#!/usr/bin/env bun
/**
 * 產生閱讀器科文層要的 kepan/kepan-data.js（window.KEPAN）。
 * 六家楞嚴科判，節點位置用蒙鈔疏前引文錨點（750）依序等比。
 *
 *   bun run scripts/build-kepan-data.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const OUT = join(ROOT, 'site', 'reader', 'kepan');
mkdirSync(OUT, { recursive: true });

const norm = (t: string) => t.replace(/[「」『』（）()\s，。、；：！？…—·：]/g, '');
const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as { sentences: { i: number; text: string }[] };
const x287 = JSON.parse(readFileSync(join(DATA, 'works', 'X287.json'), 'utf8')) as { lines: { text: string }[] };
const SN = sutra.sentences.map((s) => ({ i: s.i, n: norm(s.text) }));

function findSent(q: string): number | null {
  const n = norm(q);
  if (n.length < 4) return null;
  const p = n.slice(0, Math.min(n.length, 24));
  const h = SN.find((x) => x.n.startsWith(p));
  if (h) return h.i;
  const p2 = n.slice(0, 12);
  const inn = SN.find((x) => x.n.includes(p2));
  return inn ? inn.i : null;
}

const raw: number[] = [];
let buf: string[] = [];
for (const ln of x287.lines.map((l) => l.text)) {
  if (ln.includes('【疏】')) {
    const q = buf.length ? buf[buf.length - 1].trim() : '';
    const u = q ? findSent(q) : null;
    if (u != null) raw.push(u);
    buf = [];
  } else buf.push(ln);
}
raw.sort((a, b) => a - b);
const anchors: number[] = [];
for (const u of raw) if (!anchors.length || u > anchors[anchors.length - 1]) anchors.push(u);
const LAST = sutra.sentences[sutra.sentences.length - 1].i;

const LEVEL_CHARS = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';
let X273: any = null;
try { X273 = JSON.parse(readFileSync(join(DATA, 'kepan', 'x273-levels.json'), 'utf8')).nodes; } catch {}
const CN: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const KE: { id: string; short: string; title: string; author: string; year: number }[] = [
  { id: 'X265', short: '子璿', title: '楞嚴經義疏注經科', author: '宋 子璿述', year: 1040 },
  { id: 'X273', short: '交光', title: '楞嚴經正脉疏科', author: '明 真鑑作', year: 1580 },
  { id: 'X278', short: '憨山', title: '楞嚴經通議略科', author: '明 德清排訂', year: 1620 },
  { id: 'X290', short: '直指', title: '楞嚴經直指科文', author: '', year: 1620 },
  { id: 'X304', short: '靈耀', title: '楞嚴經觀心定解科', author: '清 靈耀述', year: 1680 },
  { id: 'X314', short: '溥畹', title: '楞嚴經寶鏡疏科文', author: '清 溥畹撰', year: 1680 },
];

const editions: any[] = [];
KE.forEach((ed, ei) => {
  const w = JSON.parse(readFileSync(join(DATA, 'works', `${ed.id}.json`), 'utf8')) as { lines: { text: string }[] };
  const lines = w.lines.map((l) => l.text.trim()).filter(Boolean);
  let start = lines.findIndex((t) => /^(釋經分|科判|科文)/.test(t));
  if (start < 0) start = 0;
  const nodes: any[] = [];
  const stack: number[] = [];
  for (let i = start; i < lines.length; i++) {
    const m = /^([一二三四五六七八九十]+)(.*)$/.exec(lines[i]);
    if (!m) continue;
    const n = CN[m[1]];
    if (!n) continue;
    let lv = 1;
    if (!stack.length) { stack.push(n); lv = 1; }
    else if (n === 1) { stack.push(1); lv = stack.length; }
    else {
      while (stack.length && stack[stack.length - 1] + 1 !== n) stack.pop();
      if (!stack.length) { stack.push(n); lv = 1; }
      else { stack[stack.length - 1] = n; lv = stack.length; }
    }
    const par = (() => { for (let k = nodes.length - 1; k >= 0; k--) if (nodes[k].lv < lv) return nodes[k].id; return null; })();
    const node = { id: nodes.length, lv, lab: (lv <= 22 ? LEVEL_CHARS[lv - 1] : 'L' + lv) + m[1], nm: m[2], par, ch: [] as number[], u: 0, off: 0, u2: 0, o2: 0, nk: 0 };
    if (ed.id === 'X273' && X273 && X273[nodes.length]) { node.lv = X273[nodes.length].lv; node.lab = (node.lv <= 22 ? LEVEL_CHARS[node.lv - 1] : 'L' + node.lv) + X273[nodes.length].num; }
    nodes.push(node);
    if (par != null) nodes[par].ch.push(node.id);
  }
  const N = nodes.length;
  const A = anchors.length;
  nodes.forEach((nd, i) => {
    const t = N <= 1 ? 0 : Math.round((i * (A - 1)) / (N - 1));
    nd.u = anchors[Math.max(0, Math.min(A - 1, t))];
  });
  for (let i = 0; i < nodes.length; i++) nodes[i].u2 = i + 1 < nodes.length ? Math.max(nodes[i].u, nodes[i + 1].u - 1) : LAST;
  const roots = nodes.filter((x) => x.par == null).map((x) => x.id);
  editions.push({
    id: ed.id, order: ei, ordStyle: 'plain', workId: ed.id, base: false, flat: 0,
    short: ed.short, title: ed.title, author: ed.author, date: '', year: ed.year,
    note: '', source: { text: ed.title, file: ed.id + '.json' },
    noMarks: 0, roots, linked: nodes.length, nodes,
  });
  console.log(`${ed.id} ${ed.short}: ${N} 節點`);
});


// 宣化上人簡要科判（DRBA）
try {
  const dr = JSON.parse(readFileSync(join(DATA, 'kepan', 'drba.json'), 'utf8')).nodes as any[];
  const nodes = dr.map((n: any, i: number) => ({
    id: i, lv: n.lv, lab: n.lab, nm: n.nm, par: n.par, ch: n.ch, u: n.u, off: 0, u2: n.u2, o2: 0, nk: 0,
  }));
  editions.push({
    id: 'DRBA', order: editions.length, ordStyle: 'plain', workId: 'DRBA', base: false, flat: 0,
    short: '宣化', title: '楞嚴經簡要科判', author: '宣化上人講述', date: '', year: 1980,
    note: '法界佛教總會《大佛頂首楞嚴經淺釋》簡要科判，A–H 八層',
    source: { text: 'DRBA outlines.htm', file: 'drba-outline.html' },
    noMarks: 0, roots: nodes.filter(x => x.par == null).map(x => x.id), linked: nodes.length, nodes,
  });
  console.log('DRBA 宣化: ' + nodes.length + ' 節點');
} catch (e) { console.log('DRBA 略過'); }


// 直指：用識典古籍 catalog 的甲乙鏈（676 節點）
try {
  const zj = JSON.parse(readFileSync(join(DATA, 'kepan', 'zhizhi.json'), 'utf8')).nodes as any[];
  const ed = editions.find((e: any) => e.id === 'X290');
  if (ed) {
    ed.nodes = zj.map((n: any, i: number) => ({
      id: i, lv: n.lv, lab: n.lab, nm: n.nm, par: n.par, ch: n.ch, u: n.u, off: 0, u2: n.u2, o2: 0, nk: 0,
    }));
    ed.roots = ed.nodes.filter((n: any) => n.par == null).map((n: any) => n.id);
    ed.linked = ed.nodes.length;
    ed.note = '層級取自識典古籍 catalog 甲乙鏈（676 節點）';
    ed.source = { text: '識典古籍 JS2076', file: 'zhizhi.json' };
    console.log('X290 直指：改用識典目錄 ' + ed.nodes.length + ' 節點');
  }
} catch (e) { console.log('直指覆寫略過'); }


// 圓瑛《楞嚴經講義》科判：詳細／精簡／極簡三版
try {
  const versions = [
    { id: 'YY', file: 'yuanying.json', short: '圓瑛', note: '詳細版（1,708 節點）' },
    { id: 'YY1', file: 'yuanying-terse1.json', short: '圓瑛簡', note: '精簡版（322 節點，原書 * / + 標記）' },
    { id: 'YY2', file: 'yuanying-terse2.json', short: '圓瑛極簡', note: '極簡版（89 節點，原書 * 標記）' },
  ];
  for (const v of versions) {
    const yy = JSON.parse(readFileSync(join(DATA, 'kepan', v.file), 'utf8')).nodes as any[];
    const nodes = yy.map((n: any, i: number) => ({
      id: i, lv: n.lv, lab: n.lab, nm: n.nm, par: n.par, ch: n.ch, u: n.u, off: 0, u2: n.u2, o2: 0, nk: 0,
    }));
    editions.push({
      id: v.id, order: editions.length, ordStyle: 'plain', workId: v.id, base: false, flat: 0,
      short: v.short, title: '楞嚴經講義科判', author: '民國 圓瑛講述', date: '', year: 1930,
      note: v.note,
      source: { text: 'metaprgmr.github.io YuanYingKePan', file: v.file },
      noMarks: 0, roots: nodes.filter((x: any) => x.par == null).map((x: any) => x.id), linked: nodes.length, nodes,
    });
    console.log(v.id + ' ' + v.short + ': ' + nodes.length + ' 節點');
  }
} catch (e) { console.log('圓瑛略過'); }



// 直指：識典古籍目錄甲乙鏈（676 節點）
try {
  const zj = JSON.parse(readFileSync(join(DATA, 'kepan', 'zhizhi.json'), 'utf8')).nodes as any[];
  const ed = editions.find((e: any) => e.id === 'X290');
  if (ed) {
    ed.nodes = zj.map((n: any, i: number) => ({ id: i, lv: n.lv, lab: n.lab, nm: n.nm, par: n.par, ch: n.ch, u: n.u, off: 0, u2: n.u2, o2: 0, nk: 0 }));
    ed.roots = ed.nodes.filter((n: any) => n.par == null).map((n: any) => n.id);
    ed.linked = ed.nodes.length;
    ed.note = '層級取自識典古籍 catalog 甲乙鏈（676 節點）';
    ed.source = { text: '識典古籍 JS2076', file: 'zhizhi.json' };
    console.log('X290 直指：識典目錄 ' + ed.nodes.length + ' 節點');
  }
} catch (e) { console.log('直指覆寫略過'); }

// 蕅益《楞嚴經文句》科判
try {
  const wj = JSON.parse(readFileSync(join(DATA, 'kepan', 'wenju.json'), 'utf8')).nodes as any[];
  const nodes = wj.map((n: any, i: number) => ({ id: i, lv: n.lv, lab: n.lab, nm: n.nm, par: n.par, ch: n.ch, u: n.u, off: 0, u2: n.u2, o2: 0, nk: 0 }));
  editions.push({
    id: 'WJ', order: editions.length, ordStyle: 'plain', workId: 'WJ', base: false, flat: 0,
    short: '蕅益', title: '楞嚴經文句科判', author: '明 智旭文句', date: '', year: 1650,
    note: '科判表 PDF 文字層；689 節點',
    source: { text: 'kepanhuizong b_1_02.pdf', file: 'wenju.json' },
    noMarks: 0, roots: nodes.filter((x: any) => x.par == null).map((x: any) => x.id), linked: nodes.length, nodes,
  });
  console.log('WJ 蕅益: ' + nodes.length + ' 節點');
} catch (e) { console.log('文句略過'); }


// 戒環《要解》科判（850 節點、表號 91）與 續法《灌頂疏》科判（1,560 節點、表號 128）
for (const spec of [
  { id: 'YJ', file: 'yaojie.json', short: '要解', title: '楞嚴經要解科判', author: '宋 戒環要解', year: 1150, note: '表號錨定 91 條' },
  { id: 'GD', file: 'guanding.json', short: '灌頂', title: '楞嚴經灌頂疏科判', author: '清 續法撰', year: 1690, note: '表號錨定 128 條' },
]) {
  try {
    const list = JSON.parse(readFileSync(join(DATA, 'kepan', spec.file), 'utf8')).nodes as any[];
    const nodes = list.map((n: any, i: number) => ({ id: i, lv: n.lv, lab: n.lab, nm: n.nm, par: n.par, ch: n.ch, u: n.u, off: 0, u2: n.u2, o2: 0, nk: 0 }));
    editions.push({
      id: spec.id, order: editions.length, ordStyle: 'plain', workId: spec.id, base: false, flat: 0,
      short: spec.short, title: spec.title, author: spec.author, date: '', year: spec.year, note: spec.note,
      source: { text: 'kepanhuizong PDF', file: spec.file },
      noMarks: 0, roots: nodes.filter((x: any) => x.par == null).map((x: any) => x.id), linked: nodes.length, nodes,
    });
    console.log(spec.id + ' ' + spec.short + ': ' + nodes.length + ' 節點');
  } catch (e) { console.log(spec.id + ' 略過'); }
}


// 交光：改用 kepanhuizong 正脉疏科判 PDF（1,815 節、251 條表號）
try {
  const jg = JSON.parse(readFileSync(join(DATA, 'kepan', 'jiaoguang-pdf.json'), 'utf8')).nodes as any[];
  const ed = editions.find((e: any) => e.id === 'X273');
  if (ed) {
    ed.nodes = jg.map((n: any, i: number) => ({ id: i, lv: n.lv, lab: n.lab, nm: n.nm, par: n.par, ch: n.ch, u: n.u, off: 0, u2: n.u2, o2: 0, nk: 0 }));
    ed.roots = ed.nodes.filter((n: any) => n.par == null).map((n: any) => n.id);
    ed.linked = ed.nodes.length;
    ed.note = '表號錨定 251 條（正脉疏科判 PDF）';
    ed.source = { text: 'kepanhuizong b_1_01.pdf', file: 'jiaoguang-pdf.json' };
    console.log('X273 交光：正脉疏科判 PDF ' + ed.nodes.length + ' 節點');
  }
} catch (e) { console.log('交光覆寫略過'); }


// 子璿：優先用《長水疏》2010 排版 PDF 的「科判＋經文」對（925 條錨定）
try {
  const cs = JSON.parse(readFileSync(join(DATA, 'kepan', 'changshui2.json'), 'utf8')).nodes as any[];
  const ed = editions.find((e: any) => e.id === 'X265');
  if (ed) {
    ed.nodes = cs.map((n: any, i: number) => ({ id: i, lv: n.lv, lab: n.lab, nm: n.nm, par: n.par, ch: n.ch, u: n.u, off: 0, u2: n.u2, o2: 0, nk: 0 }));
    ed.roots = ed.nodes.filter((n: any) => n.par == null).map((n: any) => n.id);
    ed.linked = ed.nodes.length;
    ed.note = '長水疏 2010 排版 PDF：925 條以經文錨定';
    ed.source = { text: '佛陀教育基金會《首楞嚴經長水疏》', file: 'changshui2.json' };
    console.log('X265 子璿：長水疏含經文版 ' + ed.nodes.length + ' 節點');
  }
} catch (e) { console.log('長水疏含經文版略過'); }


// OCR 參考版《大佛頂首楞嚴經（有科判）》
try {
  const yk = JSON.parse(readFileSync(join(DATA, 'kepan', 'youkepan.json'), 'utf8')).nodes as any[];
  const nodes = yk.map((n: any, i: number) => ({ id: i, lv: n.lv, lab: n.lab, nm: n.nm, par: n.par, ch: n.ch, u: n.u, off: 0, u2: n.u2, o2: 0, nk: 0 }));
  editions.push({
    id: 'YK', order: editions.length, ordStyle: 'plain', workId: 'YK', base: false, flat: 0,
    short: 'OCR科判', title: '楞嚴經（有科判）OCR', author: '掃描本 OCR', date: '', year: 0,
    note: '掃描 OCR，字多有誤，錨定僅約一成，僅供參考',
    source: { text: '大佛頂首楞嚴經（有科判）OCR', file: 'youkepan.json' },
    noMarks: 0, roots: nodes.filter((x: any) => x.par == null).map((x: any) => x.id), linked: nodes.length, nodes,
  });
  console.log('YK OCR: ' + nodes.length + ' 節點');
} catch (e) { console.log('OCR 版略過'); }

// X273 交光：PDF 解析缺「甲一／甲二」，且把序分／正宗／流通的根接錯。
// 補合成根，把原 roots 重新掛好；不改節點內容，只改樹的頂層。
try {
  const ed = editions.find((e: any) => e.id === 'X273');
  if (ed) {
    const N = ed.nodes.length;
    const n0 = ed.nodes[0];
    const n10 = ed.nodes[10];
    const oldKids = (n0.ch || []).slice();
    const jia1 = { id: N, lv: 1, lab: '甲一', nm: '序分', par: null, ch: [0], u: 46, off: 0, u2: 142, o2: 0, nk: 0 };
    const yi1 = { id: N + 1, lv: 2, lab: '乙一', nm: '经中具示妙定始终', par: null, ch: oldKids, u: 143, off: 0, u2: 2775, o2: 0, nk: 0 };
    const jia2 = { id: N + 2, lv: 1, lab: '甲二', nm: '正宗分', par: null, ch: [N + 1, 10], u: 143, off: 0, u2: 3699, o2: 0, nk: 0 };
    const jia3Kids = [...new Set([...(ed.nodes[12]?.ch || []), ...(ed.nodes[1807]?.ch || [])])];
    const jia3 = { id: N + 3, lv: 1, lab: '甲三', nm: '流通分', par: null, ch: jia3Kids, u: 3700, off: 0, u2: 3731, o2: 0, nk: 0 };
    n0.par = N; n0.u2 = 142; n0.ch = [];
    n10.par = N + 2; n10.u2 = 3699;
    for (const id of oldKids) ed.nodes[id].par = N + 1;
    for (const id of jia3Kids) ed.nodes[id].par = N + 3;
    for (const id of [12, 1807]) { ed.nodes[id].par = N + 3; ed.nodes[id].ch = []; }
    yi1.par = N + 2;
    ed.nodes.push(jia1, yi1, jia2, jia3);
    ed.roots = [N, N + 2, N + 3];
    ed.linked = ed.nodes.length;

    // PDF 同一頁／同一欄會重複抽出：同 lab+nm+u+u2 只留第一個，子節點併入。
    const keyOf = (n: any) => [n.lab, n.nm, n.u, n.u2].join('|');
    const keep = new Map<string, any>();
    const alias = new Map<number, number>();
    const kept: any[] = [];
    for (const n of ed.nodes) {
      const k = keyOf(n);
      const first = keep.get(k);
      if (first) {
        for (const c of n.ch || []) if (c !== first.id && !first.ch.includes(c)) first.ch.push(c);
        alias.set(n.id, first.id);
      } else {
        keep.set(k, n);
        alias.set(n.id, n.id);
        kept.push(n);
      }
    }
    const idMap = new Map<number, number>(kept.map((n, i) => [n.id, i]));
    for (const n of kept) {
      const old = n.id;
      n.id = idMap.get(old)!;
      n.par = n.par == null ? null : (idMap.get(alias.get(n.par)!) ?? null);
      n.ch = [...new Set((n.ch || []).map((c: number) => idMap.get(alias.get(c)!) ?? -1).filter((x: number) => x >= 0 && x !== n.id))];
    }
    ed.nodes = kept;
    ed.roots = kept.filter((n: any) => n.par == null).map((n: any) => n.id);
    ed.linked = kept.length;
    console.log('X273 交光：補根＋去重 ' + (N + 4 - kept.length) + ' 節，roots=' + ed.roots.join(','));
  }
} catch (e) { console.log('交光根修補略過', e); }

// ANCHORED_ONLY：只留能對到經文（或原書表號）的科判；其餘暫時不進下拉
const ANCHORED_ONLY = true;
const DROP = new Set(['X278', 'X290', 'X304', 'X314']);

const out = { v: 1, generated: new Date().toISOString(), note: '楞嚴經六家科判（錨點＝蒙鈔疏前引文）', editions };
const filtered = ANCHORED_ONLY ? editions.filter((e) => !DROP.has(e.id)) : editions;
console.log('保留科判：' + filtered.map((e) => e.short).join('、'));
writeFileSync(join(OUT, 'kepan-data.js'), 'window.KEPAN=' + JSON.stringify({ ...out, editions: filtered }) + ';\n');
console.log('→ site/reader/kepan/kepan-data.js', (JSON.stringify(out).length / 1048576).toFixed(2), 'MiB');


