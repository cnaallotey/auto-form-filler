// Renders the site's share images and touch icon with headless Chrome.
// Usage: npm run og   (set CHROME_PATH if Chrome isn't in the default place)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const chrome = CANDIDATES.find((path) => existsSync(path));
if (!chrome) {
  console.error('Chrome not found. Set CHROME_PATH to a Chrome or Chromium binary.');
  process.exit(1);
}

const JOBS = [
  { template: 'home.html', out: 'site/og/home.png', size: [1200, 630] },
  { template: 'docs.html', out: 'site/og/docs.png', size: [1200, 630] },
  { template: 'icon.html', out: 'site/apple-touch-icon.png', size: [180, 180] },
];

// Chrome refuses to start its sandbox as root (common in Docker and CI).
const sandboxFlags = process.getuid?.() === 0 ? ['--no-sandbox'] : [];

for (const job of JOBS) {
  const out = join(root, job.out);
  mkdirSync(dirname(out), { recursive: true });
  // Remove the old image so a failed render can't pass for a fresh one.
  rmSync(out, { force: true });
  try {
    execFileSync(chrome, [
      ...sandboxFlags,
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${job.size.join(',')}`,
      // Give web fonts time to load before the screenshot
      '--virtual-time-budget=6000',
      `--screenshot=${out}`,
      pathToFileURL(join(here, job.template)).href,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (error) {
    console.error(`Chrome failed rendering ${job.template}:\n${error.stderr || error.message}`);
    process.exit(1);
  }
  if (!existsSync(out)) {
    console.error(`Chrome exited without writing ${job.out}.`);
    process.exit(1);
  }
  console.log(`${job.out} (${job.size.join('×')})`);
}
