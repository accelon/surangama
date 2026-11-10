# -*- coding: utf-8 -*-
"""docs/zongzhuan-cidian.md -> /incubator/surangama-cidian.html

單檔靜態頁：紙色主題、暗色切換、無損簡體切換、四張圖以 WebP 內嵌。
繁體是母本；簡體只做顯示轉換，不改檔案內容。
"""
import base64
import html
import io
import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "zongzhuan-cidian.md"
FIG = ROOT / "docs" / "figs" / "zongzhuan-cidian"
OUT = ROOT / "build" / "site" / "surangama-cidian.html"
SIM_DATA = ROOT.parent / "agent-norms" / "lossless-simplified" / "simplified-data.ts"


def inline(s: str) -> str:
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"</strong>\s+(?=[\u4e00-\u9fff「『（《])", "</strong>", s)
    s = re.sub(r"(?<=[：，。；])\s+<strong>", "<strong>", s)
    return s


def para(text: str) -> str:
    text = text.strip()
    m = re.match(r"^([一二三四五六七八九十]+）)(.*)$", text, re.S)
    if m:
        return (
            f'<p class="item"><span class="idx">{m.group(1)}</span>'
            f"{inline(m.group(2).strip())}</p>"
        )
    return f"<p>{inline(text)}</p>"


def render_table(rows):
    head, body = rows[0], rows[1:]
    out = ['<div class="table-wrap"><table>', "<thead><tr>"]
    for c in head:
        out.append(f"<th>{inline(c)}</th>")
    out.append("</tr></thead><tbody>")
    for r in body:
        out.append("<tr>")
        for j, c in enumerate(r):
            label = head[j] if j < len(head) else ""
            attr = f' data-label="{html.escape(label, quote=True)}"' if j > 0 and label else ""
            out.append(f"<td{attr}>{inline(c)}</td>")
        out.append("</tr>")
    out.append("</tbody></table></div>")
    return "".join(out)


def fig_data(name):
    im = Image.open(FIG / name).convert("RGB")
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=90, method=6)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/webp;base64,{b64}", im.width, im.height


lines = SRC.read_text(encoding="utf-8").splitlines()
blocks = []
i = 0
while i < len(lines):
    line = lines[i].strip()
    if not line:
        i += 1
        continue
    if line.startswith("# "):
        blocks.append(("h1", line[2:].strip()))
        i += 1
    elif line.startswith("## "):
        blocks.append(("h2", line[3:].strip()))
        i += 1
    elif line == "---":
        blocks.append(("hr", ""))
        i += 1
    elif line.startswith("> "):
        parts = []
        while i < len(lines) and lines[i].strip().startswith("> "):
            parts.append(lines[i].strip()[2:].strip())
            i += 1
        blocks.append(("quote", " ".join(parts)))
    elif line.startswith("!["):
        m = re.match(r"!\[([^\]]*)\]\(([^)]+)\)", line)
        if not m:
            raise ValueError(f"bad image line: {line}")
        blocks.append(("img", (m.group(1), Path(m.group(2)).name)))
        i += 1
    elif line.startswith("|"):
        rows = []
        while i < len(lines) and lines[i].strip().startswith("|"):
            row = lines[i].strip().strip("|")
            cells = [c.strip() for c in row.split("|")]
            if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
                rows.append(cells)
            i += 1
        blocks.append(("table", rows))
    else:
        blocks.append(("p", line))
        i += 1

TOC = []
body = []
open_sec = False
in_abs = False
quote_seen = 0
toc_done = False

body.append(
    '<header class="art-head">'
    '<div class="kicker">楞嚴經選注 · 專宗詞典</div>'
    "<h1>楞嚴詞典</h1>"
    '<p class="sub">紙書與語料：專宗詞典編纂的兩個時代</p>'
    '<p class="meta">以《楞嚴詞典》為例 · 2026 年 11 月</p>'
    "</header>"
)

for kind, val in blocks:
    if kind == "h1":
        continue

    if kind == "quote":
        quote_seen += 1
        if quote_seen == 1:
            continue  # 副題已寫進頁首
        body.append(f'<blockquote class="endnote">{inline(val)}</blockquote>')
        continue

    if kind == "hr":
        continue

    if kind == "h2":
        if open_sec:
            body.append("</section>")
        m = re.match(r"^([一二三四五六七八九十]+)、(.+)$", val)
        no, title = (m.group(1), m.group(2)) if m else ("", val)
        sid = f"s{len(TOC) + 1}"
        TOC.append((no, title, sid))
        body.append(f'<section class="sec" id="{sid}"><h2>')
        if no:
            body.append(f'<span class="no">{no}</span>')
        body.append(f"{inline(title)}</h2>")
        open_sec = True
        continue

    if kind == "p":
        if val == "**摘要**":
            in_abs = True
            body.append('<section class="abstract" id="abstract"><div class="label">摘要</div>')
            continue
        if val.startswith("**關鍵字**"):
            body.append(f'<p class="keywords">{inline(val)}</p></section>')
            in_abs = False
            continue
        if in_abs:
            body.append(f'<p class="abs">{inline(val)}</p>')
        else:
            body.append(para(val))
        continue

    if kind == "img":
        alt, name = val
        uri, w, h = fig_data(name)
        body.append(
            f'<figure><img src="{uri}" width="{w}" height="{h}" '
            f'alt="{html.escape(alt)}" decoding="async">'
            f"<figcaption>{inline(alt)}</figcaption></figure>"
        )
        continue

    if kind == "table":
        body.append(render_table(val))
        continue

if open_sec:
    body.append("</section>")

toc_html = [
    '<nav class="toc" aria-label="目錄"><div class="toc-title">目錄</div><ol>'
]
for no, title, sid in TOC:
    toc_html.append(f'<li><a href="#{sid}"><span>{no}</span>{inline(title)}</a></li>')
toc_html.append("</ol></nav>")
toc_html = "".join(toc_html)

article = "".join(body)
# 目錄放在摘要之後；沒有摘要就放在頁首之後
if "</section>" in article:
    pos = article.find("</section>") + len("</section>")
    article = article[:pos] + toc_html + article[pos:]
else:
    pos = article.find("</header>") + len("</header>")
    article = article[:pos] + toc_html + article[pos:]

# ---------------------------------------------------------------- 無損簡體表
match = re.search(r'export const SAFE_PAIRS = "([^"]*)"', SIM_DATA.read_text(encoding="utf-8"))
if not match:
    raise SystemExit("讀不到 SAFE_PAIRS")
pairs = match.group(1)
safe = {pairs[i]: pairs[i + 1] for i in range(0, len(pairs) - 1, 2)}
# 只帶頁面上真的會用到的字，控制體積
used = set(re.findall(r"[\u4e00-\u9fff]", article + "楞嚴詞典專宗方法論目錄摘要關鍵字註簡繁回頂部"))
sim_map = {ch: safe[ch] for ch in used if ch in safe and safe[ch] != ch}
sim_json = json.dumps(sim_map, ensure_ascii=False, separators=(",", ":"))

CSS = r"""
:root{
  --paper:#fbf8f1; --paper2:#f5efe3; --card:#fffdf8;
  --ink:#241f19; --muted:#82796d; --faint:#a2988a;
  --line:#e3dacb; --accent:#8a5a2f; --accent-deep:#6f4522;
  --serif:"Noto Serif TC","Source Han Serif TC","Songti TC","PMingLiU",serif;
  --sans:"PingFang TC","Microsoft JhengHei","Noto Sans TC",sans-serif;
}
html.dark{
  --paper:#17140f; --paper2:#221d16; --card:#1d1914;
  --ink:#eae1d2; --muted:#a99c88; --faint:#8b7f6d;
  --line:#3a3228; --accent:#d59d61; --accent-deep:#e0b380;
  color-scheme:dark;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--serif);
  font-size:18.5px;line-height:1.95;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline;text-underline-offset:3px}
::selection{background:var(--accent);color:var(--paper)}

.top{position:sticky;top:0;z-index:30;background:var(--paper);border-bottom:1px solid var(--line)}
.top-inner{max-width:900px;margin:0 auto;padding:10px 20px;display:flex;align-items:center;gap:16px}
.back{font-family:var(--sans);font-size:.82rem;color:var(--muted);white-space:nowrap;padding:11px 0}
.back:hover{color:var(--accent);text-decoration:none}
.brand{display:flex;align-items:baseline;gap:10px;min-width:0;flex:1}
.brand-name{font-size:1.02rem;font-weight:700;letter-spacing:.16em;white-space:nowrap}
.brand-sub{font-family:var(--sans);font-size:.7rem;color:var(--muted);letter-spacing:.12em;white-space:nowrap}
.acts{display:flex;gap:8px;align-items:center}
.iconbtn{width:44px;height:44px;border:1px solid var(--line);background:var(--card);
  color:var(--muted);border-radius:50%;cursor:pointer;font-family:var(--sans);
  font-size:.9rem;line-height:1;display:inline-flex;align-items:center;justify-content:center}
.iconbtn:hover{color:var(--ink);border-color:var(--accent)}

.art{max-width:760px;margin:0 auto;padding:54px 22px 72px}
.art-head{padding-bottom:30px;border-bottom:2px solid var(--ink)}
.kicker{font-family:var(--sans);font-size:.76rem;letter-spacing:.26em;color:var(--accent);font-weight:700}
h1{font-size:clamp(2.2rem,6vw,3.15rem);line-height:1.2;letter-spacing:.07em;margin:.45em 0 .2em}
.sub{font-size:clamp(1.08rem,2.6vw,1.32rem);line-height:1.65;color:var(--ink);margin:.2em 0 0;font-weight:600}
.meta{font-family:var(--sans);font-size:.8rem;color:var(--faint);letter-spacing:.08em;margin:.9em 0 0}

.abstract{background:var(--paper2);border-left:4px solid var(--accent);padding:22px 24px 18px;margin:34px 0 0}
.abstract .label{font-family:var(--sans);font-size:.72rem;letter-spacing:.3em;color:var(--accent);font-weight:700}
.abstract p{margin:.7em 0 0;text-align:justify;text-justify:inter-ideograph}
.abstract p.abs{font-size:.96rem;line-height:2.02}
.abstract .keywords{font-family:var(--sans);font-size:.8rem;color:var(--muted);line-height:1.8;
  border-top:1px dashed var(--line);margin-top:18px;padding-top:14px}
.abstract .keywords strong{color:var(--accent);letter-spacing:.1em}

.toc{margin:30px 0 0;padding:18px 0 0;border-top:1px solid var(--line)}
.toc-title{font-family:var(--sans);font-size:.72rem;letter-spacing:.3em;color:var(--faint);margin-bottom:10px}
.toc ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:2px 22px}
.toc a{display:block;font-size:.88rem;line-height:1.9;color:var(--ink);padding:2px 0}
.toc a:hover{color:var(--accent);text-decoration:none}
.toc a span{color:var(--accent);font-family:var(--sans);font-size:.76rem;margin-right:8px}

.sec{margin-top:3.4em;scroll-margin-top:76px}
.sec h2{display:flex;align-items:baseline;gap:12px;border-top:2px solid var(--ink);
  padding-top:15px;margin:0 0 1.05em;font-size:1.34rem;line-height:1.5;letter-spacing:.04em}
.sec h2 .no{font-family:var(--sans);font-size:.8rem;color:var(--accent);letter-spacing:.1em;flex:none}
.sec p{margin:0 0 1.12em;text-align:justify;text-justify:inter-ideograph}
.sec p.item .idx{color:var(--accent);font-weight:700;margin-right:-.12em}
.sec strong{font-weight:700;color:var(--ink)}
.sec code{font-family:"Cascadia Mono",Consolas,monospace;font-size:.86em;
  background:var(--paper2);border:1px solid var(--line);border-radius:4px;padding:1px 6px;color:var(--accent-deep)}

figure{margin:1.9em 0 2.1em}
figure img{display:block;width:100%;height:auto;background:#fff;border:1px solid var(--line)}
figcaption{font-family:var(--sans);font-size:.78rem;line-height:1.7;color:var(--muted);
  text-align:center;margin-top:10px;letter-spacing:.03em}

.table-wrap{margin:1.6em 0 1.9em;overflow-x:auto;border:1px solid var(--line);
  -webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;min-width:520px;font-family:var(--sans);font-size:16px;line-height:1.65}
th,td{border-bottom:1px solid var(--line);padding:11px 14px;text-align:left;vertical-align:top}
th{background:var(--paper2);font-weight:700;color:var(--ink)}
td:first-child{font-weight:700;width:24%}
tbody tr:last-child td{border-bottom:0}

.endnote{margin:3.2em 0 0;padding:20px 0 0;border-top:1px solid var(--line);
  font-family:var(--sans);font-size:.82rem;line-height:1.95;color:var(--muted);text-align:justify}
.endnote::before{content:"註";display:block;font-family:var(--sans);font-size:.7rem;
  letter-spacing:.3em;color:var(--accent);font-weight:700;margin-bottom:8px}

footer{border-top:1px solid var(--line);margin-top:20px;padding:26px 20px 44px;
  font-family:var(--sans);font-size:.8rem;color:var(--muted);line-height:2}
.foot-inner{max-width:760px;margin:0 auto}
footer b{color:var(--ink);font-weight:700;letter-spacing:.08em}
footer .faint{color:var(--faint);font-size:.76rem}

.totop{position:fixed;right:18px;bottom:18px;z-index:40;width:44px;height:44px;border-radius:50%;opacity:0;pointer-events:none;transition:opacity .2s ease;
  display:flex;align-items:center;justify-content:center;background:var(--card);
  border:1px solid var(--line);color:var(--muted);font-family:var(--sans);font-size:1rem;
  box-shadow:0 6px 18px rgba(60,45,25,.14)}
.totop.show{opacity:1;pointer-events:auto}
.totop:hover{color:var(--accent);text-decoration:none}

@media (max-width:640px){
  body{font-size:17.5px}
  .top-inner{padding:8px 14px;gap:10px}
  .brand-sub{display:none}
  .art{padding:34px 18px 58px}
  .abstract{padding:18px 18px 16px;margin-top:26px}
  .toc ol{grid-template-columns:1fr;gap:0}
  .sec h2{font-size:1.22rem}
  .table-wrap{margin-left:0;margin-right:0;border:0;overflow:visible}
  table{min-width:0;width:100%;font-size:16px;line-height:1.6}
  thead{display:none}
  tbody,tr,td{display:block;width:100%}
  tr{border:1px solid var(--line);background:var(--card);margin-bottom:12px;padding:10px 12px}
  td{border:0;padding:3px 0;width:auto}
  td:first-child{font-size:1.04rem;color:var(--ink);border-bottom:1px dashed var(--line);
    margin-bottom:6px;padding-bottom:6px}
  td:not(:first-child)::before{content:attr(data-label) "：";display:block;
    font-family:var(--sans);font-size:.74rem;color:var(--muted);margin-bottom:1px}
  .totop{right:14px;bottom:14px}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
"""


def esc(s):
    return html.escape(s, quote=True)


description = (
    "專宗詞典以一部經、一宗之學為範圍，價值在「界」而不在「義」。"
    "本文比較紙書與機器輔助編制在成本、可回答性、異說處理與修訂上的差異；"
    "實例是楞嚴 3,732 句、11 家注疏、113 條種子詞條。"
)

topbar = (
    '<header class="top"><div class="top-inner">'
    '<a class="back" href="./">← 孵化區</a>'
    '<div class="brand"><span class="brand-name">楞嚴詞典</span>'
    '<span class="brand-sub">楞嚴經選注</span></div>'
    '<div class="acts">'
    '<button class="iconbtn" id="simBtn" type="button" aria-label="切換簡體" title="顯示簡體">简</button>'
    '<button class="iconbtn" id="theme" type="button" aria-label="切換明暗" title="切換明暗">☾</button>'
    "</div></div></header>"
)

footer = (
    '<footer><div class="foot-inner">'
    "<p><b>楞嚴經選注</b> · 專宗詞典方法論</p>"
    '<p><a href="/incubator/surangama.html">回楞嚴經選注</a>　·　'
    '<a href="./">孵化區</a>　·　<a href="/incubator/projects.json">projects.json</a></p>'
    '<p class="faint">本文的數字取自楞嚴對讀站、金剛經合注與跨專案規範區的估算口徑；'
    "估算不是報價，換題目要重算。2026 年 11 月。</p>"
    "</div></footer>"
)

JS = r"""
(function(){
  var MAP = __SIM_JSON__;
  var PUNCT = {'「':'“','」':'”','『':'‘','』':'’'};
  var simBtn = document.getElementById('simBtn');
  var themeBtn = document.getElementById('theme');

  function qs(k){ try { return new URLSearchParams(location.search).get(k); } catch(e){ return null; } }

  /* ---- 明暗 ---- */
  function prefTheme(){
    var q = qs('theme');
    if (q === 'dark' || q === 'light') return q;
    var s = null; try { s = localStorage.getItem('cidian-theme'); } catch(e){}
    if (s === 'dark' || s === 'light') return s;
    return (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  function applyTheme(t){
    var dark = t === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    if (themeBtn){ themeBtn.textContent = dark ? '☀' : '☾'; themeBtn.title = dark ? '切換亮色' : '切換暗色'; }
  }
  applyTheme(prefTheme());

  /* ---- 繁簡（無損：只換一對一字形與引號） ---- */
  var nodes = [], orig = new Map(), sim = false;
  function collect(){
    var root = document.body;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n){
        var p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest('script,style,#simBtn,#theme,.no-sim,code')) return NodeFilter.FILTER_REJECT;
        if (!n.nodeValue || !/\S/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()){
      var n = walker.currentNode;
      if (!orig.has(n)) orig.set(n, n.nodeValue);
      nodes.push(n);
    }
  }
  function conv(s){
    var out = '';
    for (var ch of s) out += (MAP[ch] || PUNCT[ch] || ch);
    return out;
  }
  function applySim(on){
    for (var i = 0; i < nodes.length; i++){
      var n = nodes[i], src = orig.get(n);
      n.nodeValue = on ? conv(src) : src;
    }
    document.documentElement.lang = on ? 'zh-Hans' : 'zh-Hant';
    if (simBtn){
      simBtn.textContent = on ? '繁' : '简';
      simBtn.title = on ? '回繁體原文' : '顯示無損簡體';
      simBtn.setAttribute('aria-label', on ? '回繁體原文' : '顯示簡體');
      simBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    sim = on;
  }
  function prefSim(){
    var q = qs('lang');
    if (q === 'zh-Hans' || q === 'hans' || q === 'sim') return true;
    if (q === 'zh-Hant' || q === 'hant' || q === 'trad') return false;
    var s = null; try { s = localStorage.getItem('cidian-sim'); } catch(e){}
    if (s === '1') return true;
    if (s === '0') return false;
    return /(^|\.)shutonggui\.cn$/i.test(location.hostname);
  }
  collect();
  applySim(prefSim());

  if (simBtn) simBtn.addEventListener('click', function(){
    applySim(!sim);
    try { localStorage.setItem('cidian-sim', sim ? '1' : '0'); } catch(e){}
  });
  if (themeBtn) themeBtn.addEventListener('click', function(){
    var dark = !document.documentElement.classList.contains('dark');
    applyTheme(dark ? 'dark' : 'light');
    try { localStorage.setItem('cidian-theme', dark ? 'dark' : 'light'); } catch(e){}
  });

  var topBtn = document.querySelector('.totop');
  function onScroll(){
    if (topBtn) topBtn.classList.toggle('show', window.scrollY > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}());
""".replace("__SIM_JSON__", sim_json)

# 先套一次明暗，避免重繪閃爍
HEAD_SCRIPT = (
    "<script>(function(){try{var q=new URLSearchParams(location.search).get('theme');"
    "var s=null;try{s=localStorage.getItem('cidian-theme');}catch(e){}"
    "var d=q==='dark'||(q!=='light'&&(s?s==='dark':(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)));"
    "if(d)document.documentElement.classList.add('dark');}catch(e){}})();</script>"
)

doc = (
    '<!doctype html>\n<html lang="zh-Hant">\n<head>\n'
    '<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
    "<title>楞嚴詞典：紙書與語料 · 楞嚴經選注</title>\n"
    f'<meta name="description" content="{esc(description)}">\n'
    '<meta name="theme-color" content="#fbf8f1" media="(prefers-color-scheme: light)">\n'
    '<meta name="theme-color" content="#17140f" media="(prefers-color-scheme: dark)">\n'
    '<meta property="og:type" content="article">\n'
    '<meta property="og:site_name" content="書同軌">\n'
    '<meta property="og:title" content="楞嚴詞典：紙書與語料">\n'
    f'<meta property="og:description" content="{esc(description)}">\n'
    '<meta property="og:url" content="https://shutonggui.cn/incubator/surangama-cidian.html">\n'
    '<link rel="canonical" href="https://shutonggui.cn/incubator/surangama-cidian.html">\n'
    + HEAD_SCRIPT + "\n<style>" + CSS + "</style>\n</head>\n<body id=\"top\">\n"
    + topbar
    + '<main class="art" id="doc">' + article + "</main>\n"
    + footer
    + '<a class="totop" href="#top" aria-label="回頂部">↑</a>\n'
    + "<script>" + JS + "</script>\n</body>\n</html>\n"
)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(doc, encoding="utf-8")
print("wrote", OUT, len(doc), "chars")
print("sim map", len(sim_map), "chars")

