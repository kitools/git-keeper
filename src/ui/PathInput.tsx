import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface PathInputProps {
  onSubmit: (dir: string) => void;
  label: string;
}

export default function PathInput({ onSubmit, label }: PathInputProps) {
  const [input, setInput] = useState('');

  useInput((_input, key) => {
    if (key.escape) process.exit(0);
  });

  const handleSubmit = (value: string) => {
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text>{label}</Text>
      <Box marginTop={1}>
        <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} placeholder="/path/to/repo" />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Esc to exit</Text>
      </Box>
    </Box>
  );
}
