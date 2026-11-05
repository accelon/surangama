#!/usr/bin/env bun
/**
 * 用《長水疏》PDF 的「科判＋經文」配對，重錨既有的表號版科判樹。
 * 層級不動（那版有甲乙層級），只把 u 換成經文對到的位置。
 *
 *   bun run scripts/build-changshui-merge.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const CH = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥天地';

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as { sentences: { i: number; text: string }[] };
const norm = (t: string) => t.replace(/[「」『』（）()\s，。、；：！？…—·：.]/g, '').replace(/祗/g, '祇').replace(/盤/g, '槃').replace(/陁/g, '陀');
const SN = sutra.sentences.map((s) => ({ i: s.i, n: norm(s.text) }));
const LAST = sutra.sentences[sutra.sentences.length - 1].i;

const records = JSON.parse(readFileSync(join(DATA, 'kepan', 'changshui-sutra.json'), 'utf8')) as { page: number; kepan: string; sutra: string }[];
const tree = JSON.parse(readFileSync(join(DATA, 'kepan', 'changshui.json'), 'utf8')) as { nodes: any[] };
const nodes = tree.nodes;

// 記錄 → 節名（第一個句號前）＋經文位置
const marker = new RegExp('[' + CH + '](初|二|三|四|五|六|七|八|九|十)', 'g');
const byName = new Map<string, number>();
let pi = 0;
let hit = 0;
for (const rec of records) {
  const key = norm(rec.sutra);
  if (key.length < 4) continue;
  let u = -1;
  for (let i = pi; i < Math.min(pi + 250, SN.length); i++) {
    if (SN[i].n.startsWith(key.slice(0, 8)) || SN[i].n.includes(key.slice(0, 8))) { u = i; break; }
  }
  if (u < 0) continue;
  pi = u + 1;
  // 取最後一個標記後的節名
  let lastEnd = -1;
  let m: RegExpExecArray | null;
  const rx = new RegExp(marker.source, 'g');
  while ((m = rx.exec(rec.kepan))) lastEnd = m.index + m[0].length;
  if (lastEnd < 0) continue;
  let nm = rec.kepan.slice(lastEnd).split('。')[0].trim();
  nm = nm.replace(/分[一二三四五六七八九十]+$/, '').replace(/[，、；：]$/, '').trim();
  if (!nm) continue;
  if (!byName.has(nm)) { byName.set(nm, u); hit++; }
}

let matched = 0;
for (const n of nodes) {
  const u = byName.get(n.nm);
  if (u != null) { n.u = u; (n as any).exact = 1; matched++; }
}
// 未錨：相鄰內插
const anchors = nodes.map((n, i) => ({ i, u: n.u, ok: (n as any).exact })).filter((x) => x.ok);
for (let a = 0; a < anchors.length; a++) {
  const A = anchors[a];
  const B = a + 1 < anchors.length ? anchors[a + 1] : { i: nodes.length, u: LAST };
  for (let k = A.i + 1; k < B.i; k++) {
    if ((nodes[k] as any).exact) continue;
    nodes[k].u = Math.round(A.u + ((B.u - A.u) * (k - A.i)) / Math.max(1, B.i - A.i));
  }
}
let cur = 0;
for (const n of nodes) { if (n.u < cur) n.u = cur; cur = n.u; }
for (let i = 0; i < nodes.length; i++) nodes[i].u2 = i + 1 < nodes.length ? Math.max(nodes[i].u, nodes[i + 1].u - 1) : LAST;

writeFileSync(join(DATA, 'kepan', 'changshui.json'), JSON.stringify({ schema: 1, nodes: nodes.map(({ exact, ...rest }: any) => rest) }, null, 0) + '\n');
console.log(`記錄 ${records.length}、名稱錨點 ${hit}、節點對上 ${matched}/${nodes.length}`);
