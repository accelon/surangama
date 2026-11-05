#!/usr/bin/env bun
/**
 * 由 CBETA XML-P5 的 `X`（卍新纂續藏）檔頭建書目：
 *   檔名、冊、經號、題名、作者、卷數、字數（由 wxzj TEI 文本算）。
 *
 * 產出 build/x-catalog.tsv 與 build/x-catalog.json。
 * 語料唯讀；可用 $env:SURANGAMA_XML 改 XML 根、$env:SURANGAMA_CORPUS 改 build 根。
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const XML_ROOT = process.env.SURANGAMA_XML ?? 'D:\\2026\\xml-p5';
const CORPUS = process.env.SURANGAMA_CORPUS ?? 'D:\\2026\\adb-converter';
const OUT = join(import.meta.dir, '..', 'build');
mkdirSync(OUT, { recursive: true });

interface XBook {
  file: string;
  vol: number;
  no: number;
  title: string;
  author: string;
  juan: string;
}

/** 取檔頭裡第一個 <open …>text</close>；open 可帶屬性（例如 `title level="m"`）。 */
const tag = (head: string, open: string, close = open): string => {
  const m = new RegExp(`<${open}[^>]*>([\\s\\S]*?)</${close}>`).exec(head);
  return (m?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
};

const books: XBook[] = [];
for (const volDir of readdirSync(join(XML_ROOT, 'X')).sort()) {
  const mVol = /^X(\d+)$/.exec(volDir);
  if (!mVol) continue;
  const dir = join(XML_ROOT, 'X', volDir);
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.xml')) continue;
    const m = /^X(\d+)n(\d+)([a-z]?)\.xml$/i.exec(f);
    if (!m) {
      console.error('跳過不認得的檔名', f);
      continue;
    }
    const head = readFileSync(join(dir, f), 'utf8').slice(0, 8000).split('</fileDesc>')[0];
    const title = tag(head, 'title level="m"', 'title') || '';
    const author = tag(head, 'author');
    const extent = tag(head, 'extent');
    books.push({ file: f, vol: Number(m[1]), no: Number(m[2]) + (m[3] ? m[3] : ''), title, author, juan: extent });
  }
}
books.sort((a, b) => a.file.localeCompare(b.file));

// 字數：從 wxzj TEI 的每一部書切片算（去標記後算非空白字元）。
// 以「出現順序」對應 XML 檔序（兩邊都是冊／號升序）；標題相同時才不會撞。
const TEI = join(CORPUS, 'build', 'wxzj-tei-2026R2-new.txt');
const all = readFileSync(TEI, 'utf8');
const heads = [...all.matchAll(/<段\/><書 id="n(\d+)">([^<]*)<\/書>/g)];
if (heads.length !== books.length) {
  console.error(`⚠ TEI 書數 ${heads.length} ≠ XML 書數 ${books.length}；字數改用標題比對`);
}
const byOrder = heads.length === books.length;
const charsByIndex: number[] = [];
const charsByTitle = new Map<string, number>();
heads.forEach((h, i) => {
  const start = h.index! + h[0].length;
  const end = i + 1 < heads.length ? heads[i + 1].index! : all.length;
  const raw = all.slice(start, end).replace(/<[^>]+>/g, '').replace(/[^\u3400-\u9fff]/g, '');
  charsByIndex.push(raw.length);
  if (!charsByTitle.has(h[2])) charsByTitle.set(h[2], raw.length);
  if (byOrder && books[i].title && books[i].title !== h[2]) {
    console.error(`⚠ 第 ${i + 1} 部標題不同：XML「${books[i].title}」 TEI「${h[2]}」`);
  }
});

const rows = books.map((b, i) => ({
  ...b,
  chars: byOrder ? charsByIndex[i] : charsByTitle.get(b.title) ?? 0,
}));

writeFileSync(
  join(OUT, 'x-catalog.tsv'),
  ['file\tvol\tno\ttitle\tauthor\tjuan\tchars']
    .concat(rows.map((r) => [r.file, r.vol, r.no, r.title, r.author, r.juan, r.chars].join('\t')))
    .join('\n') + '\n',
);
writeFileSync(join(OUT, 'x-catalog.json'), JSON.stringify(rows, null, 1) + '\n');
console.log(`X 書目 ${rows.length} 筆 → build/x-catalog.tsv（有字數 ${rows.filter((r) => r.chars > 0).length} 筆）`);
