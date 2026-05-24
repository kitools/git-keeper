import { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from './Spinner.js';
import { runScan } from '../commands/scan.js';
import type { ScanOptions, ScanResult } from '../shared/types.js';

interface ScanUIProps {
  options: ScanOptions;
}

export default function ScanUI({ options }: ScanUIProps) {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { exit } = useApp();

  useEffect(() => {
    runScan(options)
      .then((res) => {
        setResult(res);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [options]);

  useInput((_input, key) => {
    if (key.escape || key.return) exit();
  });

  if (loading) {
    return (
      <Box padding={1}>
        <Spinner label="Scanning repositories..." />
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Press Esc or Enter to exit</Text>
      </Box>
    );
  }

  if (!result) {
    return (
      <Box padding={1}>
        <Text color="red">Scan failed</Text>
      </Box>
    );
  }

  const reposWithFiles = result.repos.filter((r) => r.fileCount > 0);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>
        Found {result.totalRepos} repo source(s), {result.totalUntracked} untracked file(s) total
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {result.totalRepos === 0 ? (
          <Text color="yellow">No git repositories found in this directory.</Text>
        ) : reposWithFiles.length === 0 ? (
          <Text color="green">All {result.totalRepos} repositor(ies) are clean!</Text>
        ) : (
          reposWithFiles.map((repo, i) => (
            <Box key={i} flexDirection="column" marginBottom={1}>
              <Text color="cyan">
                {repo.repo} ({repo.fileCount} untracked)
              </Text>
              {repo.files.slice(0, 10).map((file, j) => (
                <Text key={j} dimColor>
                  {'  '}
                  {file}
                </Text>
              ))}
              {repo.files.length > 10 && (
                <Text dimColor>  ... and {repo.files.length - 10} more</Text>
              )}
            </Box>
          ))
        )}
      </Box>
      {options.output && <Text color="cyan">Report exported to {options.output}</Text>}
      <Box marginTop={1}>
        <Text dimColor>Press Esc or Enter to exit</Text>
      </Box>
    </Box>
  );
}
