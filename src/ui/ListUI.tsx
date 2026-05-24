import { Box, Static, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useEffect, useState } from 'react';
import { runList } from '../commands/list.js';
import type { ListOptions } from '../shared/types.js';
import Spinner from './Spinner.js';

interface ListUIProps {
  options: ListOptions;
}

export default function ListUI({ options }: ListUIProps) {
  const [skipIgnored, setSkipIgnored] = useState(options.skipIgnored);
  const [outputFile, setOutputFile] = useState<string | undefined>(options.output);

  const [configPhase, setConfigPhase] = useState<'ignored' | 'output' | null>(() => {
    if (options.skipIgnored === undefined) return 'ignored';
    if (options.output === undefined) return 'output';
    return null;
  });

  const [result, setResult] = useState<{ success: boolean; files: string[]; error?: string } | null>(null);
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
    runList({ targetDir: options.targetDir, skipIgnored: skipIgnored ?? false, output: outputFile })
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
      {/* Current interactive or result content */}
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
        <Box flexDirection="column">
          <Text>Export file list to file? (optional, leave empty to skip):</Text>
          <OutputPathInput
            onSubmit={(path) => {
              setOutputFile(path);
              setLog((l) => [...l, `Export to file: ${path || '(skipped)'}`]);
              setConfigPhase(null);
            }}
          />
        </Box>
      )}
      {loading && <Spinner label="Scanning untracked files..." />}
      {error && (
        <>
          <Text color="red">Error: {error}</Text>
          <Text dimColor>Press Enter or Esc to exit</Text>
        </>
      )}
      {result &&
        (result.success ? (
          <>
            <Box marginTop={1}>
              <Text bold>
                Found {result.files.length} untracked file{result.files.length !== 1 ? 's' : ''}
                {skipIgnored ? ' (excluding git-ignored)' : ''}
              </Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
              {result.files.slice(0, 100).map((file) => (
                <Text key={file} dimColor>
                  {file}
                </Text>
              ))}
              {result.files.length > 100 && (
                <Text dimColor>... and {result.files.length - 100} more (use export to see all)</Text>
              )}
            </Box>
            {outputFile && <Text color="cyan">Exported to {outputFile}</Text>}
            <Box marginTop={1}>
              <Text dimColor>Press Enter or Esc to exit</Text>
            </Box>
          </>
        ) : (
          <>
            <Text color="red">Error: {result.error}</Text>
            <Text dimColor>Press Enter or Esc to exit</Text>
          </>
        ))}
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

function OutputPathInput({ onSubmit }: { onSubmit: (val: string | undefined) => void }) {
  const [input, setInput] = useState('');

  useInput((_input, key) => {
    if (key.escape) onSubmit(undefined);
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <TextInput
        value={input}
        onChange={setInput}
        onSubmit={(val) => onSubmit(val.trim() || undefined)}
        placeholder="/path/to/output.txt"
      />
      <Text dimColor>Press Enter to confirm, Esc to skip</Text>
    </Box>
  );
}
