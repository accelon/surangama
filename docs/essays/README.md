# essays（短文源稿）

這裡放要發表到 `shutonggui.cn/yap` 的短文源稿（Markdown）與示意圖（SVG）。

## 現有

| 檔案 | 內容 |
|---|---|
| `一句話一個門牌.md` | 書同軌短文（約 950 字），2026-11-05 發表 |
| `shutonggui.svg` | 上述短文的示意圖（多家科判 → 同一軌號 → 經文） |

## 建置

```text
bun run scripts/build-essay.ts                       # 預設：一句話一個門牌 → shutonggui.html
bun run scripts/build-essay.ts <md> <slug.html>      # 指定來源與輸出檔名
```

- 產出寫到 `D:\nissaya.cn\html\yap\essays\<slug>`，SVG 一併複製。
- 版面沿用 `/yap/essays/essays.css`；繁簡切換用 agent-norms 的 `SAFE_PAIRS`＋`FORCE_PAIRS`（主站預設簡體、鏡像繁體）。
- 上傳後要更新 `/yap/index.html` 的「論文與報告」清單（兩站各一份）。

## 規矩

- 源稿只改 md；不要直接編輯產生的 HTML。
- 引號用「」；正文樸素，粗體只在必要處。
- 數字要能追溯到實際資料（本篇的數字來自楞嚴建置）。
