#!/usr/bin/env bun
/**
 * 由 track-refinements.tsv 產生 suggested child tracks（不覆寫 tracks-zh.tsv）。
 * split：在原軌文字上按 Han offset 切段，子軌號 <parent>.1/.2/…
 * join：只記 join group，不合併軌號。
 *
 *   bun run scripts/suggest-tracks.ts
 *
 * 寫 data/tracks-suggested.tsv、data/join-groups.tsv
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const tracks = readFileSync(join(DATA, 'tracks-zh.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [track_id, base_sid, part, display_sid, addr, juan, page, text, han, source] = l.split('\t');
  return { track_id, base_sid, part: +part, display_sid, addr, juan: +juan, page, text, han: +han, source };
});
const byId = new Map(tracks.map((t) => [t.track_id, t]));
const isHan = (c: string) => { const cp = c.codePointAt(0) ?? 0; return (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0x20000 && cp <= 0x2fa1f); };

/** raw text slice from Han index a to Han index b (exclusive) */
function sliceHan(text: string, a: number, b: number): string {
  let n = 0, start = 0, end = text.length;
  for (let i = 0; i < text.length; i++) {
    if (!isHan(text[i])) continue;
    if (n === a) start = i;
    if (n === b) { end = i; break; }
    n++;
  }
  return text.slice(start, end);
}

const ref = readFileSync(join(DATA, 'track-refinements.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const out = ['suggested_track_id\tparent_track\tbase_sid\tpart\tdisplay_sid\taddr\tjuan\tpage\ttext\than\tsource\taction\tevidence\tconfidence'];
const joins = ['join_id\ttrack_ids\tbooks\tpages\tevidence\tconfidence'];
const seen = new Set<string>();
let splitRows = 0, joinRows = 0;

for (const r of ref) {
  const [track_id, action, split_offsets, suggested, boundary, evidence, confidence, note] = r;
  if (action === 'split') {
    const t = byId.get(track_id);
    if (!t) continue;
    const offs = split_offsets.split(',').map(Number).filter((n) => n > 0 && n < t.han);
    if (!offs.length) continue;
    const bounds = [0, ...offs, t.han];
    for (let i = 0; i < bounds.length - 1; i++) {
      const text = sliceHan(t.text, bounds[i], bounds[i + 1]);
      const id = `${track_id}.${i + 1}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push([id, track_id, t.base_sid, String(t.part), t.display_sid, t.addr, String(t.juan), t.page, text.replace(/[\t\r\n]+/g, ' '), String(bounds[i + 1] - bounds[i]), 'quote-split', 'split', evidence, confidence].join('\t'));
      splitRows++;
    }
  } else if (action === 'join') {
    const [left, right] = (suggested || '').split(';');
    if (!left || !right) continue;
    const jid = (note.match(/join_group\s+(J\d+)/) || [])[1] || `J${String(joinRows + 1).padStart(4, '0')}`;
    joins.push([jid, `${left};${right}`, evidence.split(' (')[0], (note.split('; ')[1] || ''), evidence, confidence].join('\t'));
    joinRows++;
  }
}
writeFileSync(join(DATA, 'tracks-suggested.tsv'), out.join('\n') + '\n');
writeFileSync(join(DATA, 'join-groups.tsv'), joins.join('\n') + '\n');
const sup = ['old_track_id\tnew_track_ids\taction\tevidence\tconfidence\treview'];
for (const r of ref) if (r[1] === 'split') sup.push([r[0], r[3], 'split', r[5], r[6], r[8]].join('\t'));
writeFileSync(join(DATA, 'track-superseded.tsv'), sup.join('\n') + '\n');
console.log(`split child rows ${splitRows}; join groups ${joinRows} → data/tracks-suggested.tsv, data/join-groups.tsv, data/track-superseded.tsv`);

