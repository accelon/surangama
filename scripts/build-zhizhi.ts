#!/usr/bin/env bun
/**
 * 《楞嚴經直指》(識典古籍 JS2076) 的科判樹：catalog 的章名自帶甲乙鏈，
 * 逐段拆成節點，層級即鏈的深度。
 *
 *   bun run scripts/build-zhizhi.ts
 *
 * 讀 data/kepan/zhizhi-sdg.html → 寫 data/kepan/zhizhi.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const CH = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';

const h = readFileSync(join(DATA, 'kepan', 'zhizhi-sdg.html'), 'utf8');
const d = JSON.parse(h.match(/window\._ROUTER_DATA\s*=\s*(\{.*?\});?<\/script>/s)![1]);
const v = d.loaderData['__session/(lang$)/book/$'];

const flat: { name: string; page: number }[] = [];
function walk(list: any[]) {
  for (const c of list || []) {
    flat.push({ name: c.chapterName?.[0]?.content || '', page: c.startPageNum || 0 });
    walk(c.subChapters || []);
  }
}
walk(v.bookInfo.catalog.chapters);

const re = new RegExp('([' + CH + '])(初|二|三|四|五|六|七|八|九|十)', 'g');
type N = { lv: number; lab: string; nm: string; par: number | null; ch: number[]; u: number; u2: number };
const nodes: N[] = [];
const path: number[] = []; // 每個層級目前的節點 id
for (const item of flat) {
  const name = item.name;
  const marks: { lv: number; lab: string; pos: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  const rx = new RegExp(re.source, 'g');
  while ((m = rx.exec(name))) marks.push({ lv: CH.indexOf(m[1]) + 1, lab: m[1] + m[2], pos: m.index, end: m.index + m[0].length });
  if (!marks.length) continue;
  for (let k = 0; k < marks.length; k++) {
    const seg = name.slice(marks[k].end, k + 1 < marks.length ? marks[k + 1].pos : undefined);
    const nm = seg.replace(/分[一二三四五六七八九十]+$/, '').replace(/[，。；：、]$/, '').trim();
    if (!nm) continue;
    const lv = Math.min(marks[k].lv, path.length + 1);
    while (path.length >= lv) path.pop();
    const par = lv > 1 ? (path[lv - 2] ?? null) : null;
    const id = nodes.length;
    nodes.push({ lv, lab: marks[k].lab, nm, par, ch: [], u: 0, u2: 0 });
    if (par != null) nodes[par].ch.push(id);
    path[lv - 1] = id;
    for (let q = lv; q < path.length; q++) path[q] = undefined as any;
  }
}

const N = nodes.length;
nodes.forEach((nd, i) => { nd.u = Math.round((i * 3731) / Math.max(1, N - 1)); });
let cur = 0;
for (const nd of nodes) { if (nd.u < cur) nd.u = cur; cur = nd.u; }
for (let i = 0; i < N; i++) nodes[i].u2 = i + 1 < N ? Math.max(nodes[i].u, nodes[i + 1].u - 1) : 3731;

console.log(`節點 ${N}，層 ${Math.max(...nodes.map((n) => n.lv))}，根 ${nodes.filter((n) => n.par == null).length}`);
console.log(nodes.slice(0, 8).map((n) => n.lab + n.nm.slice(0, 8)).join(' | '));
writeFileSync(join(DATA, 'kepan', 'zhizhi.json'), JSON.stringify({ schema: 1, nodes }, null, 0) + '\n');
