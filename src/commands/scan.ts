import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findGitRepos, getSubmodulePaths, getUntrackedFiles, isGitRepo } from '../shared/git.js';
import type { ScanOptions, ScanRepoEntry, ScanResult } from '../shared/types.js';

/**
 * Get untracked files for a repo and all its submodules.
 */
async function collectRepoUntracked(
  repoDir: string,
  includeIgnored: boolean,
  seen: Set<string>,
): Promise<ScanRepoEntry[]> {
  const results: ScanRepoEntry[] = [];

  if (seen.has(repoDir)) return results;
  seen.add(repoDir);

  // Main repo files
  const files = await getUntrackedFiles(repoDir, includeIgnored);
  results.push({ repo: repoDir, files, fileCount: files.length });

  // Submodules
  const submodules = await getSubmodulePaths(repoDir);
  for (const sub of submodules) {
    const subPath = join(repoDir, sub);
    if (seen.has(subPath)) continue;
    seen.add(subPath);

    if (!(await isGitRepo(subPath))) continue;
    const subFiles = await getUntrackedFiles(subPath, includeIgnored);
    results.push({ repo: subPath, files: subFiles, fileCount: subFiles.length });
  }

  return results;
}

/**
 * Execute the scan command: recursively find all git repos under a root directory
 * and list untracked files in each, including submodules.
 */
export async function runScan(options: ScanOptions): Promise<ScanResult> {
  const { targetDir, includeIgnored } = options;

  if (!existsSync(targetDir)) {
    return { repos: [], totalRepos: 0, totalUntracked: 0 };
  }

  // Find all top-level git repos
  const repoDirs = await findGitRepos(targetDir);

  // Collect untracked files for each, with submodule expansion
  const seen = new Set<string>();
  const allRepos: ScanRepoEntry[] = [];

  for (const repo of repoDirs) {
    const entries = await collectRepoUntracked(repo, includeIgnored, seen);
    allRepos.push(...entries);
  }

  const totalUntracked = allRepos.reduce((sum, r) => sum + r.fileCount, 0);

  // Optionally write to output file
  if (options.output) {
    const lines: string[] = [];
    for (const repo of allRepos) {
      lines.push(`[${repo.repo}] (${repo.fileCount} untracked)`);
      for (const file of repo.files) {
        lines.push(`  ${file}`);
      }
    }
    await writeFile(options.output, lines.join('\n'), 'utf-8');
  }

  return { repos: allRepos, totalRepos: allRepos.length, totalUntracked };
}

/**
 * Non-interactive output for scan command.
 */
export async function printScanResult(result: ScanResult, options: ScanOptions): Promise<void> {
  if (options.output) {
    process.stdout.write(
      `Scanned ${result.totalRepos} repo(s), found ${result.totalUntracked} untracked file(s). Output written to ${options.output}\n`,
    );
    return;
  }

  if (result.repos.length === 0) {
    process.stdout.write(`No git repositories found in: ${options.targetDir}\n`);
    return;
  }

  for (const repo of result.repos) {
    process.stdout.write(`[${repo.repo}] ${repo.fileCount} untracked\n`);
    for (const file of repo.files.slice(0, 10)) {
      process.stdout.write(`  ${file}\n`);
    }
    if (repo.files.length > 10) {
      process.stdout.write(`  ... and ${repo.files.length - 10} more\n`);
    }
  }

  process.stdout.write(`\nTotal: ${result.totalRepos} repo(s), ${result.totalUntracked} untracked file(s)\n`);
}
