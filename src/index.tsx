#!/usr/bin/env node
import { resolve } from 'node:path';
import { printDeleteResult, runDelete } from './commands/delete.js';
import { printListResult, runList } from './commands/list.js';
import { printScanResult, runScan } from './commands/scan.js';

export interface CliParsedArgs {
  command: 'delete' | 'list' | 'scan';
  path?: string;
  currentPath: boolean;
  nonInteractive: boolean;
  deleteDir?: boolean;
  deleteGit?: boolean;
  skipIgnored?: boolean;
  output?: string;
  willingDepth?: number;
  willingBreadth?: number;
  language?: 'en' | 'zh';
}

function showHelp(): void {
  process.stdout.write(`
git-keeper — Manage git repository files

USAGE
  git-keeper <command> [options]

COMMANDS
  delete    Remove all tracked files from a git repo (keeps untracked files)
  list      List untracked files in a git repo
  scan      Recursively scan a directory for all git repos and show untracked files

OPTIONS
  -p, --path <dir>         Target directory
  --current-path           Use current working directory
  -n, --non-interactive    Run without interactive UI (for automation)
  --delete-dir             (delete only) Remove empty directories after deletion
  --delete-git             (delete only) Also delete .git metadata directory
  --skip-ignored           (list, scan) Exclude .gitignore-ignored files from output
  --output <file>          (list, scan) Write output to file
  --willing-depth <n>      (scan) Max depth to search for repos from non-repo dirs (default 3)
  --willing-breadth <n>    (scan) Max sibling subdirs to check from a non-repo dir (default 500)
  --lang <en|zh>           Language for output text (default en)
  -h, --help               Show this help

EXAMPLES
  git-keeper delete -p /my/repo --delete-dir
  git-keeper list --current-path --skip-ignored
  git-keeper scan -p /workspace -n --output report.txt
`);
}

function parseArgs(): CliParsedArgs | null {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showHelp();
    return null;
  }

  const command = args[0] as CliParsedArgs['command'];
  if (!['delete', 'list', 'scan'].includes(command)) {
    process.stderr.write(`Unknown command: ${command}\n\n`);
    showHelp();
    return null;
  }

  const parsed: CliParsedArgs = {
    command,
    path: undefined,
    currentPath: false,
    nonInteractive: false,
    deleteDir: undefined,
    deleteGit: undefined,
    skipIgnored: undefined,
    output: undefined,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '-p' || arg === '--path') && i + 1 < args.length) {
      parsed.path = resolve(args[++i]);
    } else if (arg === '--current-path') {
      parsed.currentPath = true;
    } else if (arg === '-n' || arg === '--non-interactive') {
      parsed.nonInteractive = true;
    } else if (arg === '--delete-dir') {
      parsed.deleteDir = true;
    } else if (arg === '--delete-git') {
      parsed.deleteGit = true;
    } else if (arg === '--skip-ignored') {
      parsed.skipIgnored = true;
    } else if (arg === '--output' && i + 1 < args.length) {
      parsed.output = resolve(args[++i]);
    } else if (arg === '--willing-depth' && i + 1 < args.length) {
      parsed.willingDepth = Number(args[++i]);
    } else if (arg === '--willing-breadth' && i + 1 < args.length) {
      parsed.willingBreadth = Number(args[++i]);
    } else if (arg === '--lang' && i + 1 < args.length) {
      const val = args[++i];
      if (val !== 'en' && val !== 'zh') {
        process.stderr.write(`Invalid language: ${val}. Use en or zh.\n`);
        process.exit(1);
      }
      parsed.language = val;
    } else {
      process.stderr.write(`Unknown option: ${arg}\n`);
      process.exit(1);
    }
  }

  return parsed;
}

async function main(): Promise<void> {
  const parsed = parseArgs();
  if (!parsed) {
    process.exit(0);
    return;
  }

  // Determine target directory
  let targetDir: string;
  if (parsed.path) {
    targetDir = parsed.path;
  } else if (parsed.currentPath) {
    targetDir = process.cwd();
  } else if (parsed.nonInteractive) {
    process.stderr.write('Error: --non-interactive requires --path or --current-path\n');
    process.exit(1);
    return;
  } else {
    // Interactive mode: dynamically import Ink to avoid loading react-reconciler until needed
    const { startInteractive } = await import('./interactive.js');
    await startInteractive(parsed);
    return;
  }

  // Non-interactive mode: run directly
  switch (parsed.command) {
    case 'delete': {
      const result = await runDelete({
        targetDir,
        deleteDir: parsed.deleteDir ?? false,
        deleteGit: parsed.deleteGit ?? false,
      });
      printDeleteResult(result);
      break;
    }
    case 'list': {
      const result = await runList({
        targetDir,
        skipIgnored: parsed.skipIgnored ?? false,
        output: parsed.output,
        language: parsed.language,
      });
      await printListResult(result, {
        targetDir,
        skipIgnored: parsed.skipIgnored ?? false,
        output: parsed.output,
        language: parsed.language,
      });
      break;
    }
    case 'scan': {
      const result = await runScan({
        targetDir,
        skipIgnored: parsed.skipIgnored ?? false,
        output: parsed.output,
        willingDepth: parsed.willingDepth,
        willingBreadth: parsed.willingBreadth,
        language: parsed.language,
      });
      await printScanResult(result, {
        targetDir,
        skipIgnored: parsed.skipIgnored ?? false,
        output: parsed.output,
        language: parsed.language,
      });
      break;
    }
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
