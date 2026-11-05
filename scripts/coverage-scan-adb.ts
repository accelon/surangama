#!/usr/bin/env bun
/**
 * 6／8 字窗掃描：拿 T945 當底本，掃任意 accelon adb（Library、miuking、taixu、lc…）。
 *
 *   bun run scripts/coverage-scan-adb.ts [adb...]
 *
 * 不給參數時掃這四個：
 *   D:\accelon3\accelon3_fg\Library.adb   近代大師全集書畾
 *   D:\accelon3\accelon3_fg\miuking.adb   玅境長老說法筆錄集
 *   D:\accelon3\taixu.adb                 太虛大師全書
 *   D:\accelon3\lc.adb                    呂澂佛學著作集
 *
 * 分段依庫名：library／miuking 用 <書>，taixu 用 <文>，lc 用 <章>＋<書>。
 * 輸出 build/coverage-adb/<dbname>.tsv；同時在 stdout 印出 cov6 前段。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readAdbText } from 'D:\\2026\\adb-converter\\ts\\src\\adbtext';
import { buildIndex, coverageOf, norm, splitSentences } from './lib/ngram';

const CORPUS = process.env.SURANGAMA_CORPUS ?? 'D:\\2026\\adb-converter';
const OUT = join(import.meta.dir, '..', 'build', 'coverage-adb');
mkdirSync(OUT, { recursive: true });

const DEFAULT = [
  'D:\\accelon3\\accelon3_fg\\Library.adb',
  'D:\\accelon3\\accelon3_fg\\miuking.adb',
  'D:\\accelon3\\taixu.adb',
  'D:\\accelon3\\lc.adb',
];
const files = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;

const SEG_TAGS: Record<string, string[]> = {
  library: ['書'],
  miuking: ['書'],
  taixu: ['文'],
  lc: ['章', '書'],
};
const TITLE_RE = /楞嚴|大佛頂/;

// ---- 底本 T945（與 coverage-scan.ts 同一段）
const tAll = readFileSync(join(CORPUS, 'build', 'tei-all-2026R2.txt'), 'utf8');
const marks = [...tAll.matchAll(/<段\/><書 id="n(\d+)">([^<]*)<\/書>/g)];
const ti = marks.findIndex((m) => m[2].includes('首楞嚴經') && m[2].includes('大佛頂'));
if (ti < 0) throw new Error('找不到 T945');
const start = marks[ti].index! + marks[ti][0].length;
const end = ti + 1 < marks.length ? marks[ti + 1].index! : tAll.length;
const sutraRaw = tAll.slice(start, end).replace(/<[^>]+>/g, '');
const sutra = norm(sutraRaw);
const sentences = splitSentences(sutraRaw);
const idx6 = buildIndex(sutra, 6);
const idx8 = buildIndex(sutra, 8);
console.log(`底本 T945 norm=${sutra.length} 句=${sentences.length}；6 字窗 ${idx6.map.size}／8 字窗 ${idx8.map.size}`);

interface Seg { kind: string; title: string; from: number; to: number; text: string }

function segments(lines: string[], tags: string[]): Seg[] {
  const alt = tags.join('|');
  const re = new RegExp(`<(${alt})[^>]*>([^<]*)</\\1>`, 'g');
  const out: Seg[] = [];
  const hits: { kind: string; title: string; at: number }[] = [];
  lines.forEach((line, i) => {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(line))) hits.push({ kind: m[1], title: m[2], at: i });
  });
  for (let k = 0; k < hits.length; k++) {
    const from = hits[k].at;
    const to = k + 1 < hits.length ? hits[k + 1].at : lines.length;
    out.push({
      kind: hits[k].kind,
      title: hits[k].title,
      from, to,
      text: lines.slice(from, to).join('\n'),
    });
  }
  return out;
}

interface Row {
  kind: string; title: string; chars: number;
  cov6: number; last6: number; bins6: number;
  cov8: number; last8: number;
  sent6: number | null; mentions: number;
}

for (const file of files) {
  const t0 = Date.now();
  const db = readAdbText(file);
  const name = db.header.dbname || basename(file, '.adb');
  const tags = SEG_TAGS[name] ?? ['書'];
  const segs = segments(db.lines, tags);
  const rows: Row[] = [];
  for (const seg of segs) {
    // 先剝標籤：adb 的標籤名本身是漢字（方／篇／小字…），不剝會被算進字數與覆蓋率
    const s = norm(seg.text.replace(/<[^>]+>/g, ''));
    if (s.length < 100) continue;
    const c6 = coverageOf(idx6, sutra, s);
    if (!c6.cov) continue;
    const c8 = coverageOf(idx8, sutra, s);
    let sent6: number | null = null;
    if (c6.cov >= 0.1) {
      let chars = 0, hit = 0;
      for (const st of sentences) { chars += st.length; if (s.includes(st)) hit += st.length; }
      sent6 = chars ? hit / chars : 0;
    }
    const mentions = seg.text.split('\n').filter((l) => TITLE_RE.test(l)).length;
    rows.push({
      kind: seg.kind, title: seg.title, chars: s.length,
      cov6: c6.cov, last6: c6.lastPct, bins6: c6.bins,
      cov8: c8.cov, last8: c8.lastPct,
      sent6, mentions,
    });
  }
  rows.sort((a, b) => b.cov6 - a.cov6);
  const tsv = [['db', 'seg', 'title', 'chars', 'cov6', 'last6', 'bins6', 'cov8', 'last8', 'sent6', 'mentions'].join('\t')]
    .concat(rows.map((r) => [name, r.kind, r.title, r.chars,
      r.cov6.toFixed(4), r.last6.toFixed(4), r.bins6,
      r.cov8.toFixed(4), r.last8.toFixed(4),
      r.sent6 == null ? '' : r.sent6.toFixed(4), r.mentions].join('\t')))
    .join('\n') + '\n';
  writeFileSync(join(OUT, `${name}.tsv`), tsv);

  console.log(`\n=== ${name}（${db.header.dbcname}）${db.lines.length} 行、分段 ${segs.length}、命中 ${rows.length}、${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log('cov6   last6  cov8   chars   mentions  段名');
  for (const r of rows.slice(0, 12)) {
    console.log(`${(r.cov6 * 100).toFixed(1)}%  ${(r.last6 * 100).toFixed(1)}%  ${(r.cov8 * 100).toFixed(1)}%  ${String(r.chars).padStart(7)}  ${String(r.mentions).padStart(4)}   ${r.kind}｜${r.title}`);
  }
  const titled = rows.filter((r) => TITLE_RE.test(r.title));
  if (titled.length) {
    console.log('--- 標題含楞嚴／大佛頂 ---');
    for (const r of titled) {
      console.log(`${(r.cov6 * 100).toFixed(1)}%  ${(r.last6 * 100).toFixed(1)}%  ${(r.cov8 * 100).toFixed(1)}%  ${String(r.chars).padStart(7)}  ${r.kind}｜${r.title}`);
    }
  }
  db.close();
}
console.log(`\n寫出 ${OUT}`);
