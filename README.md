# surangama · 楞嚴經選注

《大佛頂如來密因修證了義諸菩薩萬行首楞嚴經》（T945）的對讀站：主文 ＋ 注疏 ＋（視需要）別譯／梵藏。

形態照 [`D:\2026\vcpp`](https://github.com/accelon/vcpp)（金剛經合注）：純靜態，`index.html` 開發版可直接開，
另有單檔部署版（CSS／JS／資料全部內嵌）。

- 線上：`https://shutonggui.cn/incubator/surangama.html`（2026-11-04 首發；鏡像 `https://nissaya.cn/incubator/surangama.html`）
- 發起人：釋廣鵬（頁尾與孵化頁標注；聯絡人：魏秀秀）
- 原始碼：<https://github.com/accelon/surangama>

## 書同軌（2026-11-05）

把「以注疏找切點 → 建層級 → 發穩定軌號 → 平行對齊」的流程做成 draft。`data/sutra.json` 全程未動（3,732 句）。

| 產物 | 內容 |
|---|---|
| `data/sentences.tsv` | 4,890 句（draft `sid`） |
| `data/tracks-zh.tsv` | 4,890 個漢文穩定軌號（`S0000.1` 型） |
| `data/cuts.tsv` | 2,418 刀證據表（支持度、實錨、塌縮、層級） |
| `data/xref-kepan.tsv`／`xref-section.tsv`／`xref-commentary.tsv`／`xref-quote.tsv` | 11,007 科判節點、27 分節、37,565 注疏句 → track range |
| `data/hierarchy*.json` | 卷→27 分節→段；all／exact／shared2／coarse／all-ed／coarse-ed；推薦 `hierarchy-coarse-ed`（675 段） |
| `data/tracks-sa.tsv`／`align.tsv` | 不空本 143 梵句；T945↔KU-PDF pilot 20 列 |
| `data/quote-hits.tsv` | ADBengine 掃 taisho／wxzj 的引用（291 軌、5,020 hits） |
| `data/track-refinements.tsv` | 引用邊界產生的 split（18）／join（61）建議 |
| `data/tracks-refined.tsv` | refined 預覽（4,909 軌） |
| `data/mantra-words.tsv`／`mantra-lemmas.tsv` | 454 梵詞形、446 lemma（簡單去屈折） |
| `data/mantra-word-align.tsv` | 42 列詞級梵漢對齊（M1 exact） |
| `data/mantra-tab.json` | 五會 143 unit／770 詞的閱讀器資料（M1 exact、M2–M5 approx） |
| `build/rev/2026-11-05-t/` | 最新 draft 快照＋`rev.json` |

- 咒語 prototype：<https://shutonggui.cn/incubator/surangama-mantra.html>（孵化區「釋家」，掛在「楞嚴經選注」卡片下；鏡像 <https://nissaya.cn/incubator/surangama-mantra.html>）
- 入口文件：[`docs/shutonggui.md`](docs/shutonggui.md)、[`docs/xref.md`](docs/xref.md)、[`docs/quote-scan.md`](docs/quote-scan.md)、[`docs/track-refinements.md`](docs/track-refinements.md)、[`docs/mantra-word-alignment.md`](docs/mantra-word-alignment.md)、[`docs/mantra-tab.md`](docs/mantra-tab.md)、[`docs/progress-2026-11-05.md`](docs/progress-2026-11-05.md)、[`docs/rut-id-skill.md`](docs/rut-id-skill.md)。
- 驗證：`bun run scripts/check-track-system.ts`、`bun run scripts/check-refinements.ts`。

## 現況（2026-11-04）

- **注釋群盤點完成**（只盤點，未動工）：見 [`docs\commentary-inventory.md`](docs/commentary-inventory.md)。
  一句話：大正藏只有 1 部注疏（T1799 子璿），卍續藏有 55 部（X265–X318 ＋ 2 部懺儀），
  其中全經注疏 28 部（含近代圓瑛《楞嚴講義》，已列入第一層）；另太虛 3 種、呂澂《楞嚴百偽》等。
- **6 字窗補掃**：見 [`docs\coverage-6gram.md`](docs/coverage-6gram.md)。
  6 字窗讓細碎夾註型多 3–5 個百分點錨點、排序不變；
  `Library.adb`（近代大師全集）另有圓瑛《大佛頂首楞嚴經講義》48.6 萬字（cov6 89.4%），
  CBETA 沒有這部。三個電子本（adb／詩詞匯明暘校對本／archive.org 掃描 1,578 頁）比對過：
  全書只差 445 字（0.09%），差別在「科文標記」不在文字；掃描本 OCR 有連續頁碼，
  已做行級頁對映（卷X p.Y）。
- **英文譯本**：Luk（完整 115 頁）、BTTS 宣化上人 8 卷本（合訂 2,352 頁，完整）、P. B. Tan；評估見 [docs\english-sources.md](docs/english-sources.md)。
- **範圍定案**（2026-11-04）：注疏 6 家＋圓瑛、科判 6 部、英譯 Luk；BTTS 不收；辭典為賣點。
  UI 提示詞見 [`docs\ui-prompt.md`](docs/ui-prompt.md)。
- **速查辭典 JSON 已出**（2026-11-04）：`data\glossary.json` 72 條（人物／名詞／論點／呂澂批評／譯者版本），
  附主文出處與注疏命中數。
- **資料骨架已出**（2026-11-04）：主文 3,732 句、第一層 11 家注疏、6 字窗 LIS 對齊
  （10 家覆蓋 96–98% 的句子）；`data/sutra.json`、`data/works/`、`data/align/`。
  詳見 [`docs\build-notes.md`](docs/build-notes.md)。
- **前端還沒進來**：工作區、`AGENTS.md`、版控與 remote 已就緒。
- 待作者定案的事見 [`AGENTS.md`](AGENTS.md) 第 8 節，選項整理在盤點文件 §7.1。

### 盤點怎麼重跑

```powershell
bun run scripts/x-catalog.ts        # 卍續藏 1,236 部書目
bun run scripts/coverage-scan.ts    # T945 8 字窗掃全藏（約 60 秒）
$env:SURANGAMA_N=6; bun run scripts/coverage-scan.ts   # 6 字窗（約 70 秒）
bun run scripts/coverage-scan-adb.ts   # Library／miuking／taixu／lc 四庫
bun run scripts/modern-counts.ts    # 太虛／呂澂篇幅
bun run scripts/build-inventory.ts  # 併表 → docs\commentary-inventory.{tsv,md}
bun run scripts/report-6gram.ts     # → docs\coverage-6gram.md
bun run scripts/fetch-yuanying.ts   # 圓瑛講義全文（詩詞匯）→ vendor\yuanying
bun run scripts/compare-yuanying.ts # adb／詩詞匯／掃描本比對 → build\yuanying-compare.json
bun run scripts/ocr-pages.ts        # OCR 依印刷頁碼切頁 → build\yuanying-pages.json
bun run scripts/page-map.ts         # 行級頁對映 → build\yuanying-page-map.tsv
bun run scripts/page-lookup.ts 一句話   # 查卷／頁
```

語料唯讀；路徑可用 `$env:SURANGAMA_CORPUS`、`$env:SURANGAMA_XML` 覆寫。

## 來源

| 類別 | 來源 |
|---|---|
| 經文 | 大正藏 T945；`D:\2026\adb-converter\build\tei-all-2026R2.txt`（CBETA XML-P5 2026R2） |
| 注疏 | 卍續藏 `wxzj-tei-2026R2.txt`，清單待圈選 |
| 圓瑛講義 | 詩詞匯全文、`Library.adb`、archive.org 掃描（見 `docs\commentary-inventory.md` §4.7） |
| 英文譯本 | Luk（打字本＋BDEA 書版）／BTTS 8 卷／P. B. Tan，見 [`docs\english-sources.md`](docs/english-sources.md) |
| 材料齊整度 | 各類素材的完成度與缺口，見 [`docs\materials-status.md`](docs\materials-status.md) |
| 新增材料 | 藏譯全文、Edkins 英譯、嘉興藏蒙鈔，見 [`docs\sources-new.md`](docs/sources-new.md) |
| 蒙鈔禁燬 | 乾隆三十八年毁撤的史料與版本對勘，見 [`docs\mengchao-censorship.md`](docs/mengchao-censorship.md) |
| 語料 | 一律**唯讀**；不寫入 `adb-converter` |

## 版控

- 進版控：前端程式、資料管線、抽出的資料（`*.json`、校訂 `*.tsv`）、文件。
- 不進版控：`vendor\`（原始 PDF／掃描）、`.local\`（憑證）、單檔產物、`screenshots\`、`__pycache__\`。

## 同類工作區

- `D:\2026\vcpp` — 金剛經合注（做法參照）
- `D:\2026\adb-converter` — 母工作區：語料、adb 工具


























