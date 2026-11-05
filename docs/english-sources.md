# 英文譯本與參考資料

> 2026-11-04。檔案都在 `vendor\english\`（`vendor/` 不進版控）。
> 只做「有什麼、能不能用」的評估，還沒建對齊。

## 一覽

| 版本 | 譯者／作者 | 年 | 頁數 | 檔案 | 文字層 | 性質 |
|---|---|---|---:|---|---|---|
| The Shurangama Sutra（打字本） | Charles Luk（陸寬昱） | 1966 | 115 | `shurangama-luk.pdf` | 有，乾淨 | 純譯本＋憨山注 |
| The Surangama Sutra（BDEA 排版本） | Charles Luk（陸寬昱） | 1982? | 352 | `surangama-yu.pdf` | 有 | 同上一部，書版＋頁碼 |
| The Shurangama Sutra, Vol. 1–8 | 宣化上人講、BTTS 譯 | 1977／2002 | 2,352（合訂） | `surangama-btts-complete.pdf`（各卷單檔已刪，合訂本已含全部） | 有 | 經文＋淺釋（講記） |
| Solid Enlightenment | P. B. Tan | 2022 | 198 | `Solid_Enlightenment_The_Shurangama_Sutra.pdf` | 有 | 純譯本 |

## 1. Charles Luk（陸寬昱）

兩個電子本，同一部譯文：

| 檔案 | 頁 | 特點 | 用途 |
|---|---:|---|---|
| `shurangama-luk.pdf` | 115 | 打字本；每段有 **1.11.1** 層級編號 | **機器對齊**（編號現成） |
| `surangama-yu.pdf` | 352 | BuddhaNet／BDEA 排版書版（<https://www.buddhanet.net/pdf_file/surangama.pdf>）；有目錄、書頁碼、憨山注節本 | **引用**（書頁碼） |

- 譯文完整（打字本末頁明寫 "This is the end of the Shurangama Sutra"）。
- 檔名 `yu` 指 **Lu K'uan Yu**，不是圓瑛。
- 兩本可互相校對（排版本有目錄頁碼，打字本有段落編號）。

## 2. BTTS／宣化上人《The Shurangama Sutra With Commentary》8 卷

**完整 8 卷**：`surangama-btts-complete.pdf`，2,352 頁，附錄來源 <http://dharmalib.org/Master-Hua-English/>。
各卷起始頁（合訂本）：

| 卷 | 起始頁 | 頁數 | 章（TOC） | 大約對應漢文本 |
|---|---:|---:|---|---|
| 1 | 3 | 314 | 十門判教、傳譯、證信、阿難示墮、奢摩他路、阿難悔請 | 卷一前段＋十門通論 |
| 2 | 317 | 264 | 見性、二種妄見、和合 | 卷一末–卷二 |
| 3 | 581 | 270 | 即妄即真、五陰、六入、十二處、十八界、七大、阿難起信 | 卷二–卷三 |
| 4 | 851 | 314 | 相續生起、圓通之理、阿難執因緣、二決定義、聞非聲 | 卷四–卷五 |
| 5 | 1,165 | 274 | 六結、二十五圓通、文殊選擇 | 卷五–卷六 |
| 6 | 1,439 | 232 | 三無漏學、建立道場、神咒、二顛倒、十二類生 | 卷七 |
| 7 | 1,671 | 304 | 三漸次、菩薩階位、經名、七趣 | 卷八–卷九 |
| 8 | 1,975 | 378 | 魔境、色／受／想／行／識陰、結勸 | 卷九–卷十 |

- 體例是**經文＋上人淺釋**，不是純譯本；頁眉帶「章名＋印刷頁碼」（例：`The Reason for Continual Arisal 17`），可引頁。
- 文字層可直接抽（pypdf 測試正常），排版比掃描本乾淨。
- 用途：**參考注**（近代白話解釋），拿來當「別譯」會混進講記文字，要切開才用。

## 3. P. B. Tan《Solid Enlightenment》（2022）

- 198 頁，自出版（ISBN 9781387423187）；有序、譯者前言。
- 純譯本，無漢文對照；文字層有。
- 就是先前 Scribd 那本（由作者補檔）。
- 用途：可當**第三種英譯**；還沒細看譯語風格與分節方式。

## 建議

| 用途 | 用哪一本 |
|---|---|
| 逐句別譯對齊 | **Luk**（有層級編號、完整、115 頁最輕） |
| 參考注／白話解釋 | **BTTS**（完整 8 卷，合訂 2,352 頁） |
| 第三譯／比較譯語 | **Tan**（198 頁） |

## 缺件

- ~~BTTS Vol 7~~ → 已由 dharmalib 的合訂本補齊（8 卷完整）。
- Luk 本的憨山注只節錄，不是全本《通議》。
- 三本都還沒有頁碼／段落對映；要引用得先做一次（Luk 最簡單，按 1.x.y 編號即可）。

## 重跑／檢查

```powershell
# 看某一卷的章節與頁數（pypdf）
python -c "from pypdf import PdfReader; import sys; r=PdfReader(sys.argv[1]); print(len(r.pages))" "vendor\english\Shurangama Sutra With Commentary [Vol 1 Of 8] (City Of Ten Thousand Buddhas) (z-library.sk, 1lib.sk, z-lib.sk).pdf"
```
