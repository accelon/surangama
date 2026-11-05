#!/usr/bin/env bun
/**
 * 子璿《長水疏》（佛陀教育基金會 2010 排版 PDF）：科判＋經文逐節對。
 * 科判字級 13、經文字級 18；層級＝「甲乙丙…」標記。
 *
 *   bun run scripts/build-changshui-sutra.ts
 *
 * 讀 data/kepan/changshui-sutra.json、data/sutra.json → 寫 data/kepan/changshui2.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const LEVELS = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥天地';

const records = JSON.parse(readFileSync(join(DATA, 'kepan', 'changshui-sutra.json'), 'utf8')) as { page: number; kepan: string; sutra: string }[];
const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as { sentences: { i: number; text: string }[] };
const norm = (t: string) => t.replace(/[「」『』（）()\s，。、；：！？…—·：.]/g, '').replace(/祗/g, '祇').replace(/盤/g, '槃').replace(/陁/g, '陀');
const SN = sutra.sentences.map((s) => ({ i: s.i, n: norm(s.text) }));
const LAST = sutra.sentences[sutra.sentences.length - 1].i;

type N = { lv: number; lab: string; nm: string; par: number | null; ch: number[]; u: number; u2: number; exact: number };
const nodes: N[] = [];
const stack: number[] = [];
let pi = 0;
let matched = 0;

const marker = new RegExp('([' + LEVELS + '])(初|二|三|四|五|六|七|八|九|十)', 'g');

for (const rec of records) {
  const text = rec.kepan;
  const marks: { lv: number; lab: string; pos: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  const rx = new RegExp(marker.source, 'g');
  while ((m = rx.exec(text))) marks.push({ lv: LEVELS.indexOf(m[1]) + 1, lab: m[1] + m[2], pos: m.index, end: m.index + m[0].length });
  if (!marks.length) continue;

  let u = -1;
  const key = norm(rec.sutra);
  if (key.length >= 4) {
    for (let i = pi; i < Math.min(pi + 300, SN.length); i++) {
      const n = SN[i].n;
      if (n.startsWith(key.slice(0, 8)) || n.includes(key.slice(0, 8)) || (key.length >= 10 && n.includes(key.slice(2, 10))) || (key.length >= 8 && n.includes(key.slice(0, 6)))) { u = i; break; }
    }
  }
  if (u >= 0) { pi = u + 1; matched++; }

  for (const mk of marks) {
    const next = marks.find((x) => x.pos > mk.pos);
    let seg = text.slice(mk.end, next ? next.pos : undefined);
    const nm = seg.split('。')[0].replace(/分[一二三四五六七八九十]+$/, '').replace(/[，、；：]$/, '').trim();
    if (!nm) continue;
    while (stack.length && nodes[stack[stack.length - 1]].lv >= mk.lv) stack.pop();
    const par = stack.length ? stack[stack.length - 1] : null;
    const id = nodes.length;
    nodes.push({ lv: mk.lv, lab: mk.lab, nm: nm.slice(0, 20), par, ch: [], u: u >= 0 ? u : pi, u2: 0, exact: u >= 0 ? 1 : 0 });
    if (par != null) nodes[par].ch.push(id);
    stack.push(id);
  }
}

// 未錨：相鄰已錨內插
const anchors = nodes.map((n, i) => ({ i, u: n.u, ok: n.exact })).filter((x) => x.ok);
for (let a = 0; a < anchors.length; a++) {
  const A = anchors[a];
  const B = a + 1 < anchors.length ? anchors[a + 1] : { i: nodes.length, u: LAST };
  for (let k = A.i + 1; k < B.i; k++) {
    if (nodes[k].exact) continue;
    nodes[k].u = Math.round(A.u + ((B.u - A.u) * (k - A.i)) / Math.max(1, B.i - A.i));
  }
}
let cur = 0;
for (const n of nodes) { if (n.u < cur) n.u = cur; cur = n.u; }
for (let i = 0; i < nodes.length; i++) nodes[i].u2 = i + 1 < nodes.length ? Math.max(nodes[i].u, nodes[i + 1].u - 1) : LAST;

const N = nodes.length;
console.log(`節點 ${N}，錨上 ${matched}，層 ${Math.max(...nodes.map((n) => n.lv))}，根 ${nodes.filter((n) => n.par == null).length}`);
console.log(nodes.slice(0, 8).map((n) => n.lab + n.nm.slice(0, 8) + '@' + n.u).join(' | '));
writeFileSync(join(DATA, 'kepan', 'changshui2.json'), JSON.stringify({ schema: 1, nodes: nodes.map(({ exact, ...rest }) => rest) }, null, 0) + '\n');
