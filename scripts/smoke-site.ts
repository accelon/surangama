#!/usr/bin/env bun
/**
 * 前端煙霧測試：用 Edge headless + CDP 打開 index.html，模擬點句、切分頁、搜辭典。
 *
 *   bun run scripts/smoke-site.ts
 */
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dir, '..');
const HTML = resolve(ROOT, 'index.html');
const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) { console.error('no browser'); process.exit(2); }

const profile = resolve(ROOT, 'build/.chrome-profile-smoke-' + process.pid);
const proc = Bun.spawn([browser, '--headless=new', '--disable-gpu', '--no-first-run',
  '--remote-debugging-port=0', '--remote-allow-origins=*', '--allow-file-access-from-files',
  '--window-size=1600,1000', `--user-data-dir=${profile}`, 'about:blank'],
  { stdout: 'pipe', stderr: 'pipe' });

async function devtoolsUrl(): Promise<string> {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const text = await Bun.file(resolve(profile, 'DevToolsActivePort')).text().catch(() => '');
    const [port, path] = text.split('\n').map((s) => s.trim());
    if (Number(port) > 0 && path) return `ws://127.0.0.1:${port}${path}`;
    await Bun.sleep(200);
  }
  throw new Error('no devtools');
}

class Cdp {
  ws!: WebSocket; id = 0; sessionId = '';
  pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  static async attach(url: string) {
    const c = new Cdp();
    await new Promise<void>((res, rej) => {
      c.ws = new WebSocket(url);
      c.ws.onopen = () => res();
      c.ws.onerror = () => rej(new Error('ws error'));
      c.ws.onmessage = (ev) => {
        const m = JSON.parse(String(ev.data));
        if (m.id && c.pending.has(m.id)) {
          const p = c.pending.get(m.id)!; c.pending.delete(m.id);
          m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        }
      };
    });
    return c;
  }
  send(method: string, params: Record<string, unknown> = {}, session = true): Promise<any> {
    const id = ++this.id;
    const payload: Record<string, unknown> = { id, method, params };
    if (session && this.sessionId) payload.sessionId = this.sessionId;
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      this.ws.send(JSON.stringify(payload));
      setTimeout(() => { if (this.pending.delete(id)) rej(new Error('timeout ' + method)); }, 60000);
    });
  }
  async open(url: string) {
    const { targetId } = await this.send('Target.createTarget', { url }, false);
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true }, false);
    this.sessionId = sessionId;
    await this.send('Runtime.enable');
    await this.send('Page.enable');
  }
  async eval<T>(expression: string): Promise<T> {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed');
    return r.result.value as T;
  }
}

const cdp = await Cdp.attach(await devtoolsUrl());
await cdp.open(pathToFileURL(HTML).href + '?v=' + Date.now());
await Bun.sleep(1200);

const report = await cdp.eval<string>(`
  (async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    out.sentences = document.querySelectorAll('#textPane .sent').length;
    out.title = document.querySelector('h1')?.textContent;
    // 點第一句
    document.querySelector('#textPane .sent')?.click();
    await sleep(150);
    out.notesAfterClick = document.querySelectorAll('#notesPane .note').length;
    out.selected = document.querySelectorAll('#textPane .sent.sel').length;
    // 科判
    document.querySelector('.tabs button[data-tab="ke"]')?.click();
    await sleep(100);
    out.keOptions = document.querySelectorAll('#keSel option').length;
    out.keChars = (document.querySelector('#keBody')?.textContent || '').length;
    // 別譯
    document.querySelector('.tabs button[data-tab="alt"]')?.click();
    await sleep(100);
    out.altChars = (document.querySelector('#altBody')?.textContent || '').length;
    // 辭典
    document.querySelector('.tabs button[data-tab="dict"]')?.click();
    await sleep(100);
    out.chips = document.querySelectorAll('#chips button').length;
    out.entries = document.querySelectorAll('#dictList button').length;
    const dq = document.querySelector('#dq');
    dq.value = '阿難'; dq.dispatchEvent(new Event('input'));
    await sleep(150);
    out.entriesAfterSearch = document.querySelectorAll('#dictList button').length;
    document.querySelector('#dictList button')?.click();
    await sleep(150);
    out.detailTerm = document.querySelector('#dictDetail h2')?.textContent;
    out.occRows = document.querySelectorAll('#dictDetail .occ').length;
    // 點第一筆出處 → 應跳句
    document.querySelector('#dictDetail .occ')?.click();
    await sleep(200);
    out.jumpedSelected = document.querySelectorAll('#textPane .sent.sel').length;
    dq.value = '取相'; dq.dispatchEvent(new Event('input'));
    await sleep(150);
    document.querySelector('#dictList button')?.click();
    await sleep(150);
    out.editorNote = document.querySelectorAll('#dictDetail .editorNote').length;
    out.related = document.querySelectorAll('#dictDetail .rel').length;
    document.querySelector('#dictDetail .rel')?.click();
    await sleep(150);
    out.relatedJump = document.querySelector('#dictDetail h2')?.textContent;
    dq.value = '交光'; dq.dispatchEvent(new Event('input'));
    await sleep(150);
    document.querySelector('#dictList button')?.click();
    await sleep(150);
    out.workLinks = document.querySelectorAll('#dictDetail .wl').length;
    document.querySelector('#dictDetail .wl')?.click();
    await sleep(200);
    out.fullLen = (document.querySelector('#fullBody')?.textContent || '').length;
    out.fullSel = document.querySelector('#fullSel')?.value;
    out.selection = (window.getSelection()?.toString() || '').length;
    return JSON.stringify(out, null, 1);
  })()
`);
console.log(report);
proc.kill();
await Bun.sleep(200);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
