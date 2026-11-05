#!/usr/bin/env bun
/**
 * 用 adb-converter 的 adb 讀取器（accelon26 同一套 format/adbtext）盤點已發佈的 .adb：
 *   - 列出含「楞嚴／大佛頂」的書（<書>）
 *   - 也列出含同樣字樣的章／節／文等節點（有的書把論文放在章裡）
 *   - 統計全文出現次數
 *
 *   bun run scripts/adb-survey.ts <adb> [<adb>...]
 */
import { readAdbText } from 'D:\\2026\\adb-converter\\ts\\src\\adbtext';

const files = process.argv.slice(2);
const RE_BOOK = /<書[^>]*>([^<]*)<\/書>/;
const RE_NODE = /<(章|節|品|分|篇|文|部|干)[^>]*>([^<]*)<\/\1>/;
const WANT = /楞嚴|大佛頂/;

for (const file of files) {
  const t0 = Date.now();
  const db = readAdbText(file);
  const h = db.header;
  console.log(`\n=== ${file}`);
  console.log(`dbname=${h.dbname} dbcname=${h.dbcname} lines=${db.lines.length} size=${(db.size / 1048576).toFixed(1)}MiB ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  let book = '';
  let vol = '';
  const books: string[] = [];
  const nodes: string[] = [];
  let occ = 0;
  for (const line of db.lines) {
    const named = WANT.test(line);
    if (named) occ++;
    const mv = /^<冊[^>]*>([^<]*)<\/冊>/.exec(line);
    if (mv) vol = mv[1];
    const m = RE_BOOK.exec(line);
    if (m) {
      book = m[1];
      if (WANT.test(book)) books.push(`書\t${vol}\t${book}`);
      continue;
    }
    const mn = RE_NODE.exec(line);
    if (mn && WANT.test(mn[2])) nodes.push(`${mn[1]}\t（${book}）${mn[2]}`);
  }
  console.log(books.join('\n') || '（書目無）');
  if (nodes.length) console.log('--- 章／文節點 ---\n' + nodes.join('\n'));
  console.log(`書 ${books.length} 部；含「楞嚴／大佛頂」的行 ${occ}`);
  db.close();
}
