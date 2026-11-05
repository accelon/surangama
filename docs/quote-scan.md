# 以 ADBengine 掃《楞嚴經》引用（pilot）

> 2026-11-05。目的：用已對齊的 `track_id` 到 `taisho.adb`／`wxzj.adb` 找所有引用，
> 以引用邊界反推 **suggested split / join points**。引用應該就是一個語義分段。

## 1. 方法

```text
T945 軌（tracks-zh.tsv）
  ↓ 每軌取 start / mid / end 三個 10 字窗
SearchSession.searchPhrase（adb 全文索引）
  ↓ taisho.adb、wxzj.adb
VA → 書（book）/ 頁（page）標籤
  ↓ 排除 T945 自身
hit 記錄：track_id, book, page, matched
  ↓ 同一頁／同一書的相邻軌
suggested join
  ↓ 部分命中（quote 起訖在軌內）
suggested split
```

- 用 `D:\2026\adb-converter\ts\src\accelon26\search.ts` 的 `SearchSession`，
  不是自己掃全文；片語搜尋走 adb 的 token posting。
- 命中後用 `VaPaMapper.textOfVaSpan()` 取實際文字，至少 6 個漢字與查詢重疊才收。
- `taisho` 的 T945 自身（書名 `大佛頂如來密因修證了義諸菩薩萬行首楞嚴經`）排除；
  其他大正藏文本（如 `宗鏡錄`）與卍續藏注疏保留。

## 2. Pilot 範圍與結果

先做三段：

| 範圍 | 軌數 | hits | split suggestions | join suggestions |
|---|---:|---:|---:|---:|
| 全書抽樣（每 130 軌） | 20 | 816 | — | — |
| S0160–S0180（全軌） | 21 | 1,387 | — | — |
| S0190–S0240（全軌） | 51 | 1,687 | 4 | 33 |
| S0160–S0450（全軌，10 字窗） | 291 | 5,020 | 18 | 61 |

（最後一段是主要 pilot；`--from/--to` 用 dense `display_sid`。`S0160–S0450` 的 hits 5,020，131/291 軌有引用，30 軌是部分命中；193 本書，4,638 筆屬 `楞嚴`／`宗鏡錄` 類。）

引用最多的書（pilot）：

| 書 | hits |
|---|---:|
| 楞嚴經貫攝 | 300 |
| 楞嚴經通議 | 296 |
| 楞嚴經如說 | 262 |
| 楞嚴經直指 | 258 |
| 楞嚴經合論 | 253 |
| 楞嚴經要解 | 248 |
| 楞嚴經合轍 | 246 |
| 楞嚴經宗通 | 244 |
| 楞嚴經觀心定解 | 242 |
| 首楞嚴義疏注經 | 240 |
| 宗鏡錄 | 121 |

### Split 例子

| track | 原文邊界 | 建議 | 支持 |
|---|---|---|---|
| `S0169.1` | `若在虛空，｜自非汝體，即應如來今見汝面…` | 在 4 字處切 | 宗鏡錄、楞嚴經合論、通議、如說… |
| `S0163.1` | `…此室暗中皆汝｜焦府？` | 在 18 字處切 | 6 家（但尾段只 2 字，需人工） |
| `S0191.1` | `…則汝以手挃一｜時，四𨈛應覺；` | 在 10 字處切 | 6 家 |
| `S0197.1` | `若不遍者｜當汝觸頭亦觸…｜足應無知` | 切兩刀 | 楞嚴經通議（B） |

### Join 例子

| join | 邊界 | 共同頁 | 支持 |
|---|---|---|---|
| `J0001` | `S0141.1` + `S0142.1` | 9 keys | 首楞嚴義疏注經、要解、合論… |
| `J0002` | `S0144.2` + `S0145.1` | 15 keys | 宗鏡錄、集註、要解… |
| `J0003` | `S0145.1` + `S0146.1` | 18 keys | 宗鏡錄、通議、文句… |

## 3. 輸出

| 檔案 | 內容 |
|---|---|
| `build/quote-scan-pilot.tsv` | 每個 hit：adb、track、book、page、VA、matched |
| `build/quote-profile-pilot.tsv` | 每軌的 start/mid/end 命中、書/page 清單 |
| `data/track-refinements.tsv` | split / join 建議（79 列） |
| `data/track-joins.tsv` | join 明細（61 列） |
| `data/tracks-suggested.tsv` | split 子軌（37 列；不覆寫 `tracks-zh.tsv`） |
| `data/join-groups.tsv` | join group（61 列） |
| `data/tracks-refined.tsv` | refined 預覽（4,909 軌；split 子軌取代原軌） |
| `data/xref-quote.tsv` | 正規化引用 crosswalk（5,020 列） |

## 4. 判讀規則

- **start=0, mid/end=1**：引用從軌內開始 → split at first hit offset。
- **end=0, start/mid=1**：引用在軌內結束 → split at last hit+10。
- **mid=1 only**：引用只在中間 → 兩個 split。
- **相鄰兩軌 share `(adb,book,page)`**：可能是同一段引文 → join suggestion。
- 同一頁可能包含多句，join 只是 suggestion，不是證明；A/B 信心看 shared keys 數。

## 5. 限制

1. 10 字窗對異體字、缺字、標點差異敏感；没命中不等於沒引用。
2. 常見句（如「如是我聞」）會有很多誤中；已用 6 字重疊與書名過濾，但仍需人工。
3. 注疏常是**略引／改寫**，不是逐字；matched 只代表窗內文字。
4. `page` 是 adb 的頁 id，不是 CBETA 頁碼；兩者對映要另做。
5. 目前只掃 taisho + wxzj；其他 adb（如 `yinshun`）未納入。
6. split 子軌號用 `<parent>.1/.2`，舊 `track_id` 保留；未 freeze，未寫回 `tracks-zh.tsv`。

## 6. 下一步

1. 擴大 scan 到全 4,890 軌（或每 10 軌），建立 `quote-hits.tsv`。
2. 人工校對 split/join，特別是尾段 <4 字的 split。
3. 把 confirmed split 寫成新 `track_id`（舊軌 `superseded_by`），confirmed join 寫成 `join_group`。
4. 把 `book/page` 對到 CBETA 頁碼與 `xref`，接回閱讀器。





