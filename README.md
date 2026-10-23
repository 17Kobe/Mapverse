# 🌏 地圖世界

可愛遊戲風的世界股市地圖：每個國家一隻 3D 小動物 + 城市旗幟（國旗、指數點數與漲跌），開盤的動物會在國內地形上四處走動，休市的會懶洋洋地散步、停下來就睡覺 💤（系統開啟「減少動態」時也會停止走動）。
版面仿 Google 地圖：地圖上方是可橫向捲動的篩選膠囊（全球 / 亞太 / 歐洲 / 美洲 / 中東非洲 / 📊 其它指數），點區域會依該區市場位置自動放大；「其它指數」打開後列出該區域其他指數 + 黃金、原油、比特幣、匯率等（桌面在左側面板，手機是底部抽屜）。最左側是直式圖層列（手機版在底部），主選單共四項：📈 股市（目前的指數地圖）、✈️ 旅遊（美食、慶典、活動、景點、花季）、🏠 民生（電力供需、水庫蓄水、油價、菜價、空氣品質）、🌦️ 天氣災防（颱風路徑、地震、雨量）；目前「股市」「旅遊」可用，其餘兩項先放好位置，標示「即將」。

「旅遊」是同一套遊戲風的台灣地圖：只突顯台灣本島、澎湖、金門、馬祖與綠島、蘭嶼、小琉球、龜山島等離島，周邊的大陸沿海、琉球、菲律賓蓋上戰爭迷霧；上方膠囊可直接飛到各島。地點用 3D 圖示 + 旗幟標出（旗幟只寫名稱，景點青綠、餐廳橘、飯店紫），分三個顯示等級：縮小時只出現第 1 級（必去），放大才陸續出現第 2、3 級；點地點打開詳情卡（地址、Google 地圖連結）。開啟網頁時預設選「現在正在開盤」的區域。

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
  travel.json                     旅遊地圖的區域膠囊與地點
  assets/geo/                     旅遊地圖的縣市界與迷霧多邊形（由 build_tw_geo.py 產生）
scripts/fetch_quotes.py           爬蟲（純標準庫）→ 產出 site/quotes.json
scripts/build_tw_geo.py           產生 site/assets/geo/（只需執行一次）
.github/workflows/update.yml      定時任務 + 部署
```

## 常用修改

- **增刪指數**：編輯 `site/markets.json`。`type: "map"` 會出現在地圖上（要給經緯度、時區、交易時段）；`type: "bar"` 出現在「📊 其它指數」面板（`r` 填區域，`global` 是全球行情）；`type: "sub"` 是同一國家的其他指數（`of` 填主指數代碼、`abbr` 填旗幟上的短名），例如美國的那斯達克、道瓊、費城半導體，中國的深證成指、滬深300、創業板，台灣的櫃買，日本的 TOPIX，韓國的 KOSDAQ，香港的恆生科技。空間夠時旗幟會整張列出所有指數，不夠時每 4 秒輪播一個（右上角小圓點表示第幾個），點開卡片可用分頁切換。代碼就是 Yahoo Finance 的 symbol。Yahoo 沒有的指數可加 `"src"`：`"tpex"`（櫃買指數，櫃買中心官方 OpenAPI，只有日資料，盤中不會跳動）、`"yjp"`（TOPIX，抓 Yahoo!ファイナンス日本版網頁，`code` 填 `998405.T`，網頁改版會抓失敗），細節見 `scripts/fetch_quotes.py`。
- **換動物**：改 `a` 欄位的 emoji。地圖上的 3D 動物圖放在 `site/assets/animals/`，對照表在 `app.js` 的 `ANIMALS`（含面向、走路方式）；沒有對應圖檔的 emoji 會直接顯示 emoji。國旗圖在 `site/assets/flags/`，依 `flag` 欄位自動對應。
- **小角色（海洋生物、船、各地人物）**：在 `app.js` 的 `CRITTERS` 加一筆，填圖檔、經緯度和動作 `mode`（`wander` 走動、`swim` 游、`whale` 噴水、`dolphin` 跳出水面、`boat` 划船、`surf` 衝浪、`ski` 滑雪、`chase` 追逐、`still` 不動）。圖放在 `site/assets/critters/`（Fluent 3D）或 `site/assets/people/`（自繪 SVG：因紐特人、冰屋、維京長船）。會擋到市場旗幟時自動隱藏。
- **雲**：用 canvas 即時畫在 `#clouds`，固定在經緯度上，跟著地圖移動與左右循環，並隨西風慢慢往東飄。數量、風速在 `app.js` 的 `CLOUD_N`、`CLOUD_WIND`。關閉動畫或系統開啟「減少動態效果」時，雲和小角色都會停住。
- **紅漲綠跌 / 綠漲紅跌**：圖層列最下方的 ⚙️ 設定切換（預設紅漲綠跌）。
- **上帝視角的災難（股市地圖）**：在地圖上按右鍵（手機長按，或右下角的災難按鈕）選災難，預設「下雨」；選好後左鍵點地圖空白處就在那裡降下災難（點動物 / 旗幟仍是開詳情卡）。有下雨、冰雹、颱風、地震、海嘯、龍捲風、火山爆發、瘋狗浪、森林大火。效果畫在 `#fx` canvas、錨定經緯度跟著地圖移動，程式在 `site/disasters.js`：新增災難就在 `TYPES` 加一筆（icon、label、秒數），再到 `FX` 寫 `make`（產生粒子）與 `draw`（每幀畫）。`Disasters.active()` 可取得目前的災難，之後讓角色躲災難用。股市地圖的雙擊不再放大。
- **旅遊地點**：在 `site/travel.json` 的 `spots` 加一筆：`cat`（`sight` 景點 / `food` 餐廳 / `hotel` 飯店 / `event` 活動，顏色與名稱在 `app.js` 的 `TRAVEL_CATS`；活動可以多填 `months` 通常月份與 `note` 備註，會顯示在詳情卡上）、`tier`（顯示等級 1～3，1 是必去、縮小也顯示；各級出現的縮放層級在 `app.js` 的 `TIER_Z`；同級越前面越優先）、`name`、`full`（全名）、`county`、`town`、`addr`、`lon`、`lat`、`desc`、`icon`（`site/assets/travel/` 底下的 3D 圖檔名，不含 `.png`）。上方膠囊在 `areas`，`box` 是 [西經度, 南緯度, 東經度, 北緯度]。
- **新增圖層**：在 `app.js` 的 `LAYERS` 加一筆（icon、label），完成後把 `ready` 設成 `true`。
- **區域縮放**：`app.js` 的 `REGION_MIN_K` 是區域檢視的最低放大倍率；整區放不下時，權重小的市場會留在畫面外，拖曳即可看到。
- **抓取頻率**：改 `update.yml` 裡的 `cron`。

## 要知道的限制

- **遊戲風地形**（`site/terrain.js`）由瀏覽器即時繪製：AWS Terrain Tiles 的高度資料負責陸海、海深與山體光影，Esri 衛星影像只用來判斷沙漠 / 草原 / 森林 / 雪地，再套上遊戲調色盤；山脈以岩石色 + 雪線 + 光影直接畫在地表，並擺放手繪的樹與沙丘。需連網；右下角的資料來源標示請保留，商業用途請先確認 Esri 授權。
- **圖檔來源**：3D 動物與小角色（`assets/animals/`、`assets/critters/`）來自 [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji)（MIT 授權），`assets/people/` 是本專案自繪，國旗來自 [flagcdn.com](https://flagcdn.com)；都已下載到 `site/assets/`，本地執行不用再連這兩個網站。
- **旅遊地圖的地理資料**：縣市界來自內政部國土測繪中心（政府資料開放授權條款，經 [taiwan-atlas](https://github.com/dkaoster/taiwan-atlas) 轉成 TopoJSON），周邊陸地來自 [Natural Earth](https://www.naturalearthdata.com/)（公有領域）。這些多邊形也用來修正台灣附近地形的海岸（金門、廈門一帶的混濁淺海原本會被誤判成陸地），所以切過旅遊地圖後，股市地圖上這一帶的海岸也會一起變準。東沙、南沙（太平島）目前不在範圍內。

- **不是真正的實時**：Yahoo 免費資料本來就約延遲 15 分鐘；GitHub 的定時任務也可能晚幾分鐘到更久。想要秒級跳動需要付費資料來源 + WebSocket，不在免費範圍。
- **Yahoo 是非官方介面**，偶爾限流或改版。某個代碼抓失敗時會沿用上一版並標 ⚠️；如果有指數一直沒資料，到 Yahoo 網站搜一下正確代碼，改 `markets.json`（部分代碼如 `^J200.JO`、`^IPSA` 目前會抓失敗，請部署後確認）。
- **假日**：開盤狀態按常規時段推算；遇到假日，資料 3 小時沒更新就會自動顯示休市。
- **60 天規則**：公開儲存庫如果 60 天沒有任何提交，GitHub 會暫停定時任務。到 Actions 頁面重新啟用，或隨便提交一次即可。
- **私有儲存庫**每月只有 2000 分鐘免費額度，每 10 分鐘抓一次會超；請改成公開儲存庫或把 cron 調疏。
- 僅供娛樂參考，不構成投資建議。
