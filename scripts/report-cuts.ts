#!/usr/bin/env bun
/**
 * 產出 cuts.tsv 的分析報告：支持度、塌縮、實錨、候選 cut set 的段長。
 *
 *   bun run scripts/report-cuts.ts
 *
 * 讀 data/cuts.tsv、data/sentences.tsv → 寫 docs/cuts-analysis.md
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const raw = readFileSync(join(DATA, 'cuts.tsv'), 'utf8').trim().split('\n');
const head = raw[0].split('\t');
const rows = raw.slice(1).map((l) => l.split('\t'));
const ix = Object.fromEntries(head.map((h, i) => [h, i]));
const sent = readFileSync(join(DATA, 'sentences.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const N = sent.length;
const han = sent.map((r) => +r[5]);

const q = (a, p) => { a = [...a].sort((x, y) => x - y); return a[Math.floor(p * (a.length - 1))]; };
function stats(set) {
  const cuts = [...set].filter((x) => x > 0 && x < N).sort((a, b) => a - b);
  const b = [0, ...cuts, N];
  const lens = [], chars = [];
  for (let i = 0; i < b.length - 1; i++) { lens.push(b[i + 1] - b[i]); chars.push(han.slice(b[i], b[i + 1]).reduce((a, c) => a + c, 0)); }
  return { cuts: cuts.length, segs: lens.length, min: Math.min(...lens), med: q(lens, .5), max: Math.max(...lens), charMed: q(chars, .5), charMax: Math.max(...chars) };
}

const after = rows.map((r) => +r[ix.after_sid].slice(1));
const support = rows.map((r) => +r[ix.support_editions]);
const nodes = rows.map((r) => +r[ix.support_nodes]);
const pile = rows.map((r) => +r[ix.max_pile]);
const collapse = rows.map((r) => +r[ix.collapse]);
const exact = rows.map((r) => +r[ix.exact_total]);

const hist = new Map();
for (const s of support) hist.set(s, (hist.get(s) || 0) + 1);
const levelHist = new Map();
for (const r of rows) levelHist.set(r[ix.min_lv], (levelHist.get(r[ix.min_lv]) || 0) + 1);

const sets = {
  all: new Set(after),
  shared2: new Set(after.filter((_, i) => support[i] >= 2)),
  shared3: new Set(after.filter((_, i) => support[i] >= 3)),
  exactAny: new Set(after.filter((_, i) => exact[i] > 0)),
  exactNoCollapse: new Set(after.filter((_, i) => exact[i] > 0 && !collapse[i])),
  shared2NoCollapse: new Set(after.filter((_, i) => support[i] >= 2 && !collapse[i])),
};

const top = [...rows].sort((a, b) => +b[ix.support_nodes] - +a[ix.support_nodes]).slice(0, 12);
const lines = [
  '# cut 證據分析（2,418 刀）',
  '',
  '> 2026-11-05。`data/cuts.tsv` 的摘要；不是最終 cut set，只是選最小 cut set 的材料。',
  '',
  '## 支持度',
  '',
  '| 支持家數 | cut 數 |',
  '|---:|---:|',
  ...[...hist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '- 1 家：' + (hist.get(1) || 0) + ' 刀；2 家：' + (hist.get(2) || 0) + ' 刀；≥3 家：' + [...hist.entries()].filter(([k]) => k >= 3).reduce((a, [, v]) => a + v, 0) + ' 刀。',
  '- 單家不等於錯：子璿、宣化的實錨很多單家；交光、圓瑛、灌頂的塌縮才是要降權的。',
  '',
  '## 塌縮',
  '',
  `- 標為塌縮（單家 ≥20 節點或總節點 ≥50）的 cut：**${collapse.filter(Boolean).length}** 刀。`,
  '',
  '| cut | after_sid | 節點數 | 最大單家 | 家數 | 來源 |',
  '|---|---:|---:|---:|---:|---|',
  ...top.map((r) => `| ${r[ix.cut_id]} | ${r[ix.after_sid]} | ${r[ix.support_nodes]} | ${r[ix.max_pile]} | ${r[ix.support_editions]} | \`${r[ix.edition_list]}\` |`),
  '',
  '## 實錨',
  '',
  `- 至少一個 X265/DRBA 實錨的 cut：**${exact.filter((x) => x > 0).length}** 刀；沒有實錨：**${exact.filter((x) => x === 0).length}** 刀。`,
  `- X265＋DRBA 實錨 union 的 cut 數（舊分析）：1,637；這裡的 exact_total 只算這兩家。`,
  '',
  '## 候選 cut set 的段長',
  '',
  '| 候選 | cuts | 段數 | 句 min | 句中位 | 句 max | 字中位 | 字 max |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...Object.entries(sets).map(([k, s]) => { const x = stats(s); return `| ${k} | ${x.cuts} | ${x.segs} | ${x.min} | ${x.med} | ${x.max} | ${x.charMed} | ${x.charMax} |`; }),
  '',
  '## 觀察',
  '',
  '1. **聯集不是最小**：1,292 刀只有一家支持；`shared2` 降到 1,126 刀、1,127 段。',
  '2. **咒語是最大缺口**：所有候選的句 max 都很大（437–662），因為 858 個咒語 phrase 沒有科判切點；要另加五會／咒句的 editorial cut。',
  '3. **塌縮先降權**：18 刀是塌縮（1,803／1,126／1,426 節點各疊一句）；不應把它們當成許多獨立切點。',
  '4. **實錨是骨幹**：1,637 刀有 X265/DRBA 實錨；`exactNoCollapse` 1,627 刀可作註疏骨幹的起點。',
  '5. **下一步**：先選一層 cut set（例如 `exactNoCollapse` 或 `shared2NoCollapse`），加上五會 editorial cut，再建 hierarchy。',
  '',
];
writeFileSync(join(ROOT, 'docs', 'cuts-analysis.md'), lines.join('\n') + '\n');
console.log('→ docs/cuts-analysis.md');
console.log('sets', Object.fromEntries(Object.entries(sets).map(([k, s]) => [k, stats(s).segs])));
