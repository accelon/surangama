#!/usr/bin/env bun
/**
 * 英譯按「科判分節」切塊：每節一段英文，比整卷小、比逐句可靠。
 *
 *   bun run scripts/build-section-english.ts
 *
 * 讀 data/english.json、data/ke-anchors.json、data/sutra.json
 * 寫 data/english-sections.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  sentences: { i: number; juan: number; text: string }[];
};
const ke = JSON.parse(readFileSync(join(DATA, 'ke-anchors.json'), 'utf8')) as {
  sections: { juan: number; code: string; title: string; startU: number; endU: number }[];
};
const english = JSON.parse(readFileSync(join(DATA, 'english.json'), 'utf8')) as {
  juan: Record<string, string>;
};

const charLen: Record<number, number> = {};
for (const s of sutra.sentences) charLen[s.i] = s.text.length;

const out: Record<string, string> = {};

// 逐卷：把該卷英譯按各節中文字數比例切片
for (const juan of Object.keys(english.juan)) {
  const en = english.juan[juan]
    .replace(/\r/g, '')
    .split('\n')
    .filter((l) => !/^\s*\d{1,4}\s*$/.test(l))
    .join('\n');
  if (!en.trim()) continue;
  const secs = ke.sections
    .map((s, idx) => ({ ...s, n: idx + 1 }))
    .filter((s) => s.juan === Number(juan));
  if (!secs.length) continue;
  const lens = secs.map((s) => {
    let n = 0;
    for (let u = s.startU; u <= s.endU; u++) n += charLen[u] || 0;
    return n;
  });
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  secs.forEach((s, k) => {
    const rawA = Math.round((acc / total) * en.length);
    acc += lens[k];
    const rawB = k === secs.length - 1 ? en.length : Math.round((acc / total) * en.length);
    const snap = (p: number) => {
      const win = en.slice(p, p + 260);
      const m = /[.!?]['"”’]?\s/.exec(win);
      if (m) return p + m.index + m[0].length;
      const sp = win.indexOf(' ');
      return sp >= 0 ? p + sp + 1 : p;
    };
    const a = k === 0 ? 0 : snap(rawA);
    const b = k === secs.length - 1 ? en.length : Math.max(a, snap(rawB));
    out[String(s.n)] = en.slice(a, b).trim();
  });
}

writeFileSync(join(DATA, 'english-sections.json'), JSON.stringify({ schema: 1, bySection: out }) + '\n');
const filled = Object.values(out).filter(Boolean).length;
console.log(`分節 ${ke.sections.length}，有英譯 ${filled}`);
for (const s of ke.sections.slice(0, 6)) {
  const i = ke.sections.indexOf(s) + 1;
  console.log(i, s.code, s.juan + '卷', (out[String(i)] || '').slice(0, 50));
}
