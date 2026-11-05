#!/usr/bin/env bun
/**
 * 小詞典新增「注疏題解」一批：重要注疏的作者、特點、本軟件收錄狀態。
 *
 *   bun run scripts/add-glossary-works.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const file = join(DATA, 'glossary.json');
const g = JSON.parse(readFileSync(file, 'utf8')) as {
  categories: { id: string; label: string; count: number }[];
  entries: any[];
};

const CAT = '注疏題解';
interface W {
  id: string;
  term: string;
  aliases: string[];
  en: string;
  gloss: string;
  workLinks: string[];
}
const items: W[] = [
  {
    id: 'zs-yishu', term: '首楞嚴義疏注經', aliases: ['長水疏', '子璿義疏'], en: 'Zisui’s Commentary',
    gloss: '宋 長水子璿述，十卷。以賢首宗義疏解全經，是現存最早的完整《楞嚴》注之一，後代科判多沿其結構。\n【本軟件】已收全文（T1799），並收其科判（長水疏科判 PDF，1,125 節）。',
    workLinks: ['T1799'],
  },
  {
    id: 'zs-zhengmai', term: '楞嚴經正脉疏', aliases: ['正脉疏', '交光疏'], en: 'Zhengmai Commentary',
    gloss: '明 交光真鑑述，十卷。主張「捨識用根」，力破以天台三觀解《楞嚴》的舊說，明清影響最大。\n【本軟件】已收全文（X275）；科判有念覺網甲乙表（3,728 節、22 層），但節點位置尚未能逐條錨定經文，暫不列入科判下拉。',
    workLinks: ['X275'],
  },
  {
    id: 'zs-tongyi', term: '楞嚴經通議', aliases: ['憨山通議'], en: 'Hanshan’s Tongyi',
    gloss: '明 憨山德清述。以禪宗立場通釋全經，文字簡練，另有《提綱略科》。\n【本軟件】已收全文（X279）；科判（略科）層級無可靠來源，暫不列入下拉。',
    workLinks: ['X279'],
  },
  {
    id: 'zs-wenju', term: '楞嚴經文句', aliases: ['蕅益文句'], en: 'Ouyi’s Wenju',
    gloss: '明 蕅益智旭撰，十卷。以天台教觀判經，句解簡要，常與《正脉疏》對讀。\n【本軟件】已收全文（X285）；科判用 kepanhuizong 文句科判 PDF（689 節、19 層），有表號可錨定。',
    workLinks: ['X285'],
  },
  {
    id: 'zs-mengchao', term: '楞嚴經疏解蒙鈔', aliases: ['蒙鈔'], en: 'Mengchao',
    gloss: '清 錢謙益纂。輯錄宋元明諸家疏解並加按語，資料最富；本軟件的分節與疏文引文錨點即取自此書。\n【本軟件】已收全文（X287），並以其疏前引文作全書 750 個錨點。',
    workLinks: ['X287'],
  },
  {
    id: 'zs-yaojie', term: '楞嚴經要解', aliases: ['戒環要解'], en: 'Jiehuan’s Yaojie',
    gloss: '宋 溫陵戒環解。宋代重要的《楞嚴》注，簡明扼要，常被後世引用。\n【本軟件】已收全文（X270）；科判未收（kepanhuizong 有 PDF，尚未整理）。',
    workLinks: ['X270'],
  },
  {
    id: 'zs-guanxin', term: '楞嚴經觀心定解', aliases: ['靈耀定解'], en: 'Lingyao’s Dingjie',
    gloss: '清 靈耀述。以觀心為主軸解經，科判細密。\n【本軟件】已收全文（X306）；科判層級無可靠來源，暫不列入下拉。',
    workLinks: ['X306'],
  },
  {
    id: 'zs-baojing', term: '楞嚴經寶鏡疏', aliases: ['溥畹寶鏡疏'], en: 'Puyuan’s Baojing',
    gloss: '清 溥畹撰。清代《楞嚴》注疏之一，附科文。\n【本軟件】已收全文（X316）；科判層級無可靠來源，暫不列入下拉。',
    workLinks: ['X316'],
  },
  {
    id: 'zs-zhizhang', term: '楞嚴經指掌疏', aliases: ['通理指掌疏'], en: 'Tongli’s Zhizhang',
    gloss: '清 通理述。清代流通較廣的《楞嚴》注。\n【本軟件】已收全文（X308）。',
    workLinks: ['X308'],
  },
  {
    id: 'zs-zongtong', term: '楞嚴經宗通', aliases: ['曾鳳儀宗通'], en: 'Zongtong',
    gloss: '明 曾鳳儀撰。以宗門語彙通釋經文。\n【本軟件】已收全文（X318）。',
    workLinks: ['X318'],
  },
  {
    id: 'zs-jiangyi', term: '大佛頂首楞嚴經講義', aliases: ['圓瑛講義'], en: 'Yuanying’s Lecture',
    gloss: '民國 圓瑛講述。近代最通行的《楞嚴》講義之一，科判分明（甲乙丙…二十層）。\n【本軟件】已收全文（LIB）；科判收詳細／精簡／極簡三版（1,708／322／89 節）。',
    workLinks: ['LIB'],
  },
  {
    id: 'zs-qianshi', term: '大佛頂首楞嚴經淺釋', aliases: ['宣化淺釋'], en: 'Hsuan Hua’s Commentary',
    gloss: '宣化上人 1968 年講於舊金山佛教講堂。口語活潑，另有簡要科判（A–H 八層，2,574 節）。\n【本軟件】未收正文（版權未授權）；只收其簡要科判。',
    workLinks: [],
  },
  {
    id: 'zs-yuantong', term: '楞嚴經圓通疏', aliases: ['惟則圓通疏'], en: 'Yuantong Commentary',
    gloss: '元 天如惟則撰。元代重要注本，後為《蒙鈔》大量引用。\n【本軟件】未收（與《蒙鈔》所引高度重複，篇幅亦大；目前以《蒙鈔》代替）。',
    workLinks: [],
  },
  {
    id: 'zs-hezhe', term: '楞嚴經合轍', aliases: ['通潤合轍'], en: 'Hezhe',
    gloss: '明 通潤撰。會通諸家之說。\n【本軟件】未收（未取得可用電子文本）。',
    workLinks: [],
  },
  {
    id: 'zs-zhizhi', term: '楞嚴經直指', aliases: ['函昰直指'], en: 'Zhizhi',
    gloss: '明末清初 天然函昰撰。以宗門直指之風解經。\n【本軟件】未收正文（未取得全文）；只收其科判目錄（識典古籍 676 節）。',
    workLinks: [],
  },
];

const existing = new Set(g.entries.map((e) => e.id));
let added = 0;
for (const it of items) {
  if (existing.has(it.id)) continue;
  g.entries.push({
    id: it.id, term: it.term, aliases: it.aliases, category: CAT,
    en: it.en, gloss: it.gloss, related: [], workLinks: it.workLinks, count: 0, occurrences: [],
  });
  added++;
}

const cat = g.categories.find((c) => c.id === CAT);
if (cat) cat.count = g.entries.filter((e) => e.category === CAT).length;
else g.categories.push({ id: CAT, label: CAT, count: g.entries.filter((e) => e.category === CAT).length });

writeFileSync(file, JSON.stringify(g, null, 1) + '\n');
console.log(`新增 ${added} 條，注疏題解共 ${g.entries.filter((e) => e.category === CAT).length} 條，全書 ${g.entries.length} 條`);
