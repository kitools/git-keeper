import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadGlobalConfig } from '../shared/config.js';
import { findGitRepos, getChangedFiles, getRemoteUrl, getSubmodulePaths, isGitRepo } from '../shared/git.js';
import { t } from '../shared/strings.js';
import type { Lang } from '../shared/strings.js';
import type { ScanOptions, ScanRepoEntry, ScanResult } from '../shared/types.js';

/**
 * Collect local changes for a repo and all its submodules.
 */
async function collectRepoChanged(
  repoDir: string,
  skipIgnored: boolean | undefined,
  seen: Set<string>,
  excludeDirs: string[] = [],
  ignoreFiles: string[] = [],
): Promise<ScanRepoEntry[]> {
  const results: ScanRepoEntry[] = [];

  if (seen.has(repoDir)) return results;
  seen.add(repoDir);

  // Main repo
  const main = await getChangedFiles(repoDir, skipIgnored, excludeDirs, ignoreFiles);
  let mainUrl = '';
  try { mainUrl = await getRemoteUrl(repoDir); } catch { /* no remote */ }
  results.push({
    repo: repoDir,
    modifiedTracked: main.modifiedTracked,
    untrackedFiles: [...main.untracked, ...main.ignored],
    fileCount: main.modifiedTracked.length + main.untracked.length + main.ignored.length,
    skippedDirs: [],
    hasRemote: mainUrl.length > 0,
    remoteUrl: mainUrl,
  });

  // Submodules
  const submodules = await getSubmodulePaths(repoDir);
  for (const sub of submodules) {
    const subPath = join(repoDir, sub);
    if (seen.has(subPath)) continue;
    seen.add(subPath);

    if (!(await isGitRepo(subPath))) continue;
    const subResult = await getChangedFiles(subPath, skipIgnored, excludeDirs, ignoreFiles);
    let subUrl = '';
    try { subUrl = await getRemoteUrl(subPath); } catch { /* no remote */ }
    results.push({
      repo: subPath,
      modifiedTracked: subResult.modifiedTracked,
      untrackedFiles: [...subResult.untracked, ...subResult.ignored],
      fileCount: subResult.modifiedTracked.length + subResult.untracked.length + subResult.ignored.length,
      skippedDirs: [],
      hasRemote: subUrl.length > 0,
      remoteUrl: subUrl,
    });
  }

  return results;
}

type RepoStatus = 'safe' | 'no-remote' | 'needs-review';

function getRepoStatus(repo: ScanRepoEntry): RepoStatus {
  if (!repo.hasRemote) return 'no-remote';
  if (repo.modifiedTracked.length > 0 || repo.untrackedFiles.length > 0) return 'needs-review';
  return 'safe';
}

function statusEmoji(status: RepoStatus): string {
  switch (status) {
    case 'needs-review': return '🔴';
    case 'no-remote': return '🟠';
    case 'safe': return '🟢';
  }
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
  const { repos: repoDirs, skippedDirs, nonRepoDirs } = await findGitRepos(
    targetDir,
    config.skipDirs,
    options.willingDepth ?? 3,
    options.willingBreadth ?? 500,
  );

  // Collect changed files for each, with submodule expansion
  const seen = new Set<string>();
  const allRepos: ScanRepoEntry[] = [];

  for (const repo of repoDirs) {
    const entries = await collectRepoChanged(repo, skipIgnored, seen, config.skipDirs, config.ignoreFiles);
    for (const entry of entries) {
      // Assign skipped dirs that belong to this repo
      entry.skippedDirs = skippedDirs
        .filter((d) => d.repoPath === entry.repo)
        .map((d) => ({
          ...d,
          name: d.path.slice(entry.repo.length + 1) + '/',
        }));
      allRepos.push(entry);
    }
  }

  const totalModifiedTracked = allRepos.reduce((sum, r) => sum + r.modifiedTracked.length, 0);
  const totalUntracked = allRepos.reduce((sum, r) => sum + r.untrackedFiles.length, 0);

  // Optionally write to output file
  if (options.output) {
    const lang = options.language ?? 'en';
    const lines = buildFileOutput(allRepos, nonRepoDirs, skipIgnored ?? false, config.skipDirs, config.ignoreFiles, lang);
    await writeFile(options.output, lines.join('\n'), 'utf-8');
  }

  return {
    repos: allRepos,
    totalRepos: allRepos.length,
    totalModifiedTracked,
    totalUntracked,
    skippedDirs,
    nonRepoDirs,
  };
}

function buildFileOutput(
  repos: ScanRepoEntry[],
  nonRepoDirs: ScanResult['nonRepoDirs'],
  skipIgnored: boolean,
  skipDirs: string[],
  ignoreFiles: string[],
  lang: Lang,
): string[] {
  const s = t(lang);
  const lines: string[] = [];

  // Header
  lines.push(s.fileTitle);
  lines.push(s.fileHeader);
  lines.push('');

  // Repo section
  lines.push(s.repoSectionTitle(repos.length));
  lines.push('');

  const safeRepos: string[] = [];
  const needsReviewRepos: string[] = [];

  for (const repo of repos) {
    const status = getRepoStatus(repo);
    const emoji = statusEmoji(status);
    const statusText = status === 'safe' ? s.statusSafeToDelete
      : status === 'no-remote' ? s.statusNoRemote
      : s.statusNeedsReview;

    lines.push(`### [${repo.repo}]`);
    lines.push(`- ${s.labelStatus} ${emoji} ${statusText}`);

    if (repo.hasRemote) {
      lines.push(`- ${s.labelRemoteUrl} [${repo.remoteUrl}]`);
    }

    // Modified tracked files — only if hasRemote
    if (repo.hasRemote) {
      if (repo.modifiedTracked.length > 0) {
        lines.push(`- ${s.labelModifiedTracked}: ${repo.modifiedTracked.length}`);
        for (const f of repo.modifiedTracked) {
          lines.push(`  - ${f}`);
        }
      } else {
        lines.push(`- ${s.labelModifiedTracked}: 0`);
      }
    }

    // Untracked files — always
    if (repo.untrackedFiles.length > 0) {
      lines.push(`- ${s.labelUntracked}: ${repo.untrackedFiles.length}`);
      for (const f of repo.untrackedFiles) {
        lines.push(`  - ${f}`);
      }
    } else if (repo.hasRemote) {
      // For 🟢 repos we show 0, for 🟠 we only show if > 0
      // Actually 🟠 repos show untracked if > 0, and don't show the line at all if 0
      // But 🟢 shows "0" explicitly
      lines.push(`- ${s.labelUntracked}: 0`);
    }

    // Skipped dirs
    if (repo.skippedDirs.length > 0) {
      const dirNames = [...new Set(repo.skippedDirs.map((d) => d.name))];
      lines.push(`- ${s.labelSkippedDirs}: ${dirNames.length}`);
      lines.push(`  - ${dirNames.join(', ')}`);
    }

    lines.push('');

    // Track for summary
    if (status === 'safe') safeRepos.push(repo.repo);
    else if (status === 'needs-review') needsReviewRepos.push(repo.repo);
  }

  // Non-repo section
  if (nonRepoDirs.length > 0) {
    lines.push(s.nonRepoSectionTitle(nonRepoDirs.length));
    lines.push('');

    const fullySearched = nonRepoDirs.filter((d) => d.reason === 'no-repo');
    const partialSearched = nonRepoDirs.filter((d) => d.reason !== 'no-repo');

    if (fullySearched.length > 0) {
      lines.push(s.nonRepoFullySearched(fullySearched.length));
      for (const d of fullySearched) {
        lines.push(`  - ${d.path}`);
      }
      lines.push('');
    }
    if (partialSearched.length > 0) {
      lines.push(s.nonRepoPartialSearched(partialSearched.length));
      for (const d of partialSearched) {
        lines.push(`  - [${d.reason}] ${d.path}`);
      }
      lines.push('');
    }
  }

  // Summary
  lines.push(s.summaryTitle);
  lines.push('');

  if (safeRepos.length > 0) {
    lines.push(`- ${s.summarySafeToDelete(safeRepos.length)}`);
    for (const r of safeRepos) {
      lines.push(`  - [${r}]`);
    }
  }
  const noRemoteRepos = repos.filter((r) => !r.hasRemote);
  const untrackedCount = noRemoteRepos.length + nonRepoDirs.length;
  if (untrackedCount > 0) {
    lines.push(`- ${s.summaryUntracked(untrackedCount)}`);
    for (const r of noRemoteRepos) {
      lines.push(`  - [${r.repo}]`);
    }
    for (const d of nonRepoDirs) {
      lines.push(`  - ${d.path}`);
    }
  }
  if (needsReviewRepos.length > 0) {
    lines.push(`- ${s.summaryNeedsReview(needsReviewRepos.length)}`);
    for (const r of needsReviewRepos) {
      lines.push(`  - [${r}]`);
    }
  }

  // Config section
  lines.push('');
  lines.push(s.configTitle);
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify({
    skipIgnored,
    language: lang,
    skipDirs,
    ignoreFiles,
  }, null, 2));
  lines.push('```');
  lines.push('');

  return lines;
}

/**
 * Non-interactive terminal output for scan command.
 */
export async function printScanResult(result: ScanResult, options: ScanOptions): Promise<void> {
  const lang = options.language ?? 'en';
  const s = t(lang);

  if (options.output) {
    process.stdout.write(`${s.terminalScannedOutput(result.totalRepos, result.totalUntracked, options.output)}\n`);
    return;
  }

  if (result.repos.length === 0) {
    process.stdout.write(`${s.terminalNoRepos(options.targetDir)}\n`);
  } else {
    for (const repo of result.repos) {
      const status = getRepoStatus(repo);
      const emoji = statusEmoji(status);
      const statusText = status === 'safe' ? s.statusSafeToDelete
        : status === 'no-remote' ? s.statusNoRemote
        : s.statusNeedsReview;

      const remotePart = repo.hasRemote ? ` ${repo.remoteUrl}` : '';
      process.stdout.write(`[${repo.repo}] ${emoji} ${statusText}${remotePart}\n`);

      const total = repo.modifiedTracked.length + repo.untrackedFiles.length;
      if (total === 0) continue;

      // Show first few modified tracked files
      const show = repo.modifiedTracked.slice(0, 10);
      for (const file of show) {
        process.stdout.write(`  M ${file}\n`);
      }
      if (repo.modifiedTracked.length > 10) {
        process.stdout.write(`  ${s.terminalAndNMore(repo.modifiedTracked.length - 10)}\n`);
      }

      // Show first few untracked files
      const showU = repo.untrackedFiles.slice(0, 10);
      for (const file of showU) {
        process.stdout.write(`  ? ${file}\n`);
      }
      if (repo.untrackedFiles.length > 10) {
        process.stdout.write(`  ${s.terminalAndNMore(repo.untrackedFiles.length - 10)}\n`);
      }

      // Skipped dirs on one line
      if (repo.skippedDirs.length > 0) {
        process.stdout.write(`  ${s.labelSkippedDirs}: ${[...new Set(repo.skippedDirs.map((d) => d.name))].join(', ')}\n`);
      }
    }

    process.stdout.write(`\n${s.terminalTotal(result.totalRepos, result.totalModifiedTracked, result.totalUntracked)}\n`);
  }

  // Non-repo dirs for terminal
  if (result.nonRepoDirs.length > 0) {
    const fullySearched = result.nonRepoDirs.filter((d) => d.reason === 'no-repo');
    const partialSearched = result.nonRepoDirs.filter((d) => d.reason !== 'no-repo');
    if (fullySearched.length > 0) {
      process.stdout.write(`\n${s.nonRepoFullySearched(fullySearched.length)}\n`);
      for (const d of fullySearched) {
        process.stdout.write(`  - ${d.path}\n`);
      }
    }
    if (partialSearched.length > 0) {
      process.stdout.write(`\n${s.nonRepoPartialSearched(partialSearched.length)}\n`);
      for (const d of partialSearched) {
        process.stdout.write(`  - [${d.reason}] ${d.path}\n`);
      }
    }
  }
}
