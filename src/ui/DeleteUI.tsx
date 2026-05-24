import { Box, Static, Text, useApp, useInput } from 'ink';
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

  const [configPhase, setConfigPhase] = useState<'deleteDir' | 'deleteGit' | null>(() => {
    if (options.deleteDir === undefined) return 'deleteDir';
    if (options.deleteGit === undefined) return 'deleteGit';
    return null;
  });

  const [result, setResult] = useState<DeleteResult | null>(null);
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

  const dynamic = (
    <Box flexDirection="column" padding={1}>
      {configPhase === 'deleteDir' && (
        <Box flexDirection="column">
          <Text>
            Tracked files will be deleted. Untracked files will be kept.
            {'\n'}
          </Text>
          <AskYesNo
            label="Also remove empty directories after deletion? (y/N)"
            onAnswer={(val) => {
              setDeleteDir(val);
              setLog((l) => [...l, `Remove empty directories? ${val ? 'Yes' : 'No'}`]);
              setConfigPhase(options.deleteGit === undefined ? 'deleteGit' : null);
            }}
          />
        </Box>
      )}
      {configPhase === 'deleteGit' && (
        <AskYesNo
          label="Delete git metadata (.git directory)? This cannot be undone. (y/N)"
          onAnswer={(val) => {
            setDeleteGit(val);
            setLog((l) => [...l, `Delete .git metadata? ${val ? 'Yes' : 'No'}`]);
            setConfigPhase(null);
          }}
        />
      )}
      {loading && <Spinner label="Deleting tracked files..." />}
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
              <Text color="green">Done!</Text>
            </Box>
            <Text>Deleted {result.deleted} tracked file(s)</Text>
            <Text>Remote URL saved to {result.remoteFile}</Text>
            {result.emptyDirs != null && result.emptyDirs > 0 && (
              <Text>Removed {result.emptyDirs} empty director(ies)</Text>
            )}
            {result.gitMetaDeleted && (
              <Text>Git metadata (.git) deleted — this is no longer a git repository</Text>
            )}
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
