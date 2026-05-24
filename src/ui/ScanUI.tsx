import { Box, Static, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useEffect, useState } from 'react';
import { runScan } from '../commands/scan.js';
import type { ScanOptions, ScanResult } from '../shared/types.js';
import Spinner from './Spinner.js';

interface ScanUIProps {
  options: ScanOptions;
}

export default function ScanUI({ options }: ScanUIProps) {
  const [skipIgnored, setSkipIgnored] = useState(options.skipIgnored);
  const [outputFile, setOutputFile] = useState<string | undefined>(options.output);

  const [configPhase, setConfigPhase] = useState<'ignored' | 'output' | null>(() => {
    if (options.skipIgnored === undefined) return 'ignored';
    if (options.output === undefined) return 'output';
    return null;
  });

  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const { exit } = useApp();

  useInput((_input, key) => {
    if (key.escape) exit();
    if (key.return && (result || error)) exit();
  });

  useEffect(() => {
    if (configPhase !== null || loading || result || error) return;
    setLoading(true);
    runScan({
      targetDir: options.targetDir,
      skipIgnored: skipIgnored ?? false,
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

  const dynamic = (
    <Box flexDirection="column" padding={1}>
      {configPhase === 'ignored' && (
        <AskYesNo
          label="Skip git-ignored files? (y/N)"
          onAnswer={(val) => {
            setSkipIgnored(val);
            setLog((l) => [...l, `Skip git-ignored files? ${val ? 'Yes' : 'No'}`]);
            setConfigPhase(options.output === undefined ? 'output' : null);
          }}
        />
      )}
      {configPhase === 'output' && (
        <AskOutputPath
          label="Export full report to file (optional, leave empty to skip):"
          onAnswer={(path) => {
            setOutputFile(path);
            setLog((l) => [...l, `Export to file: ${path || '(skipped)'}`]);
            setConfigPhase(null);
          }}
        />
      )}
      {loading && <Spinner label="Scanning repositories..." />}
      {error && (
        <>
          <Text color="red">Error: {error}</Text>
          <Text dimColor>Press Enter or Esc to exit</Text>
        </>
      )}
      {result && (
        <>
          <Box marginTop={1}>
            <Text bold>
              Found {result.totalRepos} repo source(s), {result.totalUntracked} untracked file(s) total
            </Text>
          </Box>
          <Box flexDirection="column" marginTop={1}>
            {result.totalRepos === 0 ? (
              <Text color="yellow">No git repositories found in this directory.</Text>
            ) : (() => {
              const reposWithFiles = result.repos.filter((r) => r.fileCount > 0);
              return reposWithFiles.length === 0 ? (
                <Text color="green">All {result.totalRepos} repositor(ies) are clean!</Text>
              ) : (
                reposWithFiles.map((repo) => (
                  <Box key={repo.repo} flexDirection="column" marginBottom={1}>
                    <Text color="cyan">
                      {repo.repo} ({repo.fileCount} untracked)
                    </Text>
                    {repo.files.slice(0, 10).map((file) => (
                      <Text key={file} dimColor>
                        {'  '}
                        {file}
                      </Text>
                    ))}
                    {repo.files.length > 10 && <Text dimColor> ... and {repo.files.length - 10} more</Text>}
                    {repo.skippedDirs.length > 0 && (
                      <Text color="yellow">
                        {'  '}Skipped dirs: {[...new Set(repo.skippedDirs.map((d) => d.name))].join(', ')}
                      </Text>
                    )}
                  </Box>
                ))
              );
            })()}
          </Box>
          {outputFile && <Text color="cyan">Report exported to {outputFile}</Text>}
          <Box marginTop={1}>
            <Text dimColor>Press Enter or Esc to exit</Text>
          </Box>
        </>
      )}
    </Box>
  );

  return (
    <>
      {log.length > 0 && (
        <Static items={log}>
          {(line) => <Text key={line}>{line}</Text>}
        </Static>
      )}
      {dynamic}
    </>
  );
}

function AskYesNo({ label, onAnswer }: { label: string; onAnswer: (val: boolean) => void }) {
  useInput((ch) => {
    const c = ch.toLowerCase();
    if (c === 'y') onAnswer(true);
    else if (c === 'n' || c === '\r' || c === '\n') onAnswer(false);
  });

  return <Text>{label}</Text>;
}

function AskOutputPath({ label, onAnswer }: { label: string; onAnswer: (val: string | undefined) => void }) {
  const [input, setInput] = useState('');

  useInput((_input, key) => {
    if (key.escape) onAnswer(undefined);
  });

  return (
    <Box flexDirection="column" marginTop={1}>
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
