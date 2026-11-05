#!/usr/bin/env bun
/**
 * 句級定址表：一行一句，帶統一 sid／addr、分段、27 分節與九家科判切點計數。
 * 另出長表：一行一個科判節點，給需要追節點明細的人 join。
 *
 * 2026-11-05：在「：『」「：「」等引號前再切一次，重編句子號。
 *
 *   bun run scripts/build-sentence-tsv.ts
 *
 * 讀 data/sutra.json、data/ke-anchors.json、site/reader/kepan/kepan-data.js
 * 寫 data/sentences.tsv、data/sentence-kepan.tsv、build/sentence-split-map.tsv
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const BUILD = join(ROOT, 'build');
mkdirSync(BUILD, { recursive: true });

type Sent = { i: number; juan: number; page: string; text: string; start: number; end: number };
type Node = { id: number; lv: number; lab: string; nm: string; u: number; u2: number; off: number };
type Edition = { id: string; short: string; nodes: Node[] };
type NewSent = { i: number; juan: number; page: string; text: string; src: number };

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as { sentences: Sent[] };
const S = sutra.sentences;
const N = S.length;

const raw = readFileSync(join(ROOT, 'site', 'reader', 'kepan', 'kepan-data.js'), 'utf8');
const K = JSON.parse(raw.slice(raw.indexOf('=') + 1).trim().replace(/;\s*$/, '')) as { editions: Edition[] };
// 固定在 2026-11-05 06:09 的九家；06:39 之後 kepan-data.js 另加 YK，未納入本表。
const ED_IDS = ['X265', 'X273', 'DRBA', 'YY', 'YY1', 'YY2', 'WJ', 'YJ', 'GD'];
const ED = K.editions.filter((e) => ED_IDS.includes(e.id));

const cell = (t: string) => (t || '').replace(/[\t\r\n]+/g, ' ').trim();
const normName = (t: string) => (t || '').replace(/\s+/g, ' ').trim();

// ---- 再切分 ----
// (1) 在「：『」「：「」等引號前切開；切點留在前句（：或。），引號留給下一句。
// (2) 長句中的「『…』」：若雙括內 ≥20 漢字、且所在舊句 ≥30 漢字，在「『」前再切一刀。
// (3) 「——」也切；切在破折號後（句首的 —— 不切，避免只有標點）。
// (4) 超過 2,000 字的咒語，按全角空格「　」切。
// (5) S0046 手工按文意切並補標點（譯場資訊／筆授／譯語／如是我聞／說法處）。
const SPLIT_PATS = ['：「', '：『', '：”', '。“', '。「', '。『', '——'];
const DOUBLE_MIN_HAN = 20;      // 雙括內最少漢字
const DOUBLE_MIN_SENT_HAN = 30; // 所在舊句最少漢字
const MANTRA_MIN_LEN = 2000;    // 超過此字數的句子視為長咒語

const MANUAL_SPLITS: Record<number, string[]> = {
  0: [
    'No. 945新印大佛頂首楞嚴經序',
    '前雄武軍節度推官許洞撰',
    '楞嚴經者，括諸佛萬行之樞紐也。',
  ],
  46: [
    '大唐神龍元年，龍集乙巳，五月己卯朔，二十三日辛丑，中天竺沙門般剌蜜帝，於廣州制止道場譯出。',
    '菩薩戒弟子，前正諫大夫，同中書門下平章事，清河房融筆授。',
    '烏長國沙門彌伽釋迦譯語。',
    '如是我聞：',
    '一時，佛在室羅筏城祇桓精舍，與大比丘眾千二百五十人俱，皆是無漏大阿羅漢——',
    '佛子住持，善超諸有，能於國土成就威儀；',
  ],
};

const fullOld = S.map((s) => s.text).join('');
const oldStart = new Int32Array(N);
const oldHan = new Int32Array(N);
{
  let p = 0;
  for (let i = 0; i < N; i++) {
    oldStart[i] = p;
    oldHan[i] = (S[i].text.match(/\p{Script=Han}/gu) || []).length;
    p += S[i].text.length;
  }
}

const doubleCuts: number[] = [];
{
  let p = fullOld.indexOf('『');
  while (p >= 0) {
    const q = fullOld.indexOf('』', p + 1);
    if (q >= 0) {
      const h = (fullOld.slice(p + 1, q).match(/\p{Script=Han}/gu) || []).length;
      if (h >= DOUBLE_MIN_HAN) doubleCuts.push(p);
    }
    p = fullOld.indexOf('『', p + 1);
  }
}

function cutPositions(text: string, oldIndex: number): number[] {
  const cuts = new Set<number>();
  for (const pat of SPLIT_PATS) {
    let idx = text.indexOf(pat);
    while (idx >= 0) {
      if (pat === '——' && idx === 0) {
        // 句首的破折號是上一句的延續，不在這裡切出一個只有標點的碎片。
        idx = text.indexOf(pat, idx + 1);
        continue;
      }
      // ：”／—— 切在符號後；其餘切在冒號／句號後、開引號前。
      const cut = pat === '：”' || pat === '——' ? idx + 2 : idx + 1;
      if (cut > 0 && cut < text.length) cuts.add(cut);
      idx = text.indexOf(pat, idx + 1);
    }
  }
  if (oldHan[oldIndex] >= DOUBLE_MIN_SENT_HAN) {
    for (const gp of doubleCuts) {
      const local = gp - oldStart[oldIndex];
      if (local > 0 && local < text.length) cuts.add(local);
    }
  }
  return [...cuts].sort((a, b) => a - b);
}

const S2: NewSent[] = [];
const mapStart = new Int32Array(N);
const mapEnd = new Int32Array(N);
for (let i = 0; i < N; i++) {
  mapStart[i] = S2.length;

  const manual = MANUAL_SPLITS[i];
  if (manual) {
    for (const t of manual) S2.push({ i: S2.length, juan: S[i].juan, page: S[i].page, text: t, src: i });
    mapEnd[i] = S2.length - 1;
    continue;
  }

  // 長咒語：按全角空格切；空格本身不進句子。
  if (S[i].text.length >= MANTRA_MIN_LEN && S[i].text.includes('　')) {
    const parts = S[i].text.split('　').map((t) => t.trim()).filter(Boolean);
    for (const t of parts) S2.push({ i: S2.length, juan: S[i].juan, page: S[i].page, text: t, src: i });
    mapEnd[i] = S2.length - 1;
    continue;
  }

  const points = [...new Set([0, ...cutPositions(S[i].text, i), S[i].text.length])].sort((a, b) => a - b);
  for (let k = 0; k < points.length - 1; k++) {
    if (points[k + 1] <= points[k]) continue;
    S2.push({ i: S2.length, juan: S[i].juan, page: S[i].page, text: S[i].text.slice(points[k], points[k + 1]), src: i });
  }
  mapEnd[i] = S2.length - 1;
}

// 行首的 」／』 不應自成一句開頭：搬到前一句的句尾。
// 只搬括號，不合併短句（阿難／世尊等二字句先留著）。
for (let i = 1; i < S2.length; i++) {
  let t = S2[i].text;
  let moved = '';
  while (t.startsWith('」') || t.startsWith('』')) {
    moved += t[0];
    t = t.slice(1);
  }
  if (!moved) continue;
  if (!t) throw new Error(`closing bracket only at new sentence ${i}`);
  S2[i].text = t;
  S2[i - 1].text += moved;
}

const N2 = S2.length;

// ---- 切點與段號（沿用舊 cut 的文字位置，映射到新句首）----
const cutSet = new Set<number>();
for (const ed of ED) for (const n of ed.nodes) cutSet.add(mapStart[n.u]);
const cuts = [...cutSet].sort((a, b) => a - b);
const segId = new Array<number>(N2);
{
  let k = 0;
  for (let i = 0; i < N2; i++) {
    while (k < cuts.length && cuts[k] <= i) k++;
    segId[i] = Math.max(1, k);
  }
}

// ---- 27 分節（舊起迄映射到新句首／句尾）----
const ka = JSON.parse(readFileSync(join(DATA, 'ke-anchors.json'), 'utf8')) as {
  sections: { juan: number; code: string; title: string; startPhrase: string; startU: number; endU: number }[];
};
const secId = new Array<number>(N2).fill(0);
const secTitle = new Array<string>(N2).fill('');
ka.sections.forEach((s, idx) => {
  const label = cell(s.title) || cell(s.startPhrase) || s.code || `第${idx + 1}節`;
  const a = mapStart[s.startU];
  const b = mapEnd[s.endU];
  for (let i = a; i <= b; i++) {
    secId[i] = idx + 1;
    secTitle[i] = label;
  }
});

// ---- 每句開頭的科判節點（映射到舊句的第一個新句）----
const at = new Map<number, { ed: Edition; n: Node }[]>();
for (const ed of ED) {
  for (const n of ed.nodes) {
    const ns = mapStart[n.u];
    if (!at.has(ns)) at.set(ns, []);
    at.get(ns)!.push({ ed, n });
  }
}

// ---- 頁內句序：T945.19p106b.01 ----
const pageCount = new Map<string, number>();
const pageSeq = S2.map((s) => {
  const n = (pageCount.get(s.page) || 0) + 1;
  pageCount.set(s.page, n);
  return n;
});

const pad = (n: number, w: number) => String(n).padStart(w, '0');
const sidOf = (i: number) => 'S' + pad(i, 4);
const addrOf = (i: number) => `T945.${S2[i].page}.${pad(pageSeq[i], 2)}`;

const header = [
  'sid', 'addr', 'juan', 'page', 'text', 'han', 'seg', 'seg_start', 'sec27', 'sec27_title', 'nke', 'ke_first',
  ...ED.map((e) => `${e.id}_n`),
];
const lines = [header.join('\t')];

for (const s of S2) {
  const sid = sidOf(s.i);
  const addr = addrOf(s.i);
  const han = (s.text.match(/\p{Script=Han}/gu) || []).length;
  const hits = at.get(s.i) || [];
  const counts = ED.map((ed) => String(hits.filter((x) => x.ed.id === ed.id).length));
  const firsts = ED.map((ed) => {
    const h = hits.find((x) => x.ed.id === ed.id);
    return h ? `${ed.id}:${cell(h.n.lab)}` : '';
  }).filter(Boolean).join('; ');
  lines.push([
    sid, addr, String(s.juan), s.page, cell(s.text), String(han), String(segId[s.i]),
    String(s.i === 0 || segId[s.i] !== segId[s.i - 1] ? 1 : 0),
    String(secId[s.i]), cell(secTitle[s.i]), String(hits.length), firsts, ...counts,
  ].join('\t'));
}

// ---- 長表：一行一個節點；u/u2 映射到新句號 ----
const long = ['sid\taddr\tjuan\tpage\tedition\tshort\tnode_id\tlv\tlab\tnm\tu\tu2\toff'];
for (const s of S2) {
  const hits = at.get(s.i) || [];
  if (!hits.length) continue;
  for (const { ed, n } of hits) {
    long.push([
      sidOf(s.i), addrOf(s.i), String(s.juan), s.page, ed.id, ed.short, String(n.id), String(n.lv),
      cell(n.lab), normName(n.nm), String(mapStart[n.u]), String(mapEnd[n.u2]), String(n.off ?? 0),
    ].join('\t'));
  }
}

// ---- 舊→新句號對映，給後續遷移用 ----
const map = ['old_sid\tnew_first\tnew_last\tparts\told_text'];
for (let i = 0; i < N; i++) {
  map.push([sidOf(i), sidOf(mapStart[i]), sidOf(mapEnd[i]), String(mapEnd[i] - mapStart[i] + 1), cell(S[i].text)].join('\t'));
}

writeFileSync(join(DATA, 'sentences.tsv'), lines.join('\n') + '\n');
writeFileSync(join(DATA, 'sentence-kepan.tsv'), long.join('\n') + '\n');
writeFileSync(join(BUILD, 'sentence-split-map.tsv'), map.join('\n') + '\n');
console.log(`→ data/sentences.tsv  ${N2} 句（舊 ${N}＋切 ${N2 - N}）、${header.length} 欄`);
console.log(`→ data/sentence-kepan.tsv  ${long.length - 1} 個節點`);
console.log(`→ build/sentence-split-map.tsv  ${N} 筆舊→新對映`);
console.log(`切點 ${cuts.length}、段 ${cuts.length}；27 分節 ${ka.sections.length}`);
console.log(lines.slice(0, 3).join('\n'));

