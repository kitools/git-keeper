import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { Box, Static, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useEffect, useState } from 'react';
import { runScan } from '../commands/scan.js';
import type { ScanOptions, ScanResult } from '../shared/types.js';
import Spinner from './Spinner.js';

interface ScanUIProps {
  options: ScanOptions;
}

function getDefaultSaveDir(): string {
  return join(homedir(), 'Downloads');
}

function getDefaultSaveName(targetDir: string): string {
  const dirName = basename(targetDir);
  const d = new Date();
  const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  return `${dirName}-${ts}.txt`;
}

export default function ScanUI({ options }: ScanUIProps) {
  const [skipIgnored, setSkipIgnored] = useState(options.skipIgnored);
  const [outputFile, setOutputFile] = useState<string | undefined>(options.output);
  const [saveDir, setSaveDir] = useState(getDefaultSaveDir);
  const [saveName] = useState(() => getDefaultSaveName(options.targetDir));

  const [configPhase, setConfigPhase] = useState<'ignored' | 'savePrompt' | 'saveDir' | 'saveName' | null>(() => {
    if (options.skipIgnored === undefined) return 'ignored';
    if (options.output === undefined) return 'savePrompt';
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
          defaultYes={false}
          onAnswer={(val) => {
            setSkipIgnored(val);
            setLog((l) => [...l, `Skip git-ignored files? ${val ? 'Yes' : 'No'}`]);
            setConfigPhase('savePrompt');
          }}
        />
      )}
      {configPhase === 'savePrompt' && (
        <AskYesNo
          label="Save results to file? (Y/n)"
          defaultYes={true}
          onAnswer={(val) => {
            setLog((l) => [...l, `Save results to file? ${val ? 'Yes' : 'No'}`]);
            setConfigPhase(val ? 'saveDir' : null);
          }}
        />
      )}
      {configPhase === 'saveDir' && (
        <AskPath
          label="Save directory:"
          defaultValue={saveDir}
          onSubmit={(val) => {
            if (val) setSaveDir(val);
            setLog((l) => [...l, `Save directory: ${val}`]);
            setConfigPhase('saveName');
          }}
          onSkip={() => setConfigPhase(null)}
        />
      )}
      {configPhase === 'saveName' && (
        <AskPath
          label="File name:"
          defaultValue={saveName}
          onSubmit={(val) => {
            const finalName = val || saveName;
            const fullPath = join(saveDir, finalName);
            setOutputFile(fullPath);
            setLog((l) => [...l, `Output file: ${fullPath}`]);
            setConfigPhase(null);
          }}
          onSkip={() => setConfigPhase(null)}
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
            ) : (
              result.repos.map((repo) => (
                <Box key={repo.repo} flexDirection="column" marginBottom={1}>
                  {repo.fileCount > 0 ? (
                    <>
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
                    </>
                  ) : (
                    <Text color="green">
                      {repo.repo} (0 untracked)
                    </Text>
                  )}
                  {repo.skippedDirs.length > 0 && (
                    <Text color="yellow">
                      {'  '}Skipped dirs: {[...new Set(repo.skippedDirs.map((d) => d.name))].join(', ')}
                    </Text>
                  )}
                </Box>
              ))
            )}
          </Box>
          {outputFile && <Text color="cyan">Report exported to {outputFile}</Text>}
          {result.skippedDirs.filter((d) => !d.repoPath).length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="yellow">
                Other skipped: {[...new Set(result.skippedDirs.filter((d) => !d.repoPath).map((d) => d.name))].join(', ')}
              </Text>
              <Text dimColor> (configured in ~/.git-keeper/git-keeper-settings.json)</Text>
            </Box>
          )}
          {result.nonRepoDirs.length > 0 && (
            <>
              {result.nonRepoDirs.filter((d) => d.reason !== 'no-repo').length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                  <Text color="yellow">Non-repo directories (hit limits):</Text>
                  {result.nonRepoDirs.filter((d) => d.reason !== 'no-repo').map((d) => (
                    <Text key={d.path} dimColor>
                      {'  '}{d.path} (limit: {d.reason})
                    </Text>
                  ))}
                </Box>
              )}
              {result.nonRepoDirs.filter((d) => d.reason === 'no-repo').length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                  <Text color="yellow">Non-repo directories:</Text>
                  {result.nonRepoDirs.filter((d) => d.reason === 'no-repo').map((d) => (
                    <Text key={d.path} dimColor>
                      {'  '}{d.path}
                    </Text>
                  ))}
                </Box>
              )}
            </>
          )}
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

function AskYesNo({ label, onAnswer, defaultYes = false }: { label: string; onAnswer: (val: boolean) => void; defaultYes?: boolean }) {
  useInput((ch) => {
    const c = ch.toLowerCase();
    if (c === 'y') onAnswer(true);
    else if (c === 'n') onAnswer(false);
    else if (c === '\r' || c === '\n') onAnswer(defaultYes);
  });

  return <Text>{label}</Text>;
}

function AskPath({
  label,
  defaultValue,
  onSubmit,
  onSkip,
}: {
  label: string;
  defaultValue: string;
  onSubmit: (val: string) => void;
  onSkip: () => void;
}) {
  const [input, setInput] = useState(defaultValue);

  useInput((_input, key) => {
    if (key.escape) onSkip();
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{label}</Text>
      <Box marginTop={1}>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={(val) => onSubmit(val.trim() || defaultValue)}
        />
      </Box>
      <Text dimColor>Press Enter to confirm, Esc to skip</Text>
    </Box>
  );
}
