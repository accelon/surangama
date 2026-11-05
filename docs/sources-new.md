# 新增三種材料：藏譯、Edkins 英譯、蒙鈔（2026-11-04）

> 對應作者指示：加藏譯本、Joseph Edkins 英譯、錢謙益《楞嚴經疏解蒙鈔》被乾隆削本要補。

## 1. 藏譯本 ✅（全文已到手）

- **藏文題名**：`de bzhin gshegs pa'i gsang ba sgrub pa'i don mngon par thob pa'i rgyu byang chub sems dpa' thams cad kyi spyod pa rgya mtsho ston pa sangs rgyas kyi gtsug tor dpa' bar 'gro ba zhes bya ba theg pa chen po'i mdo`
  （漢：大佛頂如來密因修證了義諸菩薩萬行首楞嚴經）
- **來源**：[rkts.org H259](http://www.rkts.org/etexts/tcompleteu.php?coll=H&id=H259)（Resources for Kanjur & Tanjur Studies，ACIP/ALL e-text；H = 布達拉宮本系統）
- **規模**：10 個 bam po、419,775 字元；卷末有譯跋，明說「རྒྱ་ལས་བསྒྱུར་བའོ」（譯自漢文）。
- **檔案**：
  - `vendor/tibetan/shurangama-bo.txt`（全文）
  - `data/tibetan.json`（依 bam po 分 10 段）
- **待核**：咒段（tadyathā）在藏文裡找不到對應轉寫，可能節略或改用其他形式；藏文 bam po 與漢文十卷的對應也還沒做。
- 同一個數位典藏目錄（[digitalarchives.tw](https://catalog.digitalarchives.tw/item/00/31/06/4e.html)）另記有滿文譯本，可作旁證。

## 2. Joseph Edkins 英譯 ✅（節譯，已抽出）

- **出處**：Joseph Edkins, *Chinese Buddhism*（1893 增訂版），第十八章〈The Leng-yen-king〉。
- **範圍**：只譯到「十八界」，作者自己在章末寫「So ends the first chapter of this book」；不是全經。
- **規模**：28,344 字元、約 4,400 詞。
- **檔案**：
  - `vendor/english/edkins-chinese-buddhism-1893.txt`（全書 OCR 文字，1.12 MiB）
  - `vendor/english/edkins-leng-yen-king.txt`（抽出該章）
- **版權**：1880／1893 出版，公版。
- 來源：[archive.org: chinesebuddhismv00edki](https://archive.org/details/chinesebuddhismv00edki)。

## 3. 錢謙益《楞嚴經疏解蒙鈔》◐（找到未削本，待對勘）

- **流通本**：卍續藏 X287（CBETA），一般認為是乾隆削板後的本子（作者指示）。
- **未削本**：嘉興藏（萬曆版大藏經）本，東京大學總合圖書館藏，**CC BY 4.0** 開放：
  - 續第 26 帙 第 1–12 冊，共 **1,058 頁**，IIIF manifest：
    `https://dzkimgs.l.u-tokyo.ac.jp/kakouzou/KA026_01/manifest3.json`（01–12）
  - 例：第 5 冊 = 蒙鈔 卷 4a／4b，119 頁。
  - 入口：[UTokyo Digital Archive](https://da.dl.itc.u-tokyo.ac.jp/portal/en/assets/69c4c3d4-10d1-48ce-8606-94cf6263d276)。
- **另存目**：乾隆藏 No. 1653（[數位典藏](https://catalog.digitalarchives.tw/item/00/25/bb/64.html)）可作第三個見證。
- **下一步**：
  1. 抓 12 冊 IIIF 圖（1,058 頁）→ OCR（或先人工看卷四樣本）。
  2. 與 X287 逐卷對勘，列出被刪段落。
  3. 把補回的文字併進 `data/works/X287.json`（或另立 `X287-full`）。

## 檔案清單

| 檔案 | 內容 |
|---|---|
| `vendor/tibetan/shurangama-bo.txt` | 藏譯全文（419,775 字元） |
| `data/tibetan.json` | 藏譯分 bam po |
| `vendor/english/edkins-chinese-buddhism-1893.txt` | Edkins 全書 OCR |
| `vendor/english/edkins-leng-yen-king.txt` | Edkins 楞嚴章 |
| `vendor/mengchao/KA026_05.manifest.json` | 嘉興藏蒙鈔第 5 冊 IIIF manifest |
