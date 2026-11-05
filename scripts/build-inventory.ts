#!/usr/bin/env bun
/**
 * 楞嚴經相關文獻清單：把 X 書目、大正藏書目、覆蓋率掃描與 adb 盤點結果併成
 * docs/commentary-inventory.tsv，並產生 docs/commentary-inventory.md 的表格段落。
 *
 *   bun run scripts/build-inventory.ts
 *
 * 讀（唯讀）：
 *   build/x-catalog.tsv                      scripts/x-catalog.ts
 *   build/coverage/{wxzj,taisho}.tsv         scripts/coverage-scan.ts
 *   $env:SURANGAMA_CORPUS/build/jingqun/catalog.tsv
 * 寫：
 *   docs/commentary-inventory.tsv
 *   build/inventory-tables.md               （md 的表格，貼進文件用）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CORPUS = process.env.SURANGAMA_CORPUS ?? 'D:\\2026\\adb-converter';
const ROOT = join(import.meta.dir, '..');
const BUILD = join(ROOT, 'build');
const DOCS = join(ROOT, 'docs');
const WANT = /楞嚴|大佛頂/;

interface Row {
  canon: 'T' | 'X' | 'LIB' | 'TX' | 'YS' | 'LC';
  vol: string;
  no: string;
  title: string;
  author: string;
  juan: string;
  chars: number;
  cov: number | null;
  sent: number | null;
  lastPct: number | null;
  bins: number | null;
  kind: string;
  note: string;
}

function readCoverage(file: string) {
  const map = new Map<string, { cov: number; sent: number; lastPct: number; bins: number; len: number }>();
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/).slice(1)) {
    if (!line) continue;
    const p = line.split('\t');
    map.set(`${p[0]}:${p[2]}`, {
      cov: Number(p[6]), sent: Number(p[8]), lastPct: Number(p[9]), bins: Number(p[10]), len: Number(p[11]),
    });
  }
  return map;
}
const covX = readCoverage(join(BUILD, 'coverage', 'wxzj.tsv'));
const covT = readCoverage(join(BUILD, 'coverage', 'taisho.tsv'));

/** 類別（人工判定，依題名與卷數；cov 只作旁證）。 */
const KIND: Record<string, string> = {
  // 卍續藏
  X265: '科判', X267: '疏記', X268: '全經注疏', X269: '疏記', X270: '全經注疏',
  X271: '全經注疏', X272: '全經注疏', X273: '科判', X274: '卷首玄義', X275: '全經注疏',
  X276: '短篇', X277: '卷首玄義', X278: '科判', X279: '全經注疏', X280: '短篇',
  X281: '全經注疏', X282: '卷首玄義', X283: '全經注疏', X284: '卷首玄義', X285: '全經注疏',
  X286: '全經注疏', X287: '全經注疏', X288: '全經注疏', X289: '全經注疏', X290: '科判',
  X291: '全經注疏', X292: '短篇', X293: '卷首玄義', X294: '短篇', X295: '全經注疏',
  X296: '短篇', X297: '短篇', X298: '全經注疏', X299: '全經注疏', X300: '全經注疏',
  X301: '全經注疏', X302: '全經注疏', X303: '全經注疏', X304: '科判', X305: '卷首玄義',
  X306: '全經注疏', X307: '卷首玄義', X308: '全經注疏', X309: '附錄', X310: '單章注',
  X311: '單章注', X312: '單章注', X313: '序跋', X314: '科判', X315: '卷首玄義',
  X316: '全經注疏', X317: '全經注疏', X318: '全經注疏', X1477: '儀軌', X1478: '儀軌',
  // 大正藏
  T945: '母經', T1799: '全經注疏', T642: '同名異經',
  T944a: '咒典', T944b: '咒典', T946: '咒典', T947: '咒典', T975: '咒典',
  T2233: '日本撰述', T2234: '日本撰述', T2235: '日本撰述', T2723: '日本撰述', T2724: '日本撰述',
};

const NOTE: Record<string, string> = {
  T945: '般剌蜜帝譯，10 卷；本計畫的母本',
  T1799: '子璿集，大正藏 vol.39 唯一的楞嚴注疏',
  T642: '羅什譯《首楞嚴三昧經》，同名不同經，勿混',
  T944a: '不空譯楞嚴咒（大佛頂陀羅尼）—咒典，非經注',
  T944b: '大佛頂大陀羅尼—咒典',
  T946: '大佛頂廣聚陀羅尼經，4 卷—同屬佛頂部，內容非 T945',
  T947: '大佛頂…金輪三昧呪品—佛頂部旁支',
  T975: '白傘蓋佛頂—佛頂部旁支',
  T2233: '日本撰述（開題）', T2234: '日本撰述（悉曇）', T2235: '日本撰述（陀羅尼勘註）',
  T2723: '日本儀式（二十五三昧式）', T2724: '日本儀式（起請）',
  X265: '子璿《義疏》之科', X267: '釋子璿《義疏》（懷遠錄）', X269: '釋子璿《義疏》（仁岳述）',
  X273: '正脉疏科', X274: '正脉疏懸示', X278: '通議略科', X282: '傳燈玄義',
  X284: '智旭玄義', X290: '直指科文', X304: '觀心定解科', X305: '觀心定解大綱',
  X307: '指掌疏懸示', X309: '指掌疏事義（附錄）', X313: '序指味疏（釋序）',
  X314: '寶鏡疏科文', X315: '寶鏡疏懸談', X1477: '淨源編，壇場儀', X1478: '禪修述，懺儀',
  X276: '袾宏，1 卷', X280: '圓澄，1 卷', X292: '大韶，1 卷', X294: '陸西星，1 卷',
  X296: '傳如，2 卷', X297: '傳燈，2 卷（答問）',
  X310: '正相，勢至圓通章', X311: '續法，勢至圓通章', X312: '行策，勢至圓通章',
};

/** 卍續藏 */
const xRows: Row[] = readFileSync(join(BUILD, 'x-catalog.tsv'), 'utf8')
  .split(/\r?\n/).slice(1).filter(Boolean)
  .map((l) => l.split('\t'))
  .filter((p) => WANT.test(p[3]))
  .map((p) => {
    const c = covX.get(`X:${p[2]}`);
    return {
      canon: 'X' as const, vol: p[1], no: p[2], title: p[3], author: p[4], juan: p[5],
      chars: Number(p[6]),
      cov: c?.cov ?? null, sent: c?.sent ?? null, lastPct: c?.lastPct ?? null, bins: c?.bins ?? null,
      kind: KIND[`X${p[2]}`] ?? '', note: NOTE[`X${p[2]}`] ?? '',
    };
  });

/** 大正藏（catalog 3,000 筆） */
const tRows: Row[] = [];
for (const line of readFileSync(join(CORPUS, 'build', 'jingqun', 'catalog.tsv'), 'utf8')
  .split(/\r?\n/).slice(1)) {
  if (!line) continue;
  const p = line.split('\t');
  if (!WANT.test(p[6])) continue;
  const key = `T${p[2].replace(/^0+/, '')}`;
  const c = covT.get(`T:${p[2]}`);
  tRows.push({
    canon: 'T', vol: p[1], no: p[2].replace(/^0+/, ''), title: p[6], author: p[7], juan: p[3],
    chars: c?.len ?? 0,
    cov: c?.cov ?? null, sent: c?.sent ?? null, lastPct: c?.lastPct ?? null, bins: c?.bins ?? null,
    kind: KIND[key] ?? '', note: NOTE[key] ?? '',
  });
}

// 少數書（科文、儀式）在覆蓋率表裡沒有 bookLen：從大正藏 TEI 直接算漢字數。
if (tRows.some((r) => !r.chars)) {
  const all = readFileSync(join(CORPUS, 'build', 'tei-all-2026R2.txt'), 'utf8');
  const marks = [...all.matchAll(/<段\/><書 id="n(\d+)">([^<]*)<\/書>/g)];
  const han = new Map<string, number>();
  marks.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index! : all.length;
    han.set(m[2], (all.slice(start, end).match(/[\u3400-\u9fff]/g) ?? []).length);
  });
  for (const r of tRows) if (!r.chars) r.chars = han.get(r.title) ?? 0;
}

/** 題名不含楞嚴、但大量引用的書（掃描 top，人工挑） */
const quoteRows: Row[] = [
  {
    canon: 'T', vol: '48', no: '2016', title: '宗鏡錄', author: '宋 延壽集', juan: '100',
    chars: covT.get('T:2016')?.len ?? 0,
    cov: covT.get('T:2016')?.cov ?? null, sent: covT.get('T:2016')?.sent ?? null,
    lastPct: covT.get('T:2016')?.lastPct ?? null, bins: covT.get('T:2016')?.bins ?? null,
    kind: '引用', note: '全藏引用 T945 最多（cov8 25.8%），非注疏',
  },
];

/** 近代全經注疏：圓瑛《大佛頂首楞嚴經講義》（Library.adb，CBETA 無）。
 *  數據來自 scripts/coverage-scan-adb.ts 的 build/coverage-adb/library.tsv。 */
const libRows: Row[] = [
  {
    canon: 'LIB', vol: '近代大師全集', no: '', title: '大佛頂首楞嚴經講義', author: '民國 圓瑛述',
    juan: '24卷', chars: 485988,
    cov: 0.8637, sent: 0.5630, lastPct: 0.9993, bins: 20,
    kind: '全經注疏',
    note: '近代（民國）；CBETA 無，出自 Library.adb（cov6 89.3%）',
  },
];

/** 近代／現代（tx／ys／lc adb 盤點所得；字數見 scripts/modern-counts.ts） */
const modernChars = (() => {
  try {
    const j = JSON.parse(readFileSync(join(BUILD, 'modern-counts.json'), 'utf8')) as { title: string; chars: number }[];
    return new Map(j.map((r) => [r.title, r.chars]));
  } catch { return new Map<string, number>(); }
})();
const modernRows: Row[] = [
  { canon: 'TX', vol: '太虛', no: '', title: '大佛頂首楞嚴經攝論', author: '釋太虛', juan: '', chars: modernChars.get('大佛頂首楞嚴經攝論') ?? 0, cov: null, sent: null, lastPct: null, bins: null, kind: '現代', note: '民國時期講述（太虛全書）' },
  { canon: 'TX', vol: '太虛', no: '', title: '大佛頂首楞嚴經研究', author: '釋太虛', juan: '', chars: modernChars.get('大佛頂首楞嚴經研究') ?? 0, cov: null, sent: null, lastPct: null, bins: null, kind: '現代', note: '逐科研究（太虛全書）' },
  { canon: 'TX', vol: '太虛', no: '', title: '楞嚴大意', author: '釋太虛', juan: '', chars: modernChars.get('楞嚴大意') ?? 0, cov: null, sent: null, lastPct: null, bins: null, kind: '現代', note: '提要（太虛全書）' },
  { canon: 'YS', vol: '華雨香雲', no: '', title: '《楞嚴經攝論》《楞嚴經研究》合刊．序', author: '釋印順', juan: '', chars: 0, cov: null, sent: null, lastPct: null, bins: null, kind: '現代', note: '序文（印順）' },
  { canon: 'LC', vol: '論著集', no: '', title: '楞嚴百偽', author: '呂澂', juan: '', chars: modernChars.get('楞嚴百偽') ?? 0, cov: null, sent: null, lastPct: null, bins: null, kind: '現代', note: '疑偽研究，非注疏（呂澂）' },
];

const rows = [...tRows, ...xRows, ...libRows, ...quoteRows, ...modernRows];

const order: Record<string, number> = { 母經: 0, 全經注疏: 1, 疏記: 2, 卷首玄義: 3, 科判: 4, 單章注: 5, 短篇: 6, 序跋: 7, 附錄: 8, 儀軌: 9 };
const canonOrder: Record<string, number> = { T: 0, X: 1, LIB: 2, TX: 3, YS: 4, LC: 5 };
rows.sort((a, b) =>
  (canonOrder[a.canon] - canonOrder[b.canon]) ||
  ((order[a.kind] ?? 99) - (order[b.kind] ?? 99)) ||
  (Number(a.vol) - Number(b.vol)) ||
  String(a.no).localeCompare(String(b.no)));

const pct = (v: number | null) => (v == null ? '—' : (v * 100).toFixed(1));
const fmt = (n: number) => (n ? n.toLocaleString('en-US') : '—');

const header = ['藏', '冊', '經號', '題名', '作者', '卷', '字數', 'cov8%', '句覆蓋%', '末命中', '類別', '備註'];
const tsv = [header.join('\t')].concat(rows.map((r) => [
  r.canon, r.vol, r.no, r.title, r.author, r.juan, r.chars || '', pct(r.cov), pct(r.sent), pct(r.lastPct), r.kind, r.note,
].join('\t'))).join('\n') + '\n';
writeFileSync(join(DOCS, 'commentary-inventory.tsv'), tsv);

// ---- 統計
const sumChars = (list: Row[]) => list.reduce((a, r) => a + (r.chars || 0), 0);
const xDynasty = (() => {
  const m = new Map<string, number>();
  for (const r of xRows) {
    const d = /^(宋|元|明|清|唐|民國)/.exec(r.author)?.[1] ?? '無作者';
    m.set(d, (m.get(d) ?? 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('、');
})();

const by = (k: string) => rows.filter((r) => r.kind === k);
const full = by('全經注疏');
const fullX = full.filter((r) => r.canon === 'X');
const front = by('卷首玄義');
const kepan = by('科判');
const short = by('短篇').concat(by('單章注'), by('序跋'), by('附錄'), by('疏記'));
const ritual = by('儀軌');
const periphery = rows.filter((r) => ['咒典', '同名異經', '日本撰述', '引用', '現代'].includes(r.kind));
/** 全經注疏的朝代分布（宋＝含 T1799） */
const fullDynasty = (() => {
  const m = new Map<string, number>();
  for (const r of full) {
    const d = /^(宋|元|明|清|唐|民國)/.exec(r.author)?.[1] ?? '無作者';
    m.set(d, (m.get(d) ?? 0) + 1);
  }
  return m;
})();

const mdRow = (r: Row) =>
  `| ${r.canon} | ${r.vol} | ${r.no} | ${r.title} | ${r.author} | ${r.juan} | ${fmt(r.chars)} | ${pct(r.cov)} | ${pct(r.lastPct)} |`;
const tableOf = (list: Row[]) => [
  '| 藏 | 冊 | 經號 | 題名 | 作者 | 卷 | 漢字 | cov8% | 末命中% |',
  '|---|---:|---:|---|---|---:|---:|---:|---:|',
  ...list.map(mdRow),
].join('\n');

const doc = `# 楞嚴經注釋群盤點

> 2026-11-04 初稿。範圍：CBETA 2026R2 的大正藏（T）與卍新纂續藏（X），
> 另加印順（ys）、太虛（tx）、呂澂（lc）、于淩波（yulinpo）四個現代庫。
> **本文只盤點，不動工**。成品形態照 \`vcpp\`／\`zhu-combined\`：主文 ＋ 注疏 ＋（視需要）別譯。

## 摘要

- **母經**：T945《大佛頂如來密因修證了義諸菩薩萬行首楞嚴經》，唐 般剌蜜帝譯，10 卷，
  漢字 ${fmt(rows.find((r) => r.canon === 'T' && r.title.includes('首楞嚴經'))?.chars ?? 0)}（只計漢字，不含標點）。
- **大正藏只有一部注疏**：T1799《首楞嚴義疏注經》（宋 子璿集，10 卷）。
  全藏對 T945 覆蓋率第二高的 T2016《宗鏡錄》是引用（cov8 25.8%），不是注疏；其餘都 < 2%。
- **卍新纂續藏是一整塊**：X265–X318 連續編號（X266 缺）共 53 部，再加 X1477／X1478 兩部懺儀，
  合計 **${xRows.length} 部**，集中在第 10–16 冊。朝代：${xDynasty}。
- **全經注疏 ${full.length} 部**（含 T1799 與近代圓瑛《講義》），合計 ${fmt(sumChars(full))} 漢字——這是「選注」真正的注文母體。
- **兩種書寫型態**：大段引經再釋（cov8 79–92%）與細碎夾註（cov8 15–24%）。
  後者 cov8 低不是「不完整」，${'`lastPct`'} 都到 98–99%，全經都走到了（見 §5）。
- **周邊**：佛頂部咒典 5 部、同名異經 1 部（T642，勿混）、日本撰述 5 部、大量引用 1 部、
  近代 5 種（太虛 3、印順序 1、呂澂《楞嚴百偽》1）。
- **6 字窗補掃**：\`Library.adb\`（近代大師全集）另有圓瑛《大佛頂首楞嚴經講義》48.6 萬字
  （cov6 89.4%，全經消文型），CBETA 沒有；四庫比較見 [coverage-6gram.md](coverage-6gram.md)。

## 1. 資料與方法

### 1.1 語料

| 類別 | 來源 | 筆數 |
|---|---|---:|
| 大正藏 | \`D:\\2026\\xml-p5\\T\`（CBETA XML-P5），經 \`build\\tei-all-2026R2.txt\` | 3,000 部（catalog） |
| 卍新纂續藏 | \`D:\\2026\\xml-p5\\X\`，經 \`build\\wxzj-tei-2026R2-new.txt\` | 1,236 部 |
| 近代 | \`tx.adb\`、\`ys.adb\`、\`lc.adb\`、\`yulinpo.adb\`、\`Library.adb\`、\`miuking.adb\` | — |

全部**唯讀**。大正藏的經號／卷數／作者取自 \`build\\jingqun\\catalog.tsv\`；
卍續藏另由 \`scripts/x-catalog.ts\` 解析 1,236 個 XML 檔頭重建（\`build/x-catalog.tsv\`）。

### 1.2 accelon26／adb 驗證

作者指示「利用 \`D:\\2026\\adb-converter\\accelon26\`」；**該目錄不存在**（\`adb-converter\` 下只有
\`ts\\src\\accelon26\` 程式與 \`build\\adb-publish\\*.adb\`）。這裡改用 accelon26 的同一套
adb 讀取器（\`ts\\src\\adbtext.ts\`）直接開已發佈的庫：

| 庫 | 楞嚴／大佛頂 書數 | 與 TEI 對照 |
|---|---:|---|
| \`build\\adb-publish\\taisho.adb\` | 13 | 與 catalog 的 13 部一致 |
| \`build\\adb-publish\\wxzj.adb\` | ${xRows.length} | 與 \`x-catalog.tsv\` 的 ${xRows.length} 部一致 |

所以下面這份清單就是讀者在 accelon26 裡打開 wxzj／taisho 會看到的同一批書。
（\`taisho.adb\` 315.7 MiB、\`wxzj.adb\` 234.4 MiB，讀取各約 8–11 秒。）

### 1.3 覆蓋率掃描

移植 \`adb-converter\\build\\jingqun\\find-xiaowen.ts\`（金剛經那套），把底本換成 T945：

- 經文正規化後切 **8 字窗**，掃全藏；\`cov8\` ＝ 經文的 8 字窗有多少比例原樣出現在該書。
- \`句覆蓋\` ＝ 以 \`。！？；\` 切的整句原樣出現的比例。
- **新增 \`末命中\`**：最後一個命中的經文位置 ÷ 經文長度。這一欄是為楞嚴加的，理由見 §5。

腳本：\`scripts/coverage-scan.ts\`，輸出 \`build/coverage/{taisho,wxzj}.tsv\`。

### 1.4 判讀

- \`cov8\` 高 ＝ 大段抄經再釋，最容易做逐句對讀。
- \`末命中\` 近 100% ＝ 該書走完了整部經（不管它引得多細）。
- \`卷\`、\`漢字\` 看規模；\`類別\` 是人工依題名與卷數判定（cov 只作旁證）。

## 2. 母經

| 經號 | 題名 | 譯者 | 卷 | 漢字 | 大正頁碼起 |
|---|---|---|---:|---:|---|
| T945 | 大佛頂如來密因修證了義諸菩薩萬行首楞嚴經 | 唐 般剌蜜帝譯 | 10 | ${fmt(rows.find((r) => r.canon === 'T' && r.title.includes('首楞嚴經'))?.chars ?? 0)} | T19p0106a（卷首序自 105c 起） |

- 只有一個漢譯傳世（般剌蜜帝譯），**沒有金剛經那種多譯對讀**。
- 咒（卷七）另有異譯，見 §6.1；藏譯、梵本殘卷不在 CBETA，未盤點。

## 3. 大正藏：只有一部注疏

${tableOf(full.filter((r) => r.canon === 'T'))}

- T1799 是子璿（長水）的《首楞嚴義疏注經》，10 卷、${fmt(full.find((r) => r.no === '1799')?.chars ?? 0)} 漢字；
  它的**科、鈔、記**都在卍續藏（X265／X267／X269，見 §4.2）。
- 掃描結果：cov8 第三名之後全部 < 2%，大正藏沒有第二部楞嚴注疏。
- 這和金剛經不同（大正藏有 T1700／T1701／T1703／T2732 四部消文），
  楞嚴的注疏群**幾乎全在卍續藏**。

## 4. 卍新纂續藏：一整塊楞嚴區

### 4.1 位置與規模

X265 起、X318 止（X266 在 CBETA 中缺號），連號 53 部，全部在第 10–16 冊
（經部之後的「大小乘釋經部」）；另有第 74 冊禮懺部的 X1477《首楞嚴壇場修證儀》、
X1478《依楞嚴究竟事懺》。合計 ${xRows.length} 部、${fmt(sumChars(xRows))} 漢字。

### 4.2 子璿系（疏→科→鈔→記）

| 經號 | 題名 | 作者 | 卷 | 性質 |
|---|---|---|---:|---|
| T1799 | 首楞嚴義疏注經 | 宋 子璿集 | 10 | 疏（大正藏） |
| X265 | 楞嚴經義疏注經科 | 宋 子璿述 | 1 | 疏的科判 |
| X267 | 楞嚴經義疏釋要鈔 | 宋 懷遠錄 | 6 | 疏的鈔 |
| X269 | 楞嚴經熏聞記 | 宋 仁岳述 | 5 | 疏的記 |

> 四部是一組：T1799 是母疏，X265 給科，X267／X269 再釋。做「注的注」時可以整組一起看。

### 4.3 全經注疏（卍續藏 26 部）

${tableOf(fullX)}

- 宋代 ${fullDynasty.get('宋') ?? 0} 部（X268 集註、X270 要解、X271 箋、X272 合論 ＋ T1799）、
  元代 ${fullDynasty.get('元') ?? 0} 部（X281 惟則會解、明 傳燈疏）、
  明代 ${fullDynasty.get('明') ?? 0} 部為主力（正脉、通議、圓通疏、文句、如說、蒙鈔…）、
  清代 ${fullDynasty.get('清') ?? 0} 部（貫攝、觀心定解、指掌疏、寶鏡疏、正見）。
- cov8 79–92% 的 17 部是「大段引經」型；cov8 15–24% 的 7 部（述旨、直解、講錄、纂註、
  精解評林、寶鏡疏、正見）與 5–6% 的 2 部（秘錄、略疏）是「細碎夾註」型，見 §5。

### 4.4 卷首、科判

**卷首／玄義（${front.length} 部）**

${tableOf(front)}

**科判（${kepan.length} 部）**

${tableOf(kepan)}

- 卷首／玄義 8 部是通論（懸示、懸談、玄義、大綱），適合當「導讀」而不適合逐句對讀。
- 科判 6 部只有科文（cov8 幾乎 0）。\`zhu-combined\` 的慣例是**科判不收**；
  但科文可以拿來做目錄結構（分卷、分科），值得先抽出來備用。

### 4.5 短篇、單章、序跋、附錄、疏記

${tableOf(short)}

- **勢至圓通章**獨立成組 3 部（X310 科解、X311 疏鈔、X312 解）：淨土信仰的入口，
  與全經注疏是不同讀者群。
- 短篇 6 部多為 1–2 卷的專題（摸象記、臆說、擊節、說約、截流、前茅）。

### 4.6 儀軌

${tableOf(ritual)}

### 4.7 近代：圓瑛《大佛頂首楞嚴經講義》

${tableOf(libRows)}

- 出自 \`Library.adb\`（近代大師全集書畾），**CBETA 沒有**；24 卷、48.6 萬字，cov8 86.4%、
  6 字窗 89.4%、末命中 99.9%——大段引經型，是全經消文，不是講記摘要。
- **版本**：1951 年初版，24 卷；繁體本有華廈出版、和裕出版，大陸多有私下印本。
  老和尚的著作實務上視為公版（不計版權、鼓勵翻印），引用時註明版本即可。
- **三個電子本**（\`vendor\\yuanying\\\`，不進版控）：

| 來源 | 內容 | 特點 |
|---|---|---|
| \`Library.adb\` | 近代大師全集本 | 有 \`<小字>\` 952、\`<偏右字>\` 503、\`<方>\` 1,990、\`<篇>\` 1,661 標記，**科文可辨識** |
| 詩詞匯 zh-tw | 明暘校對本全文 | 無標記；24 卷＋4 篇序，486,118 漢字 |
| archive.org 掃描 | 1,578 頁 PDF＋OCR（佛陀教育基金會印贈本） | OCR 有印刷頁碼（全形數字獨立一行，1–1,576 連續），已切頁（\`vendor\\yuanying\\ocr-pages.txt\`） |

- **頁碼**（\`scripts/ocr-pages.ts\` → \`build/yuanying-pages.json\`）：卷首 p.1–11；
  卷一 p.12、卷二 p.101、卷三 p.179、卷四 p.244、卷五 p.305、卷六 p.370、卷七 p.420、
  卷八 p.470、卷九 p.531、卷十 p.588、卷十一 p.643、卷十二 p.698、卷十三 p.754、卷十四 p.813、
  卷十五 p.882、卷十六 p.942、卷十七 p.1,003、卷十八 p.1,063、卷十九 p.1,117、卷二十 p.1,215、
  卷二十一 p.1,287、卷二十二 p.1,353、卷二十三 p.1,409、卷二十四 p.1,493–1,576。
  引用可寫「卷X，p.Y」。
- **行級頁對映（骨架）**（\`scripts/page-map.ts\` → \`build/yuanying-page-map.{tsv,json}\`）：
  adb 逐行 23,349 行對到 OCR 頁；有錨 15,228 行（全行的 65.2%；≥6 漢字的行 91.7%），沒錨的沿用上一頁；
  頁碼倒退 72 次（0.3%）。查一句話：
  \`bun run scripts/page-lookup.ts "今解此經…"\` → 第一卷 p.12。fast prototype：行級頁碼可直接用，
  段／句級等建置時再細化。

- **兩本比對**（\`scripts/compare-yuanying.ts\`）：逐卷差 ±10–46 字；全書 485,673（adb）
  vs 486,118（詩詞匯），差 445 字（0.09%）。906 條 \`<小字>\` 有 98.3%、503 條 \`<偏右字>\`
  有 100% 的內容在詩詞匯本也找得到——**同一版**；網頁本缺的是「標記」，不是文字。
- 與 T1799 同列第一層（見 §7），作為「近代」的一家。
- 同庫另有蕅益《文句》《玄義》的另一版（可校勘）、斌宗《楞嚴義燈》、慈舟《勢至圓通章講義》；
  四庫掃描細節見 [coverage-6gram.md](coverage-6gram.md)。

## 5. 兩種書寫型態：cov8 不是「完不完整」

金剛經的經驗是「cov8 ≥ 80% ＝ 消文」。楞嚴不能直接照搬：

| 型態 | 例子 | cov8 | 末命中 | 意思 |
|---|---|---:|---:|---|
| 大段引經 | 通議、正脉疏、指掌疏 | 84–90% | 99.9% | 抄一段經、釋一段 |
| 細碎夾註 | 寶鏡疏、直解、纂註 | 20–24% | 98.8–99.9% | 每幾字就夾註，8 字窗被打斷 |
| 提綱 | 秘錄、略疏 | 5–6% | 98.2–98.7% | 只引關鍵句 |

- 所以判「完整」要看 \`末命中\`（有沒有走到經尾），不是只看 cov8。
- 對 8 字窗 LIS 對齊（vcpp 的做法）而言：三種都能錨定，只是細碎型可用的錨點少
  （cov8 20% 仍有約 1.3 萬個窗），要先拿一兩部試對齊再定案。

## 6. 周邊文獻

${tableOf(periphery)}

### 6.1 佛頂部咒典（5 部）

T944a／T944b（不空譯楞嚴咒）、T946《大佛頂廣聚陀羅尼經》、T947、T975（白傘蓋佛頂）。
它們同屬「佛頂」部，但**內容不是 T945**（cov8 < 2%）。除非要做「楞嚴咒異譯」，
否則不要放進注疏群。

> 咒典多為悉曇字（PUA），本表「漢字」只計漢字，所以 T944b 只有 33 字看起來特別小；
> 要估咒典篇幅得另算悉曇字。

### 6.2 同名異經

T642《佛說首楞嚴三昧經》（羅什譯，2 卷）是另一部經，**不是**大佛頂首楞嚴。
書名相近，圈選與檢索時最容易誤收。

### 6.3 日本撰述（5 部）

T2233《大佛頂經開題》、T2234《注大佛頂眞言》、T2235《陀羅尼勘註》、
T2723／T2724 橫川首楞嚴院二十五三昧式（儀式）。屬日本悉曇／儀軌傳統，篇幅都很小。

### 6.4 引用最多的書

- T2016《宗鏡錄》（宋 永明延壽）cov8 **25.8%**，是全藏引用 T945 最多的一部；
  不是注疏，但可當「楞嚴在禪門的位置」的材料。
- 卍續藏：X970《性善惡論》（傳燈）8.5%、X1470《華嚴經海印道場懺儀》7.4%、
  X1162《淨土資糧全集》3.7%。

### 6.5 近代

- **近代大師全集（\`Library.adb\`）**：圓瑛《大佛頂首楞嚴經講義》48.6 萬字（cov6 89.4%，
  全經消文型）、斌宗《楞嚴義燈》（題要釋）、慈舟《勢至圓通章講義》；
  另收蕅益《文句》《玄義》的另一版（可與 X285／X284 校勘）。CBETA 沒有圓瑛這部。
  6 字窗掃描與四庫結果見 [coverage-6gram.md](coverage-6gram.md)。
- **太虛**：《大佛頂首楞嚴經研究》10.3 萬字（cov6 90.6%，逐科消文，不是概論）、
  《楞嚴經攝論》5.9 萬字（9.5%）、《楞嚴大意》6,675 字（2.3%）（\`tx.adb\`／\`taixu.adb\`）。
- **印順**：《楞嚴經攝論》《楞嚴經研究》合刊序（\`ys.adb\`，收在《華雨香雲》）。
- **呂澂**：《楞嚴百偽》8,369 字（\`lc.adb\`）——疑偽研究，不是注疏，但近代討論繞不開它。
- 于淩波（\`yulinpo.adb\`）、玅境長老（\`miuking.adb\`）多處提及楞嚴，沒有專書。

## 7. 如果要圈選：三層建議

> 以下是選項與理由，不是定案；依 AGENTS §8，範圍仍待作者決定。

**第一層（11 家，對讀首選）**——宋明清各期代表作、思想史上有名有姓的，加近代一家：

T1799 子璿（宋）／X270 戒環（宋）／X275 交光（明）／X279 憨山（明）／X285 蕅益（明）／
X318 曾鳳儀（明）／X316 溥畹（清）／X308 通理（清）／X306 靈耀（清）／X287 錢謙益（明末清初）／
**LIB 圓瑛（民國，\`Library.adb\`）**。

**第二層（其餘 17 部全經注疏）**——要做「選注」的完整度就靠這層：
集註、箋、合論、圓通疏、秘錄、如說、證疏廣解、合轍、直指、述旨、直解、講錄、纂註、
精解評林、略疏、貫攝、正見。

**第三層（輔助）**：科判 6 部（目錄／分科）、卷首玄義 8 部（導讀）、疏記 2 部（注的注）。

**不入注疏群**：咒典 5、同名異經 1、日本撰述 5、儀軌 2（除非另做懺儀）；
現代 5 種建議另立「近代」分頁，不混進古籍注疏。

### 7.1 待作者定案（AGENTS §8）

1. **注疏收幾家**：第一層 11 家、第一＋二層 28 家，還是 53 家全收？
   （右欄作者按鈕的多寡、資料量、對齊工作量都由此決定。）
2. **科判收不收**：\`zhu-combined\` 明說「科判不收」。建議照舊不收，
   但把 6 部科文抽出來做目錄／分科結構（尤其是 X265 子璿科、X273 正脉疏科）。
3. **勢至圓通章**要不要獨立成組（X310／X311／X312）：淨土讀者會單獨找這三章。
4. **近代**（太虛 3、印順序、呂澂《楞嚴百偽》）是否另立「近代」分頁。

## 8. 未做與限制

- **Wittern Related Texts 未抓**：金剛／法華那時用過（\`wittern-related-jingang-fahua.md\`），
  可以補 text-level 關聯；本次沒有抓 T945 的頁面。
- **音義未逐條盤點**：T2125／T2128《一切經音義》收有楞嚴經音義條目，不在本清單。
- **藏譯、梵本殘卷未盤點**：不在 CBETA；要做「別譯」得另找來源。
- **頁碼未驗**：清單只有經號與冊，沒有逐部頁碼範圍；建置時要另抽。
- **分類是啟發式**：\`類別\` 依題名與卷數人工判定，cov 只作旁證；有幾部（秘錄、略疏、
  精解評林）體例特殊，開工前值得翻一下原書。
- 大正藏 catalog 是 2018 年的目錄（3,000 筆）與 2026R2 正文對齊過，經號無誤；
  但**卷數**取自 catalog，少數書可能與 XML 的 \`<extent>\` 有出入（未逐筆核）。
- **圓瑛《講義》行級頁對映是骨架**：65% 的行有錨，沒錨的沿用上一頁；段落邊界、跨頁句
  還沒細校，正式引用前要抽查（見 §4.7）。

## 9. 重跑

\`\`\`powershell
cd D:\\2026\\surangama
bun run scripts/x-catalog.ts        # X 書目（1,236 部）→ build/x-catalog.tsv
bun run scripts/coverage-scan.ts    # T945 8 字窗掃全藏 → build/coverage/*.tsv
bun run scripts/adb-survey.ts "D:\\2026\\adb-converter\\build\\adb-publish\\wxzj.adb"
bun run scripts/adb-survey.ts "D:\\2026\\adb-converter\\build\\adb-publish\\taisho.adb"
bun run scripts/modern-counts.ts    # 太虛／呂澂篇幅 → build/modern-counts.json
bun run scripts/build-inventory.ts  # 併表 → docs/commentary-inventory.tsv、本文
\`\`\`

語料路徑可用 \`$env:SURANGAMA_CORPUS\`（預設 \`D:\\2026\\adb-converter\`）、
\`$env:SURANGAMA_XML\`（預設 \`D:\\2026\\xml-p5\`）覆寫。

## 10. 產物

| 檔案 | 內容 |
|---|---|
| \`docs/commentary-inventory.tsv\` | 74 筆清單本體（含 cov8、末命中、類別、備註） |
| \`docs/commentary-inventory.md\` | 本文 |
| \`build/x-catalog.tsv\` | 卍續藏 1,236 部書目 |
| \`build/coverage/taisho.tsv\` | 大正藏 1,400 部對 T945 的覆蓋率 |
| \`build/coverage/wxzj.tsv\` | 卍續藏 804 部對 T945 的覆蓋率 |
| \`build/modern-counts.json\` | 太虛／呂澂楞嚴著作篇幅 |
`;

writeFileSync(join(DOCS, 'commentary-inventory.md'), doc);

console.log(`共 ${rows.length} 筆：T ${tRows.length}、X ${xRows.length}、引用 ${quoteRows.length}、現代 ${modernRows.length}`);
for (const k of ['全經注疏', '疏記', '卷首玄義', '科判', '單章注', '短篇', '序跋', '附錄', '儀軌', '咒典', '同名異經', '日本撰述', '引用', '現代', '母經']) {
  console.log(`  ${k}: ${by(k).length}`);
}
console.log(`寫出 docs/commentary-inventory.{tsv,md}`);
