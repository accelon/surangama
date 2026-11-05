#!/usr/bin/env bun
/**
 * 抓「詩詞匯」的《大佛頂首楞嚴經講義》（圓瑛，24 卷）全文。
 *
 *   bun run scripts/fetch-yuanying.ts
 *
 * 產物（vendor/ 不進版控）：
 *   vendor/yuanying/shicihui/{id}-{title}.txt   逐卷純文字
 *   vendor/yuanying/shicihui-full.txt           合併（保留卷標題）
 *
 * 只抓 zh-tw（繁體）版；每頁間隔 300ms。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const OUT = join(ROOT, 'vendor', 'yuanying');
const DIR = join(OUT, 'shicihui');
mkdirSync(DIR, { recursive: true });

const BOOK = 'https://www.shicihui.com/zh-tw/book/dafudingshoulengyanjingjiangyi';
const CHAPTERS: { id: number; title: string }[] = [
  { id: 39148, title: '圓瑛法匯序一' },
  { id: 39149, title: '圓瑛法匯序二' },
  { id: 39150, title: '大佛頂首楞嚴經講義序' },
  { id: 39151, title: '自序' },
  ...Array.from({ length: 24 }, (_, i) => ({
    id: 39152 + i,
    title: `第${['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
      '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
      '二十一', '二十二', '二十三', '二十四'][i]}卷`,
  })),
];

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
};

/** 取出 <div id="chapter-text"> 的內文，轉成純文字段落。 */
function extract(html: string): string {
  const start = html.indexOf('id="chapter-text"');
  if (start < 0) throw new Error('找不到 chapter-text');
  const from = html.indexOf('>', start) + 1;
  // 內文只含 <p>，取下一個 </div> 即可
  const end = html.indexOf('</div>', from);
  let body = html.slice(from, end < 0 ? from + 200000 : end);
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');
  for (const [k, v] of Object.entries(ENTITIES)) body = body.split(k).join(v);
  body = body.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
  return body
    .split('\n')
    .map((l) => l.replace(/[ \t\u3000]+/g, ' ').trim())
    .filter((l, i, a) => l || a[i - 1])
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const parts: string[] = [];
for (const ch of CHAPTERS) {
  const url = `${BOOK}/${ch.id}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) surangama-study/0.1' },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const text = extract(await res.text());
  const han = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  writeFileSync(join(DIR, `${ch.id}-${ch.title}.txt`), text + '\n');
  parts.push(`# ${ch.title}\n\n${text}`);
  console.log(`${ch.id}\t${ch.title}\t漢字 ${han}`);
  await Bun.sleep(300);
}

writeFileSync(join(OUT, 'shicihui-full.txt'), parts.join('\n\n') + '\n');
const allHan = (parts.join('').match(/[\u3400-\u9fff]/g) ?? []).length;
console.log(`\n合計漢字 ${allHan}；寫出 ${join(OUT, 'shicihui-full.txt')}`);
