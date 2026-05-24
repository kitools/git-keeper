import type { CliParsedArgs } from './index.js';
import App from './ui/App.js';

export async function startInteractive(parsed: CliParsedArgs): Promise<void> {
  const { render } = await import('ink');
  const { waitUntilExit } = render(<App parsed={parsed} />);
  await waitUntilExit();
}
