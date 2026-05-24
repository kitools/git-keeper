import { useState } from 'react';
import { resolve } from 'node:path';
import { Box, Text } from 'ink';
import PathInput from './PathInput.js';
import DeleteUI from './DeleteUI.js';
import ListUI from './ListUI.js';
import ScanUI from './ScanUI.js';
import type { CliParsedArgs } from '../index.js';

/**
 * Normalize a user-typed path: strip surrounding quotes, resolve to absolute.
 */
function normalizeInputPath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Strip surrounding single or double quotes (common when copy-pasting)
  const unquoted = trimmed.replace(/^['"](.*)['"]$/, '$1');
  return resolve(unquoted);
}

interface AppProps {
  parsed: CliParsedArgs;
}

export default function App({ parsed }: AppProps) {
  const [targetDir, setTargetDir] = useState<string | null>(() => {
    if (parsed.path) return parsed.path;
    if (parsed.currentPath) return process.cwd();
    return null;
  });

  if (!targetDir) {
    const label =
      parsed.command === 'scan'
        ? 'Enter root directory to scan for git repositories:'
        : 'Enter git repository path:';
    return (
      <PathInput
        onSubmit={(dir) => setTargetDir(normalizeInputPath(dir))}
        label={label}
      />
    );
  }

  const common = { targetDir, nonInteractive: false };

  switch (parsed.command) {
    case 'delete':
      return <DeleteUI options={{ ...common, deleteDir: parsed.deleteDir }} />;
    case 'list':
      return <ListUI options={{ ...common, includeIgnored: parsed.includeIgnored, output: parsed.output }} />;
    case 'scan':
      return <ScanUI options={{ ...common, includeIgnored: parsed.includeIgnored, output: parsed.output }} />;
    default:
      return (
        <Box padding={1}>
          <Text>Unknown command: {parsed.command}</Text>
        </Box>
      );
  }
}
