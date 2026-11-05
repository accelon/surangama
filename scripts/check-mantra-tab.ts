#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('data/mantra-tab.json', 'utf8'));
const old = JSON.parse(readFileSync('data/sutra.json', 'utf8')).sentences;
const fails: string[] = [];
const ok = (x: boolean, m: string) => { if (!x) fails.push(m); };
ok(d.schema === 1, 'schema');
ok(d.units.length === 143, `units ${d.units.length}`);
ok(d.assemblies.length === 5, `assemblies ${d.assemblies.length}`);
ok(d.units.reduce((a: number, u: any) => a + u.words.length, 0) === 770, 'words');
ok(d.coverage.exact_units === 11 && d.coverage.approx_units === 131 && d.coverage.gap_units === 1, 'coverage');
ok(d.lexicon.length === 453, `lexicon ${d.lexicon.length}`);
ok(d.links.length === 422, `links ${d.links.length}`);
for (const u of d.units) {
  ok(Array.isArray(u.u), `unit u ${u.id}`);
  for (const x of u.u) ok(x >= 0 && x < old.length, `bad u ${u.id}`);
  for (const w of u.words) {
    ok(['1:1', '1:n', 'n:1', 'gap', 'approx'].includes(w.relation), `bad relation ${u.id}/${w.sa}`);
    if (w.relation === 'gap') ok(w.u.length === 0, `gap has u ${u.id}/${w.sa}`);
    for (const x of w.u) ok(x >= 0 && x < old.length, `word bad u ${u.id}/${w.sa}`);
    if (w.u.length && w.char) {
      const [a, b] = w.char;
      ok(a >= 0 && b >= a && b <= old[w.u[0]].text.length, `bad char ${u.id}/${w.sa} ${a}-${b}`);
    }
  }
}
ok(d.units.some((u: any) => u.id === 'M1.06' && u.gap), 'M1.06 gap');
ok(d.assemblies[0].covered === 39 && d.assemblies[0].word_covered === 11, 'M1 covered');
ok(d.assemblies.every((a: any) => a.covered === a.total), 'assemblies covered');
console.log(fails.length ? 'FAIL\n' + fails.slice(0, 20).join('\n') : 'PASS');
console.log({ units: d.units.length, words: d.units.reduce((a: number, u: any) => a + u.words.length, 0), lexicon: d.lexicon.length, links: d.links.length, fails: fails.length });
