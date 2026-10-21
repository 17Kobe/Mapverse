# 🌏 股市大冒險 · 世界指數地圖

可愛遊戲風的世界股市地圖：每個國家一隻 3D 小動物 + 城市旗幟（國旗、指數點數與漲跌），開盤的動物會在國內地形上四處走動，休市的會懶洋洋地散步、停下來就睡覺 💤（系統開啟「減少動態」時也會停止走動）。
版面仿 Google 地圖：地圖上方是可橫向捲動的篩選膠囊（自動 / 全球 / 亞太 / 歐洲 / 美洲 / 中東非洲 / 📊 其它指數），點區域會依該區市場位置自動放大；「其它指數」打開後列出該區域其他指數 + 黃金、原油、比特幣、匯率等（桌面在左側面板，手機是底部抽屜）。最左側是直式圖層列（手機版在底部），目前只有「股市」，美食景點、水電天氣、海潮、日出先放好位置，標示「即將」。手機預設自動切到「現在正在開盤」的區域。

**全部免費**：GitHub Pages 託管網頁，GitHub Actions 定時抓資料（Yahoo Finance），沒有伺服器、沒有 API key。

## 部署步驟（約 5 分鐘）

1. 在 GitHub 新建一個 **Public** 儲存庫（公開儲存庫的 Actions 分鐘數免費且無限制），把這個資料夾裡的所有檔案上傳（含隱藏的 `.github` 資料夾）。
2. 儲存庫 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
3. 進 **Actions** 頁面，點「更新資料並部署」→ **Run workflow**，等約 1 分鐘變綠。
4. 開啟 `https://你的使用者名稱.github.io/儲存庫名/`，手機用「新增到主螢幕」就像 App。

之後 Actions 會自動：工作日每 10 分鐘、週末每 4 小時抓一次資料並重新部署。

> 本機預覽（Windows）：直接雙擊 `start_local.bat`，或執行 `python scripts/serve_local.py`，會先抓一次真實報價再開啟 `http://localhost:8000/`。加上 `--no-fetch` 可跳過抓取。不能直接雙擊 `index.html`，瀏覽器的 CORS 限制會擋掉 `markets.json`。
>
> 本地預覽（手動）：`cd site && python3 -m http.server 8000`，沒有 `quotes.json` 時會顯示隨機的「演示資料」。

## 檔案結構

```
site/
  index.html  style.css  app.js   前端（d3 + SVG，無需構建）
  markets.json                    所有市場 / 指數 / 商品的設定（改這個就能增刪）
scripts/fetch_quotes.py           爬蟲（純標準庫）→ 產出 site/quotes.json
.github/workflows/update.yml      定時任務 + 部署
```

## 常用修改

- **增刪指數**：編輯 `site/markets.json`。`type: "map"` 會出現在地圖上（要給經緯度、時區、交易時段）；`type: "bar"` 出現在「📊 其它指數」面板（`r` 填區域，`global` 是全球行情）；`type: "sub"` 是同一國家的其他指數（`of` 填主指數代碼、`abbr` 填旗幟上的短名），例如美國的那斯達克、道瓊、費半。空間夠時旗幟會整張列出所有指數，不夠時每 4 秒輪播一個（右上角小圓點表示第幾個），點開卡片可用分頁切換。代碼就是 Yahoo Finance 的 symbol。
- **換動物**：改 `a` 欄位的 emoji。地圖上的 3D 動物圖放在 `site/assets/animals/`，對照表在 `app.js` 的 `ANIMALS`（含面向、走路方式）；沒有對應圖檔的 emoji 會直接顯示 emoji。國旗圖在 `site/assets/flags/`，依 `flag` 欄位自動對應。
- **紅漲綠跌 / 綠漲紅跌**：圖層列最下方的 ⚙️ 設定切換（預設紅漲綠跌）。
- **新增圖層**：在 `app.js` 的 `LAYERS` 加一筆（icon、label），完成後把 `ready` 設成 `true`。
- **區域縮放**：`app.js` 的 `REGION_MIN_K` 是區域檢視的最低放大倍率；整區放不下時，權重小的市場會留在畫面外，拖曳即可看到。
- **抓取頻率**：改 `update.yml` 裡的 `cron`。

## 要知道的限制

- **遊戲風地形**（`site/terrain.js`）由瀏覽器即時繪製：AWS Terrain Tiles 的高度資料負責陸海、海深與山體光影，Esri 衛星影像只用來判斷沙漠 / 草原 / 森林 / 雪地，再套上遊戲調色盤；山脈以岩石色 + 雪線 + 光影直接畫在地表，並擺放手繪的樹與沙丘。需連網；右下角的資料來源標示請保留，商業用途請先確認 Esri 授權。
- **圖檔來源**：3D 動物來自 [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji)（MIT 授權），國旗來自 [flagcdn.com](https://flagcdn.com)；都已下載到 `site/assets/`，本地執行不用再連這兩個網站。

- **不是真正的實時**：Yahoo 免費資料本來就約延遲 15 分鐘；GitHub 的定時任務也可能晚幾分鐘到更久。想要秒級跳動需要付費資料來源 + WebSocket，不在免費範圍。
- **Yahoo 是非官方介面**，偶爾限流或改版。某個代碼抓失敗時會沿用上一版並標 ⚠️；如果有指數一直沒資料，到 Yahoo 網站搜一下正確代碼，改 `markets.json`（部分代碼如 `^J200.JO`、`^TWOII` 請部署後確認）。
- **假日**：開盤狀態按常規時段推算；遇到假日，資料 3 小時沒更新就會自動顯示休市。
- **60 天規則**：公開儲存庫如果 60 天沒有任何提交，GitHub 會暫停定時任務。到 Actions 頁面重新啟用，或隨便提交一次即可。
- **私有儲存庫**每月只有 2000 分鐘免費額度，每 10 分鐘抓一次會超；請改成公開儲存庫或把 cron 調疏。
- 僅供娛樂參考，不構成投資建議。
