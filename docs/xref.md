# Crosswalk：所有來源 → track range

> 2026-11-05。`xref-*.tsv` 是「書同軌」的對映層：來源只存 `track_start`／`track_end`，
> 不各存一套座標。`data/sutra.json` 不動。

## 1. `xref-kepan.tsv`（11,007 列）

九家科判節點 → 漢文軌 range。

| 欄位 | 說明 |
|---|---|
| `work_id` | `X265`／`X273`／`DRBA`／`YY`／`YY1`／`YY2`／`WJ`／`YJ`／`GD` |
| `node_id` | 該書節點 id |
| `lv` | 層級 |
| `lab` / `nm` | 層級標籤／名稱 |
| `track_start` / `track_end` | 穩定軌號 range |
| `display_start` / `display_end` | 目前 dense `sid` |
| `quality` | `exact`／`interpolated`／`table` |

注意：節點只做位置映射，沒有重錨；`S0046` 手工切成 6 段後，54 個節點仍全落在 `S0046.1`。

## 2. `xref-section.tsv`（27 列）

蒙鈔目錄 27 分節 → track range；`work_id=SEC27`，`quality=catalog`。

## 3. `xref-commentary.tsv`（37,565 列）

11 家注疏的**句級**對齊 → track range，附頁碼與字元位移。

| 欄位 | 說明 |
|---|---|
| `work_id` | `T1799`、`X270`、`X275`、`X279`、`X285`、`X287`、`X306`、`X308`、`X316`、`X318`、`LIB` |
| `source_node` | 舊 `sutra.json` 句號 |
| `track_start` / `track_end` | 穩定軌號 range |
| `display_start` / `display_end` | dense `sid` |
| `char_start` / `char_end` | 注疏文字的正規化位移 |
| `page_first` / `page_last` | 大正頁碼（LIB 無頁碼） |
| `frag_count` | 該句對到的片段數 |
| `kind` | `commentary` |

各work列數：

| work | rows |
|---|---:|
| T1799 | 3,623 |
| X270 | 3,614 |
| X275 | 3,571 |
| X279 | 3,655 |
| X285 | 3,640 |
| X287 | 3,589 |
| X306 | 3,604 |
| X308 | 3,610 |
| X316 | 1,404 |
| X318 | 3,651 |
| LIB | 3,604 |
| **合計** | **37,565** |

X316 只 1,404 句，因為它的引經多為短句（6 字窗打不中），這是已知限制。

## 4. `align.tsv`（20 列）

平行語料 pilot：T945 咒語 `S2587.1`–`S2587.19` ↔ 不空本 `M1.01`–`M1.12`。
7 列 `1:1`、8 列 `n:1`、2 列 `gap`。

## 5. `xref-quote.tsv`（5,020 列）

ADBengine 引用掃描的正規化 crosswalk。

| 欄位 | 說明 |
|---|---|
| `work_id` | 引用書名（如 `楞嚴經通議`、`宗鏡錄`） |
| `source_node` | `page:va`（adb 頁 id ＋ VA） |
| `track_id` | 被引用的 T945 軌 |
| `display_sid` | 目前 dense `sid` |
| `matched` | 命中的原文片段 |
| `kind` | `quote` |
| `confidence` | `A`（楞嚴／宗鏡錄類）／`C`（其他書） |

注意：`work_id` 是書名，不是 `X265` 這種 work id；`page` 是 adb 頁 id，不是 CBETA 頁碼。

## 6. 用法

- 新注疏：只新增 `work_id`、`source_node`、`track_start/track_end` 到 `xref-commentary.tsv`；
  不動主文、不動其他家。
- UI：給一個 `track_id`，可以查所有 `work_id` + `source_node`；反向亦然。
- 版本：所有 xref 都跟 `rev` 走；`track_id` 不重用。

## 7. 驗證

```powershell
bun run scripts/check-track-system.ts
# xref_kepan 11007, xref_section 27, xref_commentary 37565, fails 0
bun run scripts/check-refinements.ts
# xref_quote 5020, refined 4909, fails 0
```




