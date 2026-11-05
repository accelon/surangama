#!/usr/bin/env bun
/**
 * 書同軌資料檢查：軌號、cuts、xref、hierarchy、align 的基本不變量。
 * 任何一項 FAIL 都應該在 freeze 前修。
 *
 *   bun run scripts/check-track-system.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const read = (f: string) => readFileSync(join(DATA, f), 'utf8').trim().split('\n');
const table = (f: string) => {
  const lines = read(f);
  const head = lines[0].split('\t');
  return lines.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [head[i], v])));
};

const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (!cond) fails.push(msg); };

const sent = table('sentences.tsv');
const tracks = table('tracks-zh.tsv');
const sa = table('tracks-sa.tsv');
const cuts = table('cuts.tsv');
const coarse = table('cuts-coarse.tsv');
const edcut = table('cuts-editorial.tsv');
const xk = table('xref-kepan.tsv');
const xc = table('xref-commentary.tsv');
const xs = table('xref-section.tsv');
const al = table('align.tsv');

// tracks
ok(tracks.length === sent.length, `tracks ${tracks.length} != sentences ${sent.length}`);
ok(new Set(tracks.map((r) => r.track_id)).size === tracks.length, 'track_id not unique');
ok(new Set(tracks.map((r) => r.display_sid)).size === tracks.length, 'display_sid not unique');
const tids = new Set(tracks.map((r) => r.track_id));
const sids = new Set(sa.map((r) => r.track_id));
ok(sa.length === 143, `tracks-sa ${sa.length} != 143`);
ok(sids.size === sa.length, 'tracks-sa track_id not unique');

// cuts
ok(cuts.length === 2418, `cuts ${cuts.length} != 2418`);
ok(new Set(cuts.map((r) => r.cut_id)).size === cuts.length, 'cut_id not unique');
ok(new Set(cuts.map((r) => r.after_sid)).size === cuts.length, 'after_sid not unique');
ok(coarse.length === 615, `cuts-coarse ${coarse.length} != 615`);
ok(new Set(coarse.map((r) => r.cut_id)).size === coarse.length, 'coarse cut_id not unique');

// xref
ok(xk.length === 11007, `xref-kepan ${xk.length} != 11007`);
ok(xs.length === 27, `xref-section ${xs.length} != 27`);
for (const r of [...xk, ...xs]) {
  ok(tids.has(r.track_start), `missing track_start ${r.track_start}`);
  ok(tids.has(r.track_end), `missing track_end ${r.track_end}`);
}

// hierarchy coverage
for (const f of ['hierarchy.json', 'hierarchy-exact.json', 'hierarchy-shared2.json', 'hierarchy-coarse.json', 'hierarchy-all-ed.json', 'hierarchy-coarse-ed.json', 'hierarchy-exact-ed.json', 'hierarchy-shared2-ed.json']) {
  const j = JSON.parse(readFileSync(join(DATA, f), 'utf8'));
  const seen = new Int32Array(sent.length).fill(0);
  const nodes: any[] = [];
  let segs = 0;
  const walk = (n: any) => {
    nodes.push(n);
    if (n.kind === 'segment') { segs++; for (let i = n.sid_start; i <= n.sid_end; i++) seen[i]++; }
    (n.children || []).forEach(walk);
  };
  walk(j);
  ok(j.sid_start === 0 && j.sid_end === sent.length - 1, `${f} root range`);
  ok(seen.every((x) => x === 1), `${f} coverage not exactly 1`);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    if (n.parent == null) continue;
    const p = byId.get(n.parent);
    ok(!!p, `${f} missing parent ${n.parent}`);
    if (p) ok(p.sid_start <= n.sid_start && n.sid_end <= p.sid_end, `${f} parent range ${n.id}`);
  }
}

// align
for (const r of al) {
  ok(!r.track_a || tids.has(r.track_a), `align missing track_a ${r.track_a}`);
  ok(!r.track_b || sids.has(r.track_b), `align missing track_b ${r.track_b}`);
}

console.log(fails.length ? 'FAIL\n' + fails.slice(0, 20).join('\n') : 'PASS');
console.log({ sentences: sent.length, tracks: tracks.length, sa: sa.length, cuts: cuts.length, coarse: coarse.length, edcut: edcut.length, xref_kepan: xk.length, xref_section: xs.length, xref_commentary: xc.length, align: al.length, fails: fails.length });



