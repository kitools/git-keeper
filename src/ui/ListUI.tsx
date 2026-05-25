import { Box, Static, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useEffect, useState } from 'react';
import { runList } from '../commands/list.js';
import type { ListOptions } from '../shared/types.js';
import { t } from '../shared/strings.js';
import type { Lang } from '../shared/strings.js';
import Spinner from './Spinner.js';

interface ListUIProps {
  options: ListOptions;
}

export default function ListUI({ options }: ListUIProps) {
  const [lang, setLang] = useState<Lang>(options.language ?? 'en');
  const [skipIgnored, setSkipIgnored] = useState(options.skipIgnored);
  const [outputFile, setOutputFile] = useState<string | undefined>(options.output);

  const [configPhase, setConfigPhase] = useState<'language' | 'ignored' | 'output' | null>(() => {
    if (options.language === undefined) return 'language';
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
    runList({ targetDir: options.targetDir, skipIgnored: skipIgnored ?? false, output: outputFile, language: lang })
      .then((res) => {
        setResult(res);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [configPhase, lang]);

  const s = t(lang);

  const dynamic = (
    <Box flexDirection="column" padding={1}>
      {configPhase === 'language' && (
        <AskLang onSelect={(l) => {
          setLang(l);
          setLog((ls) => [...ls, l === 'en' ? 'Language: English' : '语言：中文']);
          setConfigPhase(options.skipIgnored === undefined ? 'ignored' : options.output === undefined ? 'output' : null);
        }} />
      )}
      {configPhase === 'ignored' && (
        <AskYesNo
          label={s.skipGitIgnored}
          onAnswer={(val) => {
            setSkipIgnored(val);
            setLog((l) => [...l, `${s.skipGitIgnored} ${val ? s.yes : s.no}`]);
            setConfigPhase(options.output === undefined ? 'output' : null);
          }}
        />
      )}
      {configPhase === 'output' && (
        <Box flexDirection="column">
          <Text>{s.listOutputPrompt}</Text>
          <OutputPathInput
            onSubmit={(path) => {
              setOutputFile(path);
              setLog((l) => [...l, `${s.listOutputPrompt} ${path || '(skipped)'}`]);
              setConfigPhase(null);
            }}
            hint={s.pressEnterConfirm}
          />
        </Box>
      )}
      {loading && <Spinner label={lang === 'zh' ? '正在扫描未跟踪文件...' : 'Scanning untracked files...'} />}
      {error && (
        <>
          <Text color="red">Error: {error}</Text>
          <Text dimColor>{s.pressEnterExit}</Text>
        </>
      )}
      {result &&
        (result.success ? (
          <>
            <Box marginTop={1}>
              <Text bold>
                {s.foundNFiles(result.files.length, skipIgnored ?? false)}
              </Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
              {result.files.slice(0, 100).map((file) => (
                <Text key={file} dimColor>
                  {file}
                </Text>
              ))}
              {result.files.length > 100 && (
                <Text dimColor>{s.andNMoreList(result.files.length - 100)}</Text>
              )}
            </Box>
            {outputFile && <Text color="cyan">{s.exportedTo(outputFile)}</Text>}
            <Box marginTop={1}>
              <Text dimColor>{s.pressEnterExit}</Text>
            </Box>
          </>
        ) : (
          <>
            <Text color="red">Error: {result.error}</Text>
            <Text dimColor>{s.pressEnterExit}</Text>
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

function AskLang({ onSelect }: { onSelect: (lang: Lang) => void }) {
  useInput((ch, key) => {
    const c = ch.toLowerCase();
    if (c === 'e' || key.return) onSelect('en');
    else if (c === 'c') onSelect('zh');
  });

  return <Text>Language: (E)nglish / (C)hinese? (default English)</Text>;
}

function AskYesNo({ label, onAnswer }: { label: string; onAnswer: (val: boolean) => void }) {
  useInput((ch) => {
    const c = ch.toLowerCase();
    if (c === 'y') onAnswer(true);
    else if (c === 'n' || c === '\r' || c === '\n') onAnswer(false);
  });

  return <Text>{label}</Text>;
}

function OutputPathInput({ onSubmit, hint }: { onSubmit: (val: string | undefined) => void; hint?: string }) {
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
      {hint && <Text dimColor>{hint}</Text>}
    </Box>
  );
}
