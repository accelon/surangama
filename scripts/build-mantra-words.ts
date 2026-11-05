#!/usr/bin/env bun
/**
 * 梵咒詞表 + 簡單去屈折（draft）。
 *
 *   bun run scripts/build-mantra-words.ts
 *
 * 讀 data/tracks-sa.tsv、data/mantra-syllables.tsv
 * 寫 data/mantra-words.tsv、data/mantra-lemmas.tsv
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

const sa = readFileSync(join(DATA, 'tracks-sa.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [track_id, section, seq, text] = l.split('\t');
  return { track_id, section: +section, seq: +seq, text };
});
const hintRows = readFileSync(join(DATA, 'mantra-syllables.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [zh, s, conf] = l.split('\t');
  return { zh, sa: s, conf };
});
const norm = (s: string) => s.toLowerCase()
  .replace(/[.,;:!?·]/g, '')
  .replace(/ṃ/g, 'm').replace(/ḥ/g, 'h').replace(/ā/g, 'a').replace(/ī/g, 'i').replace(/ū/g, 'u')
  .replace(/ṛ/g, 'r').replace(/ś/g, 's').replace(/ṣ/g, 's').replace(/ṇ/g, 'n')
  .replace(/ṭ/g, 't').replace(/ḍ/g, 'd').replace(/ñ/g, 'n').replace(/ṅ/g, 'n').replace(/-/g, '');
const lemmaHints = new Map(readFileSync(join(DATA, 'mantra-hints.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => { const [lemma, zh] = l.split('\t'); return [lemma, zh]; }));
const hintByNorm = new Map<string, string[]>();
for (const h of hintRows) {
  const k = norm(h.sa);
  if (!hintByNorm.has(k)) hintByNorm.set(k, []);
  hintByNorm.get(k)!.push(h.zh);
}

const LEMMA_RULES: [RegExp, string][] = [
  [/^(.*)-(ebhyaḥ|ebhya|bhyaḥ|bhya)$/, '-bhyaḥ'],
  [/(ebhyaḥ|ebhya|bhyaḥ|bhya)$/, '-bhyaḥ'],
  [/(ānāṃ|ānām|īnāṃ|īnām)$/, '-ānāṃ'],
  [/(āṃ|īṃ|ūṃ)$/, '-āṃ/īṃ/ūṃ'],
  [/(asya)$/, '-asya'],
  [/(āya)$/, '-āya'],
  [/^(.*)-(eṣu)$/, '-eṣu'],
  [/(eṣu)$/, '-eṣu'],
  [/(ena|aiḥ|ebhiḥ)$/, '-ena/aiḥ/ebhiḥ'],
  [/(sya|asmai|ataḥ)$/, '-sya/asmai/ataḥ'],
  [/^(.*)-(e)$/, '-e'],
  [/(e)$/, '-e'],
  [/(yāmi|āmi|anti|ati|ntu)$/, '-verb'],
  [/(āni)$/, '-āni'],
  [/(aṃ|am)$/, '-am'],
  [/(aḥ)$/, '-aḥ'],
  [/(o)$/, '-o'],
  [/(uḥ)$/, '-uḥ'],
  [/(ā|ī|ū)$/, '-ā/ī/ū'],
  [/(e)$/, '-e'],
];
function lemmaOf(word: string): { lemma: string; rule: string } {
  const w = word.toLowerCase().replace(/[.,;:!?]/g, '');
  const parts = w.split('-');
  const last = parts.pop() || '';
  for (const [re, rule] of LEMMA_RULES) {
    if (!re.test(last)) continue;
    const stem = last.replace(re, '');
    if (stem.length >= 3) return { lemma: [...parts, stem].join('-'), rule };
  }
  // 整詞 fallback（複合詞的末段太短時）
  for (const [re, rule] of LEMMA_RULES) {
    if (!re.test(w)) continue;
    const stem = w.replace(re, '');
    if (stem.length >= 3) return { lemma: stem.replace(/-+$/, ''), rule };
  }
  return { lemma: w, rule: '' };
}

type Row = { word: string; lemma: string; rule: string; sections: Set<number>; count: number };
const byWord = new Map<string, Row>();
for (const u of sa) {
  const words = u.text.replace(/[.,;:!?]/g, ' ').split(/\s+/).filter(Boolean);
  for (const raw of words) {
    const word = raw.toLowerCase();
    const { lemma, rule } = lemmaOf(word);
    if (!byWord.has(word)) byWord.set(word, { word, lemma, rule, sections: new Set(), count: 0 });
    const r = byWord.get(word)!;
    r.count++; r.sections.add(u.section);
  }
}
const rows = [...byWord.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
const out = ['word\tlemma\trule\tcount\tsections\tzh_hint'];
for (const r of rows) {
  const hint = [...new Set([lemmaHints.get(r.lemma), ...(hintByNorm.get(norm(r.word)) || []), ...(hintByNorm.get(norm(r.lemma)) || [])].filter(Boolean))].slice(0, 4).join(';');
  out.push([r.word, r.lemma, r.rule, String(r.count), [...r.sections].sort().join(','), hint].join('\t'));
}
writeFileSync(join(DATA, 'mantra-words.tsv'), out.join('\n') + '\n');

const byLemma = new Map<string, { count: number; variants: Set<string>; sections: Set<number> }>();
for (const r of rows) {
  if (!byLemma.has(r.lemma)) byLemma.set(r.lemma, { count: 0, variants: new Set(), sections: new Set() });
  const x = byLemma.get(r.lemma)!;
  x.count += r.count; x.variants.add(r.word); for (const s of r.sections) x.sections.add(s);
}
const lem = ['lemma\tcount\tvariants\tsections\tzh_hint'];
for (const [lemma, x] of [...byLemma.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))) {
  const hint = [...new Set([lemmaHints.get(lemma), ...(hintByNorm.get(norm(lemma)) || [])].filter(Boolean))].slice(0, 4).join(';');
  lem.push([lemma, String(x.count), [...x.variants].sort().join(';'), [...x.sections].sort().join(','), hint].join('\t'));
}
writeFileSync(join(DATA, 'mantra-lemmas.tsv'), lem.join('\n') + '\n');
console.log(`words ${rows.length}; lemmas ${byLemma.size}; → data/mantra-words.tsv, data/mantra-lemmas.tsv`);
console.log(out.slice(0, 8).join('\n'));





