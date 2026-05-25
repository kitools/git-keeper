import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { Box, Static, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useEffect, useState } from 'react';
import { runScan } from '../commands/scan.js';
import type { ScanOptions, ScanResult } from '../shared/types.js';
import { t } from '../shared/strings.js';
import type { Lang } from '../shared/strings.js';
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
  const [lang, setLang] = useState<Lang>(options.language ?? 'en');
  const [skipIgnored, setSkipIgnored] = useState(options.skipIgnored);
  const [outputFile, setOutputFile] = useState<string | undefined>(options.output);
  const [saveDir, setSaveDir] = useState(getDefaultSaveDir);
  const [saveName] = useState(() => getDefaultSaveName(options.targetDir));

  const [configPhase, setConfigPhase] = useState<'language' | 'ignored' | 'savePrompt' | 'saveDir' | 'saveName' | null>(() => {
    if (options.language === undefined) return 'language';
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
      language: lang,
    })
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
        <AskLang onSelect={(chosen) => {
          setLang(chosen);
          setLog((prev) => [...prev, chosen === 'en' ? 'Language: English' : '语言：中文']);
          setConfigPhase(options.skipIgnored === undefined ? 'ignored' : options.output === undefined ? 'savePrompt' : null);
        }} />
      )}
      {configPhase === 'ignored' && (
        <AskYesNo
          label={s.skipGitIgnored}
          defaultYes={false}
          onAnswer={(val) => {
            setSkipIgnored(val);
            setLog((l) => [...l, `${s.skipGitIgnored} ${val ? s.yes : s.no}`]);
            setConfigPhase(outputFile === undefined ? 'savePrompt' : null);
          }}
        />
      )}
      {configPhase === 'savePrompt' && (
        <AskYesNo
          label={s.saveResults}
          defaultYes={true}
          onAnswer={(val) => {
            setLog((l) => [...l, `${s.saveResults} ${val ? s.yes : s.no}`]);
            setConfigPhase(val ? 'saveDir' : null);
          }}
        />
      )}
      {configPhase === 'saveDir' && (
        <AskPath
          label={s.saveDirectory}
          defaultValue={saveDir}
          onSubmit={(val) => {
            if (val) setSaveDir(val);
            setLog((l) => [...l, `${s.saveDirectory} ${val}`]);
            setConfigPhase('saveName');
          }}
          onSkip={() => setConfigPhase(null)}
          hint={s.pressEnterConfirm}
        />
      )}
      {configPhase === 'saveName' && (
        <AskPath
          label={s.fileName}
          defaultValue={saveName}
          onSubmit={(val) => {
            const finalName = val || saveName;
            const fullPath = join(saveDir, finalName);
            setOutputFile(fullPath);
            setLog((l) => [...l, `${s.fileName} ${finalName}`]);
            setConfigPhase(null);
          }}
          onSkip={() => setConfigPhase(null)}
          hint={s.pressEnterConfirm}
        />
      )}
      {loading && <Spinner label={lang === 'zh' ? '正在扫描仓库...' : 'Scanning repositories...'} />}
      {error && (
        <>
          <Text color="red">Error: {error}</Text>
          <Text dimColor>{s.pressEnterExit}</Text>
        </>
      )}
      {result && (
        <>
          <Box marginTop={1}>
            <Text bold>
              {s.terminalTotal(result.totalRepos, result.totalModifiedTracked, result.totalUntracked)}
            </Text>
          </Box>
          <Box flexDirection="column" marginTop={1}>
            {result.totalRepos === 0 ? (
              <Text color="yellow">{s.terminalNoRepos(options.targetDir)}</Text>
            ) : (
              result.repos.map((repo) => {
                const allFiles = [...repo.modifiedTracked, ...repo.untrackedFiles];
                const totalFiles = repo.modifiedTracked.length + repo.untrackedFiles.length;
                const statusEmoji = !repo.hasRemote ? '🟠' : totalFiles > 0 ? '🔴' : '🟢';
                const statusText = !repo.hasRemote ? s.statusNoRemote
                  : totalFiles > 0 ? s.statusNeedsReview : s.statusSafeToDelete;
                return (
                  <Box key={repo.repo} flexDirection="column" marginBottom={1}>
                    <Text color={totalFiles > 0 ? 'cyan' : 'green'}>
                      {repo.repo} {statusEmoji} {statusText}
                      {repo.remoteUrl ? ` ${repo.remoteUrl}` : ''}
                    </Text>
                    {totalFiles > 0 && (
                      <>
                        {allFiles.slice(0, 10).map((file) => (
                          <Text key={file} dimColor>
                            {'  '}
                            {file}
                          </Text>
                        ))}
                        {allFiles.length > 10 && <Text dimColor> {s.terminalAndNMore(allFiles.length - 10)}</Text>}
                      </>
                    )}
                    {repo.skippedDirs.length > 0 && (
                      <Text color="yellow">
                        {'  '}{s.labelSkippedDirs}: {[...new Set(repo.skippedDirs.map((d) => d.name))].join(', ')}
                      </Text>
                    )}
                  </Box>
                );
              })
            )}
          </Box>
          {outputFile && <Text color="cyan">Exported to {outputFile}</Text>}
          {result.skippedDirs.filter((d) => !d.repoPath).length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="yellow">
                Other skipped: {[...new Set(result.skippedDirs.filter((d) => !d.repoPath).map((d) => d.name))].join(', ')}
              </Text>
              <Text dimColor> Configured in ~/.git-keeper/git-keeper-settings.json</Text>
            </Box>
          )}
          {result.nonRepoDirs.length > 0 && (
            <>
              {result.nonRepoDirs.filter((d) => d.reason !== 'no-repo').length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                  <Text color="yellow">
                    {s.nonRepoPartialSearched(result.nonRepoDirs.filter((d) => d.reason !== 'no-repo').length)}
                  </Text>
                  {result.nonRepoDirs.filter((d) => d.reason !== 'no-repo').map((d) => (
                    <Text key={d.path} dimColor>
                      {'  '}[{d.reason}] {d.path}
                    </Text>
                  ))}
                </Box>
              )}
              {result.nonRepoDirs.filter((d) => d.reason === 'no-repo').length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                  <Text color="yellow">
                    {s.nonRepoFullySearched(result.nonRepoDirs.filter((d) => d.reason === 'no-repo').length)}
                  </Text>
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
            <Text dimColor>{s.pressEnterExit}</Text>
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

function AskLang({ onSelect }: { onSelect: (lang: Lang) => void }) {
  useInput((ch, key) => {
    const c = ch.toLowerCase();
    if (c === 'e' || key.return) onSelect('en');
    else if (c === 'c') onSelect('zh');
  });

  return <Text>Language: (E)nglish / (C)hinese? (default English)</Text>;
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
  hint,
}: {
  label: string;
  defaultValue: string;
  onSubmit: (val: string) => void;
  onSkip: () => void;
  hint?: string;
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
      {hint && <Text dimColor>{hint}</Text>}
    </Box>
  );
}
