#!/usr/bin/env bun
/**
 * 交光《正脉疏科》的層級：以念覺網科判表的「甲乙丙丁…」標籤為準，
 * 用 LCS 把表格 token 對到 X273 的科文行，取表格的層級。
 *
 *   bun run scripts/build-x273-levels.ts
 *
 * 讀 data/kepan/jiaoguang-table.txt、data/works/X273.json
 * 寫 data/kepan/x273-levels.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const CH = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';

const table = readFileSync(join(DATA, 'kepan', 'jiaoguang-table.txt'), 'utf8').replace(/\r?\n/g, '');
const w = JSON.parse(readFileSync(join(DATA, 'works', 'X273.json'), 'utf8')) as { lines: { text: string }[] };

// 表格 token
const re = new RegExp('([' + CH + '])([一二三四五六七八九十]+)', 'g');
const toks: { lv: number; num: number; name: string }[] = [];
let m: RegExpExecArray | null;
let last = 0;
let lv = 0;
let num = 0;
while ((m = re.exec(table))) {
  const txt = table.slice(last, m.index).replace(/[（(]見頁[^）)]*[）)]/g, '').replace(/\[[^\]]*\]/g, '');
  if (lv) toks.push({ lv, num, name: clean(txt) });
  last = m.index + m[0].length;
  lv = CH.indexOf(m[1]) + 1;
  num = '一二三四五六七八九十'.indexOf(m[2]) + 1 || cnToInt(m[2]);
}

// X273 科文行
const lines = w.lines.map((l) => l.text.trim()).filter(Boolean);
const start = lines.findIndex((t) => t === '大分為三');
const nodes: { num: number; text: string; raw: string }[] = [];
for (let i = start; i < lines.length; i++) {
  const mm = /^([一二三四五六七八九十]+)([^一二三四五六七八九十].*)$/.exec(lines[i]);
  if (!mm) continue;
  const n = cnToInt(mm[1]);
  if (!n) continue;
  nodes.push({ num: n, text: clean(mm[2]), raw: lines[i] });
}

function clean(s: string): string {
  return (s.match(/[\u4e00-\u9fff]+/g) || []).join('');
}

function cnToInt(s: string): number {
  const D: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  if (s.length === 1) return D[s] || 0;
  if (s[0] === '十') return 10 + (D[s[1]] || 0);
  if (s[1] === '十') return (D[s[0]] || 0) * 10 + (D[s[2]] || 0);
  return 0;
}

// LCS：分數看名稱前綴或序號相同
const N = nodes.length;
const M = toks.length;
const W = M + 1;
const dp = new Int16Array((N + 1) * W);
const op = new Uint8Array((N + 1) * W); // 1=up,2=left,3=diag
function score(i: number, j: number): number {
  const a = nodes[i].text;
  const b = toks[j].name;
  if (a.length >= 2 && b.startsWith(a)) return 3;
  if (a.length >= 2 && a.slice(0, 3) === b.slice(0, 3)) return 2;
  if (nodes[i].num === toks[j].num && a.length >= 2 && b.includes(a.slice(0, 2))) return 1;
  return 0;
}
for (let i = 1; i <= N; i++) {
  for (let j = 1; j <= M; j++) {
    const s = score(i - 1, j - 1);
    let best = dp[(i - 1) * W + j];
    let o = 1;
    if (dp[i * W + (j - 1)] > best) { best = dp[i * W + (j - 1)]; o = 2; }
    if (s > 0 && dp[(i - 1) * W + (j - 1)] + s > best) { best = dp[(i - 1) * W + (j - 1)] + s; o = 3; }
    dp[i * W + j] = best;
    op[i * W + j] = o;
  }
}
const pairs: { node: number; tok: number; s: number }[] = [];
let i = N, j = M;
while (i > 0 && j > 0) {
  const o = op[i * W + j];
  if (o === 3) { pairs.push({ node: i - 1, tok: j - 1, s: score(i - 1, j - 1) }); i--; j--; }
  else if (o === 1) i--;
  else j--;
}
pairs.reverse();
const good = pairs.filter((p) => p.s > 0);
console.log(`節點 ${N}、表格 token ${M}、對上 ${good.length}`);

// 對上的節點取表格層級；缺口內依序把剩下的 token 補給節點
const lvOf: (number | null)[] = new Array(N).fill(null);
const numOf: (number | null)[] = new Array(N).fill(null);
const matched = good.filter((p) => p.s >= 2);
for (const p of matched) { lvOf[p.node] = toks[p.tok].lv; numOf[p.node] = toks[p.tok].num; }
for (let g = 0; g < matched.length; g++) {
  const a = matched[g];
  const b = g + 1 < matched.length ? matched[g + 1] : { node: N, tok: M };
  const nodeGap: number[] = [];
  for (let k = a.node + 1; k < b.node; k++) if (lvOf[k] == null) nodeGap.push(k);
  const tokGap: number[] = [];
  for (let k = a.tok + 1; k < b.tok; k++) tokGap.push(k);
  const n = Math.min(nodeGap.length, tokGap.length);
  for (let k = 0; k < n; k++) { lvOf[nodeGap[k]] = toks[tokGap[k]].lv; numOf[nodeGap[k]] = toks[tokGap[k]].num; }
}
let cur = 1;
for (let k = 0; k < N; k++) { if (lvOf[k] == null) lvOf[k] = cur; else cur = lvOf[k] as number; }

const out = nodes.map((n, k) => ({ i: k, lv: lvOf[k], num: numOf[k] ?? n.num, text: n.text }));
writeFileSync(join(DATA, 'kepan', 'x273-levels.json'), JSON.stringify({ schema: 1, matched: good.filter((p) => p.s >= 2).length, nodes: out }, null, 0) + '\n');
const idx = out.findIndex((x) => x.text.includes('無侶獨歸'));
console.log('無侶獨歸 idx', idx, 'lv', out[idx]?.lv);
const bad = out.filter((x) => x.lv > 22).length;
console.log('最深', Math.max(...out.map((x) => x.lv)), '超過22層', bad);
