import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface Config {
  skipDirs: string[];
}

const DEFAULT_CONFIG: Config = {
  skipDirs: ['node_modules', 'target', '__pycache__', '.venv', 'venv'],
};

const CONFIG_PATH = join(homedir(), '.git-keeper', 'git-keeper-settings.json');

/**
 * Load global config from ~/.git-keeper/git-keeper-settings.json.
 * Creates the file with defaults if it doesn't exist.
 * Merges user-defined skipDirs with defaults.
 */
export function loadGlobalConfig(): Config {
  try {
    if (!existsSync(CONFIG_PATH)) {
      mkdirSync(dirname(CONFIG_PATH), { recursive: true });
      writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
      return { ...DEFAULT_CONFIG };
    }
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.skipDirs)) {
      const merged = [...DEFAULT_CONFIG.skipDirs];
      for (const dir of parsed.skipDirs) {
        if (typeof dir === 'string' && !merged.includes(dir)) {
          merged.push(dir);
        }
      }
      return { skipDirs: merged };
    }
  } catch {
    // Invalid JSON or read error — fall through to defaults
  }
  return { ...DEFAULT_CONFIG };
}
