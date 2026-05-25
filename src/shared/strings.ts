export type Lang = 'en' | 'zh';

const _en = {
  // UI prompts
  languagePrompt: 'Language: (E)nglish / (C)hinese?',
  skipGitIgnored: 'Skip git-ignored files? (y/N)',
  saveResults: 'Save results to file? (Y/n)',
  saveDirectory: 'Save directory:',
  fileName: 'File name:',
  pressEnterExit: 'Press Enter or Esc to exit',
  pressEnterConfirm: 'Press Enter to confirm, Esc to skip',
  scanEnterPath: 'Enter root directory to scan for git repositories:',
  listEnterPath: 'Enter git repository path:',
  yes: 'Yes',
  no: 'No',

  // File output header
  fileTitle: '## Introduction',
  fileHeader: 'This file was created by [git-keeper](https://github.com/kitools/git-keeper).',

  // Repo section (file output)
  repoSectionTitle: (n: number) => `## Repositories (${n})`,
  labelStatus: 'Status',
  statusNeedsReview: 'Needs review',
  statusNoRemote: 'No remote',
  statusSafeToDelete: 'Safe to delete',
  labelRemoteUrl: 'Remote URL',
  labelModifiedTracked: 'Modified tracked files not synced to remote',
  labelUntracked: 'Untracked files',
  labelSkippedDirs: 'Skipped directories',

  // Non-repo section (file output)
  nonRepoSectionTitle: (n: number) => `## Non-repository paths (${n}) 🟠`,
  nonRepoFullySearched: (n: number) => `### Fully searched non-repo paths (${n}) 🟠`,
  nonRepoPartialSearched: (n: number) => `### Partially searched non-repo paths (${n}) 🟠`,

  // Summary (file output)
  summaryTitle: '## Summary',
  summarySafeToDelete: (n: number) => `Safe-to-delete repositories: ${n} 🟢`,
  summaryUntracked: (n: number) => `Untracked repositories or directories: ${n} 🟠`,
  summaryNeedsReview: (n: number) => `Repositories needing review: ${n} 🔴`,

  // Config section (file output)
  configTitle: '## Configuration used',

  // Terminal output
  terminalScannedOutput: (repos: number, files: number, output: string) =>
    `Scanned ${repos} repo(s), found ${files} untracked file(s). Output written to ${output}`,
  terminalNoRepos: (dir: string) => `No git repositories found in: ${dir}`,
  terminalTotal: (repos: number, modified: number, untracked: number) =>
    `Total: ${repos} repo(s), ${modified} modified tracked, ${untracked} untracked`,
  terminalAndNMore: (n: number) => `... and ${n} more`,

  // List output
  foundNFiles: (n: number, ignored: boolean) =>
    `Found ${n} untracked file${n !== 1 ? 's' : ''}${ignored ? ' (excluding git-ignored)' : ''}`,
  andNMoreList: (n: number) => `... and ${n} more (use export to see all)`,
  exportedTo: (path: string) => `Exported to ${path}`,
  wroteFiles: (n: number, path: string) => `Wrote ${n} file(s) to ${path}`,
  listOutputPrompt: 'Export file list to file? (optional, leave empty to skip):',
};

const _zh: typeof _en = {
  languagePrompt: '语言：(E)英文 / (C)中文？',
  skipGitIgnored: '跳过 git 忽略的文件？(y/N)',
  saveResults: '保存结果到文件？(Y/n)',
  saveDirectory: '保存目录：',
  fileName: '文件名：',
  pressEnterExit: '按回车或 Esc 退出',
  pressEnterConfirm: '回车确认，Esc 跳过',
  scanEnterPath: '输入要扫描的根目录：',
  listEnterPath: '输入 git 仓库路径：',
  yes: '是',
  no: '否',

  fileTitle: '## 说明',
  fileHeader: '本文件由 [git-keeper](https://github.com/kitools/git-keeper) 创建。',

  repoSectionTitle: (n: number) => `## 仓库目录 ${n} 个`,
  labelStatus: '提示',
  statusNeedsReview: '存在待检查的文件',
  statusNoRemote: '无远程地址',
  statusSafeToDelete: '可安全删除',
  labelRemoteUrl: '远程地址',
  labelModifiedTracked: '已跟踪但未同步到远程的文件数',
  labelUntracked: '未跟踪的文件',
  labelSkippedDirs: '已跳过的目录',

  nonRepoSectionTitle: (n: number) => `## 非仓库路径 ${n} 个 🟠`,
  nonRepoFullySearched: (n: number) => `### 已彻底遍历的非仓库路径 ${n} 个 🟠`,
  nonRepoPartialSearched: (n: number) => `### 未彻底遍历的非仓库路径 ${n} 个 🟠`,

  summaryTitle: '## 总结',
  summarySafeToDelete: (n: number) => `可安全删除的仓库: ${n} 个 🟢`,
  summaryUntracked: (n: number) => `未跟踪的仓库或目录: ${n} 个 🟠`,
  summaryNeedsReview: (n: number) => `需要仔细检查的仓库: ${n} 个 🔴`,

  configTitle: '## 使用的配置',

  terminalScannedOutput: (repos: number, files: number, output: string) =>
    `已扫描 ${repos} 个仓库，发现 ${files} 个未跟踪文件。输出已写入 ${output}`,
  terminalNoRepos: (dir: string) => `未找到 git 仓库：${dir}`,
  terminalTotal: (repos: number, modified: number, untracked: number) =>
    `总计：${repos} 个仓库，${modified} 个已跟踪修改，${untracked} 个未跟踪`,
  terminalAndNMore: (n: number) => `... 以及其他 ${n} 个`,

  foundNFiles: (n: number, ignored: boolean) =>
    `找到 ${n} 个未跟踪文件${ignored ? '（排除 git 忽略的）' : ''}`,
  andNMoreList: (n: number) => `... 以及其他 ${n} 个（可导出查看全部）`,
  exportedTo: (path: string) => `已导出到 ${path}`,
  wroteFiles: (n: number, path: string) => `已将 ${n} 个文件写入 ${path}`,
  listOutputPrompt: '导出文件列表到文件？（可选，留空跳过）：',
};

export const strings = { en: _en, zh: _zh };

export function t(lang: Lang): typeof _en {
  return strings[lang];
}
