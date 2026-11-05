#!/usr/bin/env bun
/**
 * 建 draft hierarchy：T945 → 卷 → 27 分節 → cut 段。
 * 只做結構，不改 sutra.json；段界以 cuts.tsv 的 after_sid 為準，
 * 分節界若不在 cut set 裡，補一個 section boundary（editorial）。
 *
 *   bun run scripts/build-hierarchy.ts
 *
 * 讀 data/sentences.tsv、data/cuts.tsv、data/ke-anchors.json、build/sentence-split-map.tsv
 * 寫 data/hierarchy.json、docs/hierarchy.md
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

const sent = readFileSync(join(DATA, 'sentences.tsv'), 'utf8').trim().split('\n');
const head = sent[0].split('\t');
const rows = sent.slice(1).map((l) => l.split('\t'));
const ix = Object.fromEntries(head.map((h, i) => [h, i]));
const N = rows.length;
const juanAt = (i) => +rows[i][ix.juan];

const map = readFileSync(join(ROOT, 'build', 'sentence-split-map.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const newStart = new Int32Array(4000);
const newEnd = new Int32Array(4000);
for (const m of map) {
  const old = +m[0].slice(1);
  newStart[old] = +m[1].slice(1);
  newEnd[old] = +m[2].slice(1);
}

const policy = process.argv[2] || 'all';
const withEditorial = policy.endsWith('-ed');
const basePolicy = withEditorial ? policy.slice(0, -3) : policy;
const cutSrc = basePolicy === 'coarse' ? 'cuts-coarse.tsv' : 'cuts.tsv';
let cutRowsAll = readFileSync(join(DATA, cutSrc), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t').map((v, i) => (basePolicy === 'coarse' && i === 0 ? null : v)).filter((v) => v !== null) as string[]);
if (withEditorial) {
  const ed = readFileSync(join(DATA, 'cuts-editorial.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
  for (const [id, after, kind, reason, source] of ed) {
    cutRowsAll.push([id, '', '', after, '', '', '0', `${source}:${reason}`, '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', 'editorial', '0', 'editorial']);
  }
}
const cutRows = cutRowsAll.filter((r) => {
  if (withEditorial && r[20] === 'editorial') return true;
  if (basePolicy === 'exact') return +r[14] > 0 && r[18] === '0';
  if (basePolicy === 'shared2') return +r[6] >= 2 && r[18] === '0';
  return true;
});
const cutHead = readFileSync(join(DATA, 'cuts.tsv'), 'utf8').trim().split('\n')[0].split('\t');
const cix = Object.fromEntries(cutHead.map((h, i) => [h, i]));
const cutAt = new Map<number, any>();
for (const c of cutRows) cutAt.set(+c[cix.after_sid].slice(1), c);

const ka = JSON.parse(readFileSync(join(DATA, 'ke-anchors.json'), 'utf8')).sections as {
  juan: number; code: string; title: string; startPhrase: string; startU: number; endU: number;
}[];

// juan ranges
const juanNodes = [];
for (let j = 0; j <= 10; j++) {
  const ids = rows.map((r, i) => (+r[ix.juan] === j ? i : -1)).filter((i) => i >= 0);
  if (!ids.length) continue;
  juanNodes.push({
    id: `H-J${String(j).padStart(2, '0')}`, parent: 'H0000', level: 1,
    label: j === 0 ? '卷首' : `卷${'一二三四五六七八九十'[j - 1]}`,
    sid_start: ids[0], sid_end: ids[ids.length - 1], kind: 'juan',
    evidence: ['sutra.json:juan=' + j], children: [] as any[],
  });
}

// sections, split if they cross juan
const sectionNodes = [];
ka.forEach((s, idx) => {
  const a0 = newStart[s.startU];
  const b0 = newEnd[s.endU];
  const label = s.title || s.startPhrase || s.code || `第${idx + 1}節`;
  let a = a0;
  let part = 0;
  while (a <= b0) {
    const j = juanAt(a);
    let b = a;
    while (b + 1 <= b0 && juanAt(b + 1) === j) b++;
    part++;
    sectionNodes.push({
      id: `H-S${String(idx + 1).padStart(2, '0')}${part > 1 ? '.' + part : ''}`,
      parent: null, level: 2, label, sid_start: a, sid_end: b, kind: 'section', juan: j,
      evidence: [`ke-anchors.json:sec=${idx + 1}`], children: [] as any[],
    });
    a = b + 1;
  }
});

// segments per section
let segCount = 0;
for (const sec of sectionNodes) {
  const a = sec.sid_start, b = sec.sid_end;
  const cuts = [...cutAt.keys()].filter((x) => x > a && x <= b).sort((x, y) => x - y);
  const points = [a, ...cuts, b + 1];
  for (let k = 0; k < points.length - 1; k++) {
    const x = points[k], y = points[k + 1];
    if (y <= x) continue;
    const c = cutAt.get(x);
    const isEd = !!c && (String(c[cix.edition_list]).startsWith('editorial:') || String(c[cix.cut_id]).startsWith('E'));
    const seg = {
      id: c ? `H-${c[cix.cut_id]}` : `H-${sec.id}-start`,
      parent: sec.id, level: 3, label: c ? c[cix.cut_id] : 'section-start',
      sid_start: x, sid_end: y - 1, kind: 'segment',
      evidence: c ? [`${isEd ? 'cuts-editorial.tsv' : 'cuts.tsv'}:${c[cix.cut_id]}`, c[cix.edition_list]] : ['section boundary (editorial)'],
      children: [] as any[],
    };
    sec.children.push(seg);
    segCount++;
  }
}

// link juan -> sections (by section.juan)
for (const sec of sectionNodes) {
  const jn = juanNodes.find((j) => j.label === (sec.juan === 0 ? '卷首' : `卷${'一二三四五六七八九十'[sec.juan - 1]}`));
  if (jn) { sec.parent = jn.id; jn.children.push(sec); }
}

const root = {
  id: 'H0000', parent: null, level: 0, label: 'T945 大佛頂首楞嚴經', sid_start: 0, sid_end: N - 1,
  kind: 'root', evidence: ['data/sentences.tsv'], children: juanNodes,
};

// validation
const errs: string[] = [];
const seen = new Int32Array(N).fill(0);
for (const j of juanNodes) for (const s of j.children) for (const g of s.children) {
  for (let i = g.sid_start; i <= g.sid_end; i++) seen[i]++;
}
for (let i = 0; i < N; i++) if (seen[i] !== 1) errs.push(`sid ${i} covered ${seen[i]}`);
for (const j of juanNodes) {
  for (let k = 1; k < j.children.length; k++) if (j.children[k].sid_start !== j.children[k - 1].sid_end + 1) errs.push(`juan ${j.id} gap`);
}
console.log(`juan ${juanNodes.length}, sections ${sectionNodes.length}, segments ${segCount}, errors ${errs.length}`);
if (errs.length) console.log(errs.slice(0, 10));
writeFileSync(join(DATA, policy === 'all' ? 'hierarchy.json' : `hierarchy-${policy}.json`), JSON.stringify(root, null, 1) + '\n');

const md = [
  `# Draft hierarchy（${policy}）`,
  '',
  `- 產生：scripts/build-hierarchy.ts ${policy}`,
  `- 卷：${juanNodes.length}`,
  `- 分節：${sectionNodes.length}（27 個原節，若跨卷則拆）`,
  `- 段：${segCount}`,
  `- 覆蓋：${N} 句；validation errors：${errs.length}`,
  '',
  '## 注意',
  '',
  '- 這是 draft：分節用蒙鈔目錄，段用選定 cut set。',
  '- 段界若剛好是分節界，但不在 cut set，會補一個 `section-start` 段，不算注疏切點。',
  '- `sutra.json` 不動；`hierarchy*.json` 只是 view。',
  '',
];
writeFileSync(join(ROOT, 'build', `hierarchy-summary-${policy}.md`), md.join('\n') + '\n');
console.log('→ data/hierarchy' + (policy === 'all' ? '' : '-' + policy) + '.json, build/hierarchy-summary-' + policy + '.md');






