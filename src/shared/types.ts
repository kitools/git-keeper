export interface DeleteOptions {
  targetDir: string;
  /** undefined = prompt user; true/false = explicit choice */
  deleteDir?: boolean;
  /** undefined = prompt user; true/false = explicit choice */
  deleteGit?: boolean;
}

export interface ListOptions {
  targetDir: string;
  /** undefined = prompt user; true/false = explicit choice */
  skipIgnored?: boolean;
  output?: string;
}

export interface ScanOptions {
  targetDir: string;
  /** undefined = prompt user; true/false = explicit choice */
  skipIgnored?: boolean;
  output?: string;
  willingDepth?: number;
  willingBreadth?: number;
}

export interface DeleteResult {
  success: boolean;
  deleted?: number;
  emptyDirs?: number;
  remoteFile?: string;
  gitMetaDeleted?: boolean;
  error?: string;
}

export interface ScanRepoEntry {
  repo: string;
  files: string[];
  fileCount: number;
  skippedDirs: SkippedDir[];
  hasRemote: boolean;
}

export interface SkippedDir {
  path: string;
  name: string;
  repoPath?: string;
}

export interface NonRepoDir {
  path: string;
  reason: 'depth' | 'breadth' | 'no-repo';
}

export interface ScanResult {
  repos: ScanRepoEntry[];
  totalRepos: number;
  totalUntracked: number;
  skippedDirs: SkippedDir[];
  nonRepoDirs: NonRepoDir[];
}
