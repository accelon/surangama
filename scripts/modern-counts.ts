#!/usr/bin/env bun
/**
 * 近代／現代著作的篇幅：從 tx／ys／lc 的 adb 取幾個楞嚴相關節點的字數。
 * 用 accelon26 同一套 adb 讀取器；輸出 build/modern-counts.json。
 *
 *   bun run scripts/modern-counts.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readAdbText } from 'D:\\2026\\adb-converter\\ts\\src\\adbtext';

const CORPUS = process.env.SURANGAMA_CORPUS ?? 'D:\\2026\\adb-converter';
const ADB = join(CORPUS, 'build', 'adb-publish');
const OUT = join(import.meta.dir, '..', 'build', 'modern-counts.json');

interface Spec { file: string; title: string; stop: RegExp }

const SPECS: Spec[] = [
  { file: join(ADB, 'tx.adb'), title: '大佛頂首楞嚴經攝論', stop: /^<文[^>]*>/ },
  { file: join(ADB, 'tx.adb'), title: '大佛頂首楞嚴經研究', stop: /^<文[^>]*>/ },
  { file: join(ADB, 'tx.adb'), title: '楞嚴大意', stop: /^<文[^>]*>/ },
  { file: join(CORPUS, 'build', 'lc.adb'), title: '楞嚴百偽', stop: /^<章[^>]*>/ },
];

const byFile = new Map<string, string[]>();
for (const s of SPECS) if (!byFile.has(s.file)) byFile.set(s.file, readAdbText(s.file).lines);

const out: { file: string; title: string; chars: number; lines: number }[] = [];
for (const s of SPECS) {
  const lines = byFile.get(s.file)!;
  const start = lines.findIndex((l) => l.includes(`>${s.title}</`) && /^<(文|章|部|書)[^>]*>/.test(l));
  if (start < 0) { console.error(`找不到 ${s.title}`); continue; }
  let chars = 0, n = 0;
  for (let i = start; i < lines.length; i++) {
    if (i > start && s.stop.test(lines[i])) break;
    chars += (lines[i].replace(/<[^>]+>/g, '').match(/[\u3400-\u9fff]/g) ?? []).length;
    n++;
  }
  out.push({ file: s.file.replace(/^.*[\\/]/, ''), title: s.title, chars, lines: n });
  console.log(`${s.title}\t${chars} 字\t${n} 行`);
}
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log('→', OUT);
