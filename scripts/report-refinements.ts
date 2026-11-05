#!/usr/bin/env bun
/**
 * 由 quote scan / refinements / joins 產生 docs/track-refinements.md。
 *
 *   bun run scripts/report-refinements.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const ref = read('data/track-refinements.tsv');
const splits = ref.filter((r) => r[1] === 'split');
const joins = ref.filter((r) => r[1] === 'join');
const children = read('data/tracks-suggested.tsv');
const groups = read('data/join-groups.tsv');
const hits = read('build/quote-scan-pilot.tsv');
const books = new Map<string, number>();
for (const h of hits) books.set(h[6], (books.get(h[6]) || 0) + 1);
const top = [...books.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

const count = (xs: string[][], i: number) => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x[i], (m.get(x[i]) || 0) + 1);
  return [...m.entries()].sort();
};
const splitConf = count(splits, 6);
const joinConf = count(joins, 6);
const review = splits.filter((r) => r[8] === '1').length;

const md = [
  '# 引用掃描與軌號 refine（pilot）',
  '',
  '> 2026-11-05。以 ADBengine 掃 `taisho.adb`／`wxzj.adb` 的《楞嚴經》引用，',
  '> 用引用邊界產生 **suggested split / join points**。目錄 `tracks-zh.tsv` 未改。',
  '',
  '## 結果',
  '',
  `- 掃描：291 軌（S0160–S0450），${hits.length.toLocaleString()} hits，${books.size} 本書。`,
  `- Split suggestions：**${splits.length}**（A ${splitConf.find((x) => x[0] === 'A')?.[1] ?? 0}／B ${splitConf.find((x) => x[0] === 'B')?.[1] ?? 0}／C ${splitConf.find((x) => x[0] === 'C')?.[1] ?? 0}；${review} 條 tail <4 字，標 review）。`,
  `- 子軌：**${children.length}** 列（<parent>.1/.2/...，不覆寫原軌）。`,
  `- Join suggestions：**${joins.length}**（A ${joinConf.find((x) => x[0] === 'A')?.[1] ?? 0}／B ${joinConf.find((x) => x[0] === 'B')?.[1] ?? 0}）；join groups ${groups.length}。`,
  '',
  '## Split suggestions',
  '',
  '| track | offsets | 邊界 | 子軌 | 信心 | review |',
  '|---|---:|---|---|---|---:|',
  ...splits.map((r) => `| \`${r[0]}\` | ${r[2]} | ${r[4]} | \`${r[3]}\` | ${r[6]} | ${r[8]} |`),
  '',
  '## Join suggestions（前 25）',
  '',
  '| pair | shared | 邊界 | 信心 |',
  '|---|---:|---|---|',
  ...joins.slice(0, 25).map((r) => `| \`${r[3]}\` | ${(r[5].match(/(\d+) keys/) || [])[1] || ''} | ${r[4]} | ${r[6]} |`),
  '',
  '## 引用最多的書',
  '',
  '| 書 | hits |',
  '|---|---:|',
  ...top.map(([b, n]) => `| ${b} | ${n} |`),
  '',
  '## 怎麼用',
  '',
  '- **Split**：`data/tracks-suggested.tsv` 是子軌；原 `track_id` 保留，子軌用 `<parent>.1`。',
  '  套用時把原軌標 `superseded_by`，子軌標 `parent_track`，不要重用舊號。',
  '- **Join**：`data/join-groups.tsv` 只記 group，不合併 `track_id`。',
  '  UI 可用 group 做「同一段」顯示；引用仍指原軌。',
  '- **Review**：`review=1` 是尾段 <4 字的 split（例 `S0163.1` 尾段「焦府」2 字），',
  '  可能是引用窗沒抓到尾巴，不要直接套用。',
  '',
  '## 限制',
  '',
  '1. 10 字窗；異體字／缺字／改寫會漏。',
  '2. 只收 `楞嚴`／`首楞嚴`／`宗鏡錄` 類書；其他書的引用在 `build/quote-scan-pilot.tsv` 仍保留（`other` 382 筆）。',
  '3. 同一注疏頁可能討論相鄰多句；join 是頁級證據，不是逐字連續證明。',
  '4. page id 是 adb 的頁 id，不是 CBETA 頁碼。',
  '5. 尚未 freeze；`tracks-zh.tsv` 與 `sutra.json` 未動。',
  '',
];
writeFileSync('docs/track-refinements.md', md.join('\n') + '\n');
console.log(`splits ${splits.length}, joins ${joins.length}, children ${children.length}, groups ${groups.length}`);


