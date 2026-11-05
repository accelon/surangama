#!/usr/bin/env bun
/**
 * 直指（識典古籍 JS2076）：逐章抓「科判鏈 + 該節經文」，供錨定用。
 *
 *   bun run scripts/fetch-zhizhi-sutra.ts
 *
 * 讀 data/kepan/zhizhi-sdg.html（catalog）
 * 寫 data/kepan/zhizhi-sutra.json（每章：id、chain、sutra）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

const first = readFileSync(join(DATA, 'kepan', 'zhizhi-sdg.html'), 'utf8');
const rd = JSON.parse(first.match(/window\._ROUTER_DATA\s*=\s*(\{.*?\});?<\/script>/s)![1]);
const v = rd.loaderData['__session/(lang$)/book/$'];

const flat: { id: string; name: string; page: number }[] = [];
function walk(list: any[]) {
  for (const c of list || []) {
    flat.push({ id: c.chapterId, name: c.chapterName?.[0]?.content || '', page: c.startPageNum || 0 });
    walk(c.subChapters || []);
  }
}
walk(v.bookInfo.catalog.chapters);

const CH = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';
const chainRe = new RegExp('[' + CH + ']');
const targets = flat.filter((x) => chainRe.test(x.name));

const OUT = join(DATA, 'kepan', 'zhizhi-sutra.json');
const done: Record<string, { chain: string; sutra: string }> = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, 'utf8'))
  : {};

function extract(html: string): { lines: string[] } {
  const m = html.match(/window\._ROUTER_DATA\s*=\s*(\{.*?\});?<\/script>/s);
  if (!m) return { lines: [] };
  const d = JSON.parse(m[1]);
  const vv = d.loaderData['__session/(lang$)/book/$'];
  if (!vv) return { lines: [] };
  const out: string[] = [];
  for (const p of vv.paragraphList || []) {
    try {
      const c = JSON.parse(p.content);
      for (const ln of c.lines || []) out.push(ln.content || '');
    } catch {}
  }
  return { lines: out };
}

async function one(t: { id: string; name: string }) {
  try {
    const r = await fetch(`https://www.shidianguji.com/book/JS2076/chapter/${t.id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();
    const { lines } = extract(html);
    let sutra = '';
    for (let i = 0; i < lines.length; i++) {
      if (chainRe.test(lines[i])) {
        for (let k = i + 1; k < Math.min(i + 4, lines.length); k++) {
          const s = (lines[k] || '').trim();
          if (s.length >= 4 && !chainRe.test(s.slice(0, 2)) && !/^[（(]/.test(s)) { sutra = s; break; }
        }
        if (sutra) break;
      }
    }
    done[t.id] = { chain: t.name, sutra };
  } catch { done[t.id] = { chain: t.name, sutra: '' }; }
}
const todo = targets.filter((x) => !done[x.id]);
let n = 0;
const WORKERS = 5;
let idx = 0;
async function worker() {
  while (idx < todo.length) {
    const t = todo[idx++];
    await one(t);
    n++;
    if (n % 25 === 0) { writeFileSync(OUT, JSON.stringify(done, null, 0) + '\n'); console.log('progress', n, '/', todo.length); }
    await Bun.sleep(200);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
writeFileSync(OUT, JSON.stringify(done, null, 0) + '\n');
console.log('完成', n, '章；有經文', Object.values(done).filter((d) => d.sutra).length);
