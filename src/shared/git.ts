import { existsSync } from 'node:fs';
import { readdir, rm, rmdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execa } from 'execa';
import type { NonRepoDir, SkippedDir } from './types.js';

/**
 * Get the remote URL for origin.
 */
/**
 * Check if the repo has a remote named 'origin'.
 */
export async function hasRemote(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await execa('git', ['remote', 'get-url', 'origin'], { cwd });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function getRemoteUrl(cwd: string): Promise<string> {
  const { stdout } = await execa('git', ['remote', 'get-url', 'origin'], { cwd });
  return stdout.trim();
}

/**
 * Check if git working tree is clean (no uncommitted changes).
 * Only checks tracked files — untracked files are ignored.
 */
export async function isGitClean(cwd: string): Promise<boolean> {
  const { stdout } = await execa('git', ['status', '--porcelain', '--untracked-files=no'], { cwd });
  return stdout.trim() === '';
}

/**
 * Get all tracked files via git ls-files.
 */
export async function getTrackedFiles(cwd: string): Promise<string[]> {
  const { stdout } = await execa('git', ['ls-files'], { cwd });
  return stdout.split('\n').filter(Boolean);
}

export interface ChangedFilesResult {
  modifiedTracked: string[];
  untracked: string[];
  ignored: string[];
}

/**
 * Get all locally changed files via git status --porcelain, split by status.
 * Returns modified tracked files, untracked files, and ignored files separately.
 * @param ignoreFiles - filenames to exclude (matched against basename)
 */
export async function getChangedFiles(
  cwd: string,
  skipIgnored = false,
  excludeDirs: string[] = [],
  ignoreFiles: string[] = [],
): Promise<ChangedFilesResult> {
  const args = ['status', '--porcelain', '-uall'];
  if (!skipIgnored) {
    args.push('--ignored');
  }
  const { stdout } = await execa('git', args, { cwd });
  const result: ChangedFilesResult = { modifiedTracked: [], untracked: [], ignored: [] };

  function acceptFile(file: string): boolean {
    // Skip directory entries
    if (file.endsWith('/')) return false;
    // Filter by excludeDirs — match any path segment
    if (excludeDirs.some((d) => file.split('/').includes(d))) return false;
    // Filter by ignoreFiles (match basename)
    const base = file.split('/').pop() || file;
    if (ignoreFiles.includes(base)) return false;
    return true;
  }

  for (const line of stdout.split('\n').filter(Boolean)) {
    const status = line.slice(0, 2);
    let file = line.slice(3);
    // Handle rename/copy: "R  old -> new"
    const arrowIdx = file.indexOf(' -> ');
    if (arrowIdx !== -1) file = file.slice(arrowIdx + 4);

    if (status === '??') {
      if (acceptFile(file)) result.untracked.push(file);
    } else if (status === '!!') {
      if (!skipIgnored && acceptFile(file)) result.ignored.push(file);
    } else {
      if (acceptFile(file)) result.modifiedTracked.push(file);
    }
  }
  return result;
}

/**
 * Get submodule paths recursively via git submodule status.
 */
export async function getSubmodulePaths(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execa('git', ['submodule', 'status', '--recursive'], { cwd });
    const paths: string[] = [];
    for (const line of stdout.split('\n')) {
      const match = line.match(/^[+\- ]?[a-f0-9]{40,}\s+(\S+)/);
      if (match) paths.push(match[1]);
    }
    return paths;
  } catch {
    return [];
  }
}

/**
 * Write remote URL to remote.txt in the repo root.
 * Returns the file path written to.
 */
export async function writeRemoteFile(cwd: string): Promise<string> {
  const url = await getRemoteUrl(cwd);
  const filePath = join(cwd, 'remote.txt');
  const finalPath = await getTimestampedPath(filePath);
  await writeFile(finalPath, url, 'utf-8');
  return finalPath;
}

export async function findGitRepos(
  root: string,
  skipDirs: string[] = ['node_modules'],
  willingDepth = 3,
  willingBreadth = 500,
): Promise<{
  repos: string[];
  skippedDirs: SkippedDir[];
  nonRepoDirs: NonRepoDir[];
}> {
  const repos: string[] = [];
  const skippedDirs: SkippedDir[] = [];
  const nonRepoDirs: NonRepoDir[] = [];

  const reportedNonRepoPaths = new Set<string>();

  function addNonRepoDir(path: string, reason: NonRepoDir['reason']): void {
    if (!reportedNonRepoPaths.has(path)) {
      reportedNonRepoPaths.add(path);
      nonRepoDirs.push({ path, reason });
    }
  }

  async function walk(
    dir: string,
    repoRoot: string | null,
    depth: number,
    chainStart: string | null,
  ): Promise<boolean> {
    // Returns true if a repo was found in this directory (or its subtree)
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return false;
    }

    // Step 1: Check if this directory is itself a git repo
    const isRepo = entries.some((e) => e.isDirectory() && e.name === '.git');
    if (isRepo) {
      repos.push(dir);
      repoRoot = dir;
      depth = 0;
      chainStart = null;
    }

    // Step 1b: Depth limit — only for non-repo dirs outside any repo
    if (!isRepo && repoRoot === null && depth > willingDepth) {
      addNonRepoDir(chainStart ?? dir, 'depth');
      return false;
    }

    // Filter subdirectories
    const subdirs: import('node:fs').Dirent[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === '.git') continue;
      if (e.name.startsWith('.')) continue;
      subdirs.push(e);
    }

    // Breadth check: outside any repo, count non-skipDirs subdirectories
    if (subdirs.length > 0 && repoRoot === null) {
      let candidateCount = 0;
      for (const e of subdirs) {
        if (!skipDirs.includes(e.name)) candidateCount++;
      }
      if (candidateCount > willingBreadth) {
        addNonRepoDir(chainStart ?? dir, 'breadth');
        return false;
      }
    }

    let foundRepo = isRepo;

    for (const entry of subdirs) {
      const fullPath = join(dir, entry.name);

      // Step 2: Check .gitignore (only when inside a known git repo)
      if (repoRoot) {
        try {
          const { exitCode } = await execa('git', ['check-ignore', fullPath], {
            cwd: repoRoot,
            reject: false,
          });
          if (exitCode === 0) {
            if (skipDirs.includes(entry.name)) {
              skippedDirs.push({ path: fullPath, name: entry.name, repoPath: repoRoot });
            }
            continue;
          }
        } catch {
          // git check-ignore errors for paths outside the repo
        }
      }

      // Step 3: Check user-configured skip directories
      if (skipDirs.includes(entry.name)) {
        skippedDirs.push({ path: fullPath, name: entry.name, repoPath: repoRoot ?? undefined });
        continue;
      }

      // Step 4: Calculate tracking for recursion
      let nextDepth = depth;
      let nextChainStart = chainStart;
      if (repoRoot === null) {
        nextDepth = depth + 1;
        if (nextChainStart === null) {
          nextChainStart = fullPath;
        }
      }

      // Step 5: Recurse
      const subFound = await walk(fullPath, repoRoot, nextDepth, nextChainStart);
      if (subFound) foundRepo = true;
    }

    // Step 6: Report non-repo chain (topmost only) if no repos found in subtree
    if (!isRepo && repoRoot === null && chainStart === dir && !foundRepo && depth > 0) {
      addNonRepoDir(dir, 'no-repo');
    }

    return foundRepo;
  }

  await walk(root, null, 0, null);
  return { repos, skippedDirs, nonRepoDirs };
}

/**
 * Recursively delete empty directories, excluding .git paths.
 */
export async function deleteEmptyDirs(dir: string): Promise<number> {
  let deletedCount = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== '.git') {
      deletedCount += await deleteEmptyDirs(join(dir, entry.name));
    }
  }
  try {
    await rmdir(dir);
    deletedCount++;
  } catch {
    // directory not empty
  }
  return deletedCount;
}

/**
 * Delete tracked files from disk.
 */
export async function deleteTrackedFiles(cwd: string, trackedFiles: string[]): Promise<number> {
  let count = 0;
  for (const file of trackedFiles) {
    try {
      await unlink(join(cwd, file));
      count++;
    } catch {
      // file may already be deleted
    }
  }
  return count;
}

/**
 * Delete the .git directory from a repository.
 */
export async function deleteGitMeta(cwd: string): Promise<boolean> {
  const gitDir = join(cwd, '.git');
  try {
    await rm(gitDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a timestamped path if the original path already exists.
 */
async function getTimestampedPath(basePath: string): Promise<string> {
  if (!existsSync(basePath)) return basePath;
  const dotIndex = basePath.lastIndexOf('.');
  if (dotIndex === -1 || (basePath.includes('/') === false && dotIndex === 0)) {
    return `${basePath}_${Date.now()}`;
  }
  const name = basePath.slice(0, dotIndex);
  const ext = basePath.slice(dotIndex);
  return `${name}_${Date.now()}${ext}`;
}

/**
 * Check if a directory is a git repository.
 */
export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await execa('git', ['rev-parse', '--git-dir'], { cwd });
    return true;
  } catch {
    return false;
  }
}
