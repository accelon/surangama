# 鏡像 nissaya.cn 開 brotli：可行性、效益與 runbook

日期 2026-11-12。**狀態：未執行**——`yap` 帳號在鏡像上 `sudo` 需要密碼（實測 `sudo: a password is required`），
所有寫入動作都要 root。本檔是把話說清楚之後要動時照著做的清單；調查命令都在
`build/_probe-nginx.mjs`、`build/_probe-nginx2.mjs`、`build/_probe-brotli-config.mjs`（皆唯讀）。

## 一、實測到的現況

| | 主站 shutonggui.cn | 鏡像 nissaya.cn |
|---|---|---|
| 系統 | Ubuntu 24.04 LTS | **Ubuntu 20.04 LTS (focal)** |
| Web | Apache 2.4.58 | nginx 1.18.0-0ubuntu1.7 |
| brotli | **已開**：`brotli_module (shared)`、`/etc/apache2/mods-available/brotli.load` | 未開，只有 `gzip_static on`（`nginx.conf:49`） |
| 同一請求實測 | `Content-Encoding: br`，3,777,995 bytes | `Content-Encoding: gzip`，3,814,089 bytes |
| 前置 CDN | 無（Server 直接露 nginx/apache，无 cf-ray） | 同左 |
| 動態模組機制 | — | `/etc/nginx/modules-enabled/*.conf` 已被 include ✓ |
| 編譯環境 | — | `build-essential 12.8ubuntu1.1`、`dpkg-dev 1.19.7`、`git 2.25.1` 已裝；`libbrotli-dev`、`devscripts`、`equivs` **未裝**（repo 有）；`deb-src` 已開，`apt-get source nginx` 可取（1,979 kB） |
| 資源 | — | 2 GB RAM（可用 1.4 GB）、`/` 77% 已用、剩 12 GB |

focal 的 apt 裡查不到 brotli 的 nginx 模組套件（三個名字 `apt-cache policy` 都空、`apt-get install -s` 回
`Unable to locate package`）。有 brotli 相關的是 `libbrotli1`、`libbrotli-dev`、`brotli` CLI，
**沒有** `libnginx-mod-http-brotli-filter` / `-static`（那是 22.04 以後才有）。

## 二、效益要先算清楚（這決定向不向做）

用實際要發布的檔案量（`zlib` q11／level 9）：

| 檔案 | 原始 | gzip | brotli | br 比 gz 省 |
|---|---:|---:|---:|---:|
| `surangama.html` | 5,235,905 | 3,814,089 | 3,777,995 | **0.9%** |
| `vcpp.html` | 3,185,295 | 2,256,736 | 2,223,433 | **1.5%** |
| `surangama-cidian.html` | 367,159 | 261,682 | 252,677 | 3.4% |
| `index.html`（小 HTML） | 14,581 | 9,340 | 8,451 | 9.5% |

原因：我們的單檔主體是 **base64 編碼的 gzip 資料**（build 輸出：gzip 3.56 MiB → base64 4.74 MiB）。
gzip 已經把 base64 膨脹回去大部分，brotli 在同一段上再省只剩 1% 上下。
文字型頁面（文章、目錄頁）才是 brotli 有感的場合（3%–10%）。

**結論建議**：若目的只是讓那两个 5 MB／3 MB 的閱讀器單檔再省幾十字 KB，**不值得**在 2 GB RAM 的
生產機上編譯 nginx 模組。若目的是讓**整站**（含大量文字頁）與主站行為一致，就做，
並且照下面的保守配置：**只開 `brotli_static`（送我們已經上傳的 `*.br`），不開 `brotli on`（不即時壓縮）**——
CPU 幾乎為零，風險主要在模組加載本身。

## 三、runbook（需要 root；在鏡像 nissaya.cn 上）

### 0. 先留底

```bash
sudo cp -a /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak-$(date +%F-%H%M)
sudo cp -a /etc/nginx/modules-enabled /etc/nginx/modules-enabled.bak-$(date +%F-%H%M)
nginx -v            # 記下：必須編出同版本的模組，否則 load 不起來
nginx -V 2>&1 | tr ' ' '\n' > /tmp/nginx-flags.txt
```

### 1. 装建環境與源碼

```bash
sudo apt update
sudo apt install -y libbrotli-dev devscripts equivs build-essential dpkg-dev git
cd /tmp && apt-get source nginx=1.18.0-0ubuntu1.7     # 版本要跟 installed 完全一致
```

### 2. 取 ngx_brotli（注意網路）

```bash
git clone --depth 1 --recursive https://github.com/google/ngx_brotli.git
```

本機環境經驗：`github.com` 與 `raw.githubusercontent.com` 常被 connection reset（jsDelivr 可行）。
鏡像在广州腾讯云，出口政策不同——**先試這一條確認抓得到**；抓不到就走 codeload tarball
或從本機 scp 上去（本機有 `D:\2026\_deps` 之类的離線包习惯）。

### 3. 用「與 nginx -V 完全相同的編譯旗標」只編動態模組

```bash
cd /tmp/nginx-1.18.0
./configure $(grep -o -- '--[^ ]*' /tmp/nginx-flags.txt | tr '\n' ' ') \
  --add-dynamic-module=/tmp/ngx_brotli
make -j2 modules          # 只 make modules，不要 make && make install（那會換掉整套 nginx）
```

產物應是 `objs/ngx_http_brotli_filter_module.so` 與 `objs/ngx_http_brotli_static_module.so`。

### 4. 安装模組與設定（保守：只 static）

```bash
sudo cp objs/ngx_http_brotli_*_module.so /usr/share/nginx/modules/
sudo tee /etc/nginx/modules-enabled/60-mod-http-brotli.conf >/dev/null <<'EOF'
load_module modules/ngx_http_brotli_filter_module.so;
load_module modules/ngx_http_brotli_static_module.so;
EOF
```

`nginx.conf` 的 `http {}` 內加（緊挨現有的 `gzip_static on;`）：

```nginx
brotli_static on;                 # 只送現成的 *.br，不即時壓
brotli_types text/html text/css application/javascript application/json image/svg+xml font/woff2;
```

> `brotli_static` 需要 `*.br` 與原檔同目錄同名——這次發布已經開始傳 `surangama.html.br`；
> **其他工作區的檔在鏡像上還沒有 `.br`**（主站有 mod_brotli 即時壓所以看不出差異）。
> 也就是說：開了 static 之後，只有帶 `.br` 的檔會走 brotli，其餘仍是 gzip，不會出錯但也不会全部命中。
> 各工作區的發布脚本都該像 `surangama/scripts/deploy-incubator.mjs` 一樣同時產 `.gz`＋`.br`。

### 5. 驗證與回滾

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -sI -H 'Accept-Encoding: br, gzip' http://127.0.0.1/incubator/surangama.html \
  | grep -iE 'content-encoding|content-length'      # 期望：br ＋ 3777995
curl -sI -H 'Accept-Encoding: gzip' https://nissaya.cn/incubator/surangama.html \
  | grep -i content-encoding                        # 期望：gzip（沒開即時 brotli 的客戶端照樣可用）
```

回滚（雨步，几秒钟）：

```bash
sudo rm /etc/nginx/modules-enabled/60-mod-http-brotli.conf
sudo cp -a /etc/nginx/nginx.conf.bak-<時間戳> /etc/nginx/nginx.conf
sudo nginx -t && sudo systemctl reload nginx
```

## 四、另一條路（如果願意排程）

**查證過的套件可用性**（`build/_probe-2404.mjs`，在主站 24.04 上問 apt）：

| 套件名 | focal 20.04（鏡像） | 24.04（主站同代） |
|---|---|---|
| `libnginx-mod-http-brotli-filter` | ✗ 查無（`Unable to locate package`） | ✓ `1.0.0~rc-5build1` |
| `libnginx-mod-http-brotli-static` | ✗ 同上 | ✓ `1.0.0~rc-5build1` |

主站那边的 brotli 不是一套額外东西：Apache 2.4.58 自带 `mod_brotli`
（`apache2ctl -M` → `brotli_module (shared)`；`/etc/apache2/mods-available/brotli.load`；
`dpkg -l | grep brotli` 只列 `libbrotli1 1.1.0-2build2`，也就是隨 apache2 一起裝的）。

所以鏡像若要走套件路，就是把 **20.04 升到 22.04／24.04**，然後
`sudo apt install libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static`
再 `brotli on; brotli_static on;`（或依 §三 的保守做法只開 static）。這是**整機升級**，
涉及 PHP／TLS 政策／cron 的連動，不屬於本工作區能負責的變更；要動就當一次獨立維護視窗規劃，
順便解決 20.04 已過標準支援期的問題。

## 五、我這一側能做的（不需要 root）

1. 已讓 `surangama` 的發布同時產 `*.br`＋`*.gz`（`scripts/deploy-incubator.mjs`，2026-11-12）。
2. 可以把同樣的產生邏輯補給其他工作區（`vcpp`、`shl`、`hdnj`、文章頁），如鏡像將來開了
   `brotli_static` 就能全部命中，不用等即時壓縮。
3. 可以寫一個驗證脚本逐檔比對兩站的 `Content-Encoding` 與大小，當作每次發布後的固定檢查。

要不要我做第 2、3 項？（鏡像那边的 root 操作我不能代做，也不會去碰别的站的文件。）
