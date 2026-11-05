# 轍號 skill：把「編轍」變成可重用的古籍流程

> 2026-11-05。目標：把楞嚴經這一套「注疏找切點 → 建層級 → 發轍號 → 平行對齊」
> 抽成 skill，讓其他漢文古籍也能自動編轍。楞嚴 prototype 已可從零重跑；本檔記規格與可重用流程。

> 2026-11-05 作者定名：中文「轍號」，英文 **`rut id`**（`rut` = *rut unified text*）；
> 原則與命名用意見 `D:\2026\agent-norms\shutonggui.md` §2.2。
> 英文 `track` 只當動詞（to track），名詞用 `rut`，避免和音軌混用——所以 `track_id`、
> `tracks-*.tsv` 都是舊名；本檔表格照**現行實作**寫，遷移後為 `rut_id`、`ruts-*.tsv`。

## 1. 為什麼是 skill，不是一個專案

漢文古籍的共通問題不是「沒有文本」，而是：

- 同一部書有多個版本、多層注疏、多種頁/行座標；
- 沒有一組穩定的句級/段級編號；
- 每換一個版本或加一家注，所有參照就要重算。

所以只要把「**穩定轍號 + 注疏證據 + 平行對齊**」這三件事做成流程，
它就不是楞嚴專用，而是任何「正文＋注疏」的古籍都能用。這就是 skill 的價值。

## 2. 核心機制

```text
注疏／科判的錨點
      ↓（候選切點 + 證據）
最小切分點
      ↓（連續區間）
語義層級
      ↓（發轍號）
不可變的 track_id
      ↓（對齊）
平行語料／多層注疏
```

- **顯示號**（dense sid、chapter:verse）可以隨切分改，只給人看。
- **轍號**（`track_id`）一旦發出就不改、不重用；切分變了只新增轍，舊轍保留。
- **證據**（evidence）決定切點與層級，不是人工憑空指定。
- **對齊**只存 `track_id ↔ track_id`，不各存座標。

## 3. Skill 的輸入／輸出

### 輸入

| 輸入 | 說明 |
|---|---|
| `base/` | 正文；最好是已切句的 TSV/JSON，或原始文本＋切句器 |
| `commentaries/` | 一家以上的注疏／科判；需有可對回正文的引文、表號或節點 |
| `config.yaml` | 語言、切句器、切點規則、門檻、轍號格式、版本 |
| `overrides/` | 人工指定的切點、合併、修字（可選） |

### 輸出

| 檔案 | 內容 |
|---|---|
| `tracks.tsv` | `track_id`, `base_sid`, `part`, `lang`, `source`, `text` |
| `cuts.tsv` | `cut_id`, `before`, `after`, `support`, `kind`, `level`, `evidence` |
| `hierarchy.json` | 連續範圍的樹；每個節點有 `level`、`label`、`evidence` |
| `align.tsv` | `track_a`, `track_b`, `relation`（1:1/1:n/n:1/gap）, `confidence` |
| `rev.json` | 版本、hash、舊→新對映、freeze 日期 |

### 3.1 先選 base witness，不是先選語言

同一套 skill 要處理兩種完全不同的傳本情況：

| 類型 | base witness | 其他語言 | 例 |
|---|---|---|---|
| **無梵本** | 漢文（或唯一傳本） | 藏譯、英譯是**依附**的，晚一層 | 楞嚴 T945；藏譯 H259 明說譯自漢文；Luk 從漢文 |
| **有梵本** | 梵本 edition／manuscript（先定 recension） | 漢譯、藏譯、英譯都是 dependent | 法華、維摩詰 |
| **梵本殘缺** | 梵本殘卷＋校勘本／藏譯 | 漢譯多本 | 維摩詰（梵本不完整） |

規則：

1. `config.yaml` 要寫 `base_witness`、`recension`、`dependent_witnesses`；**不要假設 base 一定是中文**。
2. 有梵本時，轍號先發在梵本上；漢譯／藏譯／英譯只寫 `align`。
3. 多個梵本（法華：Kern-Nanjio、Gilgit、Wogihara…）先選一個 base recension，其他作 parallel witness；
   轍號綁 base，不混。
4. 無梵本時，base 就是漢文；藏譯／英譯是 dependent，等漢文轍穩定後再對。
5. 咒的別本（如楞嚴咒的 PDF 不空本）是 parallel witness，不是 base；除非整部書以該別本為 base。

### 3.2 轍號的兩層：semantic rut vs realization

理想的轍號不是「某個 witness 的第幾句」，而是**語義單位**；同一轍可以在不同 recension 有不同的 realization。

`tracks.tsv`（semantic，跨 recension）

| 欄位 | 說明 |
|---|---|
| `track_id` | 語義轍號，例 `M1.01` |
| `parent` | 上層轍號 |
| `level` | 層級 |
| `label` | 短標籤 |
| `gloss` | 語義／漢釋 |
| `order_hint` | 建議順序，不是 canonical order |

`realizations.tsv`（witness-specific）

| 欄位 | 說明 |
|---|---|
| `realization_id` | 某 witness 的實際文本單位，例 `R-KU-0001` |
| `track_id` | 對到的語義轍 |
| `witness_id` | `T945`／`T944A`／`KU-PDF`／`H259`… |
| `text` | 該 witness 的實際文字 |
| `start` / `end` | 該 witness 的座標 |
| `confidence` | `A`／`B`／`C` |

`witnesses.tsv`

| 欄位 | 說明 |
|---|---|
| `witness_id` | 傳本 id |
| `lang` | `zh`／`sa`／`bo`／`en` |
| `source` | 出處 |
| `recension` | 版本／系統 |
| `derivation` | `original`／`translation`／`commentary` |

`witness_order.tsv`：`witness_id`, `seq`, `realization_id`。每個 witness 自己排序；
`track_id` 不帶線性順序。

規則：

- `track_id` 跨 recension 共用；`realization_id` 只屬於一個 witness。
- 新增 recension 只加 `realizations` ＋ `witness_order`，不改 `track_id`。
- 同一 rut 在不同 witness 可以是 `1:1`、`1:n`、`n:1`、`gap`；用 `align.tsv` 或在
  `realizations` 記多個 realization。
- 不同 recension 的順序不同時，各自在 `witness_order` 排序；不要用一個全域 sequence 硬套。
- 若兩本差異大到無法共用 semantic rut，才拆 rut family，上層再用 `align` 連。

這樣「同一轍兼指不同 recension」就成立了：**轍號是語義的，realization 才是某一本的文字。**

目前分工：

- **楞嚴**：`base_witness = T945`，`dependent = H259(bo), LUK(en)`；先只編漢文轍，其他語言之後再說。
- **法華／維摩**：`base_witness = Sanskrit edition`；先定 recension，再編梵本轍，
  漢譯（法華 T262/T263/T264；維摩 T474/T475/T476）與藏譯挂 `align`。

## 4. 流程

1. **正規化＋切句**：保留原字，只處理空白、標點、異體；切句規則可配置。
2. **抽候選切點**：從注疏引文、科判節點、表號、頁/行座標，全部映射到 base 句。
3. **建證據表**：每個候選切點記支持家數、實錨/內插、塌縮、來源節點。
4. **選最小 cut set**：依覆蓋率、共識、門檻、人工校對；不是取聯集。
5. **建層級**：cut set → 連續區間 → 樹；層級由證據深度決定。
6. **發轍號**：`base_sid + part` 或不可變 opaque id；**不重用**。
7. **建對齊**：所有語言／注疏只寫 `align.tsv`；缺譯用 `gap`。
8. **驗證**：覆蓋率、無孤兒、無重複 id、缺口有解釋、round-trip。

## 5. 不可違反的規則

1. **轍號不可變、不可重用**。若一轍再切，保留父轍，另發子轍；舊 `align` 仍可解析。
2. **顯示號可變，轍號不可變**。UI 可以顯示 `chapter:verse`，但 crosswalk 用 `track_id`。
3. **每個 cut 都要有證據**；沒有注疏證據的長句切，標 `kind=editorial`。
4. **缺口要明示**：缺譯、節譯、咒段省略，一律 `gap`，不要靜默對齊。
5. **freeze 前要人工校對**：自動化只負責候選與一致性檢查，不替學者做判決。
6. **保留 provenance**：每個 cut／rut 記來源、版本、confidence。

### 5.1 版本與變轍

不作 100% 完美，作**可重算的版本**：

- 每次 freeze 一個 `rev`：`rev_id`、日期、input hashes、config hash、counts。
- 「變轍」＝新 `rev` ＋ migration map；舊 `rev` 永久保留，舊 `track_id` 仍可解析。
- 顯示號可以重算；轍號不行。遷移只新增對映，不覆蓋舊號。
- 不確定的先標 `confidence`／`gap`／`editorial`，先發 `rev-0001`，再一版一版修。
- 這就是數位和紙本的分別：紙本要重印，數位只要重算＋留舊版。

`rev.json` 最小內容：

```json
{
  "rev": "2026-11-05-p",
  "status": "draft",
  "base_witness": "T945",
  "base_file": "data/sutra.json",
  "base_sha256": "...",
  "counts": { "sentences": 4890, "kepan_nodes": 11007, "segments": 2418 },
  "files": { "sentences.tsv": "...", "sentence-kepan.tsv": "..." },
  "note": "sutra.json untouched; next rev adds cuts.tsv/hierarchy/align"
}
```

目前最新 draft：`build/rev/2026-11-05-p/`（`rev.json` ＋ `sentences.tsv`、`sentence-kepan.tsv`、
`sentence-split-map.tsv`、`cuts.tsv`、`tracks-zh.tsv`、`witnesses.tsv`、`align.tsv`、
`hierarchy*.json`）。前一個 `rev-a` 只有三張 TSV 快照，保留作歷史。
它凍結的是「漢文 draft 轍」，不是 canonical；`sutra.json` 仍不動。

## 6. 適配器（讓 skill 不限於楞嚴）

| 適配器 | 用途 |
|---|---|
| `cbeta-tei` | 大正藏／卍續藏 TEI，頁/欄/行座標 |
| `plain-sentences` | 已切句的 TSV/JSON |
| `commentary-quotes` | 注疏引文對回正文（最常見） |
| `kepan-nodes` | 科判樹節點（起句/迄句） |
| `table-refs` | 表號／卷頁換算 |
| `parallel-align` | 多語言句級對齊（1:1/1:n/gap） |

## 7. 驗證與品質門檻

- 每個 base 句都至少屬於一個 rut，或明示 `gap`。
- 每個 rut 的 `track_id` 唯一、不可重用、可追回 `base_sid + part`。
- 每個 cut 有 `evidence` 或 `editorial` 標記。
- `align` 的兩端都存在；`gap` 有一端可空。
- 重建測試：用 `tracks.tsv` 能拼回原文（允許明示的標點/空白差異）。
- 版本測試：舊 `rev` 的 `track_id` 在新 `rev` 仍可解析（或明示 retired）。

## 8. 通用化的難點

- 每部書的注疏格式不同：引文、夾註、表號、頁批、眉批。
- 切句標準不同：詩、詞、駢文、語錄、科判。
- 有些書沒有「句」的概念（如單純的目錄、表格）。
- 異體字、避諱、缺字、PUA 悉曇，會影響對齊。
- 所以 skill 要把「切句器」「注疏解析器」「切點規則」做成可插拔，而不是寫死。

## 9. 里程碑

1. **楞嚴 prototype**：`cuts.tsv`、`hierarchy.json`、`tracks.tsv`、`align.tsv`。
2. **抽流程**：把 scripts 重構成可配置的 pipeline（config + adapters）。
3. **寫 SKILL.md**：輸入/輸出/規則/驗證/範例，加上模板 repo。
4. **第二部書驗證**：選一部結構不同的古籍（如金剛經 vcpp、法華經、史記三家注），
   證明同一套 skill 可跑。
5. **發佈 skill**：放到 agent-norms 的 skills，附一個最小範例與檢查腳本。

## 10. 目前實作（楞嚴 prototype）

| 步驟 | 腳本 | 產物 |
|---|---|---|
| 切句／定址 | `scripts/build-sentence-tsv.ts` | `sentences.tsv`、`sentence-kepan.tsv`、`split-map` |
| cut 證據 | `scripts/build-cuts.ts` | `cuts.tsv` |
| 穩定轍 | `scripts/build-tracks.ts` | `tracks-zh.tsv`、`witnesses.tsv` |
| 層級 | `scripts/build-hierarchy.ts` | `hierarchy*.json`（6 版） |
| 粗層 | `scripts/build-greedy-cuts.ts 3` ＋ `build-hierarchy.ts coarse` | `cuts-coarse.tsv`、`hierarchy-coarse.json` |
| 咒語 editorial | `scripts/build-editorial-cuts.ts` ＋ `build-hierarchy.ts *-ed` | `cuts-editorial.tsv`、`hierarchy-*-ed.json` |
| xref | `scripts/build-xref.ts`、`build-xref-commentary.ts` | `xref-kepan/section/commentary.tsv` |
| 平行 pilot | `scripts/build-align-pilot.ts` | `tracks-sa.tsv`、`align.tsv` |
| 驗證 | `scripts/check-track-system.ts`、`check-rev.ts` | PASS |

目前最新：`build/rev/2026-11-05-p/`；驗證 36 檔 hash 相符。

## 11. 一句話

**轍號是軸，注疏是證據，層級是結果，對齊是應用。**
把這四件事做成 skill，漢文古籍的「浩如烟海」才從口號變成可操作的工程。
















