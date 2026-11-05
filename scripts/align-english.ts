#!/usr/bin/env bun
/**
 * 把 Luk 英譯（按卷）切成句子，依字數比例對到 T945 的每一句。
 * 只求「一句英文對一句中文」的瀏覽粒度，不是精確對勘。
 *
 *   bun run scripts/align-english.ts
 *
 * 讀 data/english.json、data/sutra.json → 寫 data/english-sents.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  sentences: { i: number; juan: number; text: string }[];
};
const english = JSON.parse(readFileSync(join(DATA, 'english.json'), 'utf8')) as {
  juan: Record<string, string>;
};

function splitSentences(t: string): string[] {
  const s = t.replace(/\r/g, '').replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  // 句末標點後接大寫／引號／數字才切；避免 Mr. / B.C. 之類
  const parts = s.split(/(?<=[.!?…])\s+(?=["“'(\[]?[A-Z0-9])/);
  const out: string[] = [];
  for (const p of parts) {
    const x = p.trim();
    if (!x) continue;
    if (out.length && (x.length < 25 || /^(Mr|Mrs|Ms|Dr|Ven|B\.C|A\.D)\.?$/.test(x))) out[out.length - 1] += ' ' + x;
    else out.push(x);
  }
  return out;
}

const result: Record<string, Record<string, string>> = {};
let total = 0;
for (const juan of Object.keys(english.juan)) {
  const cn = sutra.sentences.filter((s) => s.juan === Number(juan));
  const enSents = splitSentences(english.juan[juan]);
  if (!cn.length || !enSents.length) continue;
  const cnLen = cn.map((s) => Math.max(1, s.text.length));
  const enLen = enSents.map((s) => Math.max(1, s.length));
  const cnTotal = cnLen.reduce((a, b) => a + b, 0);
  const enTotal = enLen.reduce((a, b) => a + b, 0);
  // 英文句子的累積比例端點
  const enCum: number[] = [];
  let acc = 0;
  for (const l of enLen) { acc += l; enCum.push(acc / enTotal); }
  let cnAcc = 0;
  let ei = 0;
  const map: Record<string, string> = {};
  for (let k = 0; k < cn.length; k++) {
    cnAcc += cnLen[k];
    const frac = cnAcc / cnTotal;
    while (ei < enCum.length - 1 && enCum[ei] < frac) ei++;
    map[String(cn[k].i)] = enSents[ei];
  }
  result[juan] = map;
  total += Object.keys(map).length;
}

writeFileSync(join(DATA, 'english-sents.json'), JSON.stringify({ schema: 1, byJuan: result }) + '\n');
for (const j of Object.keys(result)) console.log(`卷${j}: ${Object.keys(result[j]).length} 句`);
console.log('合計', total, '→ data/english-sents.json');
