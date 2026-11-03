# 🌏 地圖世界

可愛遊戲風的世界股市地圖：每個國家一隻 3D 小動物 + 城市旗幟（國旗、指數點數與漲跌），開盤的動物會在國內地形上四處走動，休市的會懶洋洋地散步、停下來就睡覺 💤（系統開啟「減少動態」時也會停止走動）。
版面仿 Google 地圖：地圖上方是可橫向捲動的篩選膠囊。左半（全球 / 亞太 / 美洲 / 歐洲 / 中東非洲）只顯示股票，點區域會依該區市場位置自動放大；右半（🛢️ 商品 / 🏦 債券 / 🏛️ 利率 / 💱 匯率 / ⚔️ 地緣 / 📊 經濟數據）只顯示對應主題的卡片，卡片樣式和股市旗幟相同，標題是國家，電腦版放在各自國家附近，手機版排成左右兩欄。央行與白宮的建築圖示、地緣的動畫圖示（休戰的和平鴿、衝突的交擊雙劍）不論哪個篩選都留在地圖上。網址加上 `#fx`、`#geo`、`#asia` 這類片段可以直接開在指定篩選。最左側是直式圖層列（手機版在底部），主選單共四項：📈 股市（目前的指數地圖）、✈️ 旅遊（美食、慶典、活動、景點、花季）、🏠 民生（電力供需、水庫蓄水、油價、菜價、空氣品質）、🌦️ 天氣災防（颱風路徑、地震、雨量）；目前「股市」「旅遊」可用，其餘兩項先放好位置，標示「即將」。

股市地圖的台灣島上蓋著台股市值前十大公司的建築（`site/corps.js`）：縮小時前 3 大（台積電、聯發科、台達電）合成一座小城市；放大到台灣夠大時，10 棟建築各自蓋在公司總部所在地並掛上招牌。建築跟著台股加權指數變化：上漲亮燈、下跌變暗，漲超過 2% 放煙火，跌超過 2% 烏雲打雷下雨。建築造型參考模擬城市 4 封面（細長玻璃高樓、層層退縮、斜切或尖頂樓冠、塔吊、停機坪），各公司商標直接嵌在大樓正面上方（商標圖在 `site/corp-logos.js`，沒有商標圖時顯示公司名稱）。市值與總部資料的備用值寫在 `corps.js` 的 `CORPS`；市值與名次平常由 iKDx-realtime 的 `tw-top.json` 每天自動更新。

「旅遊」是同一套遊戲風的台灣地圖：只突顯台灣本島、澎湖、金門、馬祖與綠島、蘭嶼、小琉球、龜山島等離島，周邊的大陸沿海、琉球、菲律賓蓋上戰爭迷霧；上方膠囊可直接飛到各島。地點用 3D 圖示 + 旗幟標出（旗幟只寫名稱，景點青綠、餐廳橘、飯店紫），分三個顯示等級：縮小時只出現第 1 級（必去），放大才陸續出現第 2、3 級；點地點打開詳情卡（地址、Google 地圖連結）。開啟網頁時預設選「現在正在開盤」的區域。

**全部免費**：Cloudflare Pages 託管網頁，行情資料由 [iKDx-realtime](https://github.com/kobe-cht/iKDx-realtime) 統一抓取並發佈（Yahoo Finance、CNBC、證交所等來源，多來源備援），本專案沒有伺服器、沒有爬蟲、沒有 API key。

## 資料從哪來

本專案**只有前端**。網頁載入時直接讀 iKDx-realtime 發佈的檔案（網址在 `site/app.js` 的 `DATA_BASE`，預設 `https://ikdx-realtime.pages.dev/data/world/`，已開放 CORS）：

| 檔案           | 內容                                                       | 用在                         |
| -------------- | ---------------------------------------------------------- | ---------------------------- |
| `quotes.json`  | `markets.json` 所有代碼的報價（指數、商品、匯率、加密貨幣、公債殖利率） | 旗幟、主題卡片、概況卡       |
| `tw-top.json`  | 台股市值排行（證交所，收盤價 × 已發行股數）               | 台灣島上的前十大公司建築     |

抓取由 iKDx-realtime 的 `fetch-world-realtime.yml` 負責（cloudflare-cron-worker 平日每 10 分鐘、週末每小時觸發），每個代碼依序嘗試多個來源，細節見該專案的 README。連不上資料來源時，股市頁顯示隨機的「演示資料」，台股建築沿用 `corps.js` 內建的市值。

## 部署步驟（Cloudflare Pages，約 5 分鐘）

1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**，選這個儲存庫（`17Kobe/Mapverse`）。
2. Production branch：`main`；Framework preset：`None`；Build command：留空；**Build output directory：`site`**。
3. **Save and Deploy**，完成後開啟 `https://<專案名>.pages.dev/`，手機用「新增到主螢幕」就像 App。

之後每次 push 到 `main` 都會自動重新部署。行情是網頁直接向 iKDx-realtime 讀取，**不需要**重新部署就會更新。

> 本機預覽（Windows）：直接雙擊 `start_local.bat`，或執行 `python scripts/serve_local.py`，開啟 `http://localhost:8000/`。不能直接雙擊 `index.html`，瀏覽器的 CORS 限制會擋掉 `markets.json`。
>
> 本地預覽（手動）：`cd site && python3 -m http.server 8000`。連不上行情來源時會顯示隨機的「演示資料」。
>
> 嵌入模式：網址加上 `?embed=1`（例如 `https://<專案名>.pages.dev/?embed=1`）只會顯示股市地圖，隱藏上方的概況卡（全球情緒、更新時間）與圖層列，適合用 `<iframe>` 嵌進其它網站（例如 iKDx 的「探索」分頁）。不加參數時一切照舊。

## 檔案結構

```
site/
  index.html  style.css  app.js   前端（d3 + SVG，無需構建）
  markets.json                    所有市場 / 指數 / 商品的設定（改這個就能增刪）
  corps.js  corp-logos.js         台灣島上的前十大公司建築與商標
  travel.json                     旅遊地圖的區域膠囊與地點
  assets/geo/                     旅遊地圖的縣市界與迷霧多邊形（由 build_tw_geo.py 產生）
scripts/serve_local.py            本機預覽伺服器
scripts/build_tw_geo.py           產生 site/assets/geo/（只需執行一次）
```

## 常用修改

- **增刪指數**：編輯 `site/markets.json`。`type: "map"` 會出現在地圖上（要給經緯度、時區、交易時段）；`type: "bar"` 是商品、債券、匯率這類只抓行情、不上地圖的代碼，由 `topics` 的卡片引用；`type: "sub"` 是同一國家的其他指數（`of` 填主指數代碼、`abbr` 填旗幟上的短名），例如美國的那斯達克、道瓊、費城半導體，中國的深證成指、滬深300、創業板，台灣的櫃買，日本的 TOPIX，韓國的 KOSDAQ，香港的恆生科技。空間夠時旗幟會整張列出所有指數，不夠時每 4 秒輪播一個（右上角小圓點表示第幾個），點開卡片可用分頁切換。`s` 是 Yahoo Finance 的 symbol（Yahoo 沒有的指數與殖利率，其資料來源在 iKDx-realtime 設定）。**新增代碼後要到 iKDx-realtime 執行 `npm run sync-world`，補上該代碼的抓取來源再 push，否則網頁抓不到報價。**
- **台股前十大建築**：市值與名次由 `tw-top.json` 每天自動更新，名次變動時建築上的名次、大小自動跟著變，掉出前十的公司建築會收起來。排行中出現還沒設計過建築的公司時，只會列在詳情卡的清單；要幫它蓋建築，在 `site/corps.js` 的 `CORPS` 加一筆（代碼、名稱、總部經緯度與地址、品牌色、`kind`），並在 `ART` 加對應的造型。
- **主題卡片**：`site/markets.json` 的 `topics` 每一筆是一張卡片：`cat` 是篩選（`commodity` / `bond` / `rate` / `fx` / `geo` / `econ`），`short` 與 `flag` 是標題的國家，`lon` / `lat` 是放置的位置，`rows` 是列。有行情的列填 `s`（對應 `items` 的代碼）與 `l`（名稱），債券加 `"k": "y"`（以 bp 顯示變動），`calc` 可算兩個代碼的差（例如 10Y-2Y 利差）；手動維護的列填 `l` 與 `v`（數值），可加 `d`（和前期的差）、`tone`（`ok` / `warn` / `bad` 決定顏色），純文字說明用 `note`；`stamp` 是標題右側的資料期間。**利率、地緣、經濟數據目前是手動整理的資料，不會自動更新，需要時直接改這裡。** `landmarks` 是永遠留在地圖上的圖示（央行、白宮、地緣動畫），`card` 指向點擊後要開啟的卡片。
- **換動物**：改 `a` 欄位的 emoji。地圖上的 3D 動物圖放在 `site/assets/animals/`，對照表在 `app.js` 的 `ANIMALS`（含面向、走路方式）；沒有對應圖檔的 emoji 會直接顯示 emoji。國旗圖在 `site/assets/flags/`，依 `flag` 欄位自動對應。
- **小角色（海洋生物、船、各地人物）**：在 `app.js` 的 `CRITTERS` 加一筆，填圖檔、經緯度和動作 `mode`（`wander` 走動、`swim` 游、`whale` 噴水、`dolphin` 跳出水面、`boat` 划船、`surf` 衝浪、`ski` 滑雪、`chase` 追逐、`still` 不動）。圖放在 `site/assets/critters/`（Fluent 3D）或 `site/assets/people/`（自繪 SVG：因紐特人、冰屋、維京長船）。會擋到市場旗幟時自動隱藏。
- **雲**：用 canvas 即時畫在 `#clouds`，固定在經緯度上，跟著地圖移動與左右循環，並隨西風慢慢往東飄。數量、風速在 `app.js` 的 `CLOUD_N`、`CLOUD_WIND`。關閉動畫或系統開啟「減少動態效果」時，雲和小角色都會停住。
- **紅漲綠跌 / 綠漲紅跌**：圖層列最下方的 ⚙️ 設定切換（預設紅漲綠跌）。
- **上帝視角的災難（股市地圖）**：在地圖上按右鍵（手機長按，或右下角的災難按鈕）選災難，預設「下雨」；選好後左鍵點地圖空白處就在那裡降下災難（點動物 / 旗幟仍是開詳情卡）。有下雨、冰雹、颱風、地震、海嘯、龍捲風、火山爆發、瘋狗浪、森林大火。效果畫在 `#fx` canvas、錨定經緯度跟著地圖移動，程式在 `site/disasters.js`：新增災難就在 `TYPES` 加一筆（icon、label、秒數），再到 `FX` 寫 `make`（產生粒子）與 `draw`（每幀畫）。`Disasters.active()` 可取得目前的災難，之後讓角色躲災難用。股市地圖的雙擊不再放大。
- **旅遊地點**：在 `site/travel.json` 的 `spots` 加一筆：`cat`（`sight` 景點 / `food` 餐廳 / `hotel` 飯店 / `event` 活動，顏色與名稱在 `app.js` 的 `TRAVEL_CATS`；活動可以多填 `months` 通常月份與 `note` 備註，會顯示在詳情卡上）、`tier`（顯示等級 1～3，1 是必去、縮小也顯示；各級出現的縮放層級在 `app.js` 的 `TIER_Z`；同級越前面越優先）、`name`、`full`（全名）、`county`、`town`、`addr`、`lon`、`lat`、`desc`、`icon`（`site/assets/travel/` 底下的 3D 圖檔名，不含 `.png`）。上方膠囊在 `areas`，`box` 是 [西經度, 南緯度, 東經度, 北緯度]。
- **新增圖層**：在 `app.js` 的 `LAYERS` 加一筆（icon、label），完成後把 `ready` 設成 `true`。
- **區域縮放**：`app.js` 的 `REGION_MIN_K` 是區域檢視的最低放大倍率；整區放不下時，權重小的市場會留在畫面外，拖曳即可看到。
- **抓取頻率 / 來源**：在 iKDx-realtime 設定（cloudflare-cron-worker 的排程、`world_markets.json` 的來源順序），本專案不用動。

## 要知道的限制

- **遊戲風地形**（`site/terrain.js`）由瀏覽器即時繪製：AWS Terrain Tiles 的高度資料負責陸海、海深與山體光影，Esri 衛星影像只用來判斷沙漠 / 草原 / 森林 / 雪地，再套上遊戲調色盤；山脈以岩石色 + 雪線 + 光影直接畫在地表，並擺放手繪的樹與沙丘。需連網；右下角的資料來源標示請保留，商業用途請先確認 Esri 授權。
- **圖檔來源**：3D 動物與小角色（`assets/animals/`、`assets/critters/`）來自 [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji)（MIT 授權），`assets/people/` 是本專案自繪，國旗來自 [flagcdn.com](https://flagcdn.com)；都已下載到 `site/assets/`，本地執行不用再連這兩個網站。
- **旅遊地圖的地理資料**：縣市界來自內政部國土測繪中心（政府資料開放授權條款，經 [taiwan-atlas](https://github.com/dkaoster/taiwan-atlas) 轉成 TopoJSON），周邊陸地來自 [Natural Earth](https://www.naturalearthdata.com/)（公有領域）。這些多邊形也用來修正台灣附近地形的海岸（金門、廈門一帶的混濁淺海原本會被誤判成陸地），所以切過旅遊地圖後，股市地圖上這一帶的海岸也會一起變準。東沙、南沙（太平島）目前不在範圍內。

- **不是真正的實時**：免費資料本來就約延遲 15 分鐘；GitHub Actions 的觸發也可能晚幾分鐘。想要秒級跳動需要付費資料來源 + WebSocket，不在免費範圍。
- **來源是非官方介面**（Yahoo、CNBC），偶爾限流或改版。每個代碼有多個來源備援，全部失敗才會沿用上一版並標 ⚠️。智利指數用 Yahoo 的 MSCI IPSA（`MXIPSAPC.SN`），點數與 S&P CLX IPSA 不同。
- **假日**：開盤狀態按常規時段推算；遇到假日，資料 3 小時沒更新就會自動顯示休市。
- 僅供娛樂參考，不構成投資建議。
