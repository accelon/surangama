#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs';
const lines = readFileSync('build/quote-scan-pilot.tsv', 'utf8').trim().split('\n');
const head = lines[0].split('\t');
const rows = lines.slice(1).map((l) => l.split('\t'));
const isRef = (book: string) => /楞嚴|首楞嚴|宗鏡錄/.test(book);
const out = [head.concat('cls').join('\t')];
for (const r of rows) out.push(r.concat(isRef(r[head.indexOf('book')]) ? 'ref' : 'other').join('\t'));
writeFileSync('build/quote-scan-classified.tsv', out.join('\n') + '\n');
const ref = rows.filter((r) => isRef(r[head.indexOf('book')])).length;
console.log(`rows ${rows.length}; ref ${ref}; other ${rows.length - ref} → build/quote-scan-classified.tsv`);
