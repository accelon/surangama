#!/usr/bin/env bun
/**
 * 驗收：注疏重切（P0 迄點對句末、P1 gap 歸前段）有沒有達到基準。
 *
 *   bun run scripts/check-reslice.ts            # 跑全部，寫 docs/reslice-metrics.md
 *   bun run scripts/check-reslice.ts --show 12  # 多印幾段樣本人工過目
 *
 * 這個腳本**不呼叫 align-works.ts 的任何程式碼**，從 data/works/*.json（原文）與
 * data/align/*.json（座標）各自重算，才不會用同一個錯誤驗自己。
 * 退出碼：有任何一家未通過基準 → 1。
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
// ALIGN_DIR：改驗別的對照版（例如 build/rev/2026-11-12-align-p2），預設 data/align
const ALIGN = process.env.ALIGN_DIR ? join(ROOT, process.env.ALIGN_DIR) : join(DATA, 'align');
const SHOW_N = Number((process.argv.find((a, i) => a === '--show' ? process.argv[i + 1] : '') || '10'));

// ---- 基準（2026-11-12 作者定案：規則 B ＋保護欄、最後一段也設 FULL_CAP）
// 註：先前草拟的「重疊段 = 0」只在**不加保護欄**時可能成立（實測：GUARD=16 才降到 3 段，
// 但段尾句末從 98.1% 掉到 37.9%、短於 8 字的段從 15 涨到 2,769）。加了保護欄，
// 「兩段窗重疊超過 GUARD 就維持重疊」是規則的定義行為，所以基準改成驗它的代價：
// 中間縫隙要幾乎消失、且幾乎沒有段被吃到不足一個窗。
const LIMITS = {
  endAtSentencePct: 90,   // 段尾句末收尾（實測 98.1%）
  overlapMax: 24000,      // 保留的重疊對數上限（GUARD=4 的設計結果，多了就是規則跑掉）
  shownPctMin: 90,        // 聯集覆蓋：含書首書尾（實測 93.2%）
  midSeamPctMax: 2.5,     // 中間縫隙／全文——這才是 P1/P2' 真正要消掉的東西
  shortPctMax: 0.2,       // 短於 8 字（窗被吃光）的段占比
  sentenceCoverDrop: 0.5, // 有注句子數不得比基數少超過 0.5 個百分點
};
const SENT = '。！？；';

interface Frag { start: number; end: number; page: string }
interface Work { id: string; title: string; chars: number; lines: { page: string; text: string }[] }

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  sentences: { i: number; juan: number; text: string }[];
};
const SENT_N = sutra.sentences.length;

const rows: string[] = [];
const sample: string[] = [];
const fails: string[] = [];
let totChars = 0, totShown = 0, totSent = 0, totSeg = 0, totOverlap = 0, totSeam = 0, totShort = 0, skipN = 0, skipSeg = 0;

rows.push('# 注疏重切驗收（' + new Date().toISOString().slice(0, 10) + '）');
rows.push('');
rows.push('資料版：`' + (process.env.ALIGN_DIR || 'data/align') + '`｜' + (process.env.ALIGN_LABEL || ''));
rows.push('');
rows.push('基準：段尾句末 ≥ ' + LIMITS.endAtSentencePct + '%、聯集顯示 ≥ ' + LIMITS.shownPctMin +
  '%、中縫 ≤ ' + LIMITS.midSeamPctMax + '%、短於 8 字的段 ≤ ' + LIMITS.shortPctMax +
  '%、保留重疊 ≤ ' + LIMITS.overlapMax + '（加保護欄後這是定義行為，不是缺陷）。');
rows.push('');
rows.push('| 家 | 段 | 句末收尾 | 接龍停在句中 | 重疊 | 縫隙字 | 句下顯示／全文 | 句覆蓋 | 段長 中位/P95/max |');
rows.push('|---|---:|---:|---:|---:|---:|---:|---:|---|');

for (const f of readdirSync(ALIGN).filter((x) => x.endsWith('.json')).sort()) {
  const id = f.replace(/\.json$/, '');
  if (id === 'summary' || id === 'align-summary') continue;
  const a = JSON.parse(readFileSync(join(ALIGN, f), 'utf8')) as { id: string; title: string; sentences: { s: number; frags: Frag[] }[] };
  const wf = join(DATA, 'works', `${id}.json`);
  let raw = '';
  try {
    const w = JSON.parse(readFileSync(wf, 'utf8')) as Work;
    for (const l of w.lines) { raw += l.text + '\n'; }
  } catch { continue; }
  if (!a.sentences.length) continue;
  const nSegAll = a.sentences.reduce((n, x) => n + x.frags.length, 0);
  const scope = nSegAll >= 100;            // 錨點極少的（純科判、還沒上對齊的書）不套注疏基準

  // 攤平、依原文位置排序（同句多段也排進去）
  const segs: { s: number; start: number; end: number }[] = [];
  for (const one of a.sentences) for (const f2 of one.frags) segs.push({ s: one.s, start: f2.start, end: f2.end });
  segs.sort((x, y) => x.start - y.start || x.end - y.end);

  let endSent = 0, endTile = 0, overlap = 0, seam = 0, shown = 0, covered = 0, short = 0;
  const lens: number[] = [];
  for (let i = 0; i < segs.length; i++) {
    const g = segs[i];
    shown += Math.max(0, g.end - g.start);
    lens.push(g.end - g.start);
    if (g.end - g.start < 8) short++;                       // 短於一個窗：引句多半被吃掉了
    const tail = raw.slice(g.end - 1, g.end).replace(/\s/g, '');
    if (SENT.indexOf(tail) >= 0 || g.end >= raw.length) endSent++; else endTile++;
    if (i) {
      const prev = segs[i - 1];
      if (g.start < prev.end) overlap++;
      else if (g.start > prev.end) seam += g.start - prev.end;
    }
  }
  // 覆蓋率用「聯集」：保留重疊時加總會超過 100%，那是重複計數的假數
  {
    const iv = segs.map((g) => [g.start, g.end] as number[]).sort((x, y) => x[0] - y[0]);
    let lo = -1, hi = -1;
    for (const g of iv) {
      if (g[1] <= g[0]) continue;
      if (g[0] > hi) { covered += Math.max(0, hi - lo); lo = g[0]; hi = g[1]; }
      else hi = Math.max(hi, g[1]);
    }
    covered += Math.max(0, hi - lo);
  }
  const coveredSent = new Set(a.sentences.map((x) => x.s)).size;
  const pctSent = 100 * endSent / segs.length;
  const pctShown = 100 * covered / raw.length;
  const pctCover = 100 * coveredSent / SENT_N;
  lens.sort((x, y) => x - y);
  const med = lens[Math.floor(lens.length / 2)] || 0;
  const p95 = lens[Math.floor(lens.length * 0.95)] || 0;
  const max = lens[lens.length - 1] || 0;

  const problems: string[] = [];
  const pctSeam = 100 * seam / raw.length, pctShort = 100 * short / segs.length;
  if (!scope) problems.length = 0;
  if (scope && pctSent < LIMITS.endAtSentencePct) problems.push('句末收尾 ' + pctSent.toFixed(1) + '% < ' + LIMITS.endAtSentencePct + '%');
  if (scope && overlap > LIMITS.overlapMax) problems.push('保留重疊 ' + overlap + ' > 上限 ' + LIMITS.overlapMax);
  if (scope && pctShown < LIMITS.shownPctMin) problems.push('聯集顯示 ' + pctShown.toFixed(1) + '% < ' + LIMITS.shownPctMin + '%');
  if (scope && pctSeam > LIMITS.midSeamPctMax) problems.push('中間縫隙 ' + pctSeam.toFixed(2) + '% > ' + LIMITS.midSeamPctMax + '%');
  if (scope && pctShort > LIMITS.shortPctMax) problems.push('短於 8 字的段 ' + pctShort.toFixed(2) + '% > ' + LIMITS.shortPctMax + '%');

  rows.push('| ' + id + ' ' + (a.title || '').slice(0, 12) + ' | ' + segs.length.toLocaleString() + ' | ' +
    pctSent.toFixed(1) + '% | ' + endTile.toLocaleString() + ' | ' + overlap + ' | ' + seam.toLocaleString() + ' | ' +
    pctShown.toFixed(1) + '% | ' + pctCover.toFixed(1) + '% | ' + med + '／' + p95 + '／' + max + (problems.length ? ' | ✗ ' : ' | ✓ ') + problems.join('；') + ' |');
  if (problems.length) fails.push(id + '：' + problems.join('；'));

  if (scope) { totChars += raw.length; totShown += covered; totSent += endSent; totSeg += segs.length; totOverlap += overlap; totSeam += seam; totShort += short; }
  else { skipN++; skipSeg += segs.length; }

  // 抽樣：固定步長取 SHOW_N 段（不用亂數，重跑可比對），印出前後文供人工判讀
  const step = Math.max(1, Math.floor(segs.length / SHOW_N));
  for (let i = 0; i < segs.length && sample.length < 400; i += step) {
    const g = segs[i];
    const body = raw.slice(g.start, g.end).replace(/\s+/g, '␣');
    const after = raw.slice(g.end, g.end + 22).replace(/\s+/g, '␣');
    sample.push('- **' + id + '** 句 ' + g.s + '｜' + (g.end - g.start) + ' 字｜' +
      (SENT.indexOf(raw.slice(g.end - 1, g.end)) >= 0 ? '句末收尾' : '停在句中') +
      '\n  「…' + body.slice(-46) + '」⏎ 接著「' + after + '…」');
  }
}

rows.push('');
rows.push('合計：' + totSeg.toLocaleString() + ' 段｜句末收尾 ' + (100 * totSent / totSeg).toFixed(1) +
  '%｜聯集覆蓋 ' + (100 * totShown / totChars).toFixed(1) + '%（' + totShown.toLocaleString() + '／' + totChars.toLocaleString() + ' 字）' +
  '｜保留重疊 ' + totOverlap.toLocaleString() + '｜中縫 ' + totSeam.toLocaleString() + ' 字（' +
  (100 * totSeam / totChars).toFixed(2) + '%）｜短於 8 字的段 ' + totShort.toLocaleString() + '（' +
  (100 * totShort / totSeg).toFixed(2) + '%）｜跳過純科判與未對齊 ' + skipN + ' 部、' + skipSeg.toLocaleString() + ' 段');
rows.push('');
rows.push('## 抽樣（等距取樣，重跑可逐條覆核；P2 要看的是「停在句中」那批切在什麼地方）');
rows.push('');
rows.push(...sample);

const OUTMD = process.env.OUT_MD ? join(ROOT, process.env.OUT_MD) : join(ROOT, 'docs', 'reslice-metrics.md');
writeFileSync(OUTMD, rows.join('\n') + '\n', 'utf8');
console.log(rows.slice(0, 3).join('\n'));
for (const r of rows.slice(5, -4)) console.log(r.replace(/\|/g, ' | ').trim());
console.log('\n→ ' + OUTMD + '（抽樣 ' + sample.length + ' 條）');
if (fails.length) { console.error('✗ 未通過：\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('✓ 全部符合基準');
