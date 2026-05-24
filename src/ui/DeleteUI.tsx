import { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from './Spinner.js';
import { runDelete } from '../commands/delete.js';
import type { DeleteOptions, DeleteResult } from '../shared/types.js';

interface DeleteUIProps {
  options: DeleteOptions;
}

export default function DeleteUI({ options }: DeleteUIProps) {
  const [result, setResult] = useState<DeleteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const { exit } = useApp();

  useEffect(() => {
    runDelete(options).then((res) => {
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
        <Spinner label="Deleting tracked files..." />
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

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="green">Done!</Text>
      <Text>Deleted {result.deleted} tracked file(s)</Text>
      <Text>Remote URL saved to {result.remoteFile}</Text>
      {result.emptyDirs != null && result.emptyDirs > 0 && (
        <Text>Removed {result.emptyDirs} empty director(ies)</Text>
      )}
      <Box marginTop={1}>
        <Text dimColor>Press Esc or Enter to exit</Text>
      </Box>
    </Box>
  );
}
