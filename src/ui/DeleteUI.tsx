import { Box, Text, useApp, useInput } from 'ink';
import { useEffect, useState } from 'react';
import { runDelete } from '../commands/delete.js';
import type { DeleteOptions, DeleteResult } from '../shared/types.js';
import Spinner from './Spinner.js';

interface DeleteUIProps {
  options: DeleteOptions;
}

export default function DeleteUI({ options }: DeleteUIProps) {
  const [deleteDir, setDeleteDir] = useState(options.deleteDir);
  const [deleteGit, setDeleteGit] = useState(options.deleteGit);

  // Configuration flow
  const [configPhase, setConfigPhase] = useState<'deleteDir' | 'deleteGit' | null>(() => {
    if (options.deleteDir === undefined) return 'deleteDir';
    if (options.deleteGit === undefined) return 'deleteGit';
    return null;
  });

  const [result, setResult] = useState<DeleteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { exit } = useApp();

  useInput((_input, key) => {
    if (key.escape) exit();
  });

  useEffect(() => {
    if (configPhase !== null || loading || result || error) return;
    setLoading(true);
    runDelete({ targetDir: options.targetDir, deleteDir: deleteDir ?? false, deleteGit: deleteGit ?? false })
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
        <Text color="green">Done!</Text>
        <Text>Deleted {result.deleted} tracked file(s)</Text>
        <Text>Remote URL saved to {result.remoteFile}</Text>
        {result.emptyDirs != null && result.emptyDirs > 0 && (
          <Text>Removed {result.emptyDirs} empty director(ies)</Text>
        )}
        {result.gitMetaDeleted && <Text>Git metadata (.git) deleted — this is no longer a git repository</Text>}
        <Box marginTop={1}>
          <Text dimColor>Press Esc to exit</Text>
        </Box>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box padding={1}>
        <Spinner label="Deleting tracked files..." />
      </Box>
    );
  }

  if (configPhase === 'deleteDir') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>
          Tracked files will be deleted. Untracked files will be kept.
          {'\n'}
        </Text>
        <AskYesNo
          label="Also remove empty directories after deletion? (y/N)"
          onAnswer={(val) => {
            setDeleteDir(val);
            setConfigPhase(options.deleteGit === undefined ? 'deleteGit' : null);
          }}
        />
      </Box>
    );
  }

  if (configPhase === 'deleteGit') {
    return (
      <Box flexDirection="column" padding={1}>
        <AskYesNo
          label="Delete git metadata (.git directory)? This cannot be undone. (y/N)"
          onAnswer={(val) => {
            setDeleteGit(val);
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
