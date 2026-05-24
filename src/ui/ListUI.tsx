import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useEffect, useState } from 'react';
import { runList } from '../commands/list.js';
import type { ListOptions } from '../shared/types.js';
import Spinner from './Spinner.js';

interface ListUIProps {
  options: ListOptions;
}

export default function ListUI({ options }: ListUIProps) {
  const [includeIgnored, setIncludeIgnored] = useState(options.includeIgnored);
  const [outputFile, setOutputFile] = useState<string | undefined>(options.output);

  const [configPhase, setConfigPhase] = useState<'ignored' | 'output' | null>(() => {
    if (options.includeIgnored === undefined) return 'ignored';
    if (options.output === undefined) return 'output';
    return null;
  });

  const [result, setResult] = useState<{ success: boolean; files: string[]; error?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { exit } = useApp();

  useInput((_input, key) => {
    if (key.escape) exit();
  });

  useEffect(() => {
    if (configPhase !== null || loading || result || error) return;
    setLoading(true);
    runList({ targetDir: options.targetDir, includeIgnored: includeIgnored ?? false, output: outputFile })
      .then((res) => {
        setResult(res);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [configPhase]);

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Press Esc to exit</Text>
      </Box>
    );
  }

  if (result) {
    const files = result.files;
    const displayFiles = files.slice(0, 100);
    const remaining = files.length - displayFiles.length;

    if (!result.success) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text color="red">Error: {result.error}</Text>
          <Text dimColor>Press Esc to exit</Text>
        </Box>
      );
    }

    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>
          Found {files.length} untracked file{files.length !== 1 ? 's' : ''}
          {includeIgnored ? ' (including ignored)' : ''}
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {displayFiles.map((file, i) => (
            <Text key={i} dimColor>
              {file}
            </Text>
          ))}
          {remaining > 0 && <Text dimColor>... and {remaining} more (use export to see all)</Text>}
        </Box>
        {outputFile && <Text color="cyan">Exported to {outputFile}</Text>}
        <Box marginTop={1}>
          <Text dimColor>Press Esc to exit</Text>
        </Box>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box padding={1}>
        <Spinner label="Scanning untracked files..." />
      </Box>
    );
  }

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
      <Box flexDirection="column" padding={1}>
        <Text>Export file list to file? (optional, leave empty to skip):</Text>
        <OutputPathInput
          onSubmit={(path) => {
            setOutputFile(path);
            setConfigPhase(null);
          }}
        />
      </Box>
    );
  }

  return null;
}

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
