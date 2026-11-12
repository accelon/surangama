// 把 surangama 的 site/data.js（window.SURANGAMA）轉成閱讀器的 zhu-data.js（window.ZHU）。
//
//   node build/to-reader.mjs            # → site/reader/zhu-data.js
//
// 對應：
//   sutra.sentences → versions[0]（t/u/s/p）
//   zhu + align      → works（anchors = [u, start, end, page]）
//   ke               → ke（科判全文，右欄「科判」分頁用）
//   english.juan     → versions[1].byJuan（英譯按卷）
//   glossary         → glossary（原樣，不改欄位）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const OUT_DIR = path.join(ROOT, 'site', 'reader');

const src = fs.readFileSync(path.join(ROOT, 'site', 'data.js'), 'utf8');
const S = JSON.parse(src.replace(/^window\.SURANGAMA=/, '').replace(/;\s*$/, ''));

const glossaryFile = path.join(ROOT, 'data', 'glossary.json');
const GLOSSARY = fs.existsSync(glossaryFile) ? JSON.parse(fs.readFileSync(glossaryFile, 'utf8')) : S.glossary;

const JUAN_TITLE = ['卷首', '卷一', '卷二', '卷三', '卷四', '卷五', '卷六', '卷七', '卷八', '卷九', '卷十'];

// 分節：優先使用 data/sections-final.json（卷1 讀窗 + 其餘分節），再退回 ke-anchors，最後才十卷
let sections = JUAN_TITLE.map((t, i) => ({ n: i + 1, title: t }));
let secOf = (x) => (x.juan || 0) + 1;
const sfPath = path.join(ROOT, 'data', 'sections-final.json');
const kaPath = path.join(ROOT, 'data', 'ke-anchors.json');
if (fs.existsSync(sfPath)) {
  const sf = JSON.parse(fs.readFileSync(sfPath, 'utf8'));
  if (sf.sections && sf.sections.length) {
    sections = sf.sections.map((x) => ({ n: x.n, title: x.title, u0: x.u0, u1: x.u1 }));
    const at = (u) => {
      for (const s of sf.sections) if (u >= s.u0 && u <= s.u1) return s.n;
      return 1;
    };
    secOf = (x) => at(x.i);
  }
} else if (fs.existsSync(kaPath)) {
  const ka = JSON.parse(fs.readFileSync(kaPath, 'utf8'));
  if (ka.sections && ka.sections.length) {
    sections = ka.sections.map((x, i) => ({
      n: i + 1,
      title: (x.code ? x.code + ' ' : '') + (x.title || x.startPhrase || ''),
      juan: x.juan,
      u0: x.startU,
      u1: x.endU,
    }));
    const at = (u) => {
      for (let k = 0; k < ka.sections.length; k++) {
        if (u >= ka.sections[k].startU && u <= ka.sections[k].endU) return k + 1;
      }
      return 1;
    };
    secOf = (x) => at(x.i);
  }
}

const sents = S.sutra.sentences.map((x) => ({
  t: x.text, u: x.i, s: secOf(x), p: x.page || '',
}));

// 注疏：依朝代排序（宋・明・民國）
const ORDER = ['T1799', 'X270', 'X275', 'X279', 'X285', 'X318', 'LIB'];
const YEAR = { T1799: 1040, X270: 1110, X275: 1580, X279: 1620, X285: 1640, X318: 1610, LIB: 1930 };

const works = ORDER.filter((id) => S.zhu[id]).map((id) => {
  const w = S.zhu[id];
  const al = S.align[id] || {};
  const anchors = [];
  for (const k of Object.keys(al)) {
    const u = +k;
    for (const [a, b, p] of al[k]) anchors.push([u, a, b, p || '']);
  }
  anchors.sort((x, y) => x[1] - y[1]);
  return {
    id, title: w.title || id, author: w.author || '', date: '', year: YEAR[id] || 0,
    corpus: id.startsWith('X') ? '卍續藏' : id === 'LIB' ? '圓瑛法師' : '大正藏',
    no: id, vol: '', kind: '注疏', base: 'T945',
    text: w.text || '', pages: [], anchors,
  };
});

const KE_SHORT = { X265: '子璿', X273: '交光', X278: '憨山', X290: '直指', X304: '靈耀', X314: '溥畹' };
/* 右欄「科判」分頁：2026-11-12 作者決定取消（「buggy 用處不大」）。
   閱讀器本來就是「資料有才長這個分頁」（app.js buildTabs 看 D.ke、#keBtn 同），
   所以在這裡不出資料就關乾淨，不必動共用程式，也不影響別的工作區。
   要恢復：把下面改成 true 重建即可——資料（site/data.js 的 S.ke、data/ke-*.json）都還在。
   科判的功能並沒消失：上方科文條（麵包屑、經文科文標記、科判目錄浮層）走 KEPAN，
   家數更多（10 家）、也能點著跳正文。 */
const WITH_KE_PANEL = false;
const ke = WITH_KE_PANEL
  ? Object.keys(S.ke).map((id) => ({
    id, title: S.ke[id].title || id, label: KE_SHORT[id] || S.ke[id].title || id,
    author: S.ke[id].author || '', text: S.ke[id].text || '',
  }))
  : [];

const versions = [
  { id: 'T945', label: '經文', trans: '唐 般剌蜜帝譯', lang: 'zh', group: 'guyi', sents },
];
let enSents = [];
const esPath = path.join(ROOT, 'data', 'english-sents.json');
if (fs.existsSync(esPath)) {
  const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));
  for (const j of Object.keys(es.byJuan || {})) {
    for (const u of Object.keys(es.byJuan[j])) {
      enSents.push({ t: es.byJuan[j][u], u: +u, s: +j + 1, p: '' });
    }
  }
  enSents.sort((a, b) => a.u - b.u);
}
let enSections = null;
const esPath2 = path.join(ROOT, 'data', 'english-sections.json');
if (fs.existsSync(esPath2)) {
  try { enSections = JSON.parse(fs.readFileSync(esPath2, 'utf8')).bySection; } catch { /* 沒有就算了 */ }
}
if (S.english && (enSections || enSents.length || S.english.juan)) {
  versions.push({
    id: 'LUK', label: S.english.label || '英譯', trans: 'Charles Luk', lang: 'en', group: 'alt',
    sents: enSections ? [] : enSents,
    bySection: enSections || undefined,
    byJuan: enSections ? undefined : (enSents.length ? undefined : S.english.juan),
  });
}

let keTree = null;
let keNodes = null;
let keNodesAll = null;
if (WITH_KE_PANEL) {
  const knaPath = path.join(ROOT, 'data', 'ke-nodes-all.json');
  if (fs.existsSync(knaPath)) { try { keNodesAll = JSON.parse(fs.readFileSync(knaPath, 'utf8')).byKe; } catch {} }
  const knPath = path.join(ROOT, 'data', 'ke-nodes.json');
  if (fs.existsSync(knPath)) { try { const kn = JSON.parse(fs.readFileSync(knPath, 'utf8')); keNodes = kn.nodes; } catch {} }
  const ktPath = path.join(ROOT, 'data', 'ke-tree.json');
  if (fs.existsSync(ktPath)) { try { keTree = JSON.parse(fs.readFileSync(ktPath, 'utf8')).tree; } catch {} }
}

const english = null;

const data = {
  generated: new Date().toISOString(),
  meta: {
    title: '楞嚴經選注',
    sub: '7家注疏 · 3部科判 ·英譯 · 速查辭典',
    workNames: Object.fromEntries(ORDER.filter((id) => S.zhu[id]).map((id) => [id, (S.zhu[id].author || id).replace(/^[^\s]+\s*/, '') || id])),
    foot: {
      initiator: '發起人：釋廣鵬',
      free: '免費軟件',
      sponsor: { text: '杭州繪欣堂科技有限公司', url: 'https://shutonggui.cn/huixintang/', after: '製作' },
      contact: '聯絡人：魏秀秀（湛覺）',
      wechat: { id: 'wxx68174671', note: '楞嚴選注' },
    },
  },
  sections,
  versions,
  works,
  ke,
  keTree,
  keNodes,
  english,
  pdf: [],
  glossary: GLOSSARY,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const js = 'window.ZHU=' + JSON.stringify(data) + ';\n';
fs.writeFileSync(path.join(OUT_DIR, 'zhu-data.js'), js, 'utf8');
console.log('寫出', path.join(OUT_DIR, 'zhu-data.js'), (js.length / 1024 / 1024).toFixed(2), 'MiB');
console.log('句', sents.length, '注疏', works.length,
  '科判分頁', WITH_KE_PANEL ? ke.length + ' 家' : '已取消（走科文條）', '辭典', GLOSSARY.entries.length);
