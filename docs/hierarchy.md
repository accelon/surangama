# Draft hierarchy：T945 → 卷 → 27 分節 → cut 段

> 2026-11-05。四個 draft，同一棵樹，只換 cut set。
> `sutra.json` 不動；這只是 view。

## 四個版本

| 檔案 | cut set | 段數 | 句中位／最長 | 字中位／最長 | 用途 |
|---|---|---:|---:|---:|---|
| `data/hierarchy.json` | 九家聯集（2,418 刀） | 2,423 | 1／437 | 20／2,817 | 最細；看全部注疏切點（咒語仍有 437 句大段） |
| `data/hierarchy-exact.json` | 至少一個 X265/DRBA 實錨、排除塌縮 | 1,647 | 2／438 | 32／2,845 | 註疏骨幹；保留實錨 |
| `data/hierarchy-shared2.json` | ≥2 家支持、排除塌縮 | 1,126 | 3／471 | 40／3,712 | 共識層；較少切點 |
| `data/hierarchy-coarse.json` | 容差 k=3 greedy（615 刀） | 642 | 7／442 | 94／2,936 | 粗層；給閱讀／瀏覽 |
| `data/hierarchy-all-ed.json` | 九家聯集＋咒語 editorial cuts | 2,456 | 1／37 | 20／717 | 最細；咒語每 25 phrase 一刀 |
| `data/hierarchy-coarse-ed.json` | k=3 粗層＋咒語 editorial cuts | 675 | 7／41 | 96／793 | **推薦閱讀層**；最長 41 句 |
| `data/hierarchy-exact-ed.json` | 實錨＋咒語 editorial cuts | 1,680 | 2／48 | 32／929 | 精確層；無咒語大段 |
| `data/hierarchy-shared2-ed.json` | ≥2 家＋咒語 editorial cuts | 1,159 | 3／82 | 40／1,354 | 共識層；無咒語大段 |

- `hierarchy-all-ed` 最長段 37 句（卷首序）；`hierarchy-coarse-ed` 最長 41 句，咒語段 25 句。
- 沒有 `-ed` 的版本，咒語會出現 437／422 句的大段；`-ed` 版本把咒語切成 25 句左右。

四個都是：

- 卷：11（卷首＋卷一–十）
- 分節：30 個節點（27 個原節，3 個跨卷拆開）
- 覆蓋：4,890 句；validation errors：0
- 段界若剛好是分節界、但不在 cut set，會補一個 `section-start` 段（editorial，不算注疏切點）

## 結構

```text
T945
└─ 卷（0–10）
   └─ 分節（27，跨卷拆開）
      └─ 段（cut set；分節界不在 cut set 時補 editorial 邊界）
```

節點欄位：`id`、`level`、`label`、`sid_start`、`sid_end`、`kind`、`evidence`、`children`。

## 注意

1. **咒語**：沒有 `-ed` 的版本，咒語會出現 437／422 句的大段；`-ed` 版本每 25 phrase 加一個
   `editorial` cut，把咒語段降到 25 句左右。這不是五會，而是可調的臨時切法；五會界定了再換。
2. **分節是蒙鈔目錄，不是唯一判分**：30 個節點是 27 節跨卷拆開的結果，不是 30 個新判分。
3. **coarse 有容差**：k=3 是指節點起點可落在選定 cut ±3 句內；不是精確切點，不能用來做句級對齊。
4. **hierarchy 只到段**：段以下是 `tracks-zh.tsv` 的句級軌號；兩者用 `sid` 對齊。
5. **沒有單一「最小」**：精確層與粗層並存；`track_id` 讓兩層可以互相對照。

## 重跑

```powershell
bun run scripts/build-hierarchy.ts          # all
bun run scripts/build-hierarchy.ts exact    # X265/DRBA 實錨、排除塌縮
bun run scripts/build-hierarchy.ts shared2  # ≥2 家、排除塌縮
bun run scripts/build-greedy-cuts.ts 3      # 先產生 cuts-coarse.tsv
bun run scripts/build-hierarchy.ts coarse   # k=3 粗層
bun run scripts/build-editorial-cuts.ts     # 咒語每 25 phrase 一刀
bun run scripts/build-hierarchy.ts all-ed   # all + 咒語 editorial
bun run scripts/build-hierarchy.ts coarse-ed # coarse + 咒語 editorial（推薦）
bun run scripts/build-hierarchy.ts exact-ed   # 實錨 + editorial
bun run scripts/build-hierarchy.ts shared2-ed # ≥2 家 + editorial
```



