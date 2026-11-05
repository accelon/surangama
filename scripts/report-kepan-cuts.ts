#!/usr/bin/env bun
/**
 * 以閱讀器現有科判（site/reader/kepan/kepan-data.js）的節點起點為切刀，
 * 計算經文的最小分段數與段長統計。
 *
 *   bun run scripts/report-kepan-cuts.ts
 *
 * 讀 data/sutra.json、site/reader/kepan/kepan-data.js
 * 寫 data/kepan-segments.tsv、build/kepan-cuts-summary.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const BUILD = join(ROOT, 'build');
mkdirSync(BUILD, { recursive: true });

type Sent = { i: number; juan: number; page: string; text: string; start: number; end: number };
type Node = { id: number; lv: number; lab: string; nm: string; u: number; u2: number };
type Edition = { id: string; short: string; nodes: Node[] };

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as { sentences: Sent[]; normLen: number };
const S = sutra.sentences;
const N = S.length;
const han = S.map((s) => (s.text.match(/\p{Script=Han}/gu) || []).length);

const raw = readFileSync(join(ROOT, 'site', 'reader', 'kepan', 'kepan-data.js'), 'utf8');
const K = JSON.parse(raw.slice(raw.indexOf('=') + 1).trim().replace(/;\s*$/, '')) as { editions: Edition[] };

const cutsByEdition = new Map<string, Set<number>>();
for (const ed of K.editions) cutsByEdition.set(ed.id, new Set(ed.nodes.map((n) => n.u)));

const union = new Set<number>();
for (const set of cutsByEdition.values()) for (const u of set) union.add(u);

// 0 與卷末一定算邊界；u=0 的節點不另外加。
const cuts = [...union].sort((a, b) => a - b);
const bounds = [...new Set([0, ...cuts.filter((u) => u > 0), N])].sort((a, b) => a - b);
const segs: { a: number; b: number; sent: number; chars: number; juan: number }[] = [];
for (let i = 0; i < bounds.length - 1; i++) {
  const a = bounds[i];
  const b = bounds[i + 1];
  segs.push({
    a, b,
    sent: b - a,
    chars: han.slice(a, b).reduce((x, y) => x + y, 0),
    juan: S[a].juan,
  });
}

function quantile(a: number[], p: number): number {
  const s = [...a].sort((x, y) => x - y);
  const i = Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))));
  return s[i];
}
function stats(lens: number[]) {
  const a = [...lens].sort((x, y) => x - y);
  const n = a.length;
  const sum = a.reduce((x, y) => x + y, 0);
  return {
    n, sum,
    min: a[0], max: a.at(-1)!,
    mean: +(sum / n).toFixed(2),
    p10: quantile(a, 0.1), p25: quantile(a, 0.25), median: quantile(a, 0.5),
    p75: quantile(a, 0.75), p90: quantile(a, 0.9), p95: quantile(a, 0.95), p99: quantile(a, 0.99),
  };
}

const sentStats = stats(segs.map((s) => s.sent));
const charStats = stats(segs.map((s) => s.chars));

const sentHist = new Map<number, number>();
for (const s of segs) sentHist.set(s.sent, (sentHist.get(s.sent) || 0) + 1);

const charBins: [number, number][] = [[1, 10], [11, 20], [21, 30], [31, 40], [41, 50], [51, 75], [76, 100], [101, 200], [201, 99999]];
const charHist = charBins.map(([lo, hi]) => ({ lo, hi, n: segs.filter((s) => s.chars >= lo && s.chars <= hi).length }));

const perEdition = K.editions.map((ed) => {
  const set = cutsByEdition.get(ed.id)!;
  const pile = new Map<number, number>();
  for (const n of ed.nodes) pile.set(n.u, (pile.get(n.u) || 0) + 1);
  const top = [...pile.entries()].sort((a, b) => b[1] - a[1])[0];
  const others = new Set<number>();
  for (const [id, x] of cutsByEdition) if (id !== ed.id) for (const u of x) others.add(u);
  return {
    id: ed.id, short: ed.short,
    nodes: ed.nodes.length,
    distinct: set.size,
    maxPile: top[1],
    maxPileU: top[0],
    marginal: [...set].filter((u) => !others.has(u)).length,
  };
});

// 27 分節（蒙鈔目錄）作對照
const ka = JSON.parse(readFileSync(join(DATA, 'ke-anchors.json'), 'utf8')) as { sections: { startU: number }[] };
const sectionCuts = new Set(ka.sections.map((s) => s.startU));
const sectionOnlyAdds = [...sectionCuts].filter((u) => !union.has(u)).sort((a, b) => a - b);

// 只取子璿＋宣化的「實錨」節點（子璿重算 exact；宣化讀 exact 欄）
const norm = (t: string) => t.replace(/[「」『』（）()\s，。、；：！？…—·：.]/g, '').replace(/祗/g, '祇').replace(/盤/g, '槃').replace(/陁/g, '陀');
const SN = S.map((s) => norm(s.text));
const recs = JSON.parse(readFileSync(join(DATA, 'kepan', 'changshui-sutra.json'), 'utf8')) as { kepan: string; sutra: string }[];
const LEVELS = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥天地';
const marker = new RegExp('([' + LEVELS + '])(初|二|三|四|五|六|七|八|九|十)', 'g');
let pi = 0;
const x265Exact = new Set<number>();
for (const rec of recs) {
  const text = rec.kepan;
  const marks: { pos: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  const rx = new RegExp(marker.source, 'g');
  while ((m = rx.exec(text))) marks.push({ pos: m.index, end: m.index + m[0].length });
  if (!marks.length) continue;
  let u = -1;
  const key = norm(rec.sutra);
  if (key.length >= 4) {
    for (let i = pi; i < Math.min(pi + 300, SN.length); i++) {
      const n = SN[i];
      if (n.startsWith(key.slice(0, 8)) || n.includes(key.slice(0, 8)) || (key.length >= 10 && n.includes(key.slice(2, 10))) || (key.length >= 8 && n.includes(key.slice(0, 6)))) { u = i; break; }
    }
  }
  if (u >= 0) { pi = u + 1; }
  for (const mk of marks) {
    const next = marks.find((x) => x.pos > mk.pos);
    const seg = text.slice(mk.end, next ? next.pos : undefined);
    const nm = seg.split('。')[0].replace(/分[一二三四五六七八九十]+$/, '').replace(/[，、；：]$/, '').trim();
    if (!nm) continue;
    if (u >= 0) x265Exact.add(u);
  }
}
const drba = JSON.parse(readFileSync(join(DATA, 'kepan', 'drba.json'), 'utf8')) as { nodes: { u: number; exact: number }[] };
const drbaExact = new Set(drba.nodes.filter((n) => n.exact === 1).map((n) => n.u));
const exactUnion = new Set([...x265Exact, ...drbaExact]);
const exactSegments = [...exactUnion].filter((u) => u > 0 && u < N).length + 1;

// 各卷
const juanMap = new Map<number, { segments: number; sent: number; chars: number; maxSent: number; maxChars: number }>();
for (const s of segs) {
  const x = juanMap.get(s.juan) || { segments: 0, sent: 0, chars: 0, maxSent: 0, maxChars: 0 };
  x.segments++; x.sent += s.sent; x.chars += s.chars;
  x.maxSent = Math.max(x.maxSent, s.sent); x.maxChars = Math.max(x.maxChars, s.chars);
  juanMap.set(s.juan, x);
}

// 最長／最短（句、字）
const longestSent = [...segs].sort((x, y) => y.sent - x.sent).slice(0, 5);
const longestChars = [...segs].sort((x, y) => y.chars - x.chars).slice(0, 5);
const shortestChars = [...segs].sort((x, y) => x.chars - y.chars).slice(0, 5);

const summary = {
  generated: new Date().toISOString(),
  source: 'site/reader/kepan/kepan-data.js',
  editions: K.editions.length,
  nodes: K.editions.reduce((a, e) => a + e.nodes.length, 0),
  sentences: N,
  normLen: sutra.normLen,
  hanTotal: han.reduce((a, b) => a + b, 0),
  cuts: cuts.length,
  segments: segs.length,
  sentStats,
  charStats,
  sentHist: [...sentHist.entries()].sort((a, b) => a[0] - b[0]),
  charHist,
  perEdition,
  sectionOnlyAdds,
  exact: {
    x265: x265Exact.size,
    drba: drbaExact.size,
    union: exactUnion.size,
    segments: exactSegments,
  },
  byJuan: [...juanMap.entries()].sort((a, b) => a[0] - b[0]).map(([juan, x]) => ({ juan, ...x })),
  longestSent: longestSent.map((s) => ({ ...s, text: S.slice(s.a, s.b).map((x) => x.text).join('').slice(0, 50) })),
  longestChars: longestChars.map((s) => ({ ...s, text: S.slice(s.a, s.b).map((x) => x.text).join('').slice(0, 50) })),
  shortestChars: shortestChars.map((s) => ({ ...s, text: S.slice(s.a, s.b).map((x) => x.text).join('').slice(0, 50) })),
};

writeFileSync(join(BUILD, 'kepan-cuts-summary.json'), JSON.stringify(summary, null, 2) + '\n');

const tsv = ['n\tu0\tu1\tsentences\than\tjuan\tfirst_text'];
segs.forEach((s, i) => {
  tsv.push([i + 1, s.a, s.b - 1, s.sent, s.chars, s.juan, S[s.a].text.slice(0, 40).replace(/\t/g, ' ')].join('\t'));
});
writeFileSync(join(DATA, 'kepan-segments.tsv'), tsv.join('\n') + '\n');

console.log(`科判 ${K.editions.length} 家、節點 ${summary.nodes}；切點 ${cuts.length}；分段 ${segs.length}`);
console.log('句長', sentStats);
console.log('字長', charStats);
console.log('每段句數分布', summary.sentHist);
console.log('每段字數分布', charHist);
console.table(perEdition);
console.log('27 分節新增切點', sectionOnlyAdds);
console.log('實錨', summary.exact);
console.table(summary.byJuan);
console.log('最長句段', longestSent.map((s) => `${s.a}..${s.b - 1} ${s.sent}句 ${s.chars}字`).join(' | '));
console.log('最長字段', longestChars.map((s) => `${s.a}..${s.b - 1} ${s.sent}句 ${s.chars}字`).join(' | '));
console.log('→ build/kepan-cuts-summary.json, data/kepan-segments.tsv');
