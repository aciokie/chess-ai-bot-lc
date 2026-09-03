import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const DIST_DIR = resolve('dist');
const SRC_FILE = resolve('chess-ai-bot.user.js');

function build() {
  if (!existsSync(DIST_DIR)) {
    mkdirSync(DIST_DIR, { recursive: true });
  }

  let content = readFileSync(SRC_FILE, 'utf-8');

  const version = content.match(/@version\s+([\d.]+)/)?.[1] || '1.0.0';
  const timestamp = new Date().toISOString();

  content = content.replace(
    /\/\/ @version\s+[\d.]+/,
    `// @version      ${version}`
  );

  content = `// Build: ${timestamp}\n// Version: ${version}\n\n${content}`;

  const outputFile = resolve(DIST_DIR, `chess-ai-bot-v${version}.user.js`);
  writeFileSync(outputFile, content);

  const latestFile = resolve(DIST_DIR, 'chess-ai-bot.user.js');
  writeFileSync(latestFile, content);

  console.log(`Built: ${outputFile}`);
  console.log(`Latest: ${latestFile}`);

  const stats = {
    version,
    timestamp,
    size: content.length,
    lines: content.split('\n').length
  };

  writeFileSync(resolve(DIST_DIR, 'build-info.json'), JSON.stringify(stats, null, 2));
}

build();