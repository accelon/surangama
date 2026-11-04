# AGENTS.md — `surangama` 工作區（楞嚴經合注）

> 2026-11-04 作者指示：開新工作區 `D:\2026\surangama`，版控家 <https://github.com/accelon/surangama>。
> 這一區做《楞嚴經合注》，成品形態與 `vcpp`（金剛經合注）同一類。
> 本檔只寫「這一區的差異」；共用紀律在 agent-norms 與母工作區，**不要複製過來**。

## 0. 先讀（紀律來源，留在原處）

| 順序 | 文件 | 為什麼 |
|---|---|---|
| 1 | `D:\2026\agent-norms\README.md` | 規範總目；「開新工作區」的 canonical 是 `new-workspace.md` |
| 2 | `D:\2026\agent-norms\yap-software-practice.md` | 作者預設做法；**§12 背景工作與子行程對所有工作區有效** |
| 3 | `D:\2026\adb-converter\AGENTS.md` | 母工作區規則；本區語料（**唯讀**）來自它的 `build\` |
| 4 | `D:\2026\vcpp\AGENTS.md` | 同類成品（金剛經合注）的實際做法，開工前對照 |
| 5 | `D:\2026\agent-norms\writing-skill.md` | **只在代寫／改稿作者的文章時**讀 |

## 1. 這個工作區做什麼

- **產出**：純靜態《大佛頂如來密因修證了義諸菩薩萬行首楞嚴經》（T945）對讀站——主文 ＋ 注疏 ＋ 別譯
  ＋（若需要）梵藏對照。形態照 `vcpp`：`index.html` 開發版（`file://` 可開）、單檔部署版
  （CSS／JS／資料內嵌，gzip ＋ base64）。
  - 檔名暫定 `surangama.html`；線上位置暫定 `https://shutonggui.cn/incubator/surangama.html`。
    **兩者都還沒定案，發佈前先問作者。**
- **來源**（皆唯讀）：
  - 經文：大正藏 T945，`D:\2026\adb-converter\build\tei-all-2026R2.txt`（CBETA XML-P5 2026R2）。
  - 注疏：卍續藏 `wxzj-tei-2026R2.txt`，清單待作者圈選（長水子璿、交光真鑑、憨山德清、蕅益智旭…）。
  - 句界若沿用 `ylz-prjn.offtext` 的做法，先確認那批資料有沒有楞嚴。
  - 可用 `$env:` 覆寫語料路徑的慣例照 `vcpp`。
- **成品位置**：線上；本機建置產物不進版控。
- **母工作區**：`D:\2026\adb-converter`（語料、adb 工具、版本紀錄的家）。
- **參照實作**：`D:\2026\vcpp`（金剛經合注，2026-11-04 自 `zhu-combined` 分出）。

## 2. 共用程式（不要重寫一份）

| 用途 | 用哪一個 |
|---|---|
| 語料／漢字／頁座標／VA 等 adb 工具 | `D:\2026\adb-converter\ts\`；缺東西**回母區補** |
| 資料管線、對齊、單檔打包 | `D:\2026\vcpp` 的 `build\`、`build-vcpp.mjs`——**先確認作者要複製過來還是抽成共用**，不要默默分叉 |
| 操作導覽引擎 | `vcpp` 已 vendored 的 `src\tour\`（來源見 `src\tour\VENDOR.md`） |

## 3. 工作流程

```text
① 取源（T945 經文＋圈選的注疏；原始檔唯讀）
② 分句與對齊（照 vcpp 的做法：句界、注疏 8 字窗 LIS 對齊）
③ 資料 → data js；前端照 vcpp 的三欄／面板
④ 單檔打包
⑤ 部署（只有作者明說才做）
⑥ 驗證＋記帳
```

尚未開工；上面每一步的實際指令在照 `vcpp` 落地後補進 `README.md`。

- 長跑工作（CDP 截圖、長圖、整批對齊）要加 timeout，收工前連子行程一起收（`yap-software-practice.md` §12）。

## 4. 版本、發布、記帳

1. **建置記帳**：本區 [`docs\build-log.md`](docs/build-log.md)，一列寫日期／版本或 sha／大小／buildTime／說明。
   > 不記在母區版本紀錄：母區那本記的是 adb 成品。
2. **發布**：只有作者明說才做；發布後一定驗線上。
3. `/incubator/` 是共用目錄：只放本專案的檔，不動 `index.html`、`projects.json`。
   > ⚠️ `/huixintang/` 是官網工作區的目錄，2026-11-04 誤覆蓋過它的 `index.html`——不要往那裡寫。

## 5. 文件

| 檔案 | 內容 |
|---|---|
| `README.md` | 來源、指令、成品、限制 |
| `docs\build-log.md` | 每次建置一列 |
| `docs\` 其餘 | 決策紀錄、注疏清單、對齊筆記 |

- 決策紀錄：偏離 agent-norms 或 `vcpp` 做法時，寫「為什麼」與「什麼情況改回來」。
- 文件、UI、註解用繁體中文；程式識別字用英文。

## 6. 不要做的事

- 不要改 `D:\2026\adb-converter` 的語料與程式（**唯讀**）；共用 bug 回母區修。
- 不要跨區複製 `vcpp` 的檔案當「最新版」；要共用就抽出來或明講同步方式。
- 不要 `git add -A`、`git reset --hard`、`git restore .`；作者沒說就不要 commit／push。
- 不要把 `vendor\`、`.local\`、建置產物、原始語料 commit 進 git。
- 不要在未經指示時發布、覆寫線上，或改別區的狀態檔。

## 7. 交接（工作區停用前）

- [ ] 最後一次建置能從零重跑（來源、版本、參數）
- [ ] `docs\build-log.md` 有最後一列
- [ ] `README.md` 寫清楚「已停用，維護看哪一份」
- [ ] 背景工作與子行程收乾淨

## 8. 開工前要問作者的事

- [ ] 注疏要收哪幾家？（決定 `wxzj` 的抓取範圍與右欄作者按鈕）
- [ ] 要不要別譯／梵藏對照？楞嚴只有般剌蜜帝一譯傳世（另有藏譯、梵本殘卷），做法與金剛經不同。
- [ ] 線上檔名與目錄（暫定 `surangama.html`、`/incubator/`）
- [ ] `vcpp` 的管線是複製過來，還是抽成共用模組？
