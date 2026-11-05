#!/usr/bin/env bun
/**
 * 把 data/mantra-tab.json 內嵌到單頁 prototype。
 *
 *   bun run scripts/build-mantra-app.ts
 *
 * 輸出 build/surangama-mantra.html、site/reader/surangama-mantra.html
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const data = JSON.stringify(JSON.parse(readFileSync(join(ROOT, 'data', 'mantra-tab.json'), 'utf8')));
const tpl = readFileSync(join(ROOT, 'scripts', 'mantra-app-template.html'), 'utf8');
const html = tpl.replace('__MANTRA__', data);
if (html.includes('__MANTRA__')) throw new Error('template not replaced');
writeFileSync(join(ROOT, 'build', 'surangama-mantra.html'), html);
writeFileSync(join(ROOT, 'site', 'reader', 'surangama-mantra.html'), html);
console.log(`built ${(html.length / 1024).toFixed(1)} KiB → build/surangama-mantra.html, site/reader/surangama-mantra.html`);


