#!/usr/bin/env bun
/**
 * 識典古籍《楞嚴經直指》(JS2076) 15 章全文抓取（含甲乙科判）。
 *
 *   bun run scripts/fetch-zhizhi-sdg.ts
 *
 * 讀 data/kepan/zhizhi-sdg.html（第一章，含 catalog）
 * 寫 data/kepan/zhizhi-chapters.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

const first = readFileSync(join(DATA, 'kepan', 'zhizhi-sdg.html'), 'utf8');
const rd = JSON.parse(first.match(/window\._ROUTER_DATA\s*=\s*(\{.*?\});?<\/script>/s)![1]);
const v = rd.loaderData['__session/(lang$)/book/$'];
const chapters = v.bookInfo.catalog.chapters as { chapterId: string; chapterName: { content: string }[] }[];

function textOf(html: string): string {
  const m = html.match(/window\._ROUTER_DATA\s*=\s*(\{.*?\});?<\/script>/s);
  if (!m) return '';
  const d = JSON.parse(m[1]);
  const vv = d.loaderData['__session/(lang$)/book/$'];
  if (!vv) return '';
  const out: string[] = [];
  for (const p of vv.paragraphList || []) {
    try {
      const c = JSON.parse(p.content);
      for (const ln of c.lines || []) out.push(ln.content || '');
    } catch {}
  }
  return out.join('\n');
}

const result: { id: string; name: string; text: string }[] = [];
for (const ch of chapters) {
  if (ch.chapterId === v.ssrChapterId) {
    result.push({ id: ch.chapterId, name: ch.chapterName?.[0]?.content || '', text: textOf(first) });
    continue;
  }
  const url = `https://www.shidianguji.com/book/JS2076/chapter/${ch.chapterId}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();
    result.push({ id: ch.chapterId, name: ch.chapterName?.[0]?.content || '', text: textOf(html) });
    console.log(ch.chapterId, html.length, (result.at(-1)!.text || '').length);
  } catch (e) {
    console.log(ch.chapterId, 'FAIL', String(e).slice(0, 60));
  }
  await Bun.sleep(1200);
}
writeFileSync(join(DATA, 'kepan', 'zhizhi-chapters.json'), JSON.stringify(result, null, 0) + '\n');
console.log('chapters', result.length, 'chars', result.reduce((a, b) => a + b.text.length, 0));
