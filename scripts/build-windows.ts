#!/usr/bin/env bun
/**
 * 全書讀窗：用蒙鈔【疏】前的經文引文當邊界，把每一卷切成小讀窗。
 *
 *   bun run scripts/build-windows.ts
 *
 * 讀 data/works/X287.json、data/sutra.json → 寫 data/windows-all.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const norm = (t: string) => t.replace(/[「」『』（）()\s，。、；：！？…—·：]/g, '');

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  sentences: { i: number; juan: number; text: string }[];
};
const x287 = JSON.parse(readFileSync(join(DATA, 'works', 'X287.json'), 'utf8')) as { lines: { text: string }[] };

const SN = sutra.sentences.map((s) => ({ i: s.i, j: s.juan, t: s.text, n: norm(s.text) }));
const juanRange: Record<number, [number, number]> = {};
for (const s of SN) {
  if (!juanRange[s.j]) juanRange[s.j] = [s.i, s.i];
  juanRange[s.j][1] = s.i;
}

function findSent(q: string): number | null {
  const n = norm(q);
  if (n.length < 4) return null;
  const p = n.slice(0, Math.min(n.length, 24));
  const head = SN.find((x) => x.n.startsWith(p));
  if (head) return head.i;
  const p2 = n.slice(0, 12);
  const inner = SN.find((x) => x.n.includes(p2));
  return inner ? inner.i : null;
}

// 收集錨點
const anchors: { u: number; q: string }[] = [];
let buf: string[] = [];
for (const ln of x287.lines.map((l) => l.text)) {
  if (ln.includes('【疏】')) {
    const q = buf.length ? buf[buf.length - 1].trim() : '';
    const u = q ? findSent(q) : null;
    if (u != null) anchors.push({ u, q });
    buf = [];
  } else buf.push(ln);
}

const windows: { u0: number; u1: number; title: string; juan: number }[] = [];
for (const j of Object.keys(juanRange).map(Number)) {
  const [lo, hi] = juanRange[j];
  const inJ = anchors.filter((a) => {
    const s = SN.find((x) => x.i === a.u);
    return s && s.j === j;
  });
  const byU = new Map<number, string>();
  for (const a of inJ) if (!byU.has(a.u)) byU.set(a.u, a.q.replace(/[。：，；]$/, '').slice(0, 18));
  const us = [...byU.keys()].sort((a, b) => a - b);
  if (!us.length) {
    windows.push({ u0: lo, u1: hi, title: SN.find((x) => x.i === lo)!.t.slice(0, 16), juan: j });
    continue;
  }
  // 開頭缺口
  if (us[0] > lo) {
    windows.push({ u0: lo, u1: us[0] - 1, title: '（卷首）' + SN.find((x) => x.i === lo)!.t.slice(0, 14), juan: j });
  }
  us.forEach((u, k) => {
    const u1 = k + 1 < us.length ? us[k + 1] - 1 : hi;
    windows.push({ u0: u, u1: u1 < u ? u : u1, title: byU.get(u) || SN.find((x) => x.i === u)!.t.slice(0, 16), juan: j });
  });
}

const covered = windows.reduce((a, w) => a + (w.u1 - w.u0 + 1), 0);
const total = SN.length;
console.log(`讀窗 ${windows.length}，覆蓋 ${covered}/${total}`);
writeFileSync(join(DATA, 'windows-all.json'), JSON.stringify({ schema: 1, windows }, null, 1) + '\n');
