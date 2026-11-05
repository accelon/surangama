#!/usr/bin/env bun
/**
 * 把 mantra prototype 放進孵化區的本地鏡像：
 *   - build/surangama-mantra.html → D:\nissaya.cn\html\incubator\surangama-mantra.html
 *   - projects.json 加/更新 surangama-mantra 卡片（tradition=釋家）
 *
 *   bun run scripts/prepare-incubator-mantra.ts
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const INC = 'D:/nissaya.cn/html/incubator';
const SRC = join(ROOT, 'build', 'surangama-mantra.html');
copyFileSync(SRC, join(INC, 'surangama-mantra.html'));

const file = join(INC, 'projects.json');
const data = JSON.parse(readFileSync(file, 'utf8'));
// 2026-11-05 作者指示：楞嚴咒詞級對照不獨立成卡，掛在「楞嚴經選注」之下。
data.projects = data.projects.filter((p: any) => p.id !== 'surangama-mantra');
const sur = data.projects.find((p: any) => p.id === 'surangama');
if (!sur) throw new Error('projects.json 找不到 surangama');
sur.links = sur.links || [];
if (!sur.links.some((l: any) => l.href === '/incubator/surangama-mantra.html')) {
  sur.links.push({ label: '楞嚴咒詞級對照', href: '/incubator/surangama-mantra.html' });
}
data.updated = '2026-11-05';
writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log('mantra link attached to surangama card; html copied → ' + INC + '/surangama-mantra.html');
