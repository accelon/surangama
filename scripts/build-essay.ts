#!/usr/bin/env bun
/**
 * 把 docs/essays/*.md 排成 /yap/essays/ 的文章頁（沿用 essays.css 與繁簡切換）。
 *
 *   bun run scripts/build-essay.ts docs/essays/一句話一個門牌.md shutonggui.html
 *
 * 讀 md（# 標題、> 系列副標、## 小標、段落、![圖](x.svg)）
 * 寫 D:\nissaya.cn\html\yap\essays\<slug>
 * 另外把 SVG 一併複製到同目錄，方便單獨引用。
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const mdPath = process.argv[2] ?? join(ROOT, 'docs', 'essays', '一句話一個門牌.md');
const slug = process.argv[3] ?? 'shutonggui.html';
const OUT = 'D:\\nissaya.cn\\html\\yap\\essays';

const md = readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n');
const dir = dirname(mdPath);

// ---- 解析 md ----
const lines = md.split('\n');
let i = 0;
let title = '';
let series = '';
while (i < lines.length && !lines[i].startsWith('# ')) i++;
if (i < lines.length) title = lines[i++].slice(2).trim();
for (; i < lines.length; i++) {
  const l = lines[i].trim();
  if (!l) continue;
  if (l.startsWith('> ')) { series = l.slice(2).trim(); continue; }
  break;
}
type Block = { t: 'p' | 'h2'; s: string } | { t: 'img'; src: string; svg: string };
const blocks: Block[] = [];
const body = lines.slice(i).join('\n');
for (const raw of body.split(/\n\s*\n/)) {
  const b = raw.trim();
  if (!b) continue;
  const img = /^!\[[^\]]*\]\(([^)]+)\)$/.exec(b);
  if (img) {
    const p = join(dir, img[1]);
    const svg = existsSync(p) ? readFileSync(p, 'utf8').replace(/^<\?xml[^>]*>\s*/i, '') : '';
    blocks.push({ t: 'img', src: img[1], svg });
    continue;
  }
  if (b.startsWith('## ')) { blocks.push({ t: 'h2', s: b.slice(3).trim() }); continue; }
  blocks.push({ t: 'p', s: b.split('\n').map((x) => x.trim()).join('') });
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s: string) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="mono">$1</code>')
    .replace(/(.)——/g, '<span class="nb">$1——</span>');

// ---- 繁簡表 ----
const DATA = 'D:\\2026\\agent-norms\\lossless-simplified\\simplified-data.ts';
const src = readFileSync(DATA, 'utf8');
function tableOf(name: string): string {
  const lit = src.match(new RegExp('export const ' + name + '\\s*=\\s*((?:"[^"]*"\\s*\\+?\\s*)+)'));
  if (!lit) throw new Error(name + ' not found');
  return [...lit[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]).join('');
}
const SAFE = tableOf('SAFE_PAIRS');
const FORCE = tableOf('FORCE_PAIRS');
const allText = [title, series, ...blocks.map((b) => ('s' in b ? b.s : ''))].join('\n');
const chars = new Set(allText);
// 先用 SAFE，缺的用 FORCE 補（FORCE 是完整異體表；本文沒有「著作」這類名詞用法）
const map = new Map<string, string>();
for (let k = 0; k < SAFE.length; k += 2) map.set(SAFE[k], SAFE[k + 1]);
for (let k = 0; k < FORCE.length; k += 2) if (!map.has(FORCE[k])) map.set(FORCE[k], FORCE[k + 1]);
const zhuNoun = /著(?:作|名|者|述|錄)|土著/.test(allText);
const pairs: string[] = [];
for (const ch of chars) {
  if (ch === '著' && zhuNoun) continue;
  const s = map.get(ch);
  if (s) pairs.push(ch + s);
}
const table = pairs.join('');

const DATE = '2026-11-05';
const KICKER = '書同軌 · 古籍數字化';

// ---- 版面 ----
const parts = blocks.map((b) => {
  if (b.t === 'h2') return `    <h2>${inline(b.s)}</h2>`;
  if (b.t === 'p') return `    <p>${inline(b.s)}</p>`;
  return `    <figure class="fig">\n${b.svg.split('\n').map((l) => '      ' + l).join('\n')}\n    </figure>`;
});

const SCRIPT = (tb: string) => `<script>
(function () {
  var P = "${tb}", M = {};
  for (var i = 0; i < P.length; i += 2) M[P.charAt(i)] = P.charAt(i + 1);
  var SKIP_TAG = /^(SCRIPT|STYLE|CODE|PRE)$/;
  var nodes = [], orig = [];
  try {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false), n;
    while ((n = w.nextNode())) {
      var p = n.parentNode; if (!p) continue;
      if (SKIP_TAG.test(p.nodeName)) continue;
      var v = n.nodeValue;
      if (!v || !v.replace(/\\s/g, "")) continue;
      nodes.push(n); orig.push(v);
    }
  } catch (e) {}
  var titleOrig = document.title;
  function conv(s) { var o = ""; for (var i = 0; i < s.length; i++) { var c = s.charAt(i); o += M[c] || c; } return o; }
  function apply(sim) {
    for (var i = 0; i < nodes.length; i++) nodes[i].nodeValue = sim ? conv(orig[i]) : orig[i];
    document.title = sim ? conv(titleOrig) : titleOrig;
    document.documentElement.lang = sim ? "zh-Hans" : "zh-Hant";
    var b = document.getElementById("simToggle");
    if (b) b.textContent = sim ? "繁體" : "简体";
  }
  var host = location.hostname.toLowerCase();
  var q = new URLSearchParams(location.search);
  var saved = null;
  try { saved = localStorage.getItem("rut.sim"); } catch (e) {}
  var sim = saved ? saved === "s" : (q.get("sim") === "1" ? true : q.get("sim") === "0" ? false : (host === "shutonggui.cn" || host === "www.shutonggui.cn"));
  try { apply(sim); } catch (e) {}
  var MODES = ["light", "dark", "eye"];
  var mbtns = document.querySelectorAll("#modeSwitch button");
  function setMode(m) {
    if (MODES.indexOf(m) < 0) m = "eye";
    document.documentElement.setAttribute("data-mode", m);
    for (var i = 0; i < mbtns.length; i++) mbtns[i].setAttribute("aria-pressed", mbtns[i].getAttribute("data-mode") === m ? "true" : "false");
  }
  setMode(document.documentElement.getAttribute("data-mode") || "eye");
  for (var mi = 0; mi < mbtns.length; mi++) mbtns[mi].addEventListener("click", function (e) {
    e.preventDefault(); var m = this.getAttribute("data-mode"); setMode(m);
    try { localStorage.setItem("yap.mode", m); } catch (e2) {}
  });
  document.body.style.visibility = "visible";
  var btn = document.getElementById("simToggle");
  if (btn) btn.addEventListener("click", function (e) {
    e.preventDefault(); sim = !sim; apply(sim);
    try { localStorage.setItem("rut.sim", sim ? "s" : "t"); } catch (e2) {}
  });
}());
</script>`;

const html = `<!DOCTYPE html>
<!-- 由 surangama/scripts/build-essay.ts 產生；請改 docs/essays 的 md 再重建，勿直接編輯本檔。 -->
<html lang="zh-Hant" data-mode="eye">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · 書同軌</title>
<meta name="description" content="書同軌：一句話一個門牌。從《楞嚴經》九家科判的實作，談句級地址、最小切分與軌號。">
<script>
(function () {
  var m = "eye";
  try { var s = localStorage.getItem("yap.mode"); if (s === "light" || s === "dark" || s === "eye") m = s; } catch (e) {}
  document.documentElement.setAttribute("data-mode", m);
}());
</script>
<link rel="stylesheet" href="essays.css">
<style>
  figure.fig{margin:1.6em 0 1.8em;padding:10px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
  figure.fig svg{width:100%;height:auto;display:block}
  code.mono{font-family:'Cascadia Code',Consolas,monospace;font-size:.86em;background:var(--panel);padding:1px 5px;border-radius:3px;border:1px solid var(--line)}
  strong{font-weight:700}
</style>
</head>
<body style="visibility:hidden">

<div class="topbar">
  <div class="tb-inner">
    <a class="back" href="../index.html">← 發表紀錄</a>
    <div class="tb-tools">
      <div class="modes" id="modeSwitch" role="group" aria-label="底色">
        <button type="button" data-mode="light" title="亮底">亮</button>
        <button type="button" data-mode="dark" title="暗底">暗</button>
        <button type="button" data-mode="eye" aria-pressed="true" title="護眼底色">護眼</button>
      </div>
      <a href="#" id="simToggle" aria-label="切換繁體／簡體">简体</a>
    </div>
  </div>
</div>

<header>
  <div class="wrap">
    <p class="kicker">${esc(KICKER)}</p>
    <h1>${inline(title)}</h1>
    ${series ? `<p class="sub">${inline(series)}</p>` : ''}
    <p class="byline">${DATE}</p>
  </div>
</header>

<article class="wrap">
${parts.join('\n\n')}
</article>

<footer>
  <div class="wrap">
    <div class="foot-links">
      <a href="../index.html">← 發表紀錄</a>
      <a href="https://shutonggui.cn/yap/">shutonggui.cn</a>
      <a href="https://nissaya.cn/yap/">nissaya.cn（鏡像）</a>
    </div>
    <div class="foot-series">書同軌 · ${DATE}</div>
  </div>
</footer>

<noscript><style>body{visibility:visible!important}</style></noscript>
${SCRIPT(table)}
</body>
</html>
`;

writeFileSync(join(OUT, slug), html);
for (const b of blocks) if (b.t === 'img') copyFileSync(join(dir, b.src), join(OUT, basename(b.src)));
console.log(`wrote ${join(OUT, slug)}  ${html.length} chars`);
