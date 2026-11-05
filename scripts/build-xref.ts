#!/usr/bin/env bun
/**
 * 把九家科判節點、27 分節對到穩定 track_id range。
 * 這是「書同軌」的 crosswalk：所有來源只存 track_start/track_end。
 *
 *   bun run scripts/build-xref.ts
 *
 * 讀 data/tracks-zh.tsv、build/sentence-split-map.tsv、site/reader/kepan/kepan-data.js、
 *    data/ke-anchors.json、data/kepan/changshui-sutra.json、data/kepan/drba.json
 * 寫 data/xref-kepan.tsv、data/xref-section.tsv
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

const tracks = readFileSync(join(DATA, 'tracks-zh.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const th = readFileSync(join(DATA, 'tracks-zh.tsv'), 'utf8').trim().split('\n')[0].split('\t');
const tix = Object.fromEntries(th.map((h, i) => [h, i]));
const byDisplay = new Map(tracks.map((r) => [r[tix.display_sid], r[tix.track_id]]));

const map = readFileSync(join(ROOT, 'build', 'sentence-split-map.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const newStart = new Int32Array(4000);
const newEnd = new Int32Array(4000);
for (const m of map) { newStart[+m[0].slice(1)] = +m[1].slice(1); newEnd[+m[0].slice(1)] = +m[2].slice(1); }

const raw = readFileSync(join(ROOT, 'site', 'reader', 'kepan', 'kepan-data.js'), 'utf8');
const K = JSON.parse(raw.slice(raw.indexOf('=') + 1).trim().replace(/;\s*$/, '')) as { editions: any[] };
const ED_IDS = ['X265', 'X273', 'DRBA', 'YY', 'YY1', 'YY2', 'WJ', 'YJ', 'GD'];
const ED = K.editions.filter((e) => ED_IDS.includes(e.id));

// exact sets
const norm = (t: string) => t.replace(/[「」『』（）()\s，。、；：！？…—·：.]/g, '').replace(/祗/g, '祇').replace(/盤/g, '槃').replace(/陁/g, '陀');
const recs = JSON.parse(readFileSync(join(DATA, 'kepan', 'changshui-sutra.json'), 'utf8')) as { kepan: string; sutra: string }[];
const S = (JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as { sentences: { text: string }[] }).sentences;
const SN = S.map((s) => norm(s.text));
const LEVELS = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥天地';
const marker = new RegExp('([' + LEVELS + '])(初|二|三|四|五|六|七|八|九|十)', 'g');
const exactX265 = new Set<number>();
let pi = 0, nid = 0;
for (const rec of recs) {
  const marks: { pos: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  const rx = new RegExp(marker.source, 'g');
  while ((m = rx.exec(rec.kepan))) marks.push({ pos: m.index, end: m.index + m[0].length });
  if (!marks.length) continue;
  let u = -1;
  const key = norm(rec.sutra);
  if (key.length >= 4) {
    for (let i = pi; i < Math.min(pi + 300, SN.length); i++) {
      const n = SN[i];
      if (n.startsWith(key.slice(0, 8)) || n.includes(key.slice(0, 8)) || (key.length >= 10 && n.includes(key.slice(2, 10))) || (key.length >= 8 && n.includes(key.slice(0, 6)))) { u = i; break; }
    }
  }
  if (u >= 0) pi = u + 1;
  for (const mk of marks) {
    const next = marks.find((x) => x.pos > mk.pos);
    const nm = rec.kepan.slice(mk.end, next ? next.pos : undefined).split('。')[0].replace(/分[一二三四五六七八九十]+$/, '').replace(/[，、；：]$/, '').trim();
    if (!nm) continue;
    if (u >= 0) exactX265.add(nid);
    nid++;
  }
}
const drba = JSON.parse(readFileSync(join(DATA, 'kepan', 'drba.json'), 'utf8')) as { nodes: { exact: number }[] };
const exactDrba = new Set<number>();
drba.nodes.forEach((n, i) => { if (n.exact === 1) exactDrba.add(i); });

const cell = (t: string) => (t || '').replace(/[\t\r\n]+/g, ' ').trim();
const out = ['work_id\tnode_id\tlv\tlab\tnm\ttrack_start\ttrack_end\tdisplay_start\tdisplay_end\tquality'];
for (const ed of ED) {
  for (const n of ed.nodes) {
    const ds = newStart[n.u];
    const de = newEnd[n.u2];
    const ts = byDisplay.get('S' + String(ds).padStart(4, '0'));
    const te = byDisplay.get('S' + String(de).padStart(4, '0'));
    let quality = 'table';
    if (ed.id === 'X265') quality = exactX265.has(n.id) ? 'exact' : 'interpolated';
    else if (ed.id === 'DRBA') quality = exactDrba.has(n.id) ? 'exact' : 'interpolated';
    out.push([ed.id, String(n.id), String(n.lv), cell(n.lab), cell(n.nm), ts, te,
      'S' + String(ds).padStart(4, '0'), 'S' + String(de).padStart(4, '0'), quality].join('\t'));
  }
}
writeFileSync(join(DATA, 'xref-kepan.tsv'), out.join('\n') + '\n');

const ka = JSON.parse(readFileSync(join(DATA, 'ke-anchors.json'), 'utf8')).sections as any[];
const sec = ['work_id\tnode_id\tlv\tlab\tnm\ttrack_start\ttrack_end\tdisplay_start\tdisplay_end\tquality'];
ka.forEach((s, i) => {
  const ds = newStart[s.startU], de = newEnd[s.endU];
  sec.push(['SEC27', String(i + 1), '2', s.code || '', cell(s.title || s.startPhrase || s.code),
    byDisplay.get('S' + String(ds).padStart(4, '0')), byDisplay.get('S' + String(de).padStart(4, '0')),
    'S' + String(ds).padStart(4, '0'), 'S' + String(de).padStart(4, '0'), 'catalog'].join('\t'));
});
writeFileSync(join(DATA, 'xref-section.tsv'), sec.join('\n') + '\n');
console.log(`xref-kepan ${out.length - 1}; xref-section ${sec.length - 1}`);
console.log(out.slice(0, 4).join('\n'));
