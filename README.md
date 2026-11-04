# surangama · 楞嚴經合注

《大佛頂如來密因修證了義諸菩薩萬行首楞嚴經》（T945）的對讀站：主文 ＋ 注疏 ＋（視需要）別譯／梵藏。

形態照 [`D:\2026\vcpp`](https://github.com/accelon/vcpp)（金剛經合注）：純靜態，`index.html` 開發版可直接開，
另有單檔部署版（CSS／JS／資料全部內嵌）。

- 線上：尚未發佈（暫定 `https://shutonggui.cn/incubator/surangama.html`）
- 原始碼：<https://github.com/accelon/surangama>

## 現況（2026-11-04）

**只有骨架**：工作區、`AGENTS.md`、版控與 remote 已就緒，內容與管線還沒進來。
待作者定案的事見 [`AGENTS.md`](AGENTS.md) 第 8 節（注疏範圍、要不要別譯／梵藏、線上檔名、管線共用方式）。

## 來源

| 類別 | 來源 |
|---|---|
| 經文 | 大正藏 T945；`D:\2026\adb-converter\build\tei-all-2026R2.txt`（CBETA XML-P5 2026R2） |
| 注疏 | 卍續藏 `wxzj-tei-2026R2.txt`，清單待圈選 |
| 語料 | 一律**唯讀**；不寫入 `adb-converter` |

## 版控

- 進版控：前端程式、資料管線、抽出的資料（`*.json`、校訂 `*.tsv`）、文件。
- 不進版控：`vendor\`（原始 PDF／掃描）、`.local\`（憑證）、單檔產物、`screenshots\`、`__pycache__\`。

## 同類工作區

- `D:\2026\vcpp` — 金剛經合注（做法參照）
- `D:\2026\adb-converter` — 母工作區：語料、adb 工具
