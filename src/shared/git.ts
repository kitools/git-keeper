import { execa } from 'execa';
import { existsSync } from 'node:fs';
import { readdir, rm, rmdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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
 */
export async function getUntrackedFiles(cwd: string, includeIgnored = false): Promise<string[]> {
  const args = ['ls-files', '--others', '--exclude-standard'];
  if (includeIgnored) {
    args.push('--ignored');
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

/**
 * Recursively find all Git repos under a root directory.
 * Skips hidden directories (starting with .) except the root itself.
 */
export async function findGitRepos(root: string): Promise<string[]> {
  const repos: string[] = [];
  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const hasGit = entries.some((e) => e.isDirectory() && e.name === '.git');
    if (hasGit) {
      repos.push(dir);
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await walk(join(dir, entry.name));
      }
    }
  }
  await walk(root);
  return repos;
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
  if (dotIndex === -1 || basePath.includes('/') === false && dotIndex === 0) {
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
