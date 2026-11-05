# 咒語頁籤：資料與 UI 契約

> 2026-11-05。閱讀器實作在 `D:\2026\zhu-combined`；本區只提供資料與驗證。
> 線上 prototype：<https://shutonggui.cn/incubator/surangama-mantra.html>（孵化區「釋家」；掛在「楞嚴經選注」卡片下）。
> 給閱讀器的完整提示詞：[`D:\2026\zhu-combined\docs\prompts\mantra-tab.md`](file:///D:/2026/zhu-combined/docs/prompts/mantra-tab.md)。

## 資料檔

| 檔案 | 內容 |
|---|---|
| `data/mantra-word-align.tsv` | 42 列詞級梵漢對齊（M1.01–M1.12） |
| `data/mantra-words.tsv` | 454 梵詞形、lemma、rule、freq |
| `data/mantra-lemmas.tsv` | 446 lemma、變體、freq |
| `data/mantra-meanings.tsv` | 常用 lemma → 中文詞義 |
| `data/mantra-hints.tsv` | 常用 lemma → 漢字音譯 |
| `data/mantra-tab.json` | 閱讀器用完整物件（draft） |
| `site/reader/mantra/mantra-data.js` | `window.MANTRA`（單檔內嵌用） |
| `scripts/build-mantra-tab.ts` | 產生 `mantra-tab.json`／`mantra-data.js` |
| `scripts/check-mantra-tab.ts` | 驗證 unit／word／char／gap |

## 目前覆蓋

- **143 個 unit**：M1 39、M2 14、M3 19、M4 54、M5 17。
- 11 個 `exact`（詞級；M1.01–M1.12，扣掉 M1.06 gap）。
- 131 個 `approx`（unit 級；中文範圍按梵詞數分配）；作者已接受，reader 顯示 `≈ 近似`。
- 1 個 `gap`（M1.06：T945 缺 `anāgāmināṃ`）。
- 770 個梵詞列；453 個 lexicon lemma。
- 422 條 `links`（S2587 全咒句，全部 `u=2587`）。
- 五會全部可讀；`word_covered`：M1 11，M2–M5 0。

## `window.MANTRA` 形狀（摘要）

```js
{
  schema: 1,
  coverage: { units:143, exact_units:11, approx_units:131, gap_units:1, assemblies:5 },
  assemblies: [{ id:'M1', no:1, title:'第一會', total:39, covered:39, word_covered:11,
                 units:[...], track_ids:[...] }, ...],
  units: [{
    id:'M1.01', assembly:'M1', seq:1,
    sa:'Namaḥ sarva ...', zh:'南無薩婆...',
    track_ids:['S2587.3'], u:[2587], alignment:'exact', gap:false,
    words:[{ i:0, sa:'Namaḥ', lemma:'nam', translit:'南無', meaning:'歸敬',
             freq:26, relation:'1:1', confidence:'A', track_id:'S2587.3',
             u:[2587], char:[32,34] }]
  }],
  lexicon:[{ lemma:'nam', translit:'南無', meaning:'歸敬', freq:26, units:['M1.01'] }],
  links:[{ track_id:'S2587.3', display_sid:'S3306', u:2587, char:[32,44], text:'...' }]
}
```

- `u` 是舊 `ZHU.versions[BASE].sents[].u`，不是新 `S3306`；143 個 unit 全部在同一個 `u=2587`。
- `char` 是舊句 offset `[start,end)`；`approx` unit 的 char 是 unit 範圍，不是逐詞。
- `alignment`：`exact`／`approx`／`gap`。
- `relation`：`1:1`／`1:n`／`n:1`／`gap`／`approx`。
- `translit` 是漢字音譯；`meaning` 是中文詞義；空字串顯示 `—`。
- `M1.06` 是 Sanskrit-only gap（T945 缺 `anāgāmināṃ`）。

## 驗收

```powershell
bun run scripts/build-mantra-tab.ts
bun run scripts/check-mantra-tab.ts
# PASS units 143, words 770, lexicon 453, links 422, fails 0
```

## 與閱讀器的分工

- 本區：產生／維護 `MANTRA`；不寫閱讀器 UI。
- zhu-combined：`buildTabs` 加「咒語」、`renderMantra`、`openMantra`、`selectUnit({hl})`、`build-kepan.mjs` 內嵌 `mantra-data.js`。
- 資料契約有衝突時，先改規格再改資料；不要在前端硬修 `char` 或 `u`。





