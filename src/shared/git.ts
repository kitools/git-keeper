import { existsSync } from 'node:fs';
import { readdir, rm, rmdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execa } from 'execa';
import type { SkippedDir } from './types.js';

/**
 * Get the remote URL for origin.
 */
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

/**
 * Get untracked files via git ls-files --others.
 * @param skipIgnored - If true, only non-ignored untracked files are returned.
 *                      If false (default), ALL untracked files including ignored are returned.
 */
export async function getUntrackedFiles(cwd: string, skipIgnored = false, excludeDirs: string[] = []): Promise<string[]> {
  const args = ['ls-files', '--others'];
  if (skipIgnored) {
    args.push('--exclude-standard');
  }
  for (const dir of excludeDirs) {
    args.push(`:(exclude)${dir}/**`);
  }
  const { stdout } = await execa('git', args, { cwd });
  return stdout.split('\n').filter(Boolean);
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
): Promise<{
  repos: string[];
  skippedDirs: SkippedDir[];
}> {
  const repos: string[] = [];
  const skippedDirs: SkippedDir[] = [];

  async function walk(dir: string, repoRoot: string | null): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    // Step 1: Check if this directory is itself a git repo
    const isRepo = entries.some((e) => e.isDirectory() && e.name === '.git');
    if (isRepo) {
      repos.push(dir);
      // Subdirectories should respect this repo's .gitignore
      repoRoot = dir;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '.git') continue;
      if (entry.name.startsWith('.')) continue;

      const fullPath = join(dir, entry.name);

      // Step 2: Check .gitignore (only when inside a known git repo)
      if (repoRoot) {
        try {
          const { exitCode } = await execa('git', ['check-ignore', fullPath], {
            cwd: repoRoot,
            reject: false,
          });
          if (exitCode === 0) {
            // Even if gitignored, still report if it's a configured skipDir
            if (skipDirs.includes(entry.name)) {
              skippedDirs.push({ path: fullPath, name: entry.name, repoPath: repoRoot ?? undefined });
            }
            continue; // gitignored, skip recursion
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

      // Step 4: Recurse
      await walk(fullPath, repoRoot);
    }
  }

  await walk(root, null);
  return { repos, skippedDirs };
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
