#!/usr/bin/env bun
/**
 * 楞嚴咒詞級對齊 pilot：T945 S2587.3–.17 ↔ KU-PDF M1.01–M1.11。
 * 中文用 mantra-syllables 最長匹配切單元；梵文按空格/連字號切詞；
 * 用單調 DP + 轉寫相似度對齊（允許 1:1、1:2、2:1、gap）。
 *
 *   bun run scripts/align-mantra-words.ts
 *
 * 讀 data/tracks-zh.tsv、tracks-sa.tsv、align.tsv、mantra-syllables.tsv、mantra-words.tsv
 * 寫 data/mantra-word-align.tsv、build/mantra-word-align-debug.tsv
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const BUILD = join(ROOT, 'build');

const zhTracks = new Map(readFileSync(join(DATA, 'tracks-zh.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [track_id, base_sid, part, display_sid, addr, juan, page, text] = l.split('\t');
  return [track_id, { track_id, display_sid, text }];
}));
const saTracks = new Map(readFileSync(join(DATA, 'tracks-sa.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [track_id, section, seq, text] = l.split('\t');
  return [track_id, { track_id, section: +section, seq: +seq, text }];
}));
const syll = readFileSync(join(DATA, 'mantra-syllables.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [zh, sa, conf] = l.split('\t');
  return { zh, sa, conf };
}).sort((a, b) => b.zh.length - a.zh.length);
const wordLemma = new Map(readFileSync(join(DATA, 'mantra-words.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [word, lemma] = l.split('\t');
  return [word.toLowerCase(), lemma];
}));

const isHan = (c: string) => { const cp = c.codePointAt(0) ?? 0; return (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0x20000 && cp <= 0x2fa1f); };
const hanOnly = (s: string) => Array.from(s).filter(isHan).join('');
const norm = (s: string) => s.toLowerCase()
  .replace(/[.,;:!?·]/g, '')
  .replace(/ṃ/g, 'm').replace(/ḥ/g, 'h').replace(/ā/g, 'a').replace(/ī/g, 'i').replace(/ū/g, 'u')
  .replace(/ṛ/g, 'r').replace(/ś/g, 's').replace(/ṣ/g, 's').replace(/ṇ/g, 'n')
  .replace(/ṭ/g, 't').replace(/ḍ/g, 'd').replace(/ñ/g, 'n').replace(/ṅ/g, 'n').replace(/-/g, '');
function lev(a: string, b: string): number {
  if (a === b) return 0;
  const n = a.length, m = b.length;
  if (!n) return m; if (!m) return n;
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    for (let j = 1; j <= m; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[m];
}
const sim = (a: string, b: string) => {
  const A = norm(a), B = norm(b);
  if (!A || !B) return 0;
  return 1 - lev(A, B) / Math.max(A.length, B.length);
};
function lemmaOf(word: string): string {
  const w = word.toLowerCase().replace(/[.,;:!?]/g, '');
  const hit = wordLemma.get(w);
  if (hit) return hit;
  const rules: [RegExp, string][] = [
    [/(ebhyaḥ|ebhya|bhyaḥ|bhya)$/, ''], [/(ānāṃ|ānām|īnāṃ|īnām)$/, ''],
    [/(āṃ|īṃ|ūṃ)$/, ''], [/(asya|āya)$/, ''], [/(eṣu|āni)$/, ''],
    [/(aṃ|am)$/, ''], [/(aḥ|o|uḥ)$/, ''], [/(e)$/, ''], [/(ā|ī|ū)$/, ''],
  ];
  const parts = w.split('-'); const last = parts.pop() || '';
  for (const [re] of rules) { if (!re.test(last)) continue; const st = last.replace(re, ''); if (st.length >= 3) return [...parts, st].join('-'); }
  for (const [re] of rules) { if (!re.test(w)) continue; const st = w.replace(re, ''); if (st.length >= 3) return st.replace(/-+$/, ''); }
  return w;
}

function segmentChinese(tracks: { track_id: string; text: string }[]): { zh: string; hint: string; track_id: string; index: number }[] {
  const out: { zh: string; hint: string; track_id: string; index: number }[] = [];
  for (const t of tracks) {
    let text = t.text;
    // 去掉咒前標題／咒後譯註
    const start = text.search(/[南娜][牟無]/);
    if (start > 0) text = text.slice(start);
    const end = text.search(/唐天竺|右此呪句/);
    if (end > 0) text = text.slice(0, end);
    const h = hanOnly(text);
    let i = 0;
    while (i < h.length) {
      const hit = syll.find((s) => h.startsWith(s.zh, i));
      if (hit) {
        out.push({ zh: hit.zh, hint: hit.sa, track_id: t.track_id, index: out.length });
        i += hit.zh.length;
      } else {
        out.push({ zh: h[i], hint: '?', track_id: t.track_id, index: out.length });
        i++;
      }
    }
  }
  return out;
}

function tokenizeSa(text: string): { word: string; lemma: string }[] {
  const raw = text.replace(/[.,;:!?]/g, ' ').split(/\s+/).filter(Boolean);
  const out: { word: string; lemma: string }[] = [];
  for (const w of raw) {
    // 連字號切段；保留完整 compound 作 lemma 參考
    const parts = w.split('-').filter(Boolean);
    if (parts.length > 1) for (const p of parts) out.push({ word: p, lemma: lemmaOf(p) });
    else out.push({ word: w, lemma: lemmaOf(w) });
  }
  return out;
}

type Pair = { c: { zh: string; hint: string; track_id: string; index: number }; s: { word: string; lemma: string }[]; rel: string; conf: string; cost: number; cText: string; sText: string };
function align(C: any[], S: { word: string; lemma: string }[]): Pair[] {
  const m = C.length, n = S.length;
  const INF = 1e9;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(INF));
  const bt: string[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(''));
  dp[0][0] = 0;
  for (let i = 0; i <= m; i++) for (let j = 0; j <= n; j++) {
    const v = dp[i][j]; if (v >= INF) continue;
    if (i < m && v + 0.9 < dp[i + 1][j]) { dp[i + 1][j] = v + 0.9; bt[i + 1][j] = 'skipC'; }
    if (j < n && v + 0.7 < dp[i][j + 1]) { dp[i][j + 1] = v + 0.7; bt[i][j + 1] = 'skipS'; }
    if (i < m && j < n) {
      const sc = sim(C[i].hint, S[j].word);
      const cost = 1 - sc + (sc < 0.2 ? 0.8 : 0);
      if (v + cost < dp[i + 1][j + 1]) { dp[i + 1][j + 1] = v + cost; bt[i + 1][j + 1] = '1:1'; }
    }
    if (i < m && j + 1 < n) {
      const sc = sim(C[i].hint, S[j].word + S[j + 1].word);
      const cost = 1 - sc + 0.05 + (sc < 0.2 ? 0.8 : 0);
      if (v + cost < dp[i + 1][j + 2]) { dp[i + 1][j + 2] = v + cost; bt[i + 1][j + 2] = '1:2'; }
    }
    if (i + 1 < m && j < n) {
      const sc = sim(C[i].hint + C[i + 1].hint, S[j].word);
      const cost = 1 - sc + 0.05 + (sc < 0.2 ? 0.8 : 0);
      if (v + cost < dp[i + 2][j + 1]) { dp[i + 2][j + 1] = v + cost; bt[i + 2][j + 1] = '2:1'; }
    }
  }
  const out: Pair[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    const op = bt[i][j];
    if (op === '1:1') { out.push({ c: C[i - 1], s: [S[j - 1]], rel: '1:1', conf: sim(C[i - 1].hint, S[j - 1].word) >= 0.6 ? 'A' : sim(C[i - 1].hint, S[j - 1].word) >= 0.3 ? 'B' : 'C', cost: dp[i][j], cText: C[i - 1].zh, sText: S[j - 1].word }); i--; j--; }
    else if (op === '1:2') { out.push({ c: C[i - 1], s: [S[j - 2], S[j - 1]], rel: '1:2', conf: 'B', cost: dp[i][j], cText: C[i - 1].zh, sText: S[j - 2].word + ' ' + S[j - 1].word }); i--; j -= 2; }
    else if (op === '2:1') { out.push({ c: C[i - 2], s: [S[j - 1]], rel: '2:1', conf: 'B', cost: dp[i][j], cText: C[i - 2].zh + C[i - 1].zh, sText: S[j - 1].word }); i -= 2; j--; }
    else if (op === 'skipC') { out.push({ c: C[i - 1], s: [], rel: 'gap', conf: 'C', cost: dp[i][j], cText: C[i - 1].zh, sText: '' }); i--; }
    else if (op === 'skipS') { out.push({ c: { zh: '', hint: '', track_id: '', index: -1 }, s: [S[j - 1]], rel: 'gap', conf: 'C', cost: dp[i][j], cText: '', sText: S[j - 1].word }); j--; }
    else break;
  }
  return out.reverse();
}

const alignRows = readFileSync(join(DATA, 'align.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const groups = new Map<string, string[]>();
for (const [a, b] of alignRows) {
  if (!b) continue;
  if (!groups.has(b)) groups.set(b, []);
  groups.get(b)!.push(a);
}

const out = ['sa_unit\tsa_word\tsa_lemma\tsa_index\tzh_track\tzh_unit\tzh_units\tzh_text\trelation\tconfidence\tcost'];
const dbg = ['sa_unit\tzh\trelation\tsa\tcost'];
for (const [unit, tracks] of groups) {
  const sa = saTracks.get(unit);
  if (!sa) continue;
  const zs = tracks.map((id) => zhTracks.get(id)).filter(Boolean) as any[];
  const C = segmentChinese(zs);
  const S = tokenizeSa(sa.text);
  let pairs = align(C, S);
  pairs.forEach((p, idx) => {
    out.push([unit, p.sText, p.s.map((x) => x.lemma).join(' '), String(idx), p.c.track_id, p.c.zh, p.cText, p.cText, p.rel, p.conf, p.cost.toFixed(2)].join('\t'));
    dbg.push([unit, p.cText, p.rel, p.sText, p.cost.toFixed(2)].join('\t'));
  });
}
writeFileSync(join(DATA, 'mantra-word-align.tsv'), out.join('\n') + '\n');
writeFileSync(join(BUILD, 'mantra-word-align-debug.tsv'), dbg.join('\n') + '\n');
console.log(`word align rows ${out.length - 1}; groups ${groups.size}`);
console.log(out.slice(0, 12).join('\n'));


