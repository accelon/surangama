#!/usr/bin/env bun
/**
 * 產生 docs/coverage-6gram.md：6 字窗 vs 8 字窗的比較報告。
 *
 * 讀：
 *   docs/commentary-inventory.tsv                 全經注疏清單（類別欄）
 *   build/coverage/ 與 build/coverage-6/ 的 taisho.tsv、wxzj.tsv   N=8 與 N=6 的掃描
 *   build/coverage-adb/{library,miuking,taixu,lc}.tsv
 * 寫：docs/coverage-6gram.md
 *
 *   bun run scripts/report-6gram.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const BUILD = join(ROOT, 'build');

function load(file: string): Record<string, string>[] {
  const raw = readFileSync(file, 'utf8').split(/\r?\n/);
  const head = raw[0].split('\t');
  return raw.slice(1).filter(Boolean).map((l) => {
    const v = l.split('\t');
    const o: Record<string, string> = {};
    head.forEach((k, i) => { o[k] = v[i] ?? ''; });
    return o;
  });
}

const inv = load(join(ROOT, 'docs', 'commentary-inventory.tsv'));
const x8 = load(join(BUILD, 'coverage', 'wxzj.tsv'));
const x6 = load(join(BUILD, 'coverage-6', 'wxzj.tsv'));
const t8 = load(join(BUILD, 'coverage', 'taisho.tsv'));
const t6 = load(join(BUILD, 'coverage-6', 'taisho.tsv'));

const pct = (v: string | number | undefined, d = 1) => {
  const n = Number(v);
  return Number.isFinite(n) ? (n * 100).toFixed(d) : '—';
};
const fmt = (n: number | string) => Number(n).toLocaleString('en-US');

const byNo6 = new Map(x6.map((r) => [r.no, r]));
const fullNos = inv.filter((r) => r['類別'] === '全經注疏' && r['藏'] === 'X').map((r) => r['經號']);

const fullRows = inv
  .filter((r) => r['類別'] === '全經注疏' && r['藏'] === 'X')
  .map((r) => {
    const a = byNo6.get(r['經號']);
    return {
      title: r['題名'], author: r['作者'], juan: r['卷'], chars: r['字數'],
      c8: Number(r['cov8%']) / 100, c6: Number(a?.['cov6']), l6: Number(a?.['lastPct']),
    };
  })
  .sort((a, b) => b.c6 - a.c6);

const delta = (r: { c8: number; c6: number }) => ((r.c6 - r.c8) * 100).toFixed(1);

// ---- 四個 adb
const ADBS = [
  { key: 'library', name: 'Library.adb', cname: '近代大師全集書畾' },
  { key: 'miuking', name: 'miuking.adb', cname: '玅境長老說法筆錄集' },
  { key: 'taixu', name: 'taixu.adb', cname: '太虛大師全書' },
  { key: 'lc', name: 'lc.adb', cname: '呂澂佛學著作集' },
];
const adbRows = new Map<string, Record<string, string>[]>();
for (const a of ADBS) adbRows.set(a.key, load(join(BUILD, 'coverage-adb', `${a.key}.tsv`)));

const overview = ADBS.map((a) => {
  const rows = adbRows.get(a.key)!;
  const top = [...rows].sort((x, y) => Number(y.cov6) - Number(x.cov6))[0];
  const titled = rows.filter((r) => /楞嚴|大佛頂/.test(r.title));
  return { ...a, n: rows.length, top, titled };
});

const table = (head: string[], rows: string[][]) =>
  [head, head.map((_, i) => (i === 0 ? '---' : i <= 1 ? '---' : '---:')), ...rows]
    .map((r) => `| ${r.join(' | ')} |`).join('\n');

const libTitled = adbRows.get('library')!.filter((r) => /楞嚴|大佛頂/.test(r.title))
  .sort((a, b) => Number(b.cov6) - Number(a.cov6));
const taixuTitled = adbRows.get('taixu')!.filter((r) => /楞嚴|大佛頂/.test(r.title))
  .sort((a, b) => Number(b.cov6) - Number(a.cov6));

const topNonTitle = (rows: Record<string, string>[], n = 5) =>
  rows.filter((r) => !/楞嚴|大佛頂/.test(r.title)).slice(0, n);

const doc = `# 6 字窗掃描：T945 對近代四庫（2026-11-04）

> 目的：8 字窗對「細碎夾註型」注疏會低估（見 [commentary-inventory.md](commentary-inventory.md) §5）；
> 試 6 字窗，並掃 \`Library.adb\`、\`miuking.adb\`、\`taixu.adb\`、\`lc.adb\` 四個庫。
> **只做掃描，不建置。**

## 1. 怎麼掃

| 項目 | 設定 |
|---|---|
| 底本 | T945，正規化後 67,013 字（只留漢字，折疊常見異體） |
| 字窗 | N=6 與 N=8 各跑一次，同一份核心（\`scripts/lib/ngram.ts\`） |
| 指標 | \`covN\`（底本 N 字窗原樣出現的比例）、\`lastPct\`（最後命中位置）、\`sentenceCov\` |
| 分段 | Library／miuking 用 \`<書>\`；taixu 用 \`<文>\`；lc 用 \`<章>\`＋\`<書>\` |

指令：

\`\`\`powershell
bun run scripts/coverage-scan-adb.ts            # 四庫，同時算 6／8
$env:SURANGAMA_N=6; bun run scripts/coverage-scan.ts   # 大正藏＋卍續藏 6 字窗
\`\`\`

## 2. 四庫總覽

${table(['庫', '庫名', '分段命中', '最高 cov6', '楞嚴標題'], overview.map((o) => [
  o.name, o.cname, String(o.n), `${pct(o.top.cov6)}｜${o.top.title}`, `${o.titled.length} 部`,
]))}

## 3. Library.adb：近代大師全集書畾

**新發現：圓瑛《大佛頂首楞嚴經講義》48.6 萬字，cov6 89.4%、末命中 99.9%——全經消文型注疏。**
CBETA 沒有這部（近代著作），是「選注」可以考慮的近代一家。

${table(['書', '著者', '漢字', 'cov6', 'cov8', '末命中', '提及'], libTitled.map((r) => [
  r.title.replace(/^大佛頂如來密因修證了義諸菩薩萬行/, '大佛頂…'),
  r.title.includes('勢至') ? '慈舟' : r.title.includes('文句') || r.title.includes('玄義') ? '蕅益' : r.title.includes('義燈') ? '斌宗' : '圓瑛',
  fmt(r.chars), pct(r.cov6), pct(r.cov8), pct(r.last6), r.mentions,
]))}

- 蕅益《文句》《玄義》與卍續藏 X285／X284 是**同一部書的另一版**（文句 21.4 萬 vs X285 20.9 萬字），
  可作版本校勘；不重複計入注疏家數。
- 斌宗《楞嚴義燈》是「經題要釋」（17,343 字，cov6 1.3%），屬卷首型；
  慈舟《勢至圓通章講義》只講一章（cov6 1.0%，末命中 73.5%）。
- 同庫其他書對 T945 的引用都在 4% 以下（虛雲和尚年譜 3.6%、靈峰宗論總目錄 2.7%）。

## 4. taixu.adb：太虛大師全書

${table(['文', '漢字', 'cov6', 'cov8', '末命中'], taixuTitled.map((r) => [
  r.title, fmt(r.chars), pct(r.cov6), pct(r.cov8), pct(r.last6),
]))}

- 《大佛頂首楞嚴經研究》cov6 **90.6%**、10.3 萬字——它不是「概論」，是逐科消文型的完整研究，
  在「近代」一層裡的份量比先前估的高。
- 《攝論》9.5%、《楞嚴大意》2.3%，都是通論。

## 5. miuking.adb 與 lc.adb

- **miuking**（玅境長老說法筆錄集，106 書）沒有楞嚴專書；全庫最高 cov6 是《妙法蓮華經》1.5%，
  楞嚴只是講課中的引用（全庫提及 31 處）。
- **lc**（呂澂）《楞嚴百偽》cov6 1.1%、8,818 字——它只引幾句經文來質疑，不是注疏。

## 6. 6 字窗 vs 8 字窗：全藏對照

同樣掃大正藏與卍續藏：

| | 8 字窗 | 6 字窗 |
|---|---:|---:|
| 大正藏命中 | ${fmt(t8.length)} 部 | ${fmt(t6.length)} 部 |
| 卍續藏命中 | ${fmt(x8.length)} 部 | ${fmt(x6.length)} 部 |

命中變多（短窗更容易撞到），但**排序不變**：非楞嚴標題的第一名仍是《宗鏡錄》${pct(t6.find((r) => r.title === '宗鏡錄')?.cov6)}%、
卍續藏仍是《性善惡論》${pct(x6.find((r) => r.title === '性善惡論')?.cov6)}%，沒有冒出新的「隱藏注疏」。

### 6.1 全經注疏 26 部：cov8 → cov6

${table(['題名', '作者', '卷', '漢字', 'cov8', 'cov6', 'Δ', '末命中6'],
  fullRows.map((r) => [r.title, r.author, r.juan, fmt(r.chars), pct(r.c8), pct(r.c6), `+${delta(r)}`, pct(r.l6)]))}

- 大段引經型的 17 部漲 1–3.8 點（正脉疏 +2.4、箋 +3.8）。
- **細碎夾註型漲得最多**：寶鏡疏 +5.5（20.2→25.7）、講錄 +5.1、直解 +4.6、述旨 +4.1。
  這正是 6 字窗的用處：同樣一部書，錨點多了 3–5 個百分點。
- 判「完不完整」仍然看末命中（全部 100%），不是看 cov。

### 6.2 非楞嚴標題的高命中書

| 藏 | 書 | cov6 | cov8 |
|---|---|---:|---:|
${topNonTitle(t6, 5).map((r) => `| T | ${r.title} | ${pct(r.cov6)} | ${pct(t8.find((x) => x.no === r.no)?.cov8)} |`).join('\n')}
${topNonTitle(x6, 5).map((r) => `| X | ${r.title} | ${pct(r.cov6)} | ${pct(x8.find((x) => x.no === r.no)?.cov8)} |`).join('\n')}

## 7. 結論

1. **6 字窗值得用**，但用途是「增加錨點」與「讓細碎夾註型分數更公平」，不是「找新書」。
   對齊（8 字窗 LIS）可先用 6 字窗建錨，再以 8 字窗驗證。
2. **真正的新書在 Library.adb**：圓瑛《楞嚴講義》（48.6 萬字、89.4%）已列入注疏第一層（11 家）；它是 CBETA 沒有的
   全經注疏，另外斌宗《義燈》、慈舟《勢至圓通章講義》可補「近代」層。
3. 蕅益《文句》《玄義》在 Library 有另一版，**可作校勘底本**，不要當成新的一家。
4. 太虛《研究》cov6 90.6%，應從「概論」改列「近代全經研究」。
5. 玅境、呂澂兩庫沒有遺漏的注疏；呂澂《楞嚴百偽》仍只宜作研究文獻。

## 8. 產物

| 檔案 | 內容 |
|---|---|
| \`docs/coverage-6gram.md\` | 本文 |
| \`build/coverage-6/{taisho,wxzj}.tsv\` | 6 字窗全藏掃描 |
| \`build/coverage-adb/{library,miuking,taixu,lc}.tsv\` | 四庫分段掃描（含 cov6／cov8） |
| \`scripts/lib/ngram.ts\` | 6／8 字窗共用核心 |
| \`scripts/coverage-scan-adb.ts\` | 四庫掃描器 |
`;

writeFileSync(join(ROOT, 'docs', 'coverage-6gram.md'), doc);
console.log('寫出 docs/coverage-6gram.md');
