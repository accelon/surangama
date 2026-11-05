# 楞嚴咒梵漢詞級對齊（draft）

> 2026-11-05。目標：把咒從「句級」推進到「詞級」，建立常用詞表，並用簡單去屈折
> 把 `namaḥ／namo`、`bhagavate／bhagavata` 這類形式收成 lemma。先出初稿，之後再擴。

## 1. 範圍

- 漢：T945 `S2587.3`–`S2587.19`（17 個 phrase），對應 `S3306`–`S3322`。
- 梵：KU-PDF 不空本 `M1.01`–`M1.12`（12 個 unit）。
- 這 12 個 unit 是 PDF 第 1 會的開頭；不是全咒。
- 閱讀器 tab 已擴到 143 unit（M1 11 exact、M2–M5 131 approx）；本篇的 42 列仍是 M1 exact。

## 2. 方法

```text
T945 phrase
  ↓ 用 data/mantra-syllables.tsv 最長匹配，切成中文單元（南無／薩婆／勃陀…）
梵 unit
  ↓ 空白＋連字號切詞（bodhi-satve-bhyaḥ → bodhi / satve / bhyaḥ）
單調 DP
  ↓ 轉寫相似度（normalize IAST，Levenshtein）
1:1 / 1:2 / 2:1 / gap
```

- 中文切分只認表裡的詞；表外字用單字 `hint=?`。
- 梵文連字號切段，是為了讓 `bodhi-satve` 可以對 `勃地薩跢`（1:2）；
  完整 compound 仍保留在 `sa_word`。
- 相似度用去變音符號的 IAST（`ṃ→m`、`ḥ→h`、`ā→a`…），避免 `Namaḥ`／`namaḥ` 對不上。

## 3. 例子

| 梵 | 漢 | 關係 | 信心 |
|---|---|---|---|
| Namaḥ | 南無 | 1:1 | A |
| sarva | 薩婆 | 1:1 | A |
| buddha | 勃陀 | 1:1 | A |
| bodhi + satve | 勃地薩跢 | 1:2 | B |
| bhyaḥ | 鞞弊 | 1:1 | A |
| saptānāṃ | 薩多南 | 1:1 | A |
| samyak + saṃbuddha | 三藐三菩陀 | 1:2 | B |
| srotāpannānāṃ | 蘇盧多＋波那喃 | 2:1 | B |
| rudrāya | 嚧陀囉耶 | 2:1 | A |

M1.12 的 `umāpati`／`sahīyāya` 在 T945 是 `S2587.18`／`.19`（`烏摩般帝`／`娑醯夜耶`），已對成 1:1。

## 4. 常用詞表

`data/mantra-words.tsv`：143 個梵 unit 切出 **454 個詞形**；`data/mantra-lemmas.tsv`：**446 個 lemma**。

Top lemma：

| lemma | count | 變體 |
|---|---:|---|
| phaṭ | 52 | phaṭ |
| sarva | 35 | sarva |
| nam | 26 | namaḥ;namo |
| cchinda | 17 | cchinda;cchinda-yāmi |
| vidy | 16 | vidyā;vidyāṃ |
| bhagavat | 15 | bhagavate |
| kīla | 15 | kīla-yāmi |
| hūṃ | 14 | hūṃ |
| kṛt | 14 | kṛtāṃ |
| arhat | 8 | arhate |
| tathāgat | 7 | tathāgatāya |

## 5. 簡單去屈折

`scripts/build-mantra-words.ts` 用一組後綴規則，順序很重要：

```text
-bhyaḥ / -ānāṃ / -āṃ / -asya / -āya / -eṣu / -āni
-am / -aḥ / -o / -uḥ / -e / -ā / -ī / -ū
```

例：

- `namaḥ`、`namo` → `nam`
- `bhagavate` → `bhagavat`
- `vidyāṃ` → `vidy`
- `arhate` → `arhat`
- `cchinda-yāmi` → `cchinda`（複合詞末段太短時，整詞 fallback）

限制：

- `bhyaḥ` → `bhy` 是過度去尾；它其實是與格複數的 clitic，應保留 `bhyaḥ`。
- 佛名、地名、陀羅尼專名不該去屈折；目前靠「詞形本身」保留。
- 連字號 compound 只去最後一段；`samyak-saṃbuddhāya` → `samyak-saṃbuddh`，不是真正的詞根。
- 這只是 **draft stemmer**，不是 Sanskrit grammar engine。

## 6. 已知問題

1. **T945 缺 `anāgāmināṃ`**：PDF M1.06 在 T945 沒有對應句；`align.tsv` 已標
   `M1.06 gap`，`mantra-word-align.tsv` 也留兩列 gap。
2. **T945 開頭多兩句**：`S2587.1`／`S2587.2` 是 `namaḥ satatāya sugatāya…`，
   PDF 第 1 會沒有；目前標 gap。
4. 只做 12 個 unit；第 2–5 會尚未詞級對齊。
5. 中文切分表只有 36＋常用詞；未收的字用單字，會拉低對齊。

## 7. 檔案

| 檔案 | 內容 |
|---|---|
| `data/mantra-word-align.tsv` | 42 列詞級對齊 |
| `data/mantra-words.tsv` | 454 個詞形、lemma、rule、count、zh_hint |
| `data/mantra-lemmas.tsv` | 446 個 lemma、變體、count |
| `data/mantra-hints.tsv` | 常用 lemma → 漢詞 |
| `data/mantra-syllables.tsv` | 中文切分表（36 單元） |
| `scripts/build-mantra-words.ts` | 詞表＋去屈折 |
| `scripts/align-mantra-words.ts` | DP 詞級對齊 |
| `scripts/check-mantra.ts` | 驗證 |

## 8. 下一步

1. 把 `mantra-syllables` 擴到 PDF 第 1 會全部常用詞。
2. 用 T944A 補 T945 缺的 `anāgāmināṃ`，校正 M1.06。
3. 把 DP 擴到 143 個 unit（先每會抽樣）。
4. 人工校對 1:2／2:1，特別是 `bodhi-satve`、`samyak-saṃbuddha`。
5. lemma 表加入 `bhyaḥ` 等 clitic 的 stopword，避免過度去尾。


