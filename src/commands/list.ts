import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { getUntrackedFiles, isGitRepo } from '../shared/git.js';
import type { ListOptions } from '../shared/types.js';

export interface ListResult {
  success: boolean;
  files: string[];
  error?: string;
}

/**
 * Execute the list command: list all untracked files in a git repo.
 */
export async function runList(options: ListOptions): Promise<ListResult> {
  const { targetDir, skipIgnored } = options;

  if (!(await isGitRepo(targetDir))) {
    if (!existsSync(targetDir)) {
      return { success: false, files: [], error: `Directory does not exist: ${targetDir}` };
    }
    return { success: false, files: [], error: `Not a git repository: ${targetDir}` };
  }

  const files = await getUntrackedFiles(targetDir, skipIgnored);

  if (options.output) {
    await writeFile(options.output, files.join('\n'), 'utf-8');
  }

  return { success: true, files };
}

/**
 * Non-interactive output for list command.
 */
export async function printListResult(result: ListResult, options: ListOptions): Promise<void> {
  if (!result.success) {
    process.stderr.write(`Error: ${result.error}\n`);
    process.exit(1);
    return;
  }

  if (options.output) {
    process.stdout.write(`Wrote ${result.files.length} file(s) to ${options.output}\n`);
    return;
  }

  if (result.files.length === 0) {
    process.stdout.write('No untracked files found.\n');
    return;
  }

  for (const file of result.files) {
    process.stdout.write(`${file}\n`);
  }
}
