// 上傳 mantra prototype 到孵化區（主站＋鏡像），並更新 projects.json。
//   node scripts/deploy-incubator-mantra.mjs --check
//   node scripts/deploy-incubator-mantra.mjs
//
// 只碰 /incubator/surangama-mantra.html 與 /incubator/projects.json。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LOCAL = 'D:\\2026\\vcpp\\.local';
const PSCP = 'C:\\Program Files\\PuTTY\\pscp.exe';
const PLINK = 'C:\\Program Files\\PuTTY\\plink.exe';
const HTML = 'D:\\nissaya.cn\\html\\incubator\\surangama-mantra.html';
const PROJECTS = 'D:\\nissaya.cn\\html\\incubator\\projects.json';
const CHECK = process.argv.includes('--check');
const die = (m) => { console.error('✗ ' + m); process.exit(1); };
const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

const env = {};
for (const line of fs.readFileSync(path.join(LOCAL, 'server.env'), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
  if (m) env[m[1].toUpperCase()] = m[2].trim().replace(/^["']|["']$/g, '');
}
if (!env.HOST || !env.USER || !env.PASS) die('server.env 缺少 HOST／USER／PASS');
if (!fs.existsSync(HTML)) die('找不到 ' + HTML);
if (!fs.existsSync(PROJECTS)) die('找不到 ' + PROJECTS);

const docroot = path.posix.join(path.posix.dirname((env.DOCROOT || '/var/www/html/accelon26').replace(/\/+$/, '')), 'incubator');
const targets = [{ id: 'primary', label: '主站', host: env.HOST, port: env.PORT || '22', user: env.USER, pass: env.PASS, hostkey: path.join(LOCAL, 'hostkey.txt'), base: 'https://shutonggui.cn/incubator/' }];
if (env.MIRROR_HOST) {
  const hk = path.join(LOCAL, `hostkey-${env.MIRROR_HOST}.txt`);
  if (fs.existsSync(hk)) targets.push({ id: 'mirror', label: '鏡像', host: env.MIRROR_HOST, port: env.MIRROR_PORT || env.PORT || '22', user: env.MIRROR_USER || env.USER, pass: env.MIRROR_PASS || env.PASS, hostkey: hk, base: 'https://nissaya.cn/incubator/' });
}
if (!targets.length) die('沒有站點');

function run(cmd, label) {
  const r = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8' });
  if (r.error) die(label + '：' + r.error.message);
  if (r.status !== 0) die(label + '（exit ' + r.status + '）\n' + (r.stdout || '') + (r.stderr || ''));
  return (r.stdout || '').trim();
}

for (const t of targets) {
  console.log(`\n== ${t.label} ${t.host}:${docroot}`);
  const fp = fs.readFileSync(t.hostkey, 'utf8').trim();
  if (!/^SHA256:/.test(fp)) die(t.hostkey + ' 格式不正確');
  const pw = path.join(os.tmpdir(), `.mantra-pw-${process.pid}-${t.id}.tmp`);
  fs.writeFileSync(pw, t.pass + '\n', { mode: 0o600 });
  const remote = (script, label) => {
    const f = path.join(os.tmpdir(), `.mantra-${process.pid}-${t.id}.sh`);
    fs.writeFileSync(f, script);
    try { return run([PLINK, '-batch', '-ssh', '-P', t.port, '-l', t.user, '-hostkey', fp, '-pwfile', pw, '-m', f, t.host], label); }
    finally { fs.rmSync(f, { force: true }); }
  };
  try {
    if (CHECK) {
      console.log(remote(['cd ' + shq(docroot), 'ls -l surangama-mantra.html projects.json 2>/dev/null || true'].join('\n'), '現況'));
      continue;
    }
    run([PSCP, '-batch', '-P', t.port, '-hostkey', fp, '-pwfile', pw, HTML, `${t.user}@${t.host}:${docroot}/.tmp-surangama-mantra.html`], '上傳 HTML');
    run([PSCP, '-batch', '-P', t.port, '-hostkey', fp, '-pwfile', pw, PROJECTS, `${t.user}@${t.host}:${docroot}/.tmp-projects.json`], '上傳 projects.json');
    console.log(remote([
      'set -e', 'cd ' + shq(docroot),
      '[ -f projects.json ] && cp -f projects.json projects.json.prev || true',
      'mv -f .tmp-surangama-mantra.html surangama-mantra.html',
      'mv -f .tmp-projects.json projects.json',
      'chmod a+rX surangama-mantra.html projects.json',
      'ls -l surangama-mantra.html projects.json',
    ].join('\n'), '切換'));
    const h = await fetch(t.base + 'surangama-mantra.html?v=' + Date.now(), { cache: 'no-store' });
    const ht = await h.text();
    if (!h.ok || !ht.includes('PROTOTYPE') || !ht.includes('楞嚴咒')) die('HTML 驗證失敗 HTTP ' + h.status);
    const p = await fetch(t.base + 'projects.json?v=' + Date.now(), { cache: 'no-store' });
    const pt = await p.text();
    if (!p.ok) die('projects.json HTTP ' + p.status);
    const j = globalThis.JSON.parse(pt);
    const sur = j.projects.find((x) => x.id === 'surangama');
    const link = sur && (sur.links || []).find((l) => l.href === '/incubator/surangama-mantra.html');
    if (!link) die('projects.json 的 surangama 卡片沒有楞嚴咒連結');
    if (j.projects.some((x) => x.id === 'surangama-mantra')) die('仍有獨立的 surangama-mantra 卡片');
    console.log(`✓ ${t.base}surangama-mantra.html  HTTP ${h.status}  ${Buffer.byteLength(ht)} bytes`);
    console.log(`  掛在 surangama 之下：${link.label} → ${link.href}`);
  } finally {
    fs.rmSync(pw, { force: true });
  }
}
console.log('\n完成。');

