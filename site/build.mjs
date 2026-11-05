// 楞嚴選注的單檔建置：資料在本區（site/data.js ＋ kepan/kepan-data.js），打包器在閱讀器。
//
//   node build.mjs
//   node build.mjs --limit 40000
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const READER = process.env.ZHU_READER || 'D:\\2026\\zhu-combined';

const step = (args, cwd) => {
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd });
  if (r.status !== 0) process.exit(r.status || 1);
};

step([path.join(ROOT, 'build', 'to-reader.mjs')], ROOT);
step([
  path.join(READER, 'build-kepan.mjs'),
  '--root', path.join(HERE, 'reader'),
  '--out', path.join(HERE, 'reader', 'surangama.html'),
  '--title', '楞嚴經選注',
  '--sub', '7家注疏 · 3部科判 ·英譯 · 速查辭典',
  ...process.argv.slice(2),
], HERE);
console.log('完成：site/reader/surangama.html');
