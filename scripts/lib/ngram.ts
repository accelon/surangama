/**
 * n-gram（字窗）覆蓋率核心：正規化、建索引、掃描、順序覆蓋。
 *
 * 出處：移植自 adb-converter 的 build/jingqun/find-xiaowen.ts（金剛經那套），
 * 把原本寫死的 8 字窗改成可傳 `n`，供 6／8 字窗共用同一份實作。
 */

/** 常見異體／舊字形折疊，只影響比對，不改原文。 */
const VARIANTS: [RegExp, string][] = [
  [/[説説]/g, '說'], [/[卽即]/g, '即'], [/[著着]/g, '著'], [/[鉢缽]/g, '鉢'],
  [/[湼涅]/g, '涅'], [/[衞衛]/g, '衛'], [/[衆眾]/g, '眾'], [/[祗祇]/g, '祇'],
  [/[敎教]/g, '教'], [/[縁緣]/g, '緣'], [/[經経]/g, '經'], [/[徳德]/g, '德'],
  [/[麁麤]/g, '麤'], [/[穉稚]/g, '稚'], [/[牀床]/g, '床'], [/[婬淫]/g, '淫'],
  [/[瞖翳]/g, '翳'], [/[珂呵]/g, '訶'],
  // 楞嚴常用字
  [/[嚴严]/g, '嚴'], [/[頂顶]/g, '頂'], [/[圓圆]/g, '圓'], [/[覺觉]/g, '覺'],
  [/[聞闻]/g, '聞'], [/[識识]/g, '識'], [/[陰阴]/g, '陰'], [/[塵尘]/g, '塵'],
  [/[滅灭]/g, '滅'], [/[願愿]/g, '願'],
];

/** 只留漢字，並折疊常見異體。 */
export function norm(s: string): string {
  let t = s.replace(/[^\u3400-\u9fff]/g, '');
  for (const [re, to] of VARIANTS) t = t.replace(re, to);
  return t;
}

/** 以句號／問號／驚嘆號／分號切句，各自正規化（≥4 字才留）。 */
export function splitSentences(raw: string): string[] {
  return raw.split(/[。！？；]/).map(norm).filter((s) => s.length >= 4);
}

/**
 * 正規化並保留「正規化第 i 字 → 原字位置」對照；對齊時要把位移換回原文切片。
 * 異體折疊在此逐字做（VARIANTS 都是 1 對 1 的字形替換）。
 */
export function normWithMap(s: string): { text: string; map: number[] } {
  const out: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (!/[\u3400-\u9fff]/.test(ch)) continue;
    let t = ch;
    for (const [re, to] of VARIANTS) t = t.replace(re, to);
    out.push(t);
    map.push(i);
  }
  return { text: out.join(''), map };
}

export const BASE = 131;

export interface GramIndex {
  n: number;
  pow: number;
  /** hash → 起始位置陣列 */
  map: Map<number, number[]>;
  /** 底本每個字窗的 hash（順序覆蓋用） */
  hashes: Int32Array;
}

/** 建立底本的 n 字窗索引，同時回傳每個窗的 hash 序列。 */
export function buildIndex(sutra: string, n: number): GramIndex {
  let pow = 1;
  for (let i = 0; i < n; i++) pow = Math.imul(pow, BASE);
  pow |= 0;
  const map = new Map<number, number[]>();
  const hashes = new Int32Array(Math.max(0, sutra.length - n + 1));
  let h = 0;
  for (let i = 0; i < sutra.length; i++) {
    h = (Math.imul(h, BASE) + sutra.charCodeAt(i)) | 0;
    if (i >= n) h = (h - Math.imul(sutra.charCodeAt(i - n), pow)) | 0;
    if (i >= n - 1) {
      const st = i - n + 1;
      const a = map.get(h); if (a) a.push(st); else map.set(h, [st]);
      hashes[st] = h;
    }
  }
  return { n, pow, map, hashes };
}

/** 掃一部書，把命中的底本位置塗在 cover 上；回傳命中次數。 */
export function scanInto(idx: GramIndex, s: string, cover: Uint8Array, sutra: string): number {
  const { n, pow, map } = idx;
  let h = 0, hits = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, BASE) + s.charCodeAt(i)) | 0;
    if (i >= n) h = (h - Math.imul(s.charCodeAt(i - n), pow)) | 0;
    if (i < n - 1) continue;
    const arr = map.get(h);
    if (!arr) continue;
    const start = i - n + 1;
    const w = s.slice(start, i + 1);
    for (const p of arr) if (sutra.startsWith(w, p)) { cover.fill(1, p, p + n); hits++; }
  }
  return hits;
}

/**
 * 順序覆蓋：底本與書都切 n-gram，求兩邊的最長公共子序列（Hunt–Szymanski：
 * 列出配對，再對位置求 LIS）。只算照底本次序出現的部分。
 */
export function orderedCoverage(idx: GramIndex, s: string, sutra: string): number {
  const { n, pow, hashes } = idx;
  const positions = new Map<number, number[]>();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, BASE) + s.charCodeAt(i)) | 0;
    if (i >= n) h = (h - Math.imul(s.charCodeAt(i - n), pow)) | 0;
    if (i < n - 1) continue;
    const st = i - n + 1;
    const a = positions.get(h); if (a) a.push(st); else positions.set(h, [st]);
  }
  const tails: number[] = [];
  for (let j = 0; j < hashes.length; j++) {
    const arr = positions.get(hashes[j]);
    if (!arr) continue;
    const need = sutra.slice(j, j + n);
    for (let k = arr.length - 1; k >= 0; k--) {
      const pos = arr[k];
      if (!s.startsWith(need, pos)) continue;
      let lo = 0, hi = tails.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < pos) lo = mid + 1; else hi = mid; }
      tails[lo] = pos;
    }
  }
  return hashes.length ? tails.length / hashes.length : 0;
}

/** 一部書對底本的覆蓋統計。 */
export interface Coverage {
  cov: number;
  hits: number;
  lastPct: number;
  bins: number;
  len: number;
}

export function coverageOf(idx: GramIndex, sutra: string, s: string, binCount = 20): Coverage {
  const cover = new Uint8Array(sutra.length);
  const hits = scanInto(idx, s, cover, sutra);
  let covered = 0;
  let last = 0;
  const binSize = Math.max(1, Math.ceil(cover.length / binCount));
  const binHit = new Uint8Array(binCount);
  for (let i = 0; i < cover.length; i++) if (cover[i]) {
    covered++;
    last = i;
    binHit[Math.min(binCount - 1, Math.floor(i / binSize))] = 1;
  }
  let bins = 0;
  for (const v of binHit) bins += v;
  return {
    cov: covered / sutra.length,
    hits,
    lastPct: last / cover.length,
    bins,
    len: s.length,
  };
}
