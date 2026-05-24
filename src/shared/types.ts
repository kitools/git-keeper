export interface DeleteOptions {
  targetDir: string;
  /** undefined = prompt user; true/false = explicit choice */
  deleteDir?: boolean;
}

export interface ListOptions {
  targetDir: string;
  /** undefined = prompt user; true/false = explicit choice */
  includeIgnored?: boolean;
  output?: string;
}

export interface ScanOptions {
  targetDir: string;
  /** undefined = prompt user; true/false = explicit choice */
  includeIgnored?: boolean;
  output?: string;
}

export interface DeleteResult {
  success: boolean;
  deleted?: number;
  emptyDirs?: number;
  remoteFile?: string;
  error?: string;
}

export interface ScanRepoEntry {
  repo: string;
  files: string[];
  fileCount: number;
}

export interface ScanResult {
  repos: ScanRepoEntry[];
  totalRepos: number;
  totalUntracked: number;
}
