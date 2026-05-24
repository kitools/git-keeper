import { resolve } from 'node:path';
import { Box, Text } from 'ink';
import { useState } from 'react';
import type { CliParsedArgs } from '../index.js';
import DeleteUI from './DeleteUI.js';
import ListUI from './ListUI.js';
import PathInput from './PathInput.js';
import ScanUI from './ScanUI.js';

/**
 * Normalize a user-typed path: strip surrounding quotes, unescape shell
 * escape sequences (common when drag-dropping from Finder to terminal),
 * then resolve to absolute.
 */
function normalizeInputPath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Strip surrounding single or double quotes (common when copy-pasting)
  const unquoted = trimmed.replace(/^['"](.*)['"]$/, '$1');
  // Unescape backslash-escaped characters (macOS Terminal auto-escapes
  // special chars like [ ] ( ) when you drag-drop a folder into the terminal).
  // e.g. \[Tools\] → [Tools], \ space → (space)
  const commonEscapes: [RegExp, string][] = [
    [/\\\[/g, '['],
    [/\\\]/g, ']'],
    [/\\ /g, ' '],
    [/\\\(/g, '('],
    [/\\\)/g, ')'],
    [/\\!/g, '!'],
    [/\\#/g, '#'],
    [/\\\$/g, '$'],
    [/\\&/g, '&'],
    [/\\;/g, ';'],
    [/\\'/g, "'"],
    [/\\`/g, '`'],
    [/\\\|/g, '|'],
    [/\\\*/g, '*'],
    [/\\\?/g, '?'],
    [/\\\{/g, '{'],
    [/\\\}/g, '}'],
  ];
  let unescaped = unquoted;
  for (const [pattern, replacement] of commonEscapes) {
    unescaped = unescaped.replace(pattern, replacement);
  }
  return resolve(unescaped);
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
      parsed.command === 'scan' ? 'Enter root directory to scan for git repositories:' : 'Enter git repository path:';
    return <PathInput onSubmit={(dir) => setTargetDir(normalizeInputPath(dir))} label={label} />;
  }

  const common = { targetDir, nonInteractive: false };

  switch (parsed.command) {
    case 'delete':
      return <DeleteUI options={{ ...common, deleteDir: parsed.deleteDir, deleteGit: parsed.deleteGit }} />;
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
