import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useEffect, useState } from 'react';
import { runScan } from '../commands/scan.js';
import type { ScanOptions, ScanResult } from '../shared/types.js';
import Spinner from './Spinner.js';

interface ScanUIProps {
  options: ScanOptions;
}

export default function ScanUI({ options }: ScanUIProps) {
  const [includeIgnored, setIncludeIgnored] = useState(options.includeIgnored);
  const [outputFile, setOutputFile] = useState<string | undefined>(options.output);

  // Configuration flow: which prompt are we on?
  // 'ignored' -> 'output' -> null means done configuring
  const [configPhase, setConfigPhase] = useState<'ignored' | 'output' | null>(() => {
    if (options.includeIgnored === undefined) return 'ignored';
    if (options.output === undefined) return 'output';
    return null;
  });

  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { exit } = useApp();

  useInput((_input, key) => {
    if (key.escape) exit();
  });

  // When config is done, start the scan
  useEffect(() => {
    if (configPhase !== null || loading || result || error) return;
    setLoading(true);
    runScan({
      targetDir: options.targetDir,
      includeIgnored: includeIgnored ?? false,
      output: outputFile,
    })
      .then((res) => {
        setResult(res);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [configPhase]);

  // ----- Render states -----

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Press Esc to exit</Text>
      </Box>
    );
  }

  if (result) {
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
                {repo.files.length > 10 && <Text dimColor> ... and {repo.files.length - 10} more</Text>}
              </Box>
            ))
          )}
        </Box>
        {outputFile && <Text color="cyan">Report exported to {outputFile}</Text>}
        <Box marginTop={1}>
          <Text dimColor>Press Esc to exit</Text>
        </Box>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box padding={1}>
        <Spinner label="Scanning repositories..." />
      </Box>
    );
  }

  // ----- Configuration prompts -----

  if (configPhase === 'ignored') {
    return (
      <AskYesNo
        label="Include git-ignored files? (y/N)"
        onAnswer={(val) => {
          setIncludeIgnored(val);
          setConfigPhase(options.output === undefined ? 'output' : null);
        }}
      />
    );
  }

  if (configPhase === 'output') {
    return (
      <AskOutputPath
        label="Export full report to file (optional, leave empty to skip):"
        onAnswer={(path) => {
          setOutputFile(path);
          setConfigPhase(null);
        }}
      />
    );
  }

  return null;
}

// ----- Shared prompt components -----

function AskYesNo({ label, onAnswer }: { label: string; onAnswer: (val: boolean) => void }) {
  useInput((ch) => {
    const c = ch.toLowerCase();
    if (c === 'y') onAnswer(true);
    else if (c === 'n' || c === '\r' || c === '\n') onAnswer(false);
  });

  return (
    <Box padding={1}>
      <Text>{label}</Text>
    </Box>
  );
}

function AskOutputPath({ label, onAnswer }: { label: string; onAnswer: (val: string | undefined) => void }) {
  const [input, setInput] = useState('');

  useInput((_input, key) => {
    if (key.escape) onAnswer(undefined);
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text>{label}</Text>
      <Box marginTop={1}>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={(val) => onAnswer(val.trim() || undefined)}
          placeholder="/path/to/report.txt"
        />
      </Box>
      <Text dimColor>Press Enter to confirm, Esc to skip</Text>
    </Box>
  );
}
