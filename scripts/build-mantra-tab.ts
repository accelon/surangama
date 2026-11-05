#!/usr/bin/env bun
/**
 * 產生閱讀器用的咒語頁資料（draft）：window.MANTRA。
 * M1 有 12 個 exact 詞級 unit；M1 其餘與 M2–M5 為 unit-level approx（中文範圍按梵詞數分配）。
 * 這樣五會都能讀；approx unit 標 alignment:'approx'，reader 顯示「詞級待補」。
 *
 *   bun run scripts/build-mantra-tab.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const OUT = join(ROOT, 'site', 'reader', 'mantra');
mkdirSync(OUT, { recursive: true });

const read = (f: string) => readFileSync(join(DATA, f), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t').map((x) => x.replace(/\r$/, '')));
const old = (JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as { sentences: { text: string }[] }).sentences;

const tracks = read('tracks-zh.tsv').map((r) => ({ track_id: r[0], base_sid: r[1], part: +r[2], display_sid: r[3], text: r[7], han: +r[8] }));
const trackById = new Map(tracks.map((t) => [t.track_id, t]));
const saUnits = read('tracks-sa.tsv').map((r) => ({ id: r[0], section: +r[1], seq: +r[2], text: r[3] }));
const saById = new Map(saUnits.map((s) => [s.id, s]));
const alignRows = read('align.tsv');
const wordRows = read('mantra-word-align.tsv');
const meanings = new Map(read('mantra-meanings.tsv').map((r) => [r[0], (r[1] || '').trim()]));
const hints = new Map(read('mantra-hints.tsv').map((r) => [r[0], (r[1] || '').trim()]));
const wordInfo = new Map(read('mantra-words.tsv').map((r) => [r[0].toLowerCase(), { lemma: r[1], freq: +r[3] }]));
const lemmaFreq = new Map(read('mantra-lemmas.tsv').map((r) => [r[0], +r[1]]));

const isHan = (c: string) => { const cp = c.codePointAt(0) ?? 0; return (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0x20000 && cp <= 0x2fa1f); };
const hanOnly = (s: string) => Array.from(s).filter(isHan).join('');

// track -> old u / char offsets
const cursor = new Map<number, number>();
function locateText(text: string, u = 2587): { u: number; char: [number, number] } {
  const s = old[u]?.text ?? '';
  let from = cursor.get(u) ?? 0;
  let at = s.indexOf(text, from);
  if (at < 0) at = s.indexOf(text);
  if (at < 0) {
    const h = hanOnly(text);
    const hs = hanOnly(s);
    const hi = hs.indexOf(h.slice(0, Math.min(8, h.length)));
    at = hi >= 0 ? Math.max(0, s.indexOf(h.slice(0, 4))) : 0;
  }
  cursor.set(u, at + text.length);
  return { u, char: [at, at + text.length] };
}

// ---- T945 S2587 pieces, split at the four assembly boundaries
const parts = new Map(tracks.filter((t) => t.base_sid === 'S2587').map((t) => [t.part, t]));
const piece = (text: string) => {
  if (!text) return null;
  const { u, char } = locateText(text);
  const L = tracks.find((t) => t.base_sid === 'S2587' && t.text.includes(text));
  return { track_id: L?.track_id || '', display_sid: L?.display_sid || '', text, u, char };
};
const splitAt = (part: number, marker: string, side: 'before' | 'after') => {
  const t = parts.get(part);
  if (!t) return null;
  const at = t.text.indexOf(marker);
  if (at < 0) return piece(t.text);
  return piece(side === 'before' ? t.text.slice(0, at) : t.text.slice(at));
};
const seqPieces = (a: number, b: number) => {
  const out: any[] = [];
  for (let n = a; n <= b; n++) { const t = parts.get(n); if (t) { const p = piece(t.text); if (p) out.push(p); } }
  return out;
};
const sectionPieces: Record<number, any[]> = {
  1: [...seqPieces(3, 135), splitAt(136, '烏𤙖', 'before')].filter(Boolean),
  2: [splitAt(136, '烏𤙖', 'after'), ...seqPieces(137, 175), splitAt(176, '囉闍', 'before')].filter(Boolean),
  3: [splitAt(176, '囉闍', 'after'), ...seqPieces(177, 268), splitAt(269, '婆伽梵', 'before')].filter(Boolean),
  4: [splitAt(269, '婆伽梵', 'after'), ...seqPieces(270, 327), splitAt(328, '突瑟吒', 'before')].filter(Boolean),
  5: [splitAt(328, '突瑟吒', 'after'), ...seqPieces(329, 422)].filter(Boolean),
};

const tokenize = (text: string) => text.replace(/[.,;:!?]/g, ' ').split(/\s+/).filter(Boolean);
const lemmaOf = (w: string) => {
  const x = w.toLowerCase().replace(/[.,;:!?]/g, '');
  const hit = wordInfo.get(x);
  if (hit) return hit;
  const rules = [/(ebhyaḥ|ebhya|bhyaḥ|bhya)$/, /(ānāṃ|ānām|īnāṃ|īnām)$/, /(āṃ|īṃ|ūṃ)$/, /(asya|āya)$/, /(eṣu|āni)$/, /(aṃ|am)$/, /(aḥ|o|uḥ)$/, /(e)$/, /(ā|ī|ū)$/];
  const ps = x.split('-'); const last = ps.pop() || '';
  for (const re of rules) { if (!re.test(last)) continue; const st = last.replace(re, ''); if (st.length >= 3) return { lemma: [...ps, st].join('-'), freq: 0 }; }
  return { lemma: x, freq: 0 };
};

// exact units from align
const exactGroups = new Map<string, string[]>();
for (const [a, b] of alignRows) {
  if (!a || !b) continue;
  if (!exactGroups.has(b)) exactGroups.set(b, []);
  exactGroups.get(b)!.push(a);
}

const units: any[] = [];
const exactTrackIds = new Set<string>();

function exactUnit(unitId: string, trackIds: string[]) {
  const s = saById.get(unitId);
  if (!s) return;
  const rows = wordRows.filter((r) => r[0] === unitId);
  const words: any[] = [];
  for (const r of rows) {
    const [saUnit, saWord, saLemma, , zhTrack, zhUnit, zhUnits, , relation, confidence] = r;
    const rel = relation === '1:2' ? '1:n' : relation === '2:1' ? 'n:1' : relation;
    const partsSa = saWord.trim().split(/\s+/).filter(Boolean);
    const partsLem = saLemma.trim().split(/\s+/).filter(Boolean);
    for (let k = 0; k < partsSa.length; k++) {
      const lemma = partsLem[k] || partsLem[0] || partsSa[k];
      const L = tracks.find((t) => t.track_id === zhTrack);
      const zhText = zhUnits || zhUnit || '';
      let char: [number, number] = [0, 0];
      if (L && zhText) {
        const s0 = old[2587]?.text ?? '';
        let at = s0.indexOf(zhText, cursor.get(2587) ?? 0);
        if (at < 0) at = s0.indexOf(zhText);
        if (at >= 0) char = [at, at + zhText.length];
      }
      words.push({
        i: words.length, sa: partsSa[k], lemma,
        translit: zhUnits || zhUnit || '', meaning: meanings.get(lemma) || '',
        freq: lemmaFreq.get(lemma) ?? 0,
        relation: rel, confidence, track_id: zhTrack || '', u: L ? [2587] : [], char,
      });
    }
  }
  units.push({
    id: unitId, assembly: 'M1', seq: s.seq, sa: s.text,
    zh: trackIds.map((id) => trackById.get(id)?.text || '').join(''),
    track_ids: trackIds, u: [2587], alignment: 'exact', gap: false, words,
  });
  for (const id of trackIds) exactTrackIds.add(id);
}

// M1 exact 12; M1.06 gap
for (const [unitId, ids] of [...exactGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) exactUnit(unitId, ids);
if (alignRows.some((r) => !r[0] && r[1] === 'M1.06')) {
  const s = saById.get('M1.06');
  if (s) {
    const words = tokenize(s.text).map((w, i) => {
      const inf = lemmaOf(w);
      return { i, sa: w, lemma: inf.lemma, translit: hints.get(inf.lemma) || '', meaning: meanings.get(inf.lemma) || '',
        freq: lemmaFreq.get(inf.lemma) ?? 0, relation: 'gap', confidence: 'A', track_id: '', u: [], char: [0, 0] };
    });
    units.push({ id: 'M1.06', assembly: 'M1', seq: s.seq, sa: s.text, zh: '', track_ids: [], u: [], alignment: 'gap', gap: true, words });
  }
}

// approx units: distribute remaining pieces by Sanskrit word count
for (const sec of [1, 2, 3, 4, 5]) {
  const secUnits = saUnits.filter((u) => u.section === sec).sort((a, b) => a.seq - b.seq);
  const exactIds = new Set([...exactGroups.keys()].filter((id) => saById.get(id)?.section === sec));
  const approxUnits = secUnits.filter((u) => !exactIds.has(u.id) && u.id !== 'M1.06');
  const pieces = sectionPieces[sec].filter((p) => !exactTrackIds.has(p.track_id));
  const totalW = approxUnits.reduce((a, u) => a + tokenize(u.text).length, 0) || 1;
  let cursorP = 0, cumW = 0;
  for (let i = 0; i < approxUnits.length; i++) {
    const u = approxUnits[i];
    cumW += tokenize(u.text).length;
    const target = i === approxUnits.length - 1 ? pieces.length : Math.round(pieces.length * cumW / totalW);
    const remainUnits = approxUnits.length - i;
    const remainPieces = pieces.length - cursorP;
    const want = Math.max(1, target - cursorP);
    const take = Math.min(want, Math.max(0, remainPieces - (remainUnits - 1)));
    const ps = pieces.slice(cursorP, cursorP + take);
    cursorP += take;
    const trackIds = [...new Set(ps.map((p) => p.track_id).filter(Boolean))];
    const zh = ps.map((p) => p.text).join('');
    const us = [...new Set(ps.map((p) => p.u))];
    const char: [number, number] = ps.length ? [Math.min(...ps.map((p) => p.char[0])), Math.max(...ps.map((p) => p.char[1]))] : [0, 0];
    const words = tokenize(u.text).map((w, wi) => {
      const inf = lemmaOf(w);
      const lemma = inf.lemma;
      return {
        i: wi, sa: w, lemma,
        translit: hints.get(lemma) || '', meaning: meanings.get(lemma) || '',
        freq: lemmaFreq.get(lemma) ?? 0,
        relation: 'approx', confidence: 'C',
        track_id: trackIds[0] || '', u: us.length ? [us[0]] : [], char,
      };
    });
    units.push({ id: u.id, assembly: 'M' + sec, seq: u.seq, sa: u.text, zh, track_ids: trackIds, u: us, alignment: ps.length ? 'approx' : 'gap', gap: !ps.length, words });
  }
}

units.sort((a, b) => +a.id.slice(1).split('.')[0] - +b.id.slice(1).split('.')[0] || a.seq - b.seq);

// lexicon
const lex = new Map<string, any>();
for (const u of units) for (const w of u.words) {
  if (!w.lemma || w.relation === 'gap') continue;
  if (!lex.has(w.lemma)) lex.set(w.lemma, { lemma: w.lemma, translit: w.translit, meaning: w.meaning, freq: w.freq, units: new Set<string>() });
  const x = lex.get(w.lemma)!;
  x.units.add(u.id);
  if (!x.meaning && w.meaning) x.meaning = w.meaning;
  if (!x.translit && w.translit) x.translit = w.translit;
}

const assemblies = [1, 2, 3, 4, 5].map((n) => {
  const us = units.filter((u) => u.assembly === 'M' + n);
  return {
    id: 'M' + n, no: n, title: ['第一會', '第二會', '第三會', '第四會', '第五會'][n - 1],
    total: saUnits.filter((u) => u.section === n).length,
    covered: us.length, word_covered: us.filter((u) => u.alignment === 'exact').length,
    units: us.map((u) => u.id), track_ids: us.flatMap((u) => u.track_ids),
  };
});

// links all S2587 tracks
const links: any[] = [];
for (const t of tracks.filter((x) => x.base_sid === 'S2587')) {
  const { u, char } = locateText(t.text);
  links.push({ track_id: t.track_id, display_sid: t.display_sid, u, char, text: t.text });
}

const data = {
  schema: 1,
  title: '楞嚴咒',
  source: 'T945 般剌蜜帝本／KU-PDF 不空本',
  coverage: { units: units.length, total: 143, exact_units: units.filter((u) => u.alignment === 'exact').length,
    approx_units: units.filter((u) => u.alignment === 'approx').length,
    gap_units: units.filter((u) => u.alignment === 'gap').length,
    assemblies: 5, total_assemblies: 5, note: 'M1 exact 11 + M1.06 gap；其餘 approx（中文範圍按梵詞數分配）' },
  assemblies, units,
  lexicon: [...lex.values()].map((x) => ({ ...x, units: [...x.units] })).sort((a, b) => b.freq - a.freq || a.lemma.localeCompare(b.lemma)),
  links,
};

writeFileSync(join(DATA, 'mantra-tab.json'), JSON.stringify(data, null, 1) + '\n');
writeFileSync(join(OUT, 'mantra-data.js'), 'window.MANTRA=' + JSON.stringify(data) + ';\n');
console.log(`units ${units.length} (exact ${data.coverage.exact_units}, approx ${data.coverage.approx_units}, gap ${data.coverage.gap_units}); words ${units.reduce((a, u) => a + u.words.length, 0)}; lexicon ${data.lexicon.length}; links ${links.length}`);
for (const a of assemblies) console.log(a.id, a.title, `${a.covered}/${a.total}`, `word ${a.word_covered}`);




