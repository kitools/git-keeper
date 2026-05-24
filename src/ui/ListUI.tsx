import { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from './Spinner.js';
import { runList } from '../commands/list.js';
import type { ListOptions } from '../shared/types.js';

interface ListUIProps {
  options: ListOptions;
}

export default function ListUI({ options }: ListUIProps) {
  const [result, setResult] = useState<{ success: boolean; files: string[]; error?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const { exit } = useApp();

  useEffect(() => {
    runList(options).then((res) => {
      setResult(res);
      setLoading(false);
    });
  }, [options]);

  useInput((_input, key) => {
    if (key.escape || key.return) exit();
  });

  if (loading) {
    return (
      <Box padding={1}>
        <Spinner label="Scanning untracked files..." />
      </Box>
    );
  }

  if (!result?.success) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {result?.error}</Text>
        <Text dimColor>Press Esc or Enter to exit</Text>
      </Box>
    );
  }

  const files = result.files;
  const displayFiles = files.slice(0, 100);
  const remaining = files.length - displayFiles.length;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>
        Found {files.length} untracked file{files.length !== 1 ? 's' : ''}
        {options.includeIgnored ? ' (including ignored)' : ''}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {displayFiles.map((file, i) => (
          <Text key={i} dimColor>
            {file}
          </Text>
        ))}
        {remaining > 0 && <Text dimColor>... and {remaining} more (use --output to export all)</Text>}
      </Box>
      {options.output && (
        <Text color="cyan">Exported to {options.output}</Text>
      )}
      <Box marginTop={1}>
        <Text dimColor>Press Esc or Enter to exit</Text>
      </Box>
    </Box>
  );
}
