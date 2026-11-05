#!/usr/bin/env bun
/**
 * 以 T945《大佛頂首楞嚴經》為底本，掃大正藏與卍新纂續藏，算每部書對經文的
 * 8 字窗覆蓋率（cov8）、整句覆蓋率（sentenceCov）、末命中（lastPct）。
 *
 * 方法移植自 adb-converter 的 build/jingqun/find-xiaowen.ts（金剛經）；
 * 核心在 scripts/lib/ngram.ts（6／8 字窗共用）。
 *
 *   bun run scripts/coverage-scan.ts [0945]
 *
 * 語料唯讀：$env:SURANGAMA_CORPUS 預設 D:\2026\adb-converter。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildIndex, coverageOf, norm, orderedCoverage, splitSentences } from './lib/ngram';

const CORPUS = process.env.SURANGAMA_CORPUS ?? 'D:\\2026\\adb-converter';
const TARGET_NO = (process.argv[2] ?? '0945').toLowerCase();
const N = Number(process.env.SURANGAMA_N ?? 8);
const OUT = join(import.meta.dir, '..', 'build', N === 8 ? 'coverage' : `coverage-${N}`);
mkdirSync(OUT, { recursive: true });

const THRESHOLD = 0.8;

interface Row {
  bookIdx: number;
  corpus: 'T' | 'X';
  vol: number; no: string; title: string; author: string; juan: string;
  cov: number; ordered: number; sentenceCov: number; len: number; hits: number; lastPct: number; bins: number;
}

/** 切出「書」的界線；回傳每部書的標題、起點（標記之後）與標記起點。 */
function parseBooks(all: string) {
  const marks: { id: number; title: string; at: number; start: number }[] = [];
  const re = /<段\/><書 id="n(\d+)">([^<]*)<\/書>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(all))) marks.push({ id: +m[1], title: m[2], at: m.index, start: m.index + m[0].length });
  const vols = [...all.matchAll(/<冊 id="(\d+)">([^<]*)<\/冊>/g)].map((x) => ({ vol: +x[1], at: x.index! }));
  return { marks, vols };
}

function coverBooks(
  all: string,
  corpus: 'T' | 'X',
  sutra: string,
  idx: ReturnType<typeof buildIndex>,
  sentences: string[],
) {
  const { marks, vols } = parseBooks(all);
  const rows: Row[] = [];
  let vi = 0;
  for (let k = 0; k < marks.length; k++) {
    const b = marks[k];
    const end = k + 1 < marks.length ? marks[k + 1].at : all.length;
    const raw = all.slice(b.start, end).replace(/<[^>]+>/g, '');
    const s = norm(raw);
    if (!s) continue;
    const c = coverageOf(idx, sutra, s);
    if (!c.cov) continue;
    let sentChars = 0, sentHit = 0;
    for (const st of sentences) { sentChars += st.length; if (s.includes(st)) sentHit += st.length; }
    const ordered = c.cov >= 0.4 ? orderedCoverage(idx, s, sutra) : -1;
    while (vi + 1 < vols.length && vols[vi + 1].at < b.start) vi++;
    rows.push({
      bookIdx: k + 1, corpus, vol: vols[vi]?.vol ?? 0, no: '', title: b.title, author: '', juan: '',
      cov: c.cov, ordered, sentenceCov: sentChars ? sentHit / sentChars : 0,
      len: s.length, hits: c.hits, lastPct: c.lastPct, bins: c.bins,
    });
  }
  return rows;
}

console.log('讀大正藏 …');
const tAll = readFileSync(join(CORPUS, 'build', 'tei-all-2026R2.txt'), 'utf8');
const tBooks = parseBooks(tAll);
const targetIdx = tBooks.marks.findIndex((b) => b.title.includes('首楞嚴經') && b.title.includes('大佛頂'));
if (targetIdx < 0) throw new Error('找不到 T945');
const target = tBooks.marks[targetIdx];
const targetEnd = targetIdx + 1 < tBooks.marks.length ? tBooks.marks[targetIdx + 1].at : tAll.length;
const sutraRaw = tAll.slice(target.start, targetEnd).replace(/<[^>]+>/g, '');
const sutra = norm(sutraRaw);
const sentences = splitSentences(sutraRaw);
console.log(`底本：${target.title}（第 ${targetIdx + 1} 部）raw=${sutraRaw.length} norm=${sutra.length} 句=${sentences.length}`);

const idx = buildIndex(sutra, N);
console.log(`${N} 字窗 ${idx.map.size} 種／${idx.hashes.length} 個`);

const catalog = new Map<string, { no: string; author: string; juan: string }>();
for (const line of readFileSync(join(CORPUS, 'build', 'jingqun', 'catalog.tsv'), 'utf8').split(/\r?\n/).slice(1)) {
  if (!line) continue;
  const p = line.split('\t');
  catalog.set(p[0], { no: p[2], author: p[7], juan: p[3] });
}

const t0 = Date.now();
const tRows = coverBooks(tAll, 'T', sutra, idx, sentences);
let titleMatch = 0;
tRows.forEach((r) => {
  const c = catalog.get(String(r.bookIdx));
  if (c) { r.no = c.no; r.author = c.author; r.juan = c.juan; }
  if (tBooks.marks[r.bookIdx - 1]?.title === r.title) titleMatch++;
});
console.log(`大正藏：掃 ${tBooks.marks.length} 部，命中 ${tRows.length} 部，catalog 對上 ${titleMatch} 部，${((Date.now() - t0) / 1000).toFixed(1)}s`);

console.log('讀卍續藏 …');
const xAll = readFileSync(join(CORPUS, 'build', 'wxzj-tei-2026R2-new.txt'), 'utf8');
const xCat = readFileSync(join(import.meta.dir, '..', 'build', 'x-catalog.tsv'), 'utf8')
  .split(/\r?\n/).slice(1).filter(Boolean)
  .map((l) => l.split('\t'));
const xRows = coverBooks(xAll, 'X', sutra, idx, sentences);
xRows.forEach((r) => {
  const c = xCat[r.bookIdx - 1];
  if (c && c[3] === r.title) { r.no = c[2]; r.author = c[4]; r.juan = c[5]; }
});
console.log(`卍續藏：掃 1236 部，命中 ${xRows.length} 部`);

const write = (name: string, rows: Row[]) => {
  rows.sort((a, b) => b.cov - a.cov || b.sentenceCov - a.sentenceCov);
  writeFileSync(join(OUT, name),
    [['corpus', 'vol', 'no', 'title', 'author', 'juan', `cov${N}`, 'ordered', 'sentenceCov', 'lastPct', 'bins', 'bookLen', 'hits'].join('\t')]
      .concat(rows.map((r) => [r.corpus, r.vol, r.no, r.title, r.author, r.juan,
        r.cov.toFixed(4), r.ordered < 0 ? '' : r.ordered.toFixed(4), r.sentenceCov.toFixed(4), r.lastPct.toFixed(4), r.bins, r.len, r.hits].join('\t')))
      .join('\n') + '\n');
};
write('taisho.tsv', tRows);
write('wxzj.tsv', xRows);

writeFileSync(join(OUT, 'summary.json'), JSON.stringify({
  schema: 1,
  target: { no: `T${TARGET_NO.toUpperCase()}`, title: target.title, rawLen: sutraRaw.length, normLen: sutra.length, sentences: sentences.length },
  method: { n: N, threshold: THRESHOLD, metric: 'target n-gram coverage' },
  taisho: { scanned: tBooks.marks.length, matched: tRows.length },
  wxzj: { scanned: 1236, matched: xRows.length },
  taishoTop: tRows.slice(0, 40),
  wxzjTop: xRows.slice(0, 80),
}, null, 1) + '\n');
console.log(`寫出 ${OUT}`);
