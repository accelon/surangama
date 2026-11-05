#!/usr/bin/env bun
/**
 * 前端資料包：site/data.js（window.SURANGAMA）
 *
 * 範圍（2026-11-04 定案）：
 *   注疏 6 家＋圓瑛、科判 6 部、英譯 1 種（Luk）、速查辭典。BTTS 不收。
 *
 *   bun run scripts/build-site-data.ts
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const OUT = join(ROOT, 'site');
mkdirSync(OUT, { recursive: true });

const ZHU: Record<string, { title: string; author: string }> = {
  T1799: { title: '首楞嚴義疏注經', author: '宋 子璿集' },
  X270: { title: '楞嚴經要解', author: '宋 戒環解' },
  X275: { title: '楞嚴經正脉疏', author: '明 真鑑述' },
  X279: { title: '楞嚴經通議', author: '明 德清述' },
  X285: { title: '楞嚴經文句', author: '明 智旭撰' },
  X318: { title: '楞嚴經宗通', author: '明 曾鳳儀' },
  LIB: { title: '大佛頂首楞嚴經講義', author: '民國 圓瑛' },
};
const KE: Record<string, { title: string; author: string }> = {
  X265: { title: '楞嚴經義疏注經科', author: '宋 子璿述' },
  X273: { title: '楞嚴經正脉疏科', author: '明 真鑑作' },
  X278: { title: '楞嚴經通議略科', author: '明 德清排訂' },
  X290: { title: '楞嚴經直指科文', author: '' },
  X304: { title: '楞嚴經觀心定解科', author: '清 靈耀述' },
  X314: { title: '楞嚴經寶鏡疏科文', author: '清 溥畹撰' },
};

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8'));
const worksOnDisk: Record<string, { title: string; text: string }> = {};
for (const f of readdirSync(join(DATA, 'works'))) {
  const w = JSON.parse(readFileSync(join(DATA, 'works', f), 'utf8'));
  worksOnDisk[w.id] = w;
}

const zhu: Record<string, { title: string; author: string; text: string }> = {};
for (const id of Object.keys(ZHU)) {
  const w = worksOnDisk[id];
  if (w) zhu[id] = { ...ZHU[id], text: w.text };
}
const ke: Record<string, { title: string; author: string; text: string }> = {};
for (const id of Object.keys(KE)) {
  const w = worksOnDisk[id];
  if (w) ke[id] = { ...KE[id], text: w.text };
}

const align: Record<string, Record<string, (number | string)[][]>> = {};
for (const id of Object.keys(zhu)) {
  try {
    const a = JSON.parse(readFileSync(join(DATA, 'align', `${id}.json`), 'utf8'));
    const m: Record<string, (number | string)[][]> = {};
    for (const rec of a.sentences) m[rec.s] = rec.frags.map((x: { start: number; end: number; page: string }) => [x.start, x.end, x.page]);
    align[id] = m;
  } catch { /* 沒有對齊就算了 */ }
}

const english = JSON.parse(readFileSync(join(DATA, 'english.json'), 'utf8'));
const lc = JSON.parse(readFileSync(join(DATA, 'lc.json'), 'utf8'));
const glossary = JSON.parse(readFileSync(join(DATA, 'glossary.json'), 'utf8'));

const payload = {
  schema: 1,
  sutra: { no: sutra.no, title: sutra.title, sentences: sutra.sentences },
  zhu,
  ke,
  align,
  extra: { LC: { title: lc.title, author: lc.author, text: lc.text } },
  english: { label: english.label, juan: english.juan },
  glossary: { categories: glossary.categories, entries: glossary.entries },
};

const js = 'window.SURANGAMA=' + JSON.stringify(payload) + ';\n';
writeFileSync(join(OUT, 'data.js'), js);
console.log(`site/data.js ${(js.length / 1048576).toFixed(1)} MB`);
console.log(`注疏 ${Object.keys(zhu).length}、科判 ${Object.keys(ke).length}、英譯卷 ${Object.keys(english.juan).length}、詞條 ${glossary.entries.length}`);
