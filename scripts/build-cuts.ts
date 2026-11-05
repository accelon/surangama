#!/usr/bin/env bun
/**
 * 逐刀證據表：2,418 個 cut 的支持家數、節點數、實錨/內插、塌縮、層級、前後文。
 *
 *   bun run scripts/build-cuts.ts
 *
 * 讀 data/sutra.json、site/reader/kepan/kepan-data.js、build/sentence-split-map.tsv、
 *    data/kepan/changshui-sutra.json、data/kepan/drba.json
 * 寫 data/cuts.tsv、build/cuts-summary.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const BUILD = join(ROOT, 'build');
mkdirSync(BUILD, { recursive: true });

type OldSent = { i: number; text: string };
type Node = { id: number; lv: number; lab: string; nm: string; u: number; u2: number };
type Edition = { id: string; short: string; nodes: Node[] };

const S = (JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as { sentences: OldSent[] }).sentences;
const raw = readFileSync(join(ROOT, 'site', 'reader', 'kepan', 'kepan-data.js'), 'utf8');
const K = JSON.parse(raw.slice(raw.indexOf('=') + 1).trim().replace(/;\s*$/, '')) as { editions: Edition[] };
const ED_IDS = ['X265', 'X273', 'DRBA', 'YY', 'YY1', 'YY2', 'WJ', 'YJ', 'GD'];
const ED = K.editions.filter((e) => ED_IDS.includes(e.id));

// 新句表（給前後文與 sid）
const newRows = readFileSync(join(DATA, 'sentences.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const newText = newRows.map((r) => r[4]);
const mapRows = readFileSync(join(BUILD, 'sentence-split-map.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const newOfOld = new Int32Array(S.length);
for (const r of mapRows) newOfOld[+r[0].slice(1)] = +r[1].slice(1);

// X265 實錨 node id（照 build-changshui-sutra.ts 的順序重算）
const norm = (t: string) => t.replace(/[「」『』（）()\s，。、；：！？…—·：.]/g, '')
  .replace(/祗/g, '祇').replace(/盤/g, '槃').replace(/陁/g, '陀');
const recs = JSON.parse(readFileSync(join(DATA, 'kepan', 'changshui-sutra.json'), 'utf8')) as { kepan: string; sutra: string }[];
const SN = S.map((s) => norm(s.text));
const LEVELS = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥天地';
const marker = new RegExp('([' + LEVELS + '])(初|二|三|四|五|六|七|八|九|十)', 'g');
const exactX265 = new Set<number>();
let pi = 0;
let nid = 0;
for (const rec of recs) {
  const marks: { pos: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  const rx = new RegExp(marker.source, 'g');
  while ((m = rx.exec(rec.kepan))) marks.push({ pos: m.index, end: m.index + m[0].length });
  if (!marks.length) continue;
  let u = -1;
  const key = norm(rec.sutra);
  if (key.length >= 4) {
    for (let i = pi; i < Math.min(pi + 300, SN.length); i++) {
      const n = SN[i];
      if (n.startsWith(key.slice(0, 8)) || n.includes(key.slice(0, 8)) || (key.length >= 10 && n.includes(key.slice(2, 10))) || (key.length >= 8 && n.includes(key.slice(0, 6)))) { u = i; break; }
    }
  }
  if (u >= 0) pi = u + 1;
  for (const mk of marks) {
    const next = marks.find((x) => x.pos > mk.pos);
    const seg = rec.kepan.slice(mk.end, next ? next.pos : undefined);
    const nm = seg.split('。')[0].replace(/分[一二三四五六七八九十]+$/, '').replace(/[，、；：]$/, '').trim();
    if (!nm) continue;
    if (u >= 0) exactX265.add(nid);
    nid++;
  }
}

// DRBA 實錨（array index = node id）
const drba = JSON.parse(readFileSync(join(DATA, 'kepan', 'drba.json'), 'utf8')) as { nodes: { exact: number }[] };
const exactDrba = new Set<number>();
drba.nodes.forEach((n, i) => { if (n.exact === 1) exactDrba.add(i); });

// 收集 cut
const at = new Map<number, { ed: Edition; n: Node }[]>();
for (const ed of ED) for (const n of ed.nodes) {
  if (!at.has(n.u)) at.set(n.u, []);
  at.get(n.u)!.push({ ed, n });
}
const cuts = [...at.keys()].sort((a, b) => a - b);
const cell = (t: string) => (t || '').replace(/[\t\r\n]+/g, ' ').trim();

const head = [
  'cut_id', 'old_u', 'before_sid', 'after_sid', 'before_text', 'after_text',
  'support_editions', 'edition_list', 'support_nodes', 'max_pile', 'min_lv', 'max_lv',
  'exact_x265', 'exact_drba', 'exact_total', 'x265_nodes', 'drba_nodes', 'other_nodes',
  'collapse', 'shared', 'evidence', 'interpolated_nodes', 'kind',
];
const lines = [head.join('\t')];
const summary: any = { cuts: cuts.length, editions: ED.map((e) => e.id), support: {}, collapse: {}, levels: {} };

cuts.forEach((u, idx) => {
  const list = at.get(u)!;
  const editions = [...new Set(list.map((x) => x.ed.id))];
  const counts = new Map<string, number>();
  for (const x of list) counts.set(x.ed.id, (counts.get(x.ed.id) || 0) + 1);
  const x265 = counts.get('X265') || 0;
  const dr = counts.get('DRBA') || 0;
  let ex265 = 0, exdr = 0;
  for (const x of list) {
    if (x.ed.id === 'X265' && exactX265.has(x.n.id)) ex265++;
    if (x.ed.id === 'DRBA' && exactDrba.has(x.n.id)) exdr++;
  }
  const maxPile = Math.max(...counts.values());
  const minLv = Math.min(...list.map((x) => x.n.lv));
  const maxLv = Math.max(...list.map((x) => x.n.lv));
  const after = newOfOld[u];
  const before = after > 0 ? after - 1 : null;
  const ev = list.slice(0, 8).map((x) => `${x.ed.id}#${x.n.id}(L${x.n.lv})`).join(';') + (list.length > 8 ? `;+${list.length - 8}` : '');
  const collapse = maxPile >= 20 || list.length >= 50 ? 1 : 0;
  lines.push([
    'C' + String(idx + 1).padStart(4, '0'), String(u),
    before == null ? '' : 'S' + String(before).padStart(4, '0'),
    'S' + String(after).padStart(4, '0'),
    before == null ? '' : cell(newText[before].slice(-24)),
    cell(newText[after].slice(0, 32)),
    String(editions.length),
    [...counts.entries()].map(([id, n]) => `${id}:${n}`).join(';'),
    String(list.length), String(maxPile), String(minLv), String(maxLv),
    String(ex265), String(exdr), String(ex265 + exdr), String(x265), String(dr),
    String(list.length - x265 - dr), String(collapse), String(editions.length >= 2 ? 1 : 0), ev, String(list.length - ex265 - exdr), 'commentary',
  ].join('\t'));
  summary.support[editions.length] = (summary.support[editions.length] || 0) + 1;
  if (collapse) summary.collapse.cuts = (summary.collapse.cuts || 0) + 1;
  summary.levels[minLv] = (summary.levels[minLv] || 0) + 1;
});

writeFileSync(join(DATA, 'cuts.tsv'), lines.join('\n') + '\n');
writeFileSync(join(BUILD, 'cuts-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(`cuts ${cuts.length}; support`, summary.support, 'collapse', summary.collapse);
console.log(lines.slice(0, 4).join('\n'));
console.log('→ data/cuts.tsv, build/cuts-summary.json');

