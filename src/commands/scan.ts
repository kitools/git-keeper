import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadGlobalConfig } from '../shared/config.js';
import { findGitRepos, getSubmodulePaths, getUntrackedFiles, isGitRepo } from '../shared/git.js';
import type { ScanOptions, ScanRepoEntry, ScanResult } from '../shared/types.js';

/**
 * Get untracked files for a repo and all its submodules.
 */
async function collectRepoUntracked(
  repoDir: string,
  skipIgnored: boolean | undefined,
  seen: Set<string>,
  excludeDirs: string[] = [],
): Promise<ScanRepoEntry[]> {
  const results: ScanRepoEntry[] = [];

  if (seen.has(repoDir)) return results;
  seen.add(repoDir);

  // Main repo files
  const files = await getUntrackedFiles(repoDir, skipIgnored, excludeDirs);
  results.push({ repo: repoDir, files, fileCount: files.length, skippedDirs: [] });

  // Submodules
  const submodules = await getSubmodulePaths(repoDir);
  for (const sub of submodules) {
    const subPath = join(repoDir, sub);
    if (seen.has(subPath)) continue;
    seen.add(subPath);

    if (!(await isGitRepo(subPath))) continue;
    const subFiles = await getUntrackedFiles(subPath, skipIgnored, excludeDirs);
    results.push({ repo: subPath, files: subFiles, fileCount: subFiles.length, skippedDirs: [] });
  }

  return results;
}

/**
 * Execute the scan command: recursively find all git repos under a root directory
 * and list untracked files in each, including submodules.
 */
export async function runScan(options: ScanOptions): Promise<ScanResult> {
  const { targetDir, skipIgnored } = options;

  if (!existsSync(targetDir)) {
    throw new Error(`Directory does not exist: ${targetDir}`);
  }

  // Load global config for skip dirs
  const config = loadGlobalConfig();

  // Find all top-level git repos
  const { repos: repoDirs, skippedDirs } = await findGitRepos(targetDir, config.skipDirs);

  // Collect untracked files for each, with submodule expansion
  const seen = new Set<string>();
  const allRepos: ScanRepoEntry[] = [];

  for (const repo of repoDirs) {
    const entries = await collectRepoUntracked(repo, skipIgnored, seen, config.skipDirs);
    for (const entry of entries) {
      // Assign skipped dirs that belong to this repo
      entry.skippedDirs = skippedDirs.filter((d) => d.repoPath === entry.repo);
      allRepos.push(entry);
    }
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
      if (repo.skippedDirs.length > 0) {
        lines.push(`  Skipped: ${[...new Set(repo.skippedDirs.map((d) => d.name))].join(', ')}`);
      }
    }
    await writeFile(options.output, lines.join('\n'), 'utf-8');
  }

  return { repos: allRepos, totalRepos: allRepos.length, totalUntracked, skippedDirs };
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
    if (repo.skippedDirs.length > 0) {
      process.stdout.write(`  Skipped: ${[...new Set(repo.skippedDirs.map((d) => d.name))].join(', ')}\n`);
    }
  }

  process.stdout.write(`\nTotal: ${result.totalRepos} repo(s), ${result.totalUntracked} untracked file(s)\n`);
}
