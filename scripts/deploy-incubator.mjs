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
const LOCAL_INC = 'D:\\nissaya.cn\\html\\incubator';
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

const FILES = ['surangama.html', 'projects.json', 'index.html', 'check.mjs'];

const targets = [{
  id: 'primary', label: '主站', host: env.HOST, port: env.PORT || '22',
  hostkey: path.join(LOCAL, 'hostkey.txt'), dir: REMOTE_DIR,
  base: 'https://shutonggui.cn/incubator/',
}];
if (false && env.MIRROR_HOST) {
  const hk = path.join(LOCAL, `hostkey-${env.MIRROR_HOST}.txt`);
  if (fs.existsSync(hk)) targets.push({
    id: 'mirror', label: '鏡像', host: env.MIRROR_HOST, port: env.MIRROR_PORT || env.PORT || '22',
    hostkey: hk, dir: REMOTE_DIR, base: 'https://nissaya.cn/incubator/',
  });
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
      console.log(plink(`ls -l ${shq(t.dir)}/surangama.html`, '現況'));
      continue;
    }
    for (const name of FILES) {
      const local = path.join(LOCAL_INC, name);
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
      'ls -l surangama.html projects.json index.html check.mjs',
      'echo DEPLOYED',
    ].join('\n'), '切換'));
    for (const u of ['surangama.html', 'projects.json']) {
      const res = await fetch(t.base + u + '?v=' + Date.now(), { cache: 'no-store' });
      const text = await res.text();
      console.log(`${res.ok ? '✓' : '✗'} ${t.base}${u} HTTP ${res.status} ${Buffer.byteLength(text)} bytes`);
      if (u === 'projects.json') {
        const j = JSON.parse(text);
        const p = j.projects.find((x) => x.id === 'surangama');
        console.log('  surangama: ' + (p ? p.title + ' / 發起人 ' + p.initiator + ' / ' + p.url : '缺'));
      }
      if (!res.ok) die('驗證失敗 ' + t.base + u);
    }
  } finally {
    fs.rmSync(pwFile, { force: true });
  }
}
console.log('\n完成。');

