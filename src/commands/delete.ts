import { existsSync } from 'node:fs';
import {
  deleteEmptyDirs as deleteEmptyDirsRecursive,
  deleteGitMeta,
  deleteTrackedFiles,
  getRemoteUrl,
  getTrackedFiles,
  isGitClean,
  isGitRepo,
  writeRemoteFile,
} from '../shared/git.js';
import type { DeleteOptions, DeleteResult } from '../shared/types.js';

/**
 * Execute the delete command: remove all tracked files from a git repo,
 * keeping untracked files intact.
 */
export async function runDelete(options: DeleteOptions): Promise<DeleteResult> {
  const { targetDir, deleteDir, deleteGit } = options;

  if (!(await isGitRepo(targetDir))) {
    if (!existsSync(targetDir)) {
      return { success: false, error: `Directory does not exist: ${targetDir}` };
    }
    return { success: false, error: `Not a git repository: ${targetDir}` };
  }

  // 1. Check remote origin exists
  try {
    await getRemoteUrl(targetDir);
  } catch {
    return { success: false, error: 'No remote origin configured. Aborting for safety.' };
  }

  // 2. Check no uncommitted changes
  if (!(await isGitClean(targetDir))) {
    return { success: false, error: 'Repository has uncommitted changes. Please commit or stash first.' };
  }

  // 3. Write remote URL to file
  const remoteFile = await writeRemoteFile(targetDir);

  // 4. Get and delete all tracked files
  const trackedFiles = await getTrackedFiles(targetDir);
  const deleted = await deleteTrackedFiles(targetDir, trackedFiles);

  // 5. Optionally remove empty directories
  let emptyDirs = 0;
  if (deleteDir) {
    emptyDirs = await deleteEmptyDirsRecursive(targetDir);
  }

  // 6. Optionally delete git metadata (.git)
  let gitMetaDeleted = false;
  if (deleteGit) {
    gitMetaDeleted = await deleteGitMeta(targetDir);
  }

  return { success: true, deleted, emptyDirs, remoteFile, gitMetaDeleted };
}

/**
 * Non-interactive output for delete command.
 */
export function printDeleteResult(result: DeleteResult): void {
  if (!result.success) {
    process.stderr.write(`Error: ${result.error}\n`);
    process.exit(1);
    return;
  }
  const parts: string[] = [`Deleted ${result.deleted} tracked file(s)`, `Remote URL saved to ${result.remoteFile}`];
  if (result.emptyDirs && result.emptyDirs > 0) {
    parts.push(`Removed ${result.emptyDirs} empty director(ies)`);
  }
  if (result.gitMetaDeleted) {
    parts.push('Git metadata (.git) deleted');
  }
  process.stdout.write(`${parts.join('\n')}\n`);
}
