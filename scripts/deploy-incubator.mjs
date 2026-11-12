// 部署楞嚴選注到孵化區：surangama.html + projects.json + index.html + check.mjs
//
//   node scripts/deploy-incubator.mjs --check   # 只看遠端現況
//   node scripts/deploy-incubator.mjs           # 上傳並驗證
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL = 'D:\\2026\\vcpp\\.local';
const PSCP = 'C:\\Program Files\\PuTTY\\pscp.exe';
const PLINK = 'C:\\Program Files\\PuTTY\\plink.exe';
const liveBytes = {};   // 各站抓回來的 bytes，最後要比對兩站是否一致
const REMOTE_DIR = '/var/www/html/incubator';

const CHECK = process.argv.includes('--check');
const die = (m) => { console.error('✗ ' + m); process.exit(1); };
const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

const env = {};
for (const line of fs.readFileSync(path.join(LOCAL, 'server.env'), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
  if (m) env[m[1].toUpperCase()] = m[2].trim().replace(/^["']|["']$/g, '');
}
if (!env.HOST || !env.USER || !env.PASS) die('server.env 缺少 HOST／USER／PASS');

/* 只部署本專案自己的檔。
   2026-11-12 修正三件事（照 agent-norms/incubator.md 與 AGENTS.md §4.3）：
     1. 不再上傳 `index.html`、`projects.json`、`check.mjs`——那三個是共用目錄的檔案，歸維護者。
     2. 來源改為本區建置產物（`site/reader/surangama.html`），不再從 `D:\nissaya.cn\html`
        取檔；那個目錄是網站工作區，硬規則第 1 條就是不要動它。
     3. 一併產生並上傳 `*.gz`、`*.br`（docs/brotli-release.md：shutonggui.cn 已開 brotli_static），
        並把鏡像 nissaya.cn 的 target 真的啟用（先前被 `if (false && …)` 關掉，會造成兩站不一致）。 */
const SRC = path.join(ROOT, 'site', 'reader', 'surangama.html');
const STAGE = path.join(ROOT, 'build', 'deploy');
const zlib = await import('node:zlib');
if (!fs.existsSync(SRC)) die('找不到建置產物：' + SRC + '；先跑 node site/build.mjs');
fs.mkdirSync(STAGE, { recursive: true });
const plain = fs.readFileSync(SRC);
fs.writeFileSync(path.join(STAGE, 'surangama.html'), plain);
fs.writeFileSync(path.join(STAGE, 'surangama.html.gz'),
  zlib.gzipSync(plain, { level: 9 }));
fs.writeFileSync(path.join(STAGE, 'surangama.html.br'),
  zlib.brotliCompressSync(plain, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }));
// PWA 清單與圖示：從建置產物帶來（圖示走共用的 icon-192/512.png，不覆蓋別人的檔）
for (const extra of ['surangama.webmanifest']) {
  const from = path.join(ROOT, 'site', 'reader', extra);
  if (!fs.existsSync(from)) die('找不到 ' + from);
  fs.copyFileSync(from, path.join(STAGE, extra));
}
const FILES = ['surangama.html', 'surangama.html.gz', 'surangama.html.br', 'surangama.webmanifest'];
console.log('產物：' + plain.length.toLocaleString() + ' bytes → .gz ' +
  fs.statSync(path.join(STAGE, 'surangama.html.gz')).size.toLocaleString() + '、.br ' +
  fs.statSync(path.join(STAGE, 'surangama.html.br')).size.toLocaleString());

const targets = [{
  id: 'primary', label: '主站', host: env.HOST, port: env.PORT || '22',
  hostkey: path.join(LOCAL, 'hostkey.txt'), dir: REMOTE_DIR,
  base: 'https://shutonggui.cn/incubator/',
}];
if (env.MIRROR_HOST) {
  const hk = path.join(LOCAL, `hostkey-${env.MIRROR_HOST}.txt`);
  if (fs.existsSync(hk)) targets.push({
    id: 'mirror', label: '鏡像', host: env.MIRROR_HOST, port: env.MIRROR_PORT || env.PORT || '22',
    hostkey: hk, dir: REMOTE_DIR, base: 'https://nissaya.cn/incubator/',
  });
  else console.warn('⚠ 沒有 ' + hk + '，這一次只傳主站');
} else {
  console.warn('⚠ server.env 沒有 MIRROR_HOST，這一次只傳主站');
}

function run(cmd, label) {
  const r = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8' });
  if (r.error) die(label + '：' + r.error.message);
  if (r.status !== 0) die(label + '（exit ' + r.status + '）\n' + (r.stdout || '') + (r.stderr || ''));
  return (r.stdout || '').trim();
}

for (const t of targets) {
  console.log(`\n== ${t.label} ${t.host}:${t.dir}`);
  const fp = fs.readFileSync(t.hostkey, 'utf8').trim();
  if (!/^SHA256:/.test(fp)) die(t.hostkey + ' 格式不正確');
  const pwFile = path.join(os.tmpdir(), `.surangama-pw-${process.pid}-${t.id}.tmp`);
  fs.writeFileSync(pwFile, env.PASS + '\n', { mode: 0o600 });
  const plink = (script, label) => {
    const f = path.join(os.tmpdir(), `.surangama-${process.pid}-${t.id}.sh`);
    fs.writeFileSync(f, script);
    try {
      return run([PLINK, '-batch', '-ssh', '-P', t.port, '-l', env.USER, '-hostkey', fp, '-pwfile', pwFile, '-m', f, t.host], label);
    } finally { fs.rmSync(f, { force: true }); }
  };
  try {
    if (CHECK) {
      console.log(plink(`ls -l ${shq(t.dir)}/surangama*`, '現況'));
      continue;
    }
    for (const name of FILES) {
      const local = path.join(STAGE, name);
      if (!fs.existsSync(local)) die('找不到 ' + local);
      run([PSCP, '-sftp', '-batch', '-P', t.port, '-hostkey', fp, '-pwfile', pwFile, local, `${env.USER}@${t.host}:${t.dir}/.tmp-${name}`], '上傳 ' + name);
    }
    console.log(plink([
      'set -e', 'cd ' + shq(t.dir),
      ...FILES.flatMap((n) => [
        `[ -f ${n} ] && cp -f ${n} ${n}.prev || true`,
        `mv -f .tmp-${n} ${n}`,
      ]),
      'chmod a+rX ' + FILES.join(' '),
      'ls -l ' + FILES.join(' '),
      'echo DEPLOYED',
    ].join('\n'), '切換'));
    // 驗線上：HTTP 200、大小對、而且真的是這一次改版。
    // 註：只用「未壓縮外殼」找得到東西當記號——app.js 與 kepan.js 在 gzip＋base64 的資料段裡，
    //     抓 HTML 文字是搜不到的（搜 `syncUrl` 那種會造成假失敗）。
    const res = await fetch(t.base + 'surangama.html?v=' + Date.now(), { cache: 'no-store' });
    const text = await res.text();
    const bytes = Buffer.byteLength(text);
    const marks = [['id="linkBtn"', '🔗 複製位置按鈕（index.html）'], ['.ex-more', '注文「更多」樣式（style.css）'], ["'linkBtn'", '單檔把 🔗 搬进工具群（earlyMove）']];
    const missing = marks.filter(([k]) => text.indexOf(k) < 0).map(([, n]) => n);
    console.log(`${res.ok && bytes === plain.length && !missing.length ? '✓' : '✗'} ${t.base}surangama.html HTTP ${res.status} ${bytes.toLocaleString()} bytes（本機 ${plain.length.toLocaleString()}）` +
      (missing.length ? '　缺：' + missing.join('、') : ''));
    if (!res.ok) die('驗證失敗 ' + t.base + 'surangama.html');
    if (bytes !== plain.length) die('線上大小與本機不一致：' + bytes + ' ≠ ' + plain.length);
    if (missing.length) die('線上檔不是這一次的版本（缺 ' + missing.join('、') + '）');
    liveBytes[t.id] = bytes;
  } finally {
    fs.rmSync(pwFile, { force: true });
  }
}
if (!CHECK) {
  const seen = Object.values(liveBytes);
  if (seen.length > 1 && new Set(seen).size !== 1) die('兩站大小不一致：' + seen.join(' vs '));
  if (seen.length > 1) console.log('✓ 兩站大小一致：' + seen[0].toLocaleString() + ' bytes');
}

