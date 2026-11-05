# 漢字梵音轉換表（楞嚴咒 pilot）

> 2026-11-05。目的：讓讀者看到「密碼般」漢文咒語背後的梵語，不是把它當秘密，而是把它還原成語言。
> 先做 15 句 pilot，不追求一次覆蓋 858 句。

## 原則

1. **不是一字一音**：漢字梵音常是 2–4 字對一個梵語詞或音節組（`南無`＝namaḥ、`三藐三菩陀`＝samyaksaṃbuddha）。
   所以表以「詞／音節組」為單位，不以單字為單位。
2. **順序優先**：咒語主體的顺序是穩定的；先做序列對齊，再處理異文。
3. **不硬猜**：表裡沒有的字用 `?` 標記；不確定給 B/C，不假裝是 A。
4. **沙門不神秘**：咒語是語言，不是不可解的密碼；能還原的就還原，不能的明說。

## Pilot 的範圍

拿 T945 第二段咒的開頭 17 句（新號 S3306–S3322），和 Luminous PDF 的不空本第 1 會對齊。
這 17 句大致順序一致，是很好的 pilot；但 T945 缺 `M1.06 anāgāmināṃ`，
所以不是嚴格 1:1（`M1.12` 的 `umāpati`／`sahīyāya` 在 `S2587.18`／`.19`，已對上）。

| T945 | 漢文 | 梵語（PDF 不空本） | 信心 |
|---|---|---|---|
| S3306 | 南無薩婆勃陀勃地薩跢鞞弊 | Namaḥ sarva buddha bodhi-satve-bhyaḥ | A |
| S3307 | 南無薩多南三藐三菩陀俱知南 | Namaḥ saptānāṃ samyak-saṃbuddha koṭīnāṃ | A |
| S3308 | 娑舍囉婆迦僧伽喃 | sa-śrāvaka saṃghānāṃ | A |
| S3309 | 南無盧雞阿羅漢跢喃 | Namo loke arhattāṃ | A |
| S3310 | 南無蘇盧多波那喃 | Namaḥ srotāpannānāṃ | A |
| S3311 | 南無娑羯唎陀伽彌喃 | Namaḥ sakṛdāgāmināṃ | A |
| S3312 | 南無盧雞三藐伽跢喃 | Namo loke samyag-gatānāṃ | A |
| S3313 | 三藐伽波囉底波多那喃 | samyak-prati-pannānāṃ | B |
| S3314 | 南無提婆離瑟𧹞 | Namo devarṣiṇāṃ | A |
| S3315 | 南無悉陀耶毘地耶陀囉離瑟𧹞 | Namaḥ siddha-vidyā-dhāra-rṣiṇāṃ | A |
| S3316 | 舍波奴揭囉訶娑訶娑囉摩他喃 | śāpānugraha-samarthānāṃ | B |
| S3317 | 南無跋囉訶摩泥 | Namo brahmaṇe | A |
| S3318 | 南無因陀囉耶 | Nama indrāya | A |
| S3319 | 南無婆伽婆帝 | Namo bhagavate | A |
| S3320 | 嚧陀囉耶 | rudrāya | A |
| S3321 | 烏摩般帝 | umāpati | B |
| S3322 | 娑醯夜耶 | sahīyāya | B |

注意：T945 的 S3304–S3305 是額外的開頭（`namaḥ satatāya sugatāya…`），
不在 PDF 第 1 會開頭；主體從 S3306 才和 PDF 對上。這個「額外開頭」要另外處理。

## 轉換表

`data/mantra-syllables.tsv` 目前 36 個單元，例：

| 漢字單元 | 梵音 | 信心 | 備註 |
|---|---|---|---|
| 南無 | namaḥ | A | 有時作 namo／nama（sandhi） |
| 薩婆 | sarva | A | |
| 勃陀 | buddha | A | |
| 勃地薩跢 | bodhisattva | A | |
| 鞞弊 | bhyaḥ | A | 與格複數 |
| 薩多南 | saptānāṃ | A | 七 |
| 三藐三菩陀 | samyaksaṃbuddha | A | 正等覺 |
| 俱知南 | koṭīnāṃ | A | 俱胝／億 |
| 娑舍囉婆迦 | sa-śrāvaka | A | 聲聞 |
| 僧伽喃 | saṃghānāṃ | A | |
| 盧雞 | loke | A | 世間 |
| 阿羅漢跢喃 | arhattāṃ | A | |
| 蘇盧多 | srotā | A | 預流 |
| 波那喃 | pannānāṃ | A | |
| 娑羯唎陀 | sakṛd | A | 一來 |
| 伽彌喃 | āgāmināṃ | A | |
| 三藐伽跢喃 | samyag-gatānāṃ | A | 正行 |
| 提婆 | deva | A | 天 |
| 離瑟𧹞 | rṣiṇāṃ | A | 仙人 |
| 因陀囉 | indra | A | 帝釋 |
| 婆伽婆帝 | bhagavate | A | 世尊 |

## 貪婪轉換 demo

`bun run scripts/mantra-translit.ts` 會用表對 S3306–S3322 做貪婪匹配，例：

```text
S3306  南無薩婆勃陀勃地薩跢鞞弊 → namaḥ sarva buddha bodhisattva bhyaḥ
S3309  南無盧雞阿羅漢跢喃       → namaḥ loke arhattāṃ
```

## 軌號與對齊 pilot

- `data/tracks-sa.tsv`：143 個不空本梵句（`M1.01`–`M5.17`）。
- `data/align.tsv`：20 列，把 T945 的 `S2587.1`–`S2587.19` 對到 `M1.01`–`M1.12`：
  - 7 列 `1:1`；
  - 8 列 `n:1`（T945 一句變兩句，或不空本兩句併一句）；
  - 3 列 `gap`（S3304–S3305 額外開頭；T945 缺 `M1.06 anāgāmināṃ`）。
- 詞級 pilot 見 [`mantra-word-alignment.md`](mantra-word-alignment.md)：42 列，`M1.01`–`M1.12`。
- 這是一個 pilot；`align.tsv` 還沒有全咒 858 句。

## 已知限制

1. **Sandhi**：表給的是 citation form；實際要連音：
   `namaḥ + loke → namo loke`、`sakṛd + āgāmināṃ → sakṛdāgāmināṃ`。
   目前 demo 只做詞段拼接，沒有完整 sandhi engine。
2. **一對多**：`南無` 在不同位置可能是 namaḥ／namo／nama；需要上下文規則。
3. **不空本 ≠ T945 本**：pilot 用 PDF 的不空本作對照；T945 的般剌蜜帝本在別處順序不同。
4. **PDF 是現代羅馬字還原**，不是 critical edition；拼寫要再校。
5. **咒語主體順序穩定，但開頭／結尾可能有別本插入**（如 S3304–S3305）。

## 下一步

1. 把 T944A（不空漢音譯）也 parse 成句，補上 T945↔T944A↔PDF 三向對齊。
2. 用 T2235 勘註補詞義與句界。
3. 把表從 36 個單元擴到覆蓋 pilot 以外的常見單元；未收錄的留 `?`。
4. 加一個簡單 sandhi 規則表（至少 namaḥ/namo、sakṛd/āgāmin、複輔音連寫）。
5. 最後才做全 858 句；每句給 A/B/C，不硬湊。

## 立場

咒語不是婆羅門式的秘密；它是**語言**。能還原的就還原，不能的就標不確定。
讓讀者看到 `南無薩婆勃陀…` 背後是 `Namaḥ sarva buddha…`，這是理解法義的幫助，不是洩漏天機。


