#!/usr/bin/env bun
/**
 * 英譯（Luk, BDEA 352 頁本）依漢文十卷切段 → data/english.json
 *
 *   bun run scripts/extract-english.ts
 *
 * 讀 data/luk-juan.json（卷→書頁），用 pypdf 抽對應頁的文字。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const PDF = join(ROOT, 'vendor', 'english', 'surangama-yu.pdf');
const map = JSON.parse(readFileSync(join(ROOT, 'data', 'luk-juan.json'), 'utf8')) as {
  juan: { juan: number; page: number; end: number }[];
};

const py = String.raw`
import json, sys
from pypdf import PdfReader
r = PdfReader(sys.argv[1])
spans = json.loads(sys.argv[2])
out = {}
for s in spans:
    lo = max(0, s["page"] - 1)
    hi = min(len(r.pages) - 1, s["end"] - 1)
    text = "\n".join((r.pages[i].extract_text() or "") for i in range(lo, hi + 1))
    out[str(s["juan"])] = text
print(json.dumps(out, ensure_ascii=False))
`;

const proc = Bun.spawnSync([
  'C:\\Users\\yapch\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe',
  '-c', py, PDF, JSON.stringify(map.juan),
], { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());

const juan = JSON.parse(proc.stdout.toString()) as Record<string, string>;
const payload = { schema: 1, id: 'LUK', label: '英譯・Charles Luk', source: 'surangama-yu.pdf', juan };
writeFileSync(join(ROOT, 'data', 'english.json'), JSON.stringify(payload) + '\n');
for (const [k, v] of Object.entries(juan)) console.log(`卷${k}: ${v.length} chars`);
console.log('→ data/english.json');
