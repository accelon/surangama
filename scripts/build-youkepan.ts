#!/usr/bin/env bun
/**
 * OCR 版《大佛頂首楞嚴經（有科判）》→ 科判樹＋經文錨定。
 *
 *   bun run scripts/build-youkepan.ts
 *
 * 讀 data/kepan/youkepan-ocr.jsonl、data/sutra.json
 * 寫 data/kepan/youkepan.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const LEVELS = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';

const OCR_MAP: Record<string, string> = { 皮: '戊', 茂: '戊', 戎: '戊', 已: '己', 巳: '己', 由: '甲' };

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as { sentences: { i: number; text: string }[] };
const norm = (t: string) => t.replace(/[「」『』（）()\s，。、；：！？…—·：.,?!]/g, '').replace(/祗/g, '祇').replace(/盤/g, '槃').replace(/陁/g, '陀').replace(/減/g, '滅').replace(/灌/g, '湛');
const SN = sutra.sentences.map((s) => ({ i: s.i, n: norm(s.text) }));
const LAST = sutra.sentences[sutra.sentences.length - 1].i;

const lines: string[] = [];
if (!existsSync(join(DATA, 'kepan', 'youkepan-ocr.jsonl'))) throw new Error('no ocr');
for (const raw of readFileSync(join(DATA, 'kepan', 'youkepan-ocr.jsonl'), 'utf8').split('\n')) {
  if (!raw.trim()) continue;
  const p = JSON.parse(raw) as { page: number; text: string };
  for (const ln of p.text.split('\n')) {
    const s = ln.replace(/\s+/g, ' ').trim();
    if (s) lines.push(s);
  }
}

function lcs(a: string, b: string): number {
  const m = a.length, n = Math.min(b.length, 40);
  const dp = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    let prev = 0;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

type N = { lv: number; lab: string; nm: string; par: number | null; ch: number[]; u: number; u2: number; exact: number };
const nodes: N[] = [];
const stack: number[] = [];
let pi = 0;
let matched = 0;

const marker = new RegExp('([' + LEVELS + '])(初|二|三|四|五|六|七|八|九|十)', 'g');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const marks: { lv: number; lab: string; pos: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  const rx = new RegExp(marker.source, 'g');
  while ((m = rx.exec(line))) {
    const ch = OCR_MAP[m[1]] || m[1];
    if (!LEVELS.includes(ch)) continue;
    marks.push({ lv: LEVELS.indexOf(ch) + 1, lab: ch + m[2], pos: m.index, end: m.index + m[0].length });
  }
  if (!marks.length) continue;

  // 經文：這一行的科判之後的文字，加上後續不含標記的行
  const tail = line.slice(marks[marks.length - 1].end).replace(/^[、，,。]/, '');
  const sutraParts = [tail];
  for (let k = i + 1; k < Math.min(i + 8, lines.length); k++) {
    const nxt = lines[k];
    if (new RegExp(marker.source).test(nxt)) break;
    sutraParts.push(nxt);
  }
  const sutraText = sutraParts.join('');
  let u = -1;
  const key = norm(sutraText).slice(0, 30);
  if (key.length >= 8) {
    let best = 0;
    for (let k = pi; k < Math.min(pi + 300, SN.length); k++) {
      const n = SN[k].n;
      const m = lcs(key, n);
      const score = m / Math.max(8, Math.min(key.length, n.length));
      if (score > best) { best = score; u = k; }
      if (best >= 0.85) break;
    }
    if (best < 0.45) u = -1;
  }
  if (u >= 0) { pi = u + 1; matched++; }

  for (let j = 0; j < marks.length; j++) {
    const seg = line.slice(marks[j].end, j + 1 < marks.length ? marks[j + 1].pos : undefined);
    const nm = seg.replace(/^[、，,。]/, '').split(/[。，,]/)[0].replace(/分[一二三四五六七八九十]+$/, '').trim();
    if (!nm) continue;
    const lv = marks[j].lv;
    while (stack.length && nodes[stack[stack.length - 1]].lv >= lv) stack.pop();
    const par = stack.length ? stack[stack.length - 1] : null;
    const id = nodes.length;
    nodes.push({ lv, lab: marks[j].lab, nm: nm.slice(0, 20), par, ch: [], u: u >= 0 ? u : pi, u2: 0, exact: u >= 0 ? 1 : 0 });
    if (par != null) nodes[par].ch.push(id);
    stack.push(id);
  }
}

// 未錨：相鄰內插
const anchors = nodes.map((n, i) => ({ i, u: n.u, ok: n.exact })).filter((x) => x.ok);
for (let a = 0; a < anchors.length; a++) {
  const A = anchors[a];
  const B = a + 1 < anchors.length ? anchors[a + 1] : { i: nodes.length, u: LAST };
  for (let k = A.i + 1; k < B.i; k++) {
    if (nodes[k].exact) continue;
    nodes[k].u = Math.round(A.u + ((B.u - A.u) * (k - A.i)) / Math.max(1, B.i - A.i));
  }
}
let cur = 0;
for (const n of nodes) { if (n.u < cur) n.u = cur; cur = n.u; }
for (let i = 0; i < nodes.length; i++) nodes[i].u2 = i + 1 < nodes.length ? Math.max(nodes[i].u, nodes[i + 1].u - 1) : LAST;

console.log(`節點 ${nodes.length}，錨上 ${matched}，層 ${Math.max(...nodes.map((n) => n.lv))}，根 ${nodes.filter((n) => n.par == null).length}`);
console.log(nodes.slice(0, 8).map((n) => n.lab + n.nm.slice(0, 8) + '@' + n.u).join(' | '));
writeFileSync(join(DATA, 'kepan', 'youkepan.json'), JSON.stringify({ schema: 1, nodes: nodes.map(({ exact, ...rest }) => rest) }, null, 0) + '\n');
