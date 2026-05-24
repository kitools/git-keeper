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
  includeIgnored?: boolean;
  output?: string;
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
  --include-ignored        (list, scan) Include .gitignore-ignored files
  --output <file>          (list, scan) Write output to file
  -h, --help               Show this help

EXAMPLES
  git-keeper delete -p /my/repo --delete-dir
  git-keeper list --current-path --include-ignored
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
    includeIgnored: undefined,
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
    } else if (arg === '--include-ignored') {
      parsed.includeIgnored = true;
    } else if (arg === '--output' && i + 1 < args.length) {
      parsed.output = resolve(args[++i]);
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
        includeIgnored: parsed.includeIgnored ?? false,
        output: parsed.output,
      });
      await printListResult(result, {
        targetDir,
        includeIgnored: parsed.includeIgnored ?? false,
        output: parsed.output,
      });
      break;
    }
    case 'scan': {
      const result = await runScan({
        targetDir,
        includeIgnored: parsed.includeIgnored ?? false,
        output: parsed.output,
      });
      await printScanResult(result, {
        targetDir,
        includeIgnored: parsed.includeIgnored ?? false,
        output: parsed.output,
      });
      break;
    }
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
