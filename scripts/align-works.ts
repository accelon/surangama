#!/usr/bin/env bun
/**
 * 對齊：把每部注疏的 8 字窗錨到主文 T945 的句子上（單調貪心，vcpp 的簡化版）。
 *
 *   bun run scripts/align-works.ts
 *
 * 讀 data/sutra.json、data/works/*.json
 * 寫 data/align/{id}.json、data/align-summary.json
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { normWithMap } from './lib/ngram';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
// 重切模式：0＝不重切（基數）、1＝P0＋P1、2＝P2' 規則 B ＋保護欄。2026-11-12 定案用 2。
const RESLICE_P = Number(process.env.RESLICE_P ?? 2);
// RESLICE_OUT：改寫出到別的目錄（A/B 對照用，例如 RESLICE_P=0 的基數版），預設 data/align
const OUT = process.env.RESLICE_OUT ? join(ROOT, process.env.RESLICE_OUT) : join(DATA, 'align');
mkdirSync(OUT, { recursive: true });

const N = Number(process.env.ALIGN_N ?? 8);
const BASE = 131;
const POW = (() => { let p = 1; for (let i = 0; i < N; i++) p = Math.imul(p, BASE); return p | 0; })();

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  normLen: number;
  sentences: { i: number; juan: number; page: string; text: string; start: number; end: number }[];
};
const sents = sutra.sentences;
const sNorm = sents.map((s) => s.text.replace(/[^\u3400-\u9fff]/g, '')).join(''); // 佔位，下面用真正的字流
void sNorm;

// 主文字流：直接由句子 text 正規化接起來（與 extract-sutra 的 normLen 對齊）
const sText = sents.map((s) => s.text).join('');
const { text: sutraNorm, map: sutraMap } = normWithMap(sText);
void sutraMap;

// 句子在 sutraNorm 的位置：用每句正規化長度累加（與 extract-sutra 的 start/end 一致）
let acc = 0;
const sentStart: number[] = [];
const sentEnd: number[] = [];
for (const s of sents) {
  const n = normWithMap(s.text).text.length;
  sentStart.push(acc);
  acc += n;
  sentEnd.push(acc);
}

// sutraNorm 的 8 字窗索引
const sIndex = new Map<number, number[]>();
{
  let h = 0;
  for (let i = 0; i < sutraNorm.length; i++) {
    h = (Math.imul(h, BASE) + sutraNorm.charCodeAt(i)) | 0;
    if (i >= N) h = (h - Math.imul(sutraNorm.charCodeAt(i - N), POW)) | 0;
    if (i >= N - 1) {
      const st = i - N + 1;
      const a = sIndex.get(h); if (a) a.push(st); else sIndex.set(h, [st]);
    }
  }
}
console.log(`主文 ${sents.length} 句、正規化 ${sutraNorm.length} 字、窗 ${sIndex.size} 種`);

interface Summary { id: string; chars: number; windows: number; matched: number; kept: number; sentences: number; pages: number }

const files = readdirSync(join(DATA, 'works')).filter((f) => f.endsWith('.json'));
const summary: Summary[] = [];

for (const f of files) {
  const w = JSON.parse(readFileSync(join(DATA, 'works', f), 'utf8')) as {
    id: string; title: string; chars: number; lines: { page: string; text: string }[];
  };
  // 原文 + 每字的頁
  let raw = '';
  const pageOf: string[] = [];
  for (const l of w.lines) {
    for (const ch of l.text) { raw += ch; pageOf.push(l.page); }
    raw += '\n'; pageOf.push(l.page);
  }
  const { text: wn, map } = normWithMap(raw);

  // 找錨：work 的 8 字窗 → 主文位置，全部收下，再用 LIS 取最長單調鏈
  const pairs: { w: number; s: number }[] = [];
  let h = 0;
  for (let i = 0; i < wn.length; i++) {
    h = (Math.imul(h, BASE) + wn.charCodeAt(i)) | 0;
    if (i >= N) h = (h - Math.imul(wn.charCodeAt(i - N), POW)) | 0;
    if (i < N - 1) continue;
    const st = i - N + 1;
    const arr = sIndex.get(h);
    if (!arr) continue;
    const win = wn.slice(st, i + 1);
    for (const p of arr) if (sutraNorm.startsWith(win, p)) pairs.push({ w: st, s: p });
  }
  // 同一 work 位置只留一個：排序時 s 遞減，LIS 就不會重複取同一窗
  pairs.sort((a, b) => a.w - b.w || b.s - a.s);
  const tails: number[] = [];
  const tailIdx: number[] = [];
  const prev = new Int32Array(pairs.length).fill(-1);
  for (let i = 0; i < pairs.length; i++) {
    const s = pairs[i].s;
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < s) lo = mid + 1; else hi = mid; }
    if (lo > 0) prev[i] = tailIdx[lo - 1];
    tails[lo] = s;
    tailIdx[lo] = i;
  }
  const kept: [number, number][] = [];
  for (let i = tailIdx.length ? tailIdx[tailIdx.length - 1] : -1; i >= 0; i = prev[i]) kept.push([pairs[i].w, pairs[i].s]);
  kept.reverse();

  // 句 → 注疏片段
  // 【重切 P0＋P1（2026-11-12）】原本的迄點就是 8 字窗的最後一碼，實測七家 27,365 段
  // 0% 以句末收尾，而且兩段之間的解說整塊不掛任何句子（全文只顯示 14.3%～51.3%）。
  // 現在兩條規則（不越界到下一段＝不新增重疊，重疊的消解留給 P2）：
  //   P0 迄點往後报到第一個句末標點（。！？；，含標點），最遠 RESLICE_SENT_CAP 字；
  //   P1 句末落在下一段起點之後時，乾脆接到下一段起點（把 gap 的解說收進來）。
  // 停在句中（切點＝下一段起點）與殘留縫隙都計數，作為 P2 的抽樣依據。
  const SENT_CAP = Number(process.env.RESLICE_SENT_CAP ?? 80);
  const FULL_CAP = Number(process.env.RESLICE_FULL_CAP ?? 900);   // 一段最多往後吃多少字
  const P = RESLICE_P;                                          // 0＝不重切（基數）、1＝P0＋P1、2＝P2'
  const END_CH = '。！？；';
  const snapEnd = (pos: number, look: number) => {
    const stop = Math.min(raw.length, pos + look);
    for (let i = pos; i < stop; i++) if (END_CH.indexOf(raw[i]) >= 0) return i + 1;
    return -1;
  };

  const segs: { si: number; a: number; b0: number }[] = [];
  {
    let si = 0;
    for (const [wp, sp] of kept) {
      while (si + 1 < sents.length && sentStart[si + 1] <= sp) si++;
      if (sp < sentStart[si] || sp >= sentEnd[si]) continue;
      segs.push({ si, a: map[wp], b0: map[Math.min(wp + N - 1, map.length - 1)] + 1 });
    }
  }

  const tiled: { si: number; start: number; end: number; page: string; kind: string }[] = [];
  let seamChars = 0;                       // 因收到句末而留著沒掛的縫隙（句末 → 下一段起點）
  const GUARD = Number(process.env.RESLICE_GUARD ?? 4);
  const kinds: Record<string, number> = {};

  if (P >= 2) {
    /* P2'（規則 B ＋保護欄）：一家注疏切成連續不重疊的塊，但絕不把任何一段的 8 字窗吃到見骨。
       - 縫隙（a_{i+1} ≥ b0_i）：cut 取 (b0_i, a_{i+1}] 內最靠右的句末，沒有就接到 a_{i+1}——零損失。
       - 重疊（a_{i+1} < b0_i）：在重疊區找切點，傷害＝兩側窗被吃字數的較大者；
         同傷時優先「切點正好是句末」（前段收得乾淨）；最大傷害 > GUARD 就退回保留重疊（不硬切）。
       - 最後一段同樣受 FULL_CAP 约束，不無界延伸到書尾。 */
    const isEnd = (j: number) => END_CH.indexOf(raw[j - 1]) >= 0;
    let prevEnd = 0, prevKept = false;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const nx = i + 1 < segs.length ? segs[i + 1] : null;
      // 接龍：上一段收到的位置就是本段起點（不然句末與下一錨點之間的尾巴沒人認領）。
      // 只有上一段走「保留重疊」時，本段才回到自己原本的起點。
      let start = i === 0 ? s.a : (prevKept ? Math.min(s.a, prevEnd) : prevEnd);
      if (start > s.b0) start = Math.min(s.a, s.b0);          // 極端情況的保底：不越過自己窗尾
      let end = Math.max(s.b0, start), kind = 'raw';
      if (!nx) {                                   // 最後一段：句末收尾，但不超過 FULL_CAP
        const e1 = snapEnd(s.b0, SENT_CAP);
        end = Math.min(e1 > 0 ? e1 : s.b0, s.b0 + FULL_CAP, raw.length);
        kind = e1 > 0 ? 'sent' : 'raw';
      } else if (nx.a >= s.b0) {                   // 有縫隙
        let cut = nx.a;
        for (let j = Math.min(nx.a, raw.length); j > s.b0; j--) if (isEnd(j)) { cut = j; break; }
        end = Math.max(cut, s.b0);
        kind = cut > s.b0 ? 'sent' : 'tile';
        seamChars += Math.max(0, nx.a - end);
      } else {                                     // 重疊區 [a_{i+1}, b0_i]
        const left = nx.a, right = s.b0;
        const cands: number[] = [left, right];
        for (let j = left; j <= right; j++) if (isEnd(j)) cands.push(j);
        let best: { c: number, hurt: number, score: number } | null = null;
        for (const c of cands) {
          const hurt = Math.max(right - c, c - left);            // 兩側窗被吃的較大者
          const score = hurt * 10 + (isEnd(c) ? 0 : 5);          // 同傷時先取句末
          if (!best || score < best.score) best = { c, hurt, score };
        }
        if (best && best.hurt <= GUARD) { end = best.c; kind = best.hurt === 0 ? 'tile' : 'trim'; }
        else { end = Math.min(snapEnd(s.b0, SENT_CAP) > 0 ? Math.min(snapEnd(s.b0, SENT_CAP), raw.length) : s.b0, s.b0 + FULL_CAP); kind = 'kept'; }
      }
      if (end <= start) end = Math.min(Math.max(start + 1, s.b0), raw.length);
      tiled.push({ si: s.si, start, end, page: pageOf[start] ?? '', kind });
      prevEnd = end; prevKept = kind === 'kept';
    }
    for (const t of tiled) kinds[t.kind] = (kinds[t.kind] || 0) + 1;
  } else {
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const nextA = i + 1 < segs.length ? segs[i + 1].a : Math.min(raw.length, s.a + FULL_CAP);
      const e1 = P ? snapEnd(s.b0, SENT_CAP) : -1;
      let end = s.b0, kind = 'raw';
      if (P && e1 > 0 && e1 <= nextA) { end = e1; kind = 'sent'; seamChars += Math.max(0, nextA - e1); }
      else if (P && nextA > s.b0) { end = Math.min(nextA, s.a + FULL_CAP); kind = 'tile'; }
      tiled.push({ si: s.si, start: s.a, end, page: pageOf[s.a] ?? '', kind });
    }
    for (const t of tiled) kinds[t.kind] = (kinds[t.kind] || 0) + 1;
  }

  const perSentence = new Map<number, { start: number; end: number; page: string }[]>();
  for (const t of tiled) {
    const list = perSentence.get(t.si) ?? [];
    list.push({ start: t.start, end: t.end, page: t.page });
    perSentence.set(t.si, list);
  }

  // 合併同一句內相鄰片段
  const merged = new Map<number, { start: number; end: number; page: string }[]>();
  for (const [k, list] of perSentence) {
    list.sort((a, b) => a.start - b.start);
    const out: { start: number; end: number; page: string }[] = [];
    for (const seg of list) {
      const last = out[out.length - 1];
      if (last && seg.start - last.end < 40) last.end = Math.max(last.end, seg.end);
      else out.push({ ...seg });
    }
    merged.set(k, out);
  }

  const pages = new Set(w.lines.map((l) => l.page).filter(Boolean));
  writeFileSync(join(OUT, `${w.id}.json`), JSON.stringify({
    schema: 1,
    id: w.id,
    title: w.title,
    chars: w.chars,
    sentences: [...merged].map(([s, frags]) => ({ s, frags })),
  }, null, 0) + '\n');

  // 重切后的覆蓋與收尾（自己算一份，正式驗收在 scripts/check-reslice.ts）
  let shown = 0;
  for (const [, frags] of merged) for (const f of frags) shown += Math.max(0, f.end - f.start);
  const stat = {
    id: w.id, chars: w.chars, windows: kept.length,
    kept: kept.length, sentences: merged.size, pages: pages.size,
    cutSent: kinds.sent || 0, cutTile: (kinds.tile || 0) + (kinds.trim || 0), cutKept: kinds.kept || 0, cutRaw: kinds.raw || 0,
    seamChars: seamChars, shownChars: shown, shownPct: +(100 * shown / raw.length).toFixed(1),
  };
  summary.push(stat);
  console.log(`${w.id}\t錨 ${kept.length}/${wn.length - N + 1}\t句 ${merged.size}/${sents.length}\t頁 ${pages.size}` +
    `\t句末 ${kinds.sent|0}／接龍 ${(kinds.tile|0)+(kinds.trim|0)}／保留重疊 ${kinds.kept|0}／原樣 ${kinds.raw|0}\t顯示 ${stat.shownPct}%（${shown.toLocaleString()} 字）`);
}

writeFileSync(join(OUT, 'align-summary.json'), JSON.stringify({ schema: 1, n: N, resliceP: RESLICE_P, summary }, null, 1) + '\n');
console.log('→ ' + (process.env.RESLICE_OUT ? process.env.RESLICE_OUT : 'data/align') + '/*.json、align-summary.json');
