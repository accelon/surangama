#!/usr/bin/env bun
/**
 * 注疏：把第一層 11 家從 adb 抽成 data/works/{id}.json
 *
 *   bun run scripts/extract-works.ts
 *
 * 每部：{ id, title, author, juan, pages, text, lines:[{page,text}] }
 * 頁碼來自 adb 的 <頁 id="…"/>；圓瑛本（LIB）沒有頁 id，page 留空。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readAdbText } from 'D:\\2026\\adb-converter\\ts\\src\\adbtext';

const CORPUS = process.env.SURANGAMA_CORPUS ?? 'D:\\2026\\adb-converter';
const ROOT = join(import.meta.dir, '..');
const OUT = join(ROOT, 'data', 'works');
mkdirSync(OUT, { recursive: true });

interface Work { id: string; adb: string; title: string }

const WORKS: Work[] = [
  { id: 'T1799', adb: join(CORPUS, 'build', 'adb-publish', 'taisho.adb'), title: '首楞嚴義疏注經' },
  { id: 'X270', adb: join(CORPUS, 'build', 'adb-publish', 'wxzj.adb'), title: '楞嚴經要解' },
  { id: 'X275', adb: join(CORPUS, 'build', 'adb-publish', 'wxzj.adb'), title: '楞嚴經正脉疏' },
  { id: 'X279', adb: join(CORPUS, 'build', 'adb-publish', 'wxzj.adb'), title: '楞嚴經通議' },
  { id: 'X285', adb: join(CORPUS, 'build', 'adb-publish', 'wxzj.adb'), title: '楞嚴經文句' },
  { id: 'X318', adb: join(CORPUS, 'build', 'adb-publish', 'wxzj.adb'), title: '楞嚴經宗通' },
  { id: 'X316', adb: join(CORPUS, 'build', 'adb-publish', 'wxzj.adb'), title: '楞嚴經寶鏡疏' },
  { id: 'X308', adb: join(CORPUS, 'build', 'adb-publish', 'wxzj.adb'), title: '楞嚴經指掌疏' },
  { id: 'X306', adb: join(CORPUS, 'build', 'adb-publish', 'wxzj.adb'), title: '楞嚴經觀心定解' },
  { id: 'X287', adb: join(CORPUS, 'build', 'adb-publish', 'wxzj.adb'), title: '楞嚴經疏解蒙鈔' },
  { id: 'LIB', adb: 'D:\\accelon3\\accelon3_fg\\Library.adb', title: '大佛頂首楞嚴經講義' },
  // 科判 6 部
  { id: 'X265', adb: join(CORPUS, 'build', 'adb-publish', 'wxzj.adb'), title: '楞嚴經義疏注經科' },
  { id: 'X273', adb: join(CORPUS, 'build', 'adb-publish', 'wxzj.adb'), title: '楞嚴經正脉疏科' },
  { id: 'X278', adb: join(CORPUS, 'build', 'adb-publish', 'wxzj.adb'), title: '楞嚴經通議略科' },
  { id: 'X290', adb: join(CORPUS, 'build', 'adb-publish', 'wxzj.adb'), title: '楞嚴經直指科文' },
  { id: 'X304', adb: join(CORPUS, 'build', 'adb-publish', 'wxzj.adb'), title: '楞嚴經觀心定解科' },
  { id: 'X314', adb: join(CORPUS, 'build', 'adb-publish', 'wxzj.adb'), title: '楞嚴經寶鏡疏科文' },
];

const cache = new Map<string, string[]>();
const linesOf = (adb: string) => {
  if (!cache.has(adb)) cache.set(adb, readAdbText(adb).lines);
  return cache.get(adb)!;
};

for (const w of WORKS) {
  const lines = linesOf(w.adb);
  const i = lines.findIndex((l) => new RegExp(`<書[^>]*>${w.title}</書>`).test(l));
  if (i < 0) { console.error(`找不到 ${w.title}`); continue; }
  let j = lines.findIndex((l, k) => k > i && /<書[^>]*>/.test(l));
  if (j < 0) j = lines.length;
  const seg = lines.slice(i, j);

  let page = '';
  const rows: { page: string; text: string }[] = [];
  let juan = 0;
  for (const line of seg) {
    const m = /<頁 id="([^"]+)"\/>/.exec(line);
    if (m) page = m[1];
    if (/^<卷[^>]*>/.test(line)) { juan++; continue; }
    const text = line.replace(/<[^>]+>/g, '').trim();
    if (!text) continue;
    rows.push({ page, text });
  }
  const text = rows.map((r) => r.text).join('\n');
  writeFileSync(join(OUT, `${w.id}.json`), JSON.stringify({
    schema: 1,
    id: w.id,
    title: w.title,
    juan,
    pages: [...new Set(rows.map((r) => r.page).filter(Boolean))].length,
    chars: (text.match(/[\u3400-\u9fff]/g) ?? []).length,
    text,
    lines: rows,
  }, null, 0) + '\n');
  console.log(`${w.id}\t卷 ${juan}\t頁 ${[...new Set(rows.map((r) => r.page).filter(Boolean))].length}\t行 ${rows.length}\t漢字 ${(text.match(/[\u3400-\u9fff]/g) ?? []).length}`);
}
