/* 股市村 */
(function () {
    'use strict';

    const $t = I18n.t; // 多語系：以繁體中文原文當 key（見 i18n.js）

    const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
    // 行情資料由 iKDx-realtime 專案統一抓取並發佈（quotes.json 各國指數 / 商品 / 匯率 / 殖利率，tw-top.json 台股市值排行）。
    // 本機要改用別的來源時，在 index.html 先設定 window.MAPVERSE_DATA_BASE
    const DATA_BASE = window.MAPVERSE_DATA_BASE || 'https://ikdx-realtime.pages.dev/data/world/';

    // 篩選：全球 / 亞太 / 美洲 / 歐洲 / 中東非洲只顯示股票（縮放範圍由該區市場的實際位置計算，見 regionTransform）。
    // 商品 / 債券 / 利率 / 匯率 / 地緣 / 經濟數據是另一組篩選，只顯示 markets.json 的 topics（股票動物與旗幟都收起來）。
    // mlon：手機版地圖的中心經度（手機上卡片排成左右兩欄，地圖只當背景）
    const GLOBAL_LON = 196; // 手機版全球檢視（和大部分主題篩選）的中心經度：太平洋
    const GLOBAL_LEFT_LON = -155; // 桌機版全球檢視的左邊界經度
    const TOPICS = {
        // 物件的順序就是篩選列的順序：商品、匯率、經濟數據、債券、利率、地緣
        commodity: { icon: '🛢️', label: $t('商品'), mlon: -35 }, // 大西洋：左邊看到一點美洲、右邊看到一點歐洲
        fx: { icon: '💵', label: $t('匯率'), mlon: GLOBAL_LON },
        // img：篩選按鈕改用 3D 圖片（系統 emoji 的長條圖太陽春）；icon 仍用在文字場合
        econ: { icon: '📊', img: 'assets/icons/bar_chart.png', label: $t('全球市場'), mlon: GLOBAL_LON },
        bond: { icon: '🏦', label: $t('債券'), mlon: GLOBAL_LON },
        rate: { icon: '🏛️', label: $t('利率'), mlon: GLOBAL_LON },
        geo: { icon: '⚔️', label: $t('地緣'), mlon: 85 },
    };
    // 地緣狀態的色帶與文字顏色
    const TONES = { ok: '#79e3a0', warn: '#ffc66b', bad: '#ff8d85' };
    const TONE_BAND = { ok: '#2b7a4d', warn: '#9a6a17', bad: '#8d2c2c' };
    // 區域檢視至少放大幾倍；塞不下的小市場會留在畫面外（拖曳即可看到）
    const REGION_MIN_K = 1.5;
    const REGION_MAX_K = 5;

    // 左側圖層列（手機版是底部導覽列）。之後要加新地圖，在這裡加一筆並把 ready 設成 true 即可
    const LAYERS = [
        {
            k: 'stocks',
            icon: '📈',
            label: $t('全球市場'),
            title: $t('全球市場'),
            desc: $t('指數、商品、匯率、債券、利率、全球市場、地緣'),
            ready: true,
        },
        { k: 'picks', icon: '📊', label: $t('個股'), title: $t('個股'), desc: $t('個股報價、走勢與公司資訊') },
        { k: 'holdings', icon: '💼', label: $t('持倉'), title: $t('持倉'), desc: $t('我的持股、成本與損益') },
        { k: 'balance', icon: '⚖️', label: $t('資產負債'), title: $t('資產負債'), desc: $t('資產、負債與淨值') },
    ];
    // 左側圖層列的簡單線條圖示（取代 emoji，風格更統一乾淨）：key 對應 LAYERS 的 k
    const RAIL_ICONS = {
        stocks: '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/>',
        picks: '<line x1="6" y1="20" x2="6" y2="14" stroke-width="3"/><line x1="12" y1="20" x2="12" y2="4" stroke-width="3"/><line x1="18" y1="20" x2="18" y2="10" stroke-width="3"/>',
        holdings: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
        balance: '<line x1="12" y1="3" x2="12" y2="21"/><line x1="5" y1="7" x2="19" y2="7"/><path d="M5 7l-3 6a3 3 0 0 0 6 0z"/><path d="M19 7l-3 6a3 3 0 0 0 6 0z"/><line x1="8" y1="21" x2="16" y2="21"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 5 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 5a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 5a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z"/>',
    };
    function railIconSvg(key) {
        const inner = RAIL_ICONS[key];
        if (!inner) return '';
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
    }
    const desktopMQ = window.matchMedia('(min-width:900px)');
    // 手機版城市旗幟的放大倍率（數字太小看不清楚）
    const BUBBLE_SCALE_MOBILE = 1.25;
    // 電腦版股市旗幟（連字型）最多放大的倍率，實際倍率依畫面大小與擁擠程度決定（見 layoutMarkers）
    const DESK_SCALE_MAX = 1.6;
    const DESK_SCALE_ALL = 1.75; // 全球檢視儘可能放大文字；排版演算法會自動往下試，擠不下才會縮小，不會造成重疊
    const deskUCache = new Map();
    // 上帝之手（降下災難特效）先隱藏：按鈕、點擊觸發地圖都關閉；disasters.js 整套程式碼保留，未來真的要用再打開
    const ENABLE_GOD_HAND = false;
    // 單一指數旗幟的高度：色帶（含邊框）下方留 22px 放指數，數字的基線固定在 FULL_BASE，各瀏覽器位置才會一致
    const FULL_H = 44,
        FULL_BASE = 37.5;
    // 手機版區域檢視上方額外預留的高度（px），讓 pin 的國家旗幟放得下
    const PIN_EXTRA_TOP = 95;
    // 遊戲風地形的原始資料（都是 Web Mercator 圖磚，且允許跨來源讀取像素）
    // - DEM：AWS Terrain Tiles（Terrarium 編碼），提供陸地高度與海洋深度
    // - 衛星影像：只拿來「判斷地貌」（沙漠 / 草原 / 森林 / 雪地 / 湖泊），不直接顯示
    const DEM_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
    const IMG_URL = (z, x, y) =>
        `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    const MAX_TILE_Z = 14; // 最高圖磚層級（約 10 公尺 / 像素），再放大會直接放大這一層
    const VIEW_N = 80,
        VIEW_S = -58; // 可視緯度範圍（Mercator 投影兩極會無限拉長，所以裁掉）

    // 地圖上會動的小角色（海洋生物、船、各地的人物）。和市場動物分開，不能點
    // src：assets/ 底下的圖；face：圖裡面向哪邊（L / R / F 不翻轉）；s：相對市場動物的大小
    // mode：wander 散步 / swim 游泳 / whale 鯨魚噴水 / dolphin 跳出水面 / bob 原地浮沉 / boat 船 /
    //       surf 衝浪 / ski 滑雪 / chase 繞圈追逐（lag 是落後的角度）/ fin 只露背鰭在海面巡游 / flyfish 飛魚 / still 不動
    // sea：在海上（影子改成水波）
    const CRITTERS = [
        { src: 'critters/whale-spout.png', alt: 'critters/whale.png', lon: -38, lat: 38, mode: 'whale', s: 1.15, sea: true },
        { src: 'critters/dolphin.png', lon: 112.7, lat: -26.0, mode: 'dolphin', s: 0.85, sea: true, maxDeg: 1.1 }, // 澳洲：猴子米亞野生海豚
        { src: 'critters/shark.png', lon: 19.42, lat: -34.75, mode: 'dolphin', s: 0.9, sea: true, maxDeg: 1.1 }, // 南非甘斯拜：大白鯊之都
        { src: 'critters/seal.png', lon: -27, lat: 66, mode: 'bob', s: 0.75, sea: true },
        // 南島民族（由台灣出發往太平洋、印度洋拓展）：蘭嶼達悟族拼板舟，和往太平洋、馬達加斯加遠航的拼板舟
        { src: 'critters/tatara-yami.svg', lon: 122.4, lat: 20.8, mode: 'boat', face: 'F', s: 1.2, sea: true, maxDeg: 1.2 },
        { src: 'critters/tatara-yami.svg', lon: -146, lat: 14, mode: 'boat', face: 'F', s: 1.2, sea: true },
        { src: 'critters/tatara-yami.svg', lon: 163, lat: 7, mode: 'boat', face: 'F', s: 1.2, sea: true },
        { src: 'critters/tatara-yami.svg', lon: 56, lat: -14, mode: 'boat', face: 'F', s: 1.2, sea: true },
        // 日本黑船（1853 年培里艦隊開進浦賀、逼日本開國）
        { src: 'critters/black-ship.svg', lon: 142, lat: 33.5, mode: 'boat', face: 'F', s: 1.4, sea: true, maxDeg: 1 },
        // 大航海時代的船隊：馬尼拉大帆船（太平洋）、鄭和寶船（印度洋）
        { src: 'critters/galleon-manila.svg', lon: -118, lat: 14, mode: 'boat', face: 'F', s: 1.3, sea: true },
        { src: 'critters/treasure-ship.svg', lon: 84, lat: 4, mode: 'boat', face: 'F', s: 1.4, sea: true },
        // 地理大發現：哥倉布（1492）、達伽馬（1498）、麥哲倫（1519~1522）；阿拉伯三角帆船、Vendée Globe 環球賽艇
        { src: 'critters/fleet-columbus.svg', lon: -66, lat: 22, mode: 'boat', face: 'F', s: 1.9, sea: true },
        { src: 'critters/caravel-dias.svg', lon: 21, lat: -40.5, mode: 'boat', face: 'F', s: 1.3, sea: true, maxDeg: 1.5 }, // 迪亞士 1488 繞過好望角
        { src: 'critters/ship-dagama.svg', lon: 71, lat: 11, mode: 'boat', face: 'F', s: 1.3, sea: true }, // 達伽馬 1498 抵達印度
        { src: 'critters/ship-victoria.svg', lon: -86, lat: -52, mode: 'boat', face: 'F', s: 1.3, sea: true }, // 麥哲倫船隊的維多利亞號環球航行
        { src: 'critters/dhow.svg', lon: 64, lat: 22, mode: 'boat', face: 'F', s: 1.2, sea: true },
        { src: 'critters/yacht-vendee.svg', lon: 40, lat: -47, mode: 'race', face: 'R', s: 1.4, sea: true },
        // 北大西洋：鐵達尼號沉了一半（1912 年撞冰山的海域）
        { src: 'critters/titanic.svg', lon: -49.9, lat: 41.7, mode: 'bob', face: 'F', s: 1.3, sea: true, deco: true },
        // 哥斯大黎加外海的海龜
        { src: 'critters/sea-turtle.svg', lon: -86.8, lat: 8.8, mode: 'turtle', s: 0.8, sea: true, deco: true },
        // 傳說生物：水怪週期性浮出水面（emerge）、幽靈船半透明漂移（ghost）
        {
            src: 'critters/kraken.svg',
            lon: 4,
            lat: 66,
            mode: 'emerge',
            face: 'F',
            s: 1.7,
            sea: true,
            deco: true,
            cyc: 16,
            vis: 0.5,
        }, // 挪威克拉肯
        { src: 'critters/flying-dutchman.svg', lon: 11, lat: -39, mode: 'ghost', face: 'R', s: 1.4, sea: true, maxDeg: 2 }, // 好望角飛翔的荷蘭人
        {
            src: 'critters/nessie.svg',
            lon: -4.45,
            lat: 57.3,
            mode: 'emerge',
            face: 'F',
            s: 0.9,
            sea: true,
            deco: true,
            cyc: 11,
            vis: 0.45,
        }, // 尼斯湖水怪
        {
            src: 'critters/tianchi-monster.svg',
            lon: 128.06,
            lat: 42.0,
            mode: 'emerge',
            face: 'F',
            s: 0.9,
            sea: true,
            deco: true,
            cyc: 9,
            vis: 0.4,
        }, // 長白山天池水怪
        { src: 'critters/yeti.svg', lon: 86.5, lat: 28.2, mode: 'wander', gait: 'heavy', s: 1.1, deco: true, maxDeg: 0.8 }, // 喜馬拉雅雪人
        { src: 'critters/capybara-onsen.svg', lon: 139.4, lat: 36.6, mode: 'bob', face: 'F', s: 0.9, deco: true }, // 日本水豚泡溫泉
        {
            src: 'critters/camel-caravan.svg',
            lon: 5,
            lat: 24,
            mode: 'trek',
            face: 'L',
            s: 1.9,
            deco: true,
            noShadow: true,
            maxDeg: 4,
        }, // 北非駝駝商隊
        // 北海小英雄：維京長船在北海巡航
        { src: 'people/viking.svg', lon: 3.5, lat: 59.5, mode: 'boat', face: 'R', s: 1.35, sea: true },
        // 非洲莽原：獵人追斑馬，旁邊有長頸鹿散步
        { src: 'critters/zebra.png', lon: 33.5, lat: -6, mode: 'chase', lag: 0, s: 0.95 },
        { src: 'critters/hunter.png', lon: 33.5, lat: -6, mode: 'chase', lag: 1.05, s: 0.85 },
        { src: 'critters/giraffe.png', lon: 29, lat: -10, mode: 'wander', s: 1.2 },
        { src: 'critters/lion.svg', lon: 38.5, lat: -3.5, mode: 'wander', gait: 'heavy', s: 1.05, deco: true, maxDeg: 2 }, // 非洲獅
        { src: 'animals/leopard.png', lon: 26, lat: 3, mode: 'wander', s: 0.95, deco: true, maxDeg: 2 }, // 非洲豹
        { src: 'animals/rhinoceros.png', lon: 22, lat: -19, mode: 'wander', gait: 'heavy', s: 1.15, deco: true, maxDeg: 2 }, // 犀牛
        // 北極：因紐特（愛斯基摩）人在冰屋旁走來走去
        { src: 'people/igloo.svg', lon: -74, lat: 68.5, mode: 'still', face: 'F', s: 1 },
        { src: 'people/eskimo.svg', lon: -69, lat: 67.6, mode: 'wander', face: 'F', gait: 'waddle', s: 0.85 },
        // 其他特別的人
        { src: 'critters/rower.png', lon: -62, lat: -3.3, mode: 'boat', face: 'F', s: 0.9 }, // 亞馬遜河划船
        { src: 'critters/surfer.png', lon: 155.8, lat: -30, mode: 'surf', face: 'R', s: 0.9, sea: true }, // 澳洲黃金海岸外海衝浪
        // 澳洲東南部：無尾熊抱著尤加利樹幹慢慢往上爬、停下來啃葉子，再爬下來
        { src: 'critters/eucalyptus.svg', lon: 147.5, lat: -36, mode: 'still', face: 'F', s: 1.5, deco: true },
        { src: 'critters/koala.svg', lon: 147.5, lat: -36, mode: 'climb', face: 'F', s: 0.55, deco: true, noShadow: true },
        { src: 'critters/skier.png', lon: 14, lat: 65, mode: 'ski', face: 'R', s: 0.85 }, // 挪威山上滑雪
        // 各地代表動物
        { src: 'critters/panda.svg', lon: 101.2, lat: 30.8, mode: 'wander', gait: 'waddle', s: 1.05, deco: true }, // 四川的貓熊
        { src: 'critters/brown-bear.svg', lon: 100, lat: 54, mode: 'wander', gait: 'heavy', s: 1.15, deco: true }, // 俄羅斯的棕熊
        // 蘭嶼外海的飛魚：幾隻輪流躍出水面、貼著海面滑翔一段再入水
        { src: 'critters/flying-fish.svg', lon: 122.1, lat: 22.0, mode: 'flyfish', s: 0.5, sea: true, ph: 0, deco: true },
        { src: 'critters/flying-fish.svg', lon: 122.1, lat: 22.0, mode: 'flyfish', s: 0.45, sea: true, ph: 1.1, deco: true },
        { src: 'critters/flying-fish.svg', lon: 122.1, lat: 22.0, mode: 'flyfish', s: 0.5, sea: true, ph: 2.3, deco: true },
        // 美國西海岸外海的大白鯊：只露出背鰭，拖著水痕在海面上慢慢巡游
        { src: 'critters/shark-fin.svg', lon: -127.5, lat: 36.8, mode: 'fin', s: 1.15, sea: true, deco: true },
        // ── 世界地標 ──────────────────────────────────────────────────
        { src: 'critters/jellyfish.svg', lon: 134.5, lat: 7.5, mode: 'bob', s: 0.9, sea: true, deco: true, landmark: true }, // 帛琉水母
        { src: 'critters/fuji.svg', lon: 138.3, lat: 34.4, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 富士山
        { src: 'critters/great-wall.svg', lon: 117.2, lat: 40.7, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 萬里長城
        { src: 'critters/opera-house.svg', lon: 152.5, lat: -34.8, mode: 'still', face: 'F', s: 1.0, deco: true, landmark: true }, // 雪梨歌劇院
        {
            src: 'critters/statue-liberty.svg',
            lon: -73.2,
            lat: 40.8,
            mode: 'still',
            face: 'F',
            s: 1.0,
            deco: true,
            landmark: true,
        }, // 自由女神像
        {
            src: 'critters/christ-redeemer.svg',
            lon: -43.2,
            lat: -22.95,
            mode: 'still',
            face: 'F',
            s: 1.1,
            deco: true,
            landmark: true,
        }, // 基督像
        {
            src: 'critters/machu-picchu.svg',
            lon: -72.5,
            lat: -13.2,
            mode: 'still',
            face: 'F',
            s: 1.1,
            deco: true,
            landmark: true,
        }, // 馬丘比丘
        { src: 'critters/eiffel-tower.svg', lon: 2.3, lat: 48.3, mode: 'still', face: 'F', s: 1.0, deco: true, landmark: true }, // 艾菲爾鐵塔
        { src: 'critters/big-ben.svg', lon: 0.8, lat: 51.0, mode: 'still', face: 'F', s: 1.0, deco: true, landmark: true }, // 大笨鐘
        { src: 'critters/leaning-tower.svg', lon: 10.4, lat: 42.8, mode: 'still', face: 'F', s: 1.0, deco: true, landmark: true }, // 比薩斜塔
        { src: 'critters/colosseum.svg', lon: 12.5, lat: 41.9, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 羅馬競技場
        { src: 'critters/greek-house.svg', lon: 25.4, lat: 36.4, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 希臘聖托里尼
        { src: 'critters/pyramid.svg', lon: 31.1, lat: 29.97, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 吉薩金字塔
        { src: 'critters/hot-balloon.svg', lon: 36.6, lat: 38.2, mode: 'bob', s: 1.0, deco: true, landmark: true }, // 卡帕多奇亞熱氣球
        {
            src: 'critters/kremlin-moscow.svg',
            lon: 36.4,
            lat: 56.1,
            mode: 'still',
            face: 'F',
            s: 1.2,
            deco: true,
            landmark: true,
        }, // 克里姆林宮
        { src: 'critters/st-basil.svg', lon: 39.2, lat: 55.3, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 聖瓦西里主教座堂
        { src: 'critters/moose.svg', lon: -88, lat: 51.5, mode: 'wander', gait: 'heavy', s: 1.2, deco: true, maxDeg: 2 }, // 加拿大駝鹿
        {
            src: 'critters/siberian-train.svg',
            lon: 90,
            lat: 57,
            mode: 'trek',
            face: 'L',
            s: 2.4,
            deco: true,
            noShadow: true,
            maxDeg: 8,
            amp: 3.5,
            rock: 0.3,
            bounce: 0.004,
        }, // 西伯利亞小火車
        {
            src: 'critters/santa-sleigh.svg',
            lon: 26,
            lat: 66.8,
            mode: 'trek',
            face: 'L',
            s: 2.2,
            deco: true,
            noShadow: true,
            maxDeg: 3,
            amp: 2,
            rock: 3,
            bounce: 0.06,
        }, // 芬蘭聖誕老人
        { src: 'critters/sloth.svg', lon: -70, lat: -3, mode: 'still', face: 'F', s: 0.9, deco: true, noShadow: true }, // 南美樹懶
        { src: 'critters/amazon-boat.svg', lon: -57.5, lat: -2.3, mode: 'boat', face: 'F', s: 1.2, sea: true, maxDeg: 0.8 }, // 亞馬遜河探險船
        {
            src: 'critters/footballer-brazil.svg',
            lon: -48,
            lat: -15.5,
            mode: 'still',
            face: 'F',
            s: 1.0,
            deco: true,
            noShadow: true,
        }, // 巴西足球員
        { src: 'critters/cactus-mexico.svg', lon: -102, lat: 24.5, mode: 'still', face: 'F', s: 1.0, deco: true, landmark: true }, // 墨西哥仙人掌
        { src: 'critters/baobab.svg', lon: 37.5, lat: -9.5, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 非洲猴麵包樹
        { src: 'critters/uluru.svg', lon: 131, lat: -25.3, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 烏魯魯巨岩
        { src: 'critters/danxia.svg', lon: 100, lat: 38.9, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 七彩丹霞
        { src: 'critters/iceland-volcano.svg', lon: -19, lat: 64.8, mode: 'bob', face: 'F', s: 1.2, deco: true, landmark: true }, // 冰島戴雪帽的小火山
        { src: 'critters/ring-tailed-lemur.svg', lon: 46.5, lat: -19.5, mode: 'wander', s: 0.95, deco: true, maxDeg: 1.5 }, // 馬達加斯加環尾狐猴
        {
            src: 'critters/bermuda.svg',
            lon: -70,
            lat: 26,
            mode: 'still',
            face: 'F',
            s: 1.9,
            sea: true,
            deco: true,
            noShadow: true,
        }, // 百慕達三角
        {
            src: 'critters/mariana-sub.svg',
            lon: 142.2,
            lat: 11.4,
            mode: 'bob',
            face: 'F',
            s: 1.1,
            sea: true,
            deco: true,
            noShadow: true,
        }, // 馬里亞納海溝潛水器
        {
            src: 'critters/anglerfish.svg',
            lon: 140.6,
            lat: 9.6,
            mode: 'ghost',
            face: 'L',
            s: 0.9,
            sea: true,
            noShadow: true,
            maxDeg: 1.5,
        }, // 深海鮟鱇魚
        { src: 'critters/arctic-fox.svg', lon: 88, lat: 72.5, mode: 'wander', s: 0.9, deco: true, maxDeg: 2 }, // 俄國北極狐
        { src: 'critters/mammoth.svg', lon: 120, lat: 66.5, mode: 'wander', gait: 'heavy', s: 1.3, deco: true, maxDeg: 2 }, // 西伯利亞長毛象
        { src: 'critters/golden-gate.svg', lon: -122.5, lat: 37.8, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 金門大橋
        {
            src: 'critters/grand-canyon.svg',
            lon: -112.1,
            lat: 36.2,
            mode: 'still',
            face: 'F',
            s: 1.1,
            deco: true,
            landmark: true,
        }, // 大峽谷
        { src: 'critters/yellowstone.svg', lon: -110.6, lat: 44.5, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 黃石公園
        { src: 'critters/rushmore.svg', lon: -103.5, lat: 43.85, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 拉什莫爾山
        { src: 'critters/acropolis.svg', lon: 22.4, lat: 38.6, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 雅典衛城
        {
            src: 'critters/milan-cathedral.svg',
            lon: 9.19,
            lat: 45.46,
            mode: 'still',
            face: 'F',
            s: 1.1,
            deco: true,
            landmark: true,
        }, // 米蘭大教堂
        { src: 'critters/yosemite.svg', lon: -119.55, lat: 37.75, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 優勝美地
        { src: 'critters/banff.svg', lon: -115.57, lat: 51.18, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 班夫
        {
            src: 'critters/serengeti.svg',
            lon: 34.85,
            lat: -2.35,
            mode: 'still',
            face: 'F',
            s: 2.0,
            deco: true,
            landmark: true,
            noShadow: true,
        }, // 塞倫蓋提
        {
            src: 'critters/torres-del-paine.svg',
            lon: -72.95,
            lat: -50.95,
            mode: 'still',
            face: 'F',
            s: 1.2,
            deco: true,
            landmark: true,
        }, // 百內
        { src: 'critters/iguazu.svg', lon: -54.44, lat: -25.69, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 伊瓜蘇
        { src: 'critters/fiordland.svg', lon: 167.9, lat: -44.8, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 峡灣
        {
            src: 'critters/kruger.svg',
            lon: 31.5,
            lat: -23.9,
            mode: 'still',
            face: 'F',
            s: 2.0,
            deco: true,
            landmark: true,
            noShadow: true,
        }, // 克留格爾
        { src: 'critters/galapagos.svg', lon: -90.5, lat: -0.6, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 加拉巴哥
        { src: 'critters/noah-ark.svg', lon: 44.3, lat: 39.7, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 諾亞方舟（亞拉臘山）
        { src: 'critters/louvre.svg', lon: 4.6, lat: 48.7, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 羅浮宮
        { src: 'critters/stonehenge.svg', lon: -3.0, lat: 51.3, mode: 'still', face: 'F', s: 1.0, deco: true, landmark: true }, // 巨石陣
        { src: 'critters/minoan-bull.svg', lon: 25.2, lat: 35.2, mode: 'still', face: 'F', s: 1.0, deco: true, landmark: true }, // 米諾斯躍牛壁畫
        { src: 'critters/shanghai.svg', lon: 121.6, lat: 31.2, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 上海外灘、陸家嘴
        { src: 'critters/burj-khalifa.svg', lon: 55.27, lat: 25.2, mode: 'still', face: 'F', s: 1.3, deco: true, landmark: true }, // 杜拜哈里發塔
        { src: 'critters/tokyo-tower.svg', lon: 139.9, lat: 35.5, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 東京鐵塔
        {
            src: 'critters/houston-space.svg',
            lon: -95.1,
            lat: 29.5,
            mode: 'still',
            face: 'F',
            s: 1.1,
            deco: true,
            landmark: true,
        }, // 休士頓太空中心
        {
            src: 'critters/rocket-pad.svg',
            alt: 'critters/rocket-launch.svg',
            lon: -94.2,
            lat: 30.3,
            mode: 'launch',
            face: 'F',
            s: 1.3,
            deco: true,
            noShadow: true,
        }, // 火箭發射
        { src: 'critters/ufo-aliens.svg', lon: -116.5, lat: 35, mode: 'ufo', face: 'F', s: 1.4, deco: true, noShadow: true }, // 加州沙漠的 UFO 和外星人
        { src: 'critters/troy-horse.svg', lon: 26.24, lat: 39.96, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 特洛伊木馬
        { src: 'critters/pompeii.svg', lon: 15.6, lat: 40.4, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 龐貝古城
        {
            src: 'critters/western-wall.svg',
            lon: 35.23,
            lat: 31.78,
            mode: 'still',
            face: 'F',
            s: 1.0,
            deco: true,
            landmark: true,
        }, // 以色列西牆
        { src: 'critters/taipei101.svg', lon: 121.56, lat: 25.03, mode: 'still', face: 'F', s: 1.0, deco: true, landmark: true }, // 台北 101
        {
            src: 'critters/chichen-itza.svg',
            lon: -88.57,
            lat: 20.68,
            mode: 'still',
            face: 'F',
            s: 1.1,
            deco: true,
            landmark: true,
        }, // 奇琴伊茲
        { src: 'critters/cn-tower.svg', lon: -79.39, lat: 43.64, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 多倫多西恩塔
        {
            src: 'critters/hanging-gardens.svg',
            lon: 44.42,
            lat: 32.54,
            mode: 'still',
            face: 'F',
            s: 1.1,
            deco: true,
            landmark: true,
        }, // 巴比倫空中花園
        { src: 'critters/taj-mahal.svg', lon: 78.04, lat: 27.17, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 泰姬瑪哈陵
        { src: 'critters/petra.svg', lon: 35.44, lat: 30.33, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 佩特拉古城
        {
            src: 'critters/polar-bear-l.svg',
            lon: -40.0,
            lat: 72.0,
            mode: 'wander',
            gait: 'heavy',
            maxDeg: 3,
            s: 1.0,
            deco: true,
            landmark: true,
        }, // 格陵蘭北極熊
        { src: 'critters/moai.svg', lon: -109.4, lat: -27.1, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 復活島摩艾
        // ── 第二批地標 ────────────────────────────────────────────────
        { src: 'critters/mongolian-ger.svg', lon: 106.9, lat: 47.9, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 蒙古包
        { src: 'critters/tipi.svg', lon: -105.0, lat: 45.0, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },         // 北美 Tipi
        { src: 'critters/gassho-house.svg', lon: 136.9, lat: 36.2, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },  // 白川鄉合掌造
        { src: 'critters/tulou.svg', lon: 117.1, lat: 24.7, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true },         // 福建土樓
        { src: 'critters/overwater-bungalow.svg', lon: 73.5, lat: 4.2, mode: 'bob', s: 1.0, sea: true, deco: true, landmark: true }, // 馬爾地夫水上屋
        { src: 'critters/windmill.svg', lon: 4.9, lat: 52.3, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },        // 荷蘭風車
        { src: 'critters/great-blue-hole.svg', lon: -87.5, lat: 17.3, mode: 'still', face: 'F', s: 1.2, sea: true, deco: true, landmark: true }, // 大藍洞
        { src: 'critters/chernobyl.svg', lon: 30.1, lat: 51.4, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },      // 車諾比
        { src: 'critters/kiyomizudera.svg', lon: 135.8, lat: 34.99, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 清水寺
        { src: 'critters/osaka-castle.svg', lon: 135.5, lat: 34.6, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },  // 大阪城
        { src: 'critters/forbidden-city.svg', lon: 116.4, lat: 39.9, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 紫禁城
        { src: 'critters/terracotta-army.svg', lon: 109.3, lat: 34.4, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 兵馬俑
        { src: 'critters/zhangjiajie.svg', lon: 110.5, lat: 29.1, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true },   // 張家界
        { src: 'critters/gyeongbokgung.svg', lon: 126.98, lat: 37.58, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 景福宮
        { src: 'critters/n-seoul-tower.svg', lon: 126.99, lat: 37.55, mode: 'still', face: 'F', s: 1.0, deco: true, landmark: true }, // 首爾塔（南山）
        { src: 'critters/varanasi.svg', lon: 83.0, lat: 25.3, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },       // 瓦拉納西
        { src: 'critters/red-fort.svg', lon: 77.24, lat: 28.66, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },     // 紅堡
        // ── 第三批地標 ────────────────────────────────────────────────
        { src: 'critters/angkor-wat.svg', lon: 103.87, lat: 13.41, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },       // 吳哥窟
        { src: 'critters/victoria-falls.svg', lon: 25.86, lat: -17.92, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },   // 維多利亞瀑布
        { src: 'critters/salar-de-uyuni.svg', lon: -67.5, lat: -20.1, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },    // 天空之鏡
        { src: 'critters/great-barrier-reef.svg', lon: 147.7, lat: -18.3, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 大堡礁
        { src: 'critters/everest.svg', lon: 86.93, lat: 27.99, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true },           // 聖母峰
        { src: 'critters/bagan.svg', lon: 94.86, lat: 21.17, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },             // 蒲甘
        { src: 'critters/abu-simbel.svg', lon: 31.63, lat: 22.34, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },        // 阿布辛貝
        { src: 'critters/samarkand.svg', lon: 66.97, lat: 39.65, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },         // 撒馬爾罕
        { src: 'critters/komodo-dragon.svg', lon: 119.49, lat: -8.55, mode: 'wander', gait: 'heavy', s: 1.0, deco: true, landmark: true }, // 科莫多巨蜥
        { src: 'critters/socotra.svg', lon: 53.87, lat: 12.47, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },           // 索科特拉島
        { src: 'critters/maasai.svg', lon: 36.8, lat: -2.5, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },              // 馬賽族
        { src: 'critters/angel-falls.svg', lon: -62.54, lat: 5.97, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },       // 安赫爾瀑布
        { src: 'critters/halong-bay.svg', lon: 107.08, lat: 20.91, mode: 'bob', s: 1.0, sea: true, deco: true, landmark: true },         // 下龍灣
        { src: 'critters/pamukkale.svg', lon: 29.12, lat: 37.92, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },         // 棉堡
        { src: 'critters/giants-causeway.svg', lon: -6.51, lat: 55.24, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 巨人堤道
        { src: 'critters/pearl-harbor.svg', lon: -157.95, lat: 21.37, mode: 'bob', s: 1.0, sea: true, deco: true, landmark: true },      // 珍珠港
        { src: 'critters/normandy.svg', lon: -0.87, lat: 49.34, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 諾曼第登陸
        { src: 'critters/berlin-wall.svg', lon: 13.39, lat: 52.52, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },       // 柏林圍牆
        { src: 'critters/okavango.svg', lon: 22.9, lat: -19.3, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },           // 奧卡萬戈三角洲
        { src: 'critters/waitomo-caves.svg', lon: 175.1, lat: -38.26, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },    // 螢火蟲洞
        // ── 古代七大奇蹟補充 ──────────────────────────────────────────
        { src: 'critters/lighthouse-alexandria.svg', lon: 29.885, lat: 31.214, mode: 'still', face: 'F', s: 1.2, sea: true, deco: true, landmark: true }, // 亞歷山大燈塔
        { src: 'critters/colossus-rhodes.svg', lon: 28.227, lat: 36.451, mode: 'still', face: 'F', s: 1.2, sea: true, deco: true, landmark: true },       // 羅德島巨像
        // ── 第四批地標（用戶補充清單） ────────────────────────────────
        { src: 'critters/borobudur.svg', lon: 110.2, lat: -7.61, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },         // 婆羅浮屠
        { src: 'critters/potala-palace.svg', lon: 91.12, lat: 29.66, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },     // 布達拉宮
        { src: 'critters/sagrada-familia.svg', lon: 2.17, lat: 41.4, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },     // 聖家堂
        { src: 'critters/neuschwanstein.svg', lon: 10.75, lat: 47.56, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },    // 新天鵝堡
        { src: 'critters/mont-saint-michel.svg', lon: -1.51, lat: 48.64, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 聖米歇爾山
        { src: 'critters/alhambra.svg', lon: -3.59, lat: 37.18, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },          // 阿爾罕布拉宮
        { src: 'critters/lalibela.svg', lon: 39.04, lat: 12.03, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },          // 拉利貝拉岩石教堂
        { src: 'critters/teotihuacan.svg', lon: -98.84, lat: 19.69, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },       // 特奧蒂瓦坎太陽金字塔
        { src: 'critters/nazca-lines.svg', lon: -75.13, lat: -14.74, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },     // 納斯卡線
        { src: 'critters/niagara-falls.svg', lon: -79.07, lat: 43.08, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 尼加拉瀑布
        // ── 新增動物（世界各地代表物種） ──────────────────────────────
        { src: 'animals/tiger.png', lon: 79.0, lat: 21.0, mode: 'wander', face: 'R', s: 1.0, deco: true, maxDeg: 2 },  // 印度：老虎在森林漫步（素材朝右畫）
        { src: 'critters/wombat.svg', lon: 146.0, lat: -42.0, mode: 'still', face: 'F', s: 0.9, deco: true },         // 澳洲：袋熊鑽洞
        { src: 'critters/jaguar.svg', lon: -65.0, lat: -6.0, mode: 'wander', face: 'R', s: 1.0, deco: true, maxDeg: 2 }, // 南美：美洲豹穿越雨林（素材朝右畫）
        { src: 'critters/toucan.svg', lon: -58.0, lat: -10.0, mode: 'still', face: 'F', s: 0.85, deco: true },        // 南美：巨嘴鳥跳動
        { src: 'critters/hippo.svg', lon: 31.0, lat: 1.0, mode: 'bob', s: 1.0, sea: true, deco: true },               // 非洲：河馬探頭
        { src: 'animals/elephant.png', lon: 37.5, lat: -3.0, mode: 'wander', gait: 'heavy', s: 1.05, deco: true, maxDeg: 2 }, // 非洲：象群遷徙
        { src: 'animals/penguin.png', lon: -60.0, lat: -62.0, mode: 'wander', gait: 'waddle', s: 0.85, deco: true, maxDeg: 2 }, // 南極：企鵝冰上搖擺
        { src: 'critters/japanese-macaque-onsen.svg', lon: 138.5, lat: 36.7, mode: 'still', face: 'F', s: 0.95, deco: true }, // 日本：獼猴泡溫泉
        { src: 'critters/golden-monkey.svg', lon: 103.0, lat: 31.0, mode: 'wander', face: 'R', s: 0.9, deco: true, maxDeg: 2 }, // 中國：金絲猴森林跳躍（素材朝右畫）
        { src: 'critters/chameleon.svg', lon: 49.0, lat: -17.0, mode: 'still', face: 'F', s: 0.85, deco: true },      // 馬達加斯加：變色龍伸舌頭
        { src: 'critters/piranha.svg', lon: -60.0, lat: -2.0, mode: 'swim', face: 'R', s: 0.8, sea: true, deco: true }, // 南美：食人魚群游（素材朝右畫）
        // ── 第五批補充（地標 + 動物） ──────────────────────────────────
        { src: 'critters/atlantis.svg', lon: -24.0, lat: 36.0, mode: 'still', face: 'F', s: 1.2, sea: true, deco: true, landmark: true, noShadow: true }, // 亞特蘭提斯
        { src: 'critters/chocolate-hills.svg', lon: 124.14, lat: 9.83, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 菲律賓：巧克力山
        { src: 'critters/panama-canal.svg', lon: -79.52, lat: 9.08, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 巴拿馬運河
        { src: 'critters/proboscis-monkey.svg', lon: 114.0, lat: 0.5, mode: 'wander', s: 0.95, deco: true, maxDeg: 2 }, // 婆羅洲：長鼻猴
        { src: 'critters/barcelos-rooster.svg', lon: -8.62, lat: 41.53, mode: 'still', face: 'F', s: 1.0, deco: true, landmark: true }, // 葡萄牙：巴塞盧什公雞
        { src: 'critters/eye-of-sahara.svg', lon: -11.4, lat: 21.12, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 撒哈拉之眼
        { src: 'critters/fennec-fox.svg', lon: 5.0, lat: 25.0, mode: 'wander', s: 0.8, deco: true, maxDeg: 2 }, // 撒哈拉：耳廓狐
        { src: 'critters/grizzly-salmon.svg', lon: -155.8, lat: 58.6, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 阿拉斯加：灰熊抓鮭魚
        { src: 'critters/amazon-rainforest.svg', lon: -71.0, lat: -8.0, mode: 'still', face: 'F', s: 1.8, deco: true, landmark: true }, // 亞馬遜雨林
    ];
    // 原住民小人（natives.js）：該國主要指數漲就歡呼跳舞、跌就沮喪哭泣，平盤時散步 / 揮手 / 眨眼
    // mode 'folk'；market = 看哪個指數；ox / oy = 相對位置點的偏移（單位：小角色基準大小）；minK = 縮小到這個倍率以下就收起來
    if (window.Natives)
        CRITTERS.push(
            ...Natives.FOLK.map((f, i, all) => {
                const grp = all.filter((o) => o.market === f.market);
                return {
                    ...f,
                    folk: true,
                    mode: 'folk',
                    face: 'F',
                    minK: f.minK != null ? f.minK : 1.4,
                    first: grp[0] === f, // 同一組的第一個成員
                    grpOx: grp.reduce((a, o) => a + (o.ox || 0), 0) / grp.length, // 組中心（相對位置點）
                    grpOy: grp.reduce((a, o) => a + (o.oy || 0), 0) / grp.length,
                };
            }),
        );
    // 小人整組找空位時依序試的偏移（單位：小角色基準大小）：先原地，再由近到遠繞一圈圈
    const FOLK_SPOTS = [[0, 0]];
    for (const ring of [1.8, 3, 4.2])
        for (const a of [0, 180, 90, 270, 45, 135, 225, 315])
            FOLK_SPOTS.push([Math.cos((a * Math.PI) / 180) * ring * 1.5, Math.sin((a * Math.PI) / 180) * ring * 0.9]);
    // 國家的陸地放不下整組小人時，依序縮小再試（相對基準大小的倍率）
    const FOLK_SCALES = [1, 0.8, 0.64, 0.5, 0.4];
    // 三個人之間的間距倍率：陸地很小時往中間靠攏（1 = 原本的間距）
    const FOLK_SPREADS = [1, 0.7, 0.5, 0.35];
    const FOLK_MAX_K = 40; // 小人與地標放大到這倍率以上才收起來（其他小角色放大超過 20 倍就收起來）
    // 小人的腳要站在「自己國家」的陸地上：國家輪廓轉成 Path2D（世界座標）後用 isPointInPath 判斷，比 d3.geoContains 快很多。
    // 國家太小（例如台灣縮小時）放不下就不顯示，不會跑到海上或別的國家。投影換了（視窗大小改變）要清掉重建
    const folkLand = new Map();
    // 小人的位置快取（見 layoutMarkers 的 placeFolk）：folkGen 加一就全部重找
    const folkCache = new Map();
    let folkGen = 0,
        folkTimer = 0;
    function folkRefreshSoon() {
        clearTimeout(folkTimer);
        folkTimer = setTimeout(() => {
            folkGen++;
            scheduleLayout();
        }, 250);
    }
    const landCtx = document.createElement('canvas').getContext('2d');
    function landOf(market) {
        if (!folkLand.has(market)) {
            const m = state.bySym[market];
            const f = m && state.countries.find((d) => pad3(d.id) === pad3(m.id));
            let v = null;
            if (f) {
                const gp = d3.geoPath(projection);
                const [[x0, y0], [x1, y1]] = gp.bounds(f);
                v = { path: new Path2D(gp(f) || ''), x0, y0, x1, y1 };
            }
            folkLand.set(market, v);
        }
        return folkLand.get(market);
    }
    // 螢幕座標的點是否在 market 所屬國家的陸地上（世界有左右兩份，x 要繞回一份之內）
    function onLand(market, sx, sy) {
        const L = landOf(market);
        if (!L) return false;
        const t = state.t,
            wy = (sy - t.y) / t.k;
        let wx = (sx - t.x) / t.k;
        wx = ((wx % S0) + S0) % S0;
        if (wx < L.x0 || wx > L.x1 || wy < L.y0 || wy > L.y1) return false;
        return landCtx.isPointInPath(L.path, wx, wy);
    }
    // 找小人位置時要試幾千個點：先把國家畫到一張半解析度的點陣圖，之後每個點只是查一格像素（比 isPointInPath 快上百倍）。
    // 回傳 (螢幕 x, y) => 是否在陸地上；畫面外一律當作不是
    const folkMaskCv = document.createElement('canvas');
    const folkMaskCtx = folkMaskCv.getContext('2d', { willReadFrequently: true });
    const FOLK_MASK_SC = 0.5;
    function landMask(market, W, H) {
        const L = landOf(market);
        if (!L) return () => false;
        const w = Math.max(1, Math.ceil(W * FOLK_MASK_SC)),
            h = Math.max(1, Math.ceil(H * FOLK_MASK_SC));
        folkMaskCv.width = w; // 設定尺寸同時清空
        folkMaskCv.height = h;
        const t = state.t,
            f = FOLK_MASK_SC;
        folkMaskCtx.fillStyle = '#000';
        // 世界左右各有一份（x 繞回 S0 之內）：把畫面涵蓋到的每一份都畫上去
        const n0 = Math.floor(-t.x / t.k / S0) - 1,
            n1 = Math.floor((W - t.x) / t.k / S0) + 1;
        for (let n = n0; n <= n1; n++) {
            folkMaskCtx.setTransform(f * t.k, 0, 0, f * t.k, f * (t.x + n * S0 * t.k), f * t.y);
            folkMaskCtx.fill(L.path);
        }
        const d = folkMaskCtx.getImageData(0, 0, w, h).data;
        return (sx, sy) => {
            const ix = (sx * f) | 0,
                iy = (sy * f) | 0;
            return sx >= 0 && sy >= 0 && ix < w && iy < h && d[(iy * w + ix) * 4 + 3] > 127;
        };
    }
    // 雲：固定在地球上（經緯度），隨西風慢慢往東飄，地圖拖曳時跟著地面走
    const CLOUD_N = 17,
        CLOUD_WIND = 0.5; // 每秒往東飄幾度經度

    // 地圖上的 3D 動物（Microsoft Fluent Emoji 3D，MIT 授權，已存在 assets/animals/）
    // face：圖片裡動物面向哪邊（L 左 / R 右 / F 正面不翻轉）；gait：走路方式
    const ANIMALS = {
        '🦌': ['deer'],
        '🐕': ['dog'],
        '🐅': ['tiger'],
        '🐉': ['dragon', 'L', 'float'],
        '🐎': ['horse'],
        '🦚': ['peacock', 'F', 'bird'],
        '🦘': ['kangaroo', 'L', 'hop'],
        '🐑': ['ewe'],
        '🐆': ['leopard'],
        '🦧': ['orangutan', 'F'],
        '🐘': ['elephant', 'L', 'heavy'],
        '🐒': ['monkey'],
        '🦔': ['hedgehog'],
        '🦡': ['badger'],
        '🐓': ['rooster', 'R', 'bird'],
        '🐂': ['ox', 'L', 'heavy'],
        '🐐': ['goat'],
        '🐄': ['cow', 'L', 'heavy'],
        '🐇': ['rabbit', 'L', 'hop'],
        '🦃': ['turkey', 'L', 'bird'],
        '🐪': ['camel', 'L', 'heavy'],
        '🦏': ['rhinoceros', 'L', 'heavy'],
        '🦅': ['eagle', 'L', 'bird'],
        '🦫': ['beaver'],
        '🦜': ['parrot', 'L', 'bird'],
        '🦎': ['lizard', 'F'],
        '🐧': ['penguin', 'F', 'waddle'],
        '🦙': ['alpaca', 'L', 'walk', 'svg'],
    };
    const animalOf = (e) => {
        const a = ANIMALS[e];
        return a ? { src: `assets/animals/${a[0]}.${a[3] || 'png'}`, face: a[1] || 'L', gait: a[2] || 'walk' } : null;
    };
    // Windows 不會把國旗 emoji 畫成國旗（只顯示「TW」字母），所以改用 assets/flags/ 的國旗圖
    const flagCode = (e) => {
        const cps = [...(e || '')].map((c) => c.codePointAt(0) - 0x1f1e6);
        return cps.length === 2 && cps.every((c) => c >= 0 && c < 26)
            ? cps.map((c) => String.fromCharCode(97 + c)).join('')
            : null;
    };
    const flagSrc = (e) => {
        const c = flagCode(e);
        return c ? `assets/flags/${c}.png` : null;
    };
    const flagHtml = (e, cls = 'flg') => {
        const s = flagSrc(e);
        return s ? `<img class="${cls}" src="${s}" alt="">` : e;
    };

    const $ = (s) => document.querySelector(s);
    const hash = (s) => {
        let h = 0;
        for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        return h;
    };
    const esc = (s) =>
        String(s == null ? '' : s).replace(
            /[&<>"']/g,
            (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
        );
    const pad3 = (id) => String(id == null ? '' : id).padStart(3, '0');
    const store = {
        get(k, d) {
            try {
                const v = localStorage.getItem(k);
                return v == null ? d : JSON.parse(v);
            } catch (e) {
                return d;
            }
        },
        set(k, v) {
            try {
                localStorage.setItem(k, JSON.stringify(v));
            } catch (e) {}
        },
    };

    const state = {
        cfg: null,
        maps: [],
        bars: [],
        bySym: {},
        byId: {},
        countries: [],
        quotes: {},
        econ: {}, // 經濟數據（econ.json 的 items）：代碼 → { v, prev, d, unit, ref, light?, stale? }
        tops: null, // 其它十個國家 / 地區的市值前十大公司（top10.json 的 countries）：國家代碼 → { title, cur, date, top, rows }
        fng: null, // CNN 貪婪與恐慌指數（fng.json）：{ score 0~100, rating, updated, prev: { close, week, month, year } }
        generated: null,
        demo: false,
        activeRegion: 'all',
        layer: 'stocks',
        topics: [], // markets.json 的 topics（商品 / 債券 / 利率 / 匯率 / 地緣 / 經濟數據卡片）
        landmarks: [], // 永遠留在地圖上的圖示（央行、白宮、地緣動畫）
        redUp: store.get('redUp', true),
        anim: store.get('anim', true),
        t: d3.zoomIdentity,
        rot: 0, // 多指數旗幟的輪播序號
        flash: {}, // 剛更新的報價：代碼 → { until, up }，旗幟 / 卡片用它閃一下（見 animateQuotes）
        flying: false, // 切換篩選 / 飛到某處的動畫進行中：只畫地形與國界，不排版（停下來再排）
        highlightId: null, // 點擊高亮（關閉彈窗時清除）
        hoverHighlightId: null, // hover 高亮（mouseleave 時清除）
    };

    /* ================= 時間 / 開盤狀態 ================= */
    const dtfCache = {};
    function parts(tz, d) {
        let f = dtfCache[tz];
        if (!f)
            f = dtfCache[tz] = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                hourCycle: 'h23',
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
            });
        const o = {};
        for (const p of f.formatToParts(d)) o[p.type] = p.value;
        const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[o.weekday];
        return { dow, min: (+o.hour % 24) * 60 + +o.minute };
    }
    const toMin = (s) => {
        const a = s.split(':');
        return +a[0] * 60 + +a[1];
    };

    function statusAt(m, d) {
        const { dow, min } = parts(m.tz, d);
        if (!(m.days || [1, 2, 3, 4, 5]).includes(dow)) return 'closed';
        const ses = m.ses.map((s) => [toMin(s[0]), toMin(s[1])]);
        for (const s of ses) if (min >= s[0] && min < s[1]) return 'open';
        if (min >= ses[0][0] && min < ses[ses.length - 1][1]) return 'break';
        return 'closed';
    }
    function marketStatus(m) {
        let s = statusAt(m, new Date());
        const q = state.quotes[m.s];
        // 理論上開盤，但資料 3 小時沒動 → 很可能是假日休市
        if (s === 'open' && q && q.t && !state.demo && Date.now() / 1000 - q.t > 3 * 3600) s = 'closed';
        return s;
    }
    const nextCache = {};
    function nextOpen(m) {
        const c = nextCache[m.s],
            now = Date.now();
        if (c && now - c.at < 300000) return c.v;
        const step = 15 * 60000;
        let t = Math.ceil(now / step) * step,
            v = null,
            prev = statusAt(m, new Date(now));
        for (let i = 0; i < 7 * 96; i++) {
            const s = statusAt(m, new Date(t));
            if (s === 'open' && prev !== 'open') {
                v = t;
                break;
            }
            prev = s;
            t += step;
        }
        nextCache[m.s] = { at: now, v };
        return v;
    }
    // 開啟網頁時是否依開盤時間自動挑區域（亞太 / 歐洲 / 美洲）。預設關閉，一律從「全球」開始；
    // 想開啟：把下面改成 true，或網址加 ?auto=1（?auto=0 強制關閉），或在 console 執行 localStorage.setItem('autoRegion', 'true')
    const AUTO_REGION_DEFAULT = false;
    function autoRegionOn() {
        const q = new URLSearchParams(location.search).get('auto');
        if (q === '1' || q === '0') return q === '1';
        try {
            const v = localStorage.getItem('autoRegion');
            if (v === 'true' || v === 'false') return v === 'true';
        } catch (e) {}
        return AUTO_REGION_DEFAULT;
    }
    // 自動挑區域時只在這三個主要區域之間挑（中東非洲市場少，需要時手動點）
    const AUTO_REGIONS = ['asia', 'europe', 'americas'];
    // 剛開盤的前 30 分鐘：行情有 15 分鐘延遲，最新一筆還是前一天收盤，會被 marketStatus 的「資料太舊」規則判成休市；
    // 挑區域時這段時間改看交易時段表，不然美股剛開盤時會被忽略
    function justOpened(m) {
        if (statusAt(m, new Date()) !== 'open') return false;
        const { min } = parts(m.tz, new Date());
        const s = m.ses.map((x) => toMin(x[0])).filter((t) => t <= min);
        return s.length > 0 && min - Math.max(...s) < 30;
    }
    const isOpenNow = (m) => marketStatus(m) === 'open' || justOpened(m);
    function pickAutoRegion() {
        // 優先順序：1) 台股開盤中 → 亞太；2) 美股開盤中 → 美洲（時段用各市場自己的時區算，夏令 / 冬令自動換算）；
        // 3) 其餘時間比較各區域「開盤中最重要的市場」權重（markets.json 的 w），歐洲約台灣下午 3~4 點到凌晨，
        //    美股收盤到亞洲開盤之間（清晨）是亞太（澳紐先開）。
        // 不用「開盤家數」：歐洲小市場多，晚上美股開盤時家數還是歐洲比較多，會一直停在歐洲
        for (const [sym, region] of [
            ['^TWII', 'asia'],
            ['^GSPC', 'americas'],
        ]) {
            const m = state.bySym[sym];
            if (m && isOpenNow(m)) return region;
        }
        const count = {},
            score = {};
        AUTO_REGIONS.forEach((r) => (count[r] = score[r] = 0));
        for (const m of state.maps)
            if (count[m.r] != null && isOpenNow(m)) {
                count[m.r]++;
                score[m.r] = Math.max(score[m.r], m.w || 0);
            }
        let best = null,
            bc = 0;
        for (const r of AUTO_REGIONS)
            if (count[r] > 0 && score[r] > bc) {
                best = r;
                bc = score[r];
            }
        if (best) return best;
        // 都休市：選最快開盤的區域
        let bt = Infinity;
        best = 'asia';
        for (const m of state.maps) {
            if (count[m.r] == null) continue;
            const t = nextOpen(m);
            if (t && t < bt) {
                bt = t;
                best = m.r;
            }
        }
        return best;
    }

    /* ================= 顏色 / 格式 ================= */
    const isRed = (pct) => pct >= 0 === state.redUp;
    const hue = (pct) => (isRed(pct) ? 4 : 142);
    // 介面改成深色遊戲面板，漲跌色要用較亮的版本才看得清楚
    // 平盤（四捨五入到小數 2 位是 0.00%）不算漲也不算跌：文字和色帶用灰色，不要被當成「上漲」上紅色
    const isFlat = (pct) => !(Math.abs(pct) >= 0.005);
    const FLAT_TEXT = '#a8b3c7',
        FLAT_BAND = '#4a5466';
    const pctColor = (pct) => (isFlat(pct) ? FLAT_TEXT : isRed(pct) ? 'hsl(4,88%,64%)' : 'hsl(140,70%,52%)');
    const bandColor = (pct) => (isFlat(pct) ? FLAT_BAND : isRed(pct) ? 'hsl(4,62%,38%)' : 'hsl(146,55%,28%)');
    // 休市的色帶仍依漲跌上色，但比開盤中暗、飽和度低，看得出已經收盤
    const closedBandColor = (pct) => (isFlat(pct) ? FLAT_BAND : isRed(pct) ? 'hsl(4,42%,31%)' : 'hsl(146,36%,24%)');
    // 文明帝國式國界，顏色和漲跌無關：全球十大市值國家（markets.json 的 g10）紅色，其他國家綠色。
    // 每個國家三層：寬而淡的光暈 + 看得清楚的國土底色（land）→ 亮色主線（line）→ 中央白色細線（edge）
    const BORDER = {
        green: { line: 'hsl(142,88%,50%)', fill: 'hsla(142,85%,50%,.26)' },
        red: { line: 'hsl(4,88%,50%)', fill: 'hsla(4,85%,50%,.26)' },
    };
    const borderOf = (id) => {
        const m = state.byId[id];
        return m && m.g10 ? BORDER.red : BORDER.green;
    };
    // 主題卡片對應的國家（國家的 ISO 數字代碼，三位數）：卡片寫了 countries 就用它（歐元區、地緣衝突雙方…），
    // 否則用卡片的國旗找同一面國旗的股市國家
    function cardCountryIds(c) {
        if (c.countries) return c.countries.map(pad3);
        const code = flagCode(c.flag),
            m = code && state.maps.find((x) => flagCode(x.flag) === code);
        return m ? [pad3(m.id)] : [];
    }
    // 要畫國界的國家：股票篩選（全球 / 亞太 / 美洲 / 歐洲 / 中東非洲）一律畫所有有股市的國家（電腦版每個篩選都列出所有股市卡片）；
    // 主題篩選（商品 / 匯率 / 地緣…）只畫該篩選所有卡片對應的國家
    function borderIds() {
        const key = state.activeRegion,
            ids = new Set();
        if (TOPICS[key]) {
            for (const c of state.topics) if (c.cat === key) cardCountryIds(c).forEach((i) => ids.add(i));
        } else {
            for (const m of state.maps) ids.add(pad3(m.id));
        }
        return ids;
    }
    // 數字格式器先建好重複使用（toLocaleString 每次呼叫都會重建一個，拖曳時每幀都要格式化好幾十個數字）
    const NUM_FMT = [0, 2].map((d) => new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
    const fmtN = (p, mode) => {
        if (p == null || isNaN(p)) return '--';
        const a = Math.abs(p);
        const d = mode === 'short' ? (a >= 1000 ? 0 : 2) : a >= 10000 ? 0 : 2;
        return NUM_FMT[d ? 1 : 0].format(p);
    };
    // 只在值真的改變時才寫進 DOM。d3 的 attr / style / text 每次都會寫入，值一樣也會讓瀏覽器
    // 重新計算樣式、重新排版 SVG 文字；旗幟在拖曳時每一幀都會重排，內容卻幾乎沒變
    function setQ(el, name, x) {
        if (x == null) {
            if (el.hasAttribute(name)) el.removeAttribute(name);
            return;
        }
        const s = String(x);
        if (el.getAttribute(name) !== s) el.setAttribute(name, s);
    }
    d3.selection.prototype.attrQ = function (name, v) {
        return this.each(function (d, i, g) {
            setQ(this, name, typeof v === 'function' ? v.call(this, d, i, g) : v);
        });
    };
    d3.selection.prototype.styleQ = function (name, v) {
        return this.each(function (d, i, g) {
            const x = typeof v === 'function' ? v.call(this, d, i, g) : v,
                cur = this.style.getPropertyValue(name);
            if (x == null) {
                if (cur) this.style.removeProperty(name);
                return;
            }
            const s = String(x);
            if (cur !== s) this.style.setProperty(name, s);
        });
    };
    d3.selection.prototype.textQ = function (v) {
        return this.each(function (d, i, g) {
            const x = typeof v === 'function' ? v.call(this, d, i, g) : v,
                s = x == null ? '' : String(x);
            if (this.textContent !== s) this.textContent = s;
        });
    };
    // 白色數值（股價、商品、匯率、經濟數據）的小字處理：小數部分與單位（萬、億、K、B、%、bp…）縮小，
    // 有無小數點的數字視覺上才好比較。切成「一般 / 小字」片段，小字片段包成 <tspan class="nd">（CSS 縮到 NUM_SMALL 倍）
    const NUM_SMALL = 0.72;
    const NUM_TOK = /(\.\d+)|(\d[\d,]*)|(×100M|×10K|bp|[%KBM萬万만億亿억兆])/g;
    // 片段種類 cls：null 一般 / 'nd' 縮小且變灰 / 'nu' 只縮小（字色不變）
    // mode：不給 = 股價（指數、十大市值公司）：小數與單位都縮小變灰；
    //       true = 漲跌幅：只縮小 % 和 bp（不變灰），小數維持原大小；
    //       'dec' = 商品 / 匯率 / 經濟數據等其他數值：小數縮小但字色不變，單位（萬、億、K、%…）縮小變灰
    function numParts(s, mode) {
        const uo = mode === true,
            decSame = mode === 'dec';
        const out = [];
        const push = (t, cls) => {
            if (!t) return;
            const p = out[out.length - 1];
            if (p && p[1] === cls) p[0] += t;
            else out.push([t, cls]);
        };
        let last = 0,
            afterNum = false,
            m;
        NUM_TOK.lastIndex = 0;
        while ((m = NUM_TOK.exec(s))) {
            if (m.index > last) {
                push(s.slice(last, m.index), null);
                afterNum = false;
            }
            if (m[2]) {
                push(m[0], null);
                afterNum = true;
            } else if (m[1]) {
                push(m[0], uo ? null : decSame ? 'nu' : 'nd');
                afterNum = true;
            } else {
                // 單位只在緊接數字之後才縮小（避免誤傷其他文字）
                const isUnit = afterNum && (!uo || m[0] === '%' || m[0] === 'bp');
                push(m[0], isUnit ? (uo ? 'nu' : 'nd') : null);
            }
            last = NUM_TOK.lastIndex;
        }
        push(s.slice(last), null);
        return out;
    }
    // 含小字片段的數值寬度（以 .rv 的字級量一般片段，小字片段按比例縮）
    function numW(s, cls = 'rv', mode) {
        let w = 0;
        for (const [t, k] of numParts(s == null ? '' : String(s), mode)) w += textWidthOf(t, cls) * (k ? NUM_SMALL : 1);
        return w;
    }
    d3.selection.prototype.numQ = function (v, mode) {
        return this.each(function (d, i, g) {
            const x = typeof v === 'function' ? v.call(this, d, i, g) : v,
                s = x == null ? '' : String(x);
            if (this._nv === s && (s === '' || this.firstChild)) return;
            this._nv = s;
            while (this.firstChild) this.removeChild(this.firstChild);
            for (const [t, k] of numParts(s, mode)) {
                if (!k) this.appendChild(document.createTextNode(t));
                else {
                    const e = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                    e.setAttribute('class', k);
                    e.textContent = t;
                    this.appendChild(e);
                }
            }
        });
    };
    const fmtPct = (p, d = 2) => {
        const s = p.toFixed(d);
        const n = +s;
        if (n === 0) return '0.' + '0'.repeat(d) + '%';
        return (n > 0 ? '+' : n < 0 ? '' : '') + s + '%';
    };
    // 漲跌幅箭頭 + 數字，自動消除 -0.00 的負號
    const fmtChgPct = (p, d = 2) => {
        const s = Math.abs(p).toFixed(d);
        const n = +s;
        if (n === 0) return `0.${`0`.repeat(d)}%`; // 平盤：無符號無箭頭
        return `${arrow(p)}${s}%`;
    };
    const arrow = (p) => (p > 0 ? '▲' : p < 0 ? '▼' : '–');

    /* ================= 資料 ================= */
    async function fetchJSON(url) {
        // no-cache：每次都向伺服器確認，沒改過就回 304 直接用瀏覽器快取（重新載入時不用重新下載整包資料）
        const r = await fetch(url, { cache: 'no-cache' });
        if (!r.ok) throw new Error(url + ' ' + r.status);
        return r.json();
    }
    async function loadQuotes() {
        try {
            const j = await fetchJSON(DATA_BASE + 'quotes.json?_=' + Date.now());
            state.quotes = j.quotes || {};
            state.generated = j.generated || null;
            state.demo = false;
        } catch (e) {
            if (!Object.keys(state.quotes).length) {
                state.quotes = makeDemo();
                state.generated = new Date().toISOString();
                state.demo = true;
            }
        }
    }
    /* ---------- 報價更新動畫 ----------
     * 新報價進來時，價格有變的代碼會：
     * 1. 數字在 0.9 秒內從舊值滾到新值（直接改 state.quotes 裡的內插值，旗幟、卡片、概況卡都跟著動）
     * 2. 閃一下漲跌色（旗幟外框發光、數字區塊與該列底色淡出），持續約 2 秒
     * 價格沒變的完全不動，所以看到閃的就是「剛剛有更新」。 */
    const FLASH_MS = 2400,
        ROLL_MS = 900;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion:reduce)');
    // 代碼目前閃的顏色：'lvr'（紅光）/'lvg'（綠光）/null（沒在閃）。價格上漲的顏色依「紅漲綠跌 / 綠漲紅跌」設定
    function flashOf(sym) {
        const f = state.flash[sym];
        if (!f || performance.now() >= f.until) return null;
        return isRed(f.up ? 1 : -1) ? 'lvr' : 'lvg';
    }
    const setFlash = (sel, cls) => sel.classed('lvr', cls === 'lvr').classed('lvg', cls === 'lvg');
    function animateQuotes(old) {
        const target = state.quotes;
        if (!state.anim || reducedMotion.matches || document.hidden || state.demo || !old || target === old) return;
        const ch = [];
        for (const s in target) {
            const o = old[s],
                n = target[s];
            if (o && n && isFinite(o.p) && isFinite(n.p) && o.p !== n.p) ch.push([s, o, n]);
        }
        if (!ch.length) return;
        const until = performance.now() + FLASH_MS;
        for (const [s, o, n] of ch) state.flash[s] = { until, up: n.p > o.p };
        setTimeout(scheduleLayout, FLASH_MS + 50); // 閃完了，把 class 拿掉
        const cur = { ...target };
        state.quotes = cur;
        const t0 = performance.now();
        const step = (now) => {
            if (state.quotes !== cur) return; // 途中又有更新的報價進來，這一輪就放棄
            const k = Math.max(0, Math.min(1, (now - t0) / ROLL_MS)), // rAF 的時間戳可能比 t0 早一點，要夾住
                e = 1 - (1 - k) ** 3;
            const lerp = (a, b) => (a == null || b == null ? b : a + (b - a) * e);
            for (const [s, o, n] of ch) cur[s] = { ...n, p: lerp(o.p, n.p), c: lerp(o.c, n.c), pct: lerp(o.pct, n.pct) };
            if (k < 1) {
                scheduleLayout();
                requestAnimationFrame(step);
            } else {
                state.quotes = target;
                refreshView();
            }
        };
        step(t0);
        requestAnimationFrame(step);
        // 保險：畫面被節流、rAF 停住時，也一定要把數字停在最新的報價
        setTimeout(() => {
            if (state.quotes !== cur) return;
            state.quotes = target;
            refreshView();
        }, ROLL_MS + 150);
    }
    // 台股市值排行：最多每 4 分鐘讀一次（和 60 秒輪詢、切回分頁一起呼叫）。失敗就沿用上一份或 corps.js 內建的資料
    let twTopAt = 0;
    async function loadTwTop() {
        if (Date.now() - twTopAt < 240e3) return;
        twTopAt = Date.now();
        try {
            if (window.Corps) Corps.applyFeed(await fetchJSON(DATA_BASE + 'tw-top.json?_=' + Date.now()));
        } catch (e) {
            twTopAt = 0; // 失敗了，下一輪再試
        }
    }
    // 其它十個國家 / 地區（中日韓印英德法美加港）的市值前十大公司：iKDx-realtime 的 top10.json，最多每 4 分鐘讀一次。
    // 失敗就沿用上一份，沒有的話那一國的旗幟照舊（不會多出公司列）
    let topsAt = 0;
    async function loadTops() {
        if (Date.now() - topsAt < 240e3) return;
        topsAt = Date.now();
        try {
            const j = await fetchJSON(DATA_BASE + 'top10.json?_=' + Date.now());
            const cs = j && j.countries;
            if (!cs || typeof cs !== 'object') throw new Error('top10.json 格式不對');
            for (const c of Object.values(cs)) {
                if (!Array.isArray(c.top)) continue;
                // 旗幟的公司列用 { rk, name, price, pct }（和台股的 Corps.topList() 同一個形狀）
                c.rows = c.top.map((x) => ({ rk: x.rk, s: x.s, name: x.name, cap: x.cap, price: x.p, pct: x.pct }));
            }
            state.tops = cs;
        } catch (e) {
            topsAt = 0; // 失敗了，下一輪再試
        }
    }
    // 經濟數據：一個月才更新一次，最多每 10 分鐘讀一次。失敗就沿用上一份，沒有的話各列退回 markets.json 手寫的備用值
    let econAt = 0;
    async function loadEcon() {
        if (Date.now() - econAt < 600e3) return;
        econAt = Date.now();
        try {
            const j = await fetchJSON(DATA_BASE + 'econ.json?_=' + Date.now());
            state.econ = j.items || {};
        } catch (e) {
            econAt = 0; // 失敗了，下一輪再試
        }
    }
    // CNN 貪婪與恐慌指數：最多每 4 分鐘讀一次。失敗就沿用上一份，沒有的話情緒條顯示 --
    let fngAt = 0;
    async function loadFng() {
        if (Date.now() - fngAt < 240e3) return;
        fngAt = Date.now();
        try {
            const j = await fetchJSON(DATA_BASE + 'fng.json?_=' + Date.now());
            if (typeof j.score !== 'number' || !(j.score >= 0 && j.score <= 100)) throw new Error('fng.json 格式不對');
            state.fng = j;
        } catch (e) {
            fngAt = 0; // 失敗了，下一輪再試
        }
    }
    function makeDemo() {
        const q = {};
        for (const i of state.cfg.items) {
            const h = hash(i.s);
            const base = [3000, 8000, 15000, 25000, 500, 60][h % 6] + (h % 997);
            const pct = ((h % 700) - 330) / 100;
            const prev = base / (1 + pct / 100);
            q[i.s] = { p: base, pct, c: base - prev, prev, t: Math.floor(Date.now() / 1000) };
        }
        return q;
    }

    /* ================= 地圖 ================= */
    let svg,
        gZoom,
        gWorlds,
        gLand,
        gLine,
        gEdge,
        gDecor,
        gStars,
        gCorp,
        gFolk,
        gMk,
        gWeather, // 天氣效果（烏雲/煙火）：在動物上、旗幟下
        gBub,
        gLm,
        gGeo,
        gTopic,
        zoomB,
        projection,
        W = 0,
        H = 0;
    let S0 = 1,
        viewBox = [
            [0, 0],
            [1, 1],
        ],
        maxK = 16;

    /* ---------- 遊戲風地形（實作在 terrain.js） ---------- */
    let tctx = null,
        dpr = 1,
        terrainRaf = 0;
    function scheduleTerrain() {
        if (!terrainRaf) terrainRaf = requestAnimationFrame(drawTerrain);
    }
    function drawTerrain() {
        terrainRaf = 0;
        if (tctx && W) {
            Terrain.draw(tctx, state.t, S0, W, H, dpr);
            drawSeason();
            drawNight();
        }
    }

    /* ---------- 遊戲風元件用的 SVG 定義 ---------- */
    function buildDefs() {
        const defs = svg.insert('defs', ':first-child');
        // 動物腳下的柔和接地陰影（不用外框，讓動物像站在地形上而不是貼紙）
        defs.append('filter')
            .attr('id', 'soft')
            .attr('x', '-50%')
            .attr('y', '-100%')
            .attr('width', '200%')
            .attr('height', '300%')
            .append('feGaussianBlur')
            .attr('stdDeviation', 1.4);
        // 動物本體的投影：和地形光影同方向（光從左上來，影子落在右下）
        defs.append('filter')
            .attr('id', 'cast')
            .attr('x', '-30%')
            .attr('y', '-30%')
            .attr('width', '170%')
            .attr('height', '170%')
            .append('feDropShadow')
            .attr('dx', 1.6)
            .attr('dy', 1.2)
            .attr('stdDeviation', 0.9)
            .attr('flood-color', '#14210c')
            .attr('flood-opacity', 0.45);
        // 旗幟底色（深藍漸層）
        const grad = (id, a, b) => {
            const lg = defs.append('linearGradient').attr('id', id).attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
            lg.append('stop').attr('offset', '0%').attr('stop-color', a);
            lg.append('stop').attr('offset', '100%').attr('stop-color', b);
        };
        grad('bannerBg', '#2c4570', '#14223a');
        grad('bannerOff', '#3c4659', '#222a38');
        // 國名：奶油白到琥珀金的漸層，呼應旗幟的金色邊框
        grad('nameGold', '#fffbe8', '#ffc247');
        // 夜晚城市燈光發光暈：城市旗幟在夜側時散發溫暖橘黃光
        const glow = defs
            .append('filter')
            .attr('id', 'cityGlow')
            .attr('x', '-40%')
            .attr('y', '-40%')
            .attr('width', '180%')
            .attr('height', '180%');
        glow.append('feGaussianBlur').attr('stdDeviation', 4).attr('result', 'blur');
        const glowMerge = glow.append('feMerge');
        glowMerge.append('feMergeNode').attr('in', 'blur');
        glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    }

    /* ---------- 動物自然走動 ---------- */
    const walkers = new Map();
    // 各種走路方式：step 步頻、bob 上下起伏（相對身高）、rock 左右搖晃角度、speed 移動速度（身高 / 秒）
    const GAITS = {
        walk: { step: 10, bob: 0.045, rock: 2.5, speed: 0.55 },
        heavy: { step: 6.5, bob: 0.03, rock: 1.8, speed: 0.38 },
        hop: { step: 7, bob: 0.32, rock: 0, speed: 0.85 },
        bird: { step: 13, bob: 0.06, rock: 4, speed: 0.45 },
        waddle: { step: 8, bob: 0.025, rock: 9, speed: 0.3 },
        float: { step: 5, bob: 0, rock: 2, speed: 0.5, float: true },
    };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)'); // 系統要求減少動態時，動物就待在原地
    let walkRaf = 0,
        walkLast = 0;
    function startWalk() {
        if (!walkRaf) {
            walkLast = performance.now();
            walkRaf = requestAnimationFrame(walkStep);
        }
    }
    function walkStep(now) {
        walkRaf = 0;
        const dt = Math.min(0.1, (now - walkLast) / 1000);
        walkLast = now;
        const t = now / 1000;
        // 每 60 秒更新一次晨昏線（地球自轉 1°/4min，60 秒移動 0.25° 肉眼不察）
        if (Math.floor(t / 60) !== walkStep._nightMin) {
            walkStep._nightMin = Math.floor(t / 60);
            scheduleTerrain();
        }
        for (const m of state.maps) {
            const w = walkers.get(m.s);
            if (!w || !w.vis) continue;
            const st = w.st,
                R = w.size,
                G = GAITS[w.gait] || GAITS.walk;
            const closed = st === 'closed';
            let hop = 0,
                rot = 0,
                sy = 1,
                sleeping = false;
            if (!state.anim || reduceMotion.matches) {
                // 動畫關閉 / 系統要求減少動態：站在原地不動
                w.x = w.y = w.tx = w.ty = 0;
                sleeping = closed;
                if (closed) sy = 0.9;
            } else {
                // 開盤：活潑地走來走去；午休：慢慢走；休市：懶洋洋地散步，大部分時間趴著睡覺
                const speed = R * G.speed * (closed ? 0.35 : st === 'break' ? 0.5 : 1);
                const dx = w.tx - w.x,
                    dy = w.ty - w.y,
                    d = Math.hypot(dx, dy);
                if (w.wait > 0 || d < 0.6) {
                    w.wait -= dt;
                    if (w.wait <= 0 && d < 0.6) {
                        // 選下一個目的地（在自己國家附近的小範圍內），走到後會停下來東張西望
                        const a = Math.random() * Math.PI * 2,
                            r = 0.35 + Math.sqrt(Math.random()) * 0.65;
                        const span = closed ? 0.7 : 1.3;
                        w.tx = Math.cos(a) * r * R * span;
                        w.ty = Math.sin(a) * r * R * span * 0.42;
                        w.wait = 0;
                    } else if (w.wait <= 0) w.wait = 0;
                    if (closed) {
                        sleeping = true;
                        sy = 0.88 + Math.sin(t * 1.7 + R) * 0.035; // 趴著睡，慢慢呼吸
                    } else {
                        sy = 1 + Math.sin(t * 2.4 + R) * 0.03; // 站著時輕輕呼吸
                        // 偶爾左右張望
                        if (w.face !== 'F' && Math.random() < dt * 0.35) w.dir = -w.dir;
                    }
                    if (G.float) hop = (closed ? -R * 0.04 : -R * 0.12) + Math.sin(t * 2.2 + R) * R * 0.04;
                } else {
                    const sp = Math.min(d, speed * dt);
                    w.x += (dx / d) * sp;
                    w.y += (dy / d) * sp;
                    // 往右走就讓面向左的動物翻面（面向右的反過來，正面的不翻）
                    if (Math.abs(dx) > 0.3 && w.face !== 'F') w.dir = dx > 0 === (w.face === 'L') ? -1 : 1;
                    w.ph += dt * G.step;
                    const s = Math.abs(Math.sin(w.ph));
                    if (G.float) hop = -R * 0.12 + Math.sin(w.ph * 0.5) * R * 0.06;
                    else hop = -s * R * G.bob;
                    rot = Math.sin(w.ph) * G.rock;
                    if (G.bob > 0.15) sy = 1 + s * 0.06 - Math.pow(1 - s, 6) * 0.1; // 跳躍型：騰空拉長、落地壓扁
                    if (Math.hypot(w.tx - w.x, w.ty - w.y) < 0.6)
                        w.wait = closed ? 4 + Math.random() * 6 : 1 + Math.random() * 3.5;
                }
            }
            // 跳得越高，地上的影子越小越淡
            const lift = Math.max(0, Math.min(1, -hop / (R * 0.35)));
            w.shadow.setAttribute('transform', `scale(${(1 - lift * 0.35).toFixed(3)})`);
            w.shadow.style.opacity = (0.5 * (1 - lift * 0.5)).toFixed(2);
            w.mood.style.opacity = sleeping ? '0.9' : '0'; // 💤 只在睡著時出現
            w.wk.setAttribute('transform', `translate(${w.x.toFixed(2)},${w.y.toFixed(2)})`);
            w.body.setAttribute(
                'transform',
                `translate(0,${hop.toFixed(2)}) rotate(${rot.toFixed(1)}) scale(${w.dir},${sy.toFixed(3)})`,
            );
        }
        stepCritters(dt, t);
        if (window.GeoScenes) GeoScenes.step(dt, t);
        drawClouds(dt);
        drawAurora(dt);
        drawBiolum(dt);
        drawWeather(dt);
        if (!document.hidden) walkRaf = requestAnimationFrame(walkStep);
    }
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) startWalk();
    });

    /* ---------- 小角色：海洋生物、船、各地人物 ---------- */
    const critters = [];
    const faceDir = (c, dx) => (c.face === 'F' ? 1 : dx > 0 === (c.face === 'L') ? -1 : 1);
    const folkLeads = new Map(); // 小人找不到國家附近的空位時，用虛線連回國家的位置
    function buildCritters() {
        for (const d of CRITTERS) {
            if (!d.folk || folkLeads.has(d.market)) continue;
            const g = gFolk.append('g').attr('class', 'folk-lead').style('display', 'none');
            g.append('line');
            g.append('circle').attr('r', 3.2);
            folkLeads.set(d.market, g.node());
        }
        for (const d of CRITTERS) {
            const g = (d.folk ? gFolk : gDecor).append('g').attr('class', 'cr').style('display', 'none');
            const wk = g.append('g');
            const shadow = wk
                .append('ellipse')
                .attr('class', d.sea ? 'wake' : 'shadow')
                .attr('filter', 'url(#soft)');
            const body = wk.append('g');
            let img,
                poses = null;
            if (d.folk) {
                // 原住民小人（natives.js）：每個姿勢是 <svg> 裡的一個 <g>，依漲跌切換顯示哪一個
                img = body.append('g').append('svg');
                img.attr('class', 'nv')
                    .attr('viewBox', Natives.VIEWBOX)
                    .attr('preserveAspectRatio', 'xMidYMax meet')
                    .attr('overflow', 'visible');
                img.node().innerHTML = Natives.markup(d.look, d.id);
                poses = {};
                img.node()
                    .querySelectorAll('[data-pose]')
                    .forEach((p) => (poses[p.getAttribute('data-pose')] = p));
                poses.idle.style.display = '';
            } else {
                img = body
                    .append('image')
                    .attr('href', 'assets/' + d.src)
                    .attr('preserveAspectRatio', 'xMidYMax meet')
                    .attr('filter', 'url(#cast)');
            }
            if (d.alt) new Image().src = 'assets/' + d.alt; // 先載入另一張（鯨魚噴水 / 不噴水）
            critters.push({
                poses,
                pose: 'idle',
                big: false,
                st: 'open',
                stAt: -99,
                d,
                g: g.node(),
                wk: wk.node(),
                body: body.node(),
                shadow: shadow.node(),
                img: img.node(),
                face: d.face || 'L',
                gait: d.gait || 'walk',
                x: 0,
                y: 0,
                tx: 0,
                ty: 0,
                wait: Math.random() * 3,
                dir: 1,
                ph: Math.random() * 6,
                size: 20,
                base: 20,
                vis: false,
                spout: true,
            });
            attachTip(g, critters[critters.length - 1]);
        }
    }
    /* ---------- 小角色 / 地標的說明視窗（tips.js 提供文字） ---------- */
    let ctipEl = null,
        ctipOwner = null,
        ctipTimer = 0,
        ctipInit = false;
    function tipInfo(c) {
        const d = c.d;
        if (d.folk) {
            const m = state.bySym[d.market],
                q = state.quotes[d.market],
                pct = q ? q.pct : 0;
            const mood =
                pct >= 0.15
                    ? `📈 大盤 +${pct.toFixed(2)}%：居民高舉雙手歡呼、蹦蹦跳跳！`
                    : pct <= -0.15
                      ? `📉 大盤 ${pct.toFixed(2)}%：居民垂頭喪氣，邊哭邊擦眼淚。`
                      : '➖ 大盤平盤：居民悠閒散步，偶爾揮揮手。';
            const outfit = (window.FOLK_OUTFITS || {})[d.market];
            return {
                iconHtml: m ? flagHtml(m.flag) : '🧑',
                title: `${m ? m.short || m.zh : ''}居民`,
                kind: '人物文化',
                desc: outfit ? `穿著${outfit}。他們會隨該國主要指數的漲跌有不同反應。` : '會隨該國主要指數的漲跌有不同反應。',
                mood,
            };
        }
        const t = window.CRITTER_TIPS && window.CRITTER_TIPS[d.src];
        return t ? { icon: t[0], title: t[1], kind: t[2], desc: t[3] } : null;
    }
    function moveCtip(ev) {
        const st = $('#stage').getBoundingClientRect(),
            w = ctipEl.offsetWidth,
            h = ctipEl.offsetHeight;
        let x = ev.clientX - st.left + 16,
            y = ev.clientY - st.top + 18;
        if (x + w > st.width - 6) x = ev.clientX - st.left - w - 16;
        if (y + h > st.height - 6) y = ev.clientY - st.top - h - 14;
        ctipEl.style.left = Math.max(6, x) + 'px';
        ctipEl.style.top = Math.max(6, y) + 'px';
    }
    function showCtip(c, ev) {
        if (parseFloat(c.body.style.opacity || 1) < 0.3) return;
        const info = tipInfo(c);
        if (!info) return;
        ctipEl = ctipEl || $('#ctip');
        ctipOwner = c;
        ctipEl.innerHTML =
            `<div class="th"><div class="ti">${info.iconHtml || esc(info.icon)}</div><div class="tt"><div class="tn">${esc($t(info.title))}</div>` +
            `<span class="tk" data-k="${esc(info.kind)}">${esc($t(info.kind))}</span></div></div>` +
            `<div class="td">${esc($t(info.desc))}</div>${info.mood ? `<div class="tm">${esc(info.mood)}</div>` : ''}`;
        ctipEl.classList.add('show');
        moveCtip(ev);
    }
    function hideCtip() {
        clearTimeout(ctipTimer);
        ctipOwner = null;
        if (ctipEl) ctipEl.classList.remove('show');
    }
    function attachTip(g, c) {
        if (!c.d.folk && !(window.CRITTER_TIPS && window.CRITTER_TIPS[c.d.src])) return;
        if (!ctipInit) {
            ctipInit = true;
            document.addEventListener('pointerdown', (e) => {
                if (!(e.target.closest && e.target.closest('.cr'))) hideCtip();
            });
            $('#stage').addEventListener('wheel', hideCtip, { passive: true });
        }
        const canHover = window.matchMedia('(hover: hover)').matches;
        g.classed('tipped', true)
            .style('pointer-events', 'auto')
            .on('pointerenter', (e) => {
                if (e.pointerType === 'mouse') showCtip(c, e);
            })
            .on('pointermove', (e) => {
                if (ctipOwner === c && e.pointerType === 'mouse') moveCtip(e);
            })
            .on('pointerleave', (e) => {
                if (ctipOwner === c && e.pointerType === 'mouse') hideCtip();
            })
            .on('click', (e) => {
                if (canHover) return;
                if (ctipOwner === c) return hideCtip();
                showCtip(c, e);
                clearTimeout(ctipTimer);
                ctipTimer = setTimeout(hideCtip, 6000);
            });
    }
    // 在自己附近隨機選點走過去，到了就停一下；回傳是否正在移動
    function wander(c, dt, speed, span, sq = 0.42) {
        const dx = c.tx - c.x,
            dy = c.ty - c.y,
            d = Math.hypot(dx, dy);
        if (d < 0.6) {
            c.wait -= dt;
            if (c.wait <= 0) {
                const a = Math.random() * Math.PI * 2,
                    r = 0.35 + Math.sqrt(Math.random()) * 0.65;
                // maxDeg：活動範圍不超過幾度經度，縮小地圖時才不會走到海上
                const md = c.d.maxDeg ?? (c.d.mode === 'boat' ? 2 : 0);
                const rr = Math.min(r * c.base * span, md && c.ppd ? md * c.ppd : Infinity);
                c.tx = Math.cos(a) * rr;
                c.ty = Math.sin(a) * rr * sq;
                c.wait = 1 + Math.random() * 3;
            }
            return false;
        }
        const sp = Math.min(d, speed * dt);
        c.x += (dx / d) * sp;
        c.y += (dy / d) * sp;
        if (Math.abs(dx) > 0.3) c.dir = faceDir(c, dx);
        return true;
    }
    // 原住民小人這一幀的姿勢與動作。漲跌看該國主要指數（c.d.market）：
    //  漲（≥ +0.15%）：左右手交替高舉歡呼，原地蹦跳（漲超過 2% 跳得更高、還撒彩帶）
    //  跌（≤ −0.15%）：低頭哭泣，一下垂手一下擦眼淚，身體微微顫抖（跌超過 2% 頭上打雷）
    //  平盤：慢慢散步、偶爾揮手、眨眼
    // 休市時動作放慢。動畫關閉 / 系統要求減少動態時只擺一個靜態姿勢
    function folkStep(c, dt, t, still) {
        const q = state.quotes[c.d.market];
        const pct = q ? q.pct : 0;
        const mood = pct >= 0.15 ? 'up' : pct <= -0.15 ? 'down' : 'flat';
        const big = mood !== 'flat' && Math.abs(pct) >= BIG_MOVE;
        // 市場狀態每 2 秒更新一次就好（marketStatus 比較貴）
        if (t - c.stAt > 2) {
            c.stAt = t;
            const mk = state.bySym[c.d.market];
            c.st = mk ? marketStatus(mk) : 'open';
        }
        const tempo = c.st === 'open' ? 1 : 0.55;
        const R = c.size;
        const T = t + c.ph + (c.d.ph || 0);
        let pose = 'idle',
            hop = 0,
            rot = 0,
            sy = 1;
        if (still) {
            c.x = c.y = 0;
            pose = mood === 'up' ? 'cheerA' : mood === 'down' ? 'sadA' : 'idle';
        } else if (mood === 'up') {
            const beat = T * tempo * 3.2;
            pose = Math.floor(beat) % 2 ? 'cheerB' : 'cheerA';
            const s = Math.abs(Math.sin(beat * Math.PI));
            hop = -s * R * (big ? 0.2 : 0.12);
            sy = 1 + s * 0.05 - Math.pow(1 - s, 6) * 0.08; // 騰空拉長、落地壓扁
            rot = Math.sin(beat * Math.PI) * 2;
        } else if (mood === 'down') {
            pose = Math.floor(T * tempo * 1.2) % 2 ? 'sadB' : 'sadA';
            rot = Math.sin(T * 9 * tempo) * 1.1; // 抽泣時肩膀顫抖
            sy = 0.965 + Math.sin(T * 1.6) * 0.008;
        } else {
            if (wander(c, dt, R * 0.28 * tempo, 0.7, 0.35)) {
                c.wp = (c.wp || 0) + dt * 8;
                hop = -Math.abs(Math.sin(c.wp)) * R * 0.035;
                rot = Math.sin(c.wp) * 2;
            } else {
                sy = 1 + Math.sin(T * 2.2) * 0.02; // 站著輕輕呼吸
                const cyc = T % 10;
                if (cyc < 1.8)
                    pose = Math.floor(T * 4) % 2 ? 'wave2' : 'wave1'; // 偶爾揮手
                else if (T % 3.4 < 0.14) pose = 'idleBlink'; // 眨眼
            }
        }
        if (pose !== c.pose) {
            c.poses[c.pose].style.display = 'none';
            c.poses[pose].style.display = '';
            c.pose = pose;
        }
        if (big !== c.big) {
            c.big = big;
            c.img.classList.toggle('is-big', big);
        }
        return { hop, rot, sy };
    }
    function stepCritters(dt, t) {
        const still = !state.anim || reduceMotion.matches;
        if (ctipOwner && !ctipOwner.vis) hideCtip();
        for (const c of critters) {
            if (!c.vis) continue;
            const R = c.size,
                B = c.base,
                m = c.d.mode;
            let hop = 0,
                rot = 0,
                sy = 1,
                op = 1,
                wake = 1;
            if (m === 'chase') {
                // 斑馬和獵人用同一個時鐘繞橢圓跑，獵人落後一段角度
                const a = (still ? 0 : t * 0.75) - c.d.lag;
                // 橢圓的大小不超過約 3° x 1.4°（中心在內陸），再小也不低於一個最小值免得兩隻重疊
                const rx = Math.max(B * 0.7, Math.min(B * 1.9, 3 * (c.ppd || 99))),
                    ry = Math.max(B * 0.25, Math.min(B * 0.6, 1.4 * (c.ppd || 99)));
                c.x = Math.cos(a) * rx;
                c.y = Math.sin(a) * ry;
                c.dir = faceDir(c, -Math.sin(a));
                if (!still) {
                    c.ph += dt * 13;
                    const s = Math.abs(Math.sin(c.ph));
                    hop = -s * R * 0.13;
                    rot = Math.sin(c.ph) * 4;
                }
            } else if (m === 'folk') {
                const f = folkStep(c, dt, t, still);
                hop = f.hop;
                rot = f.rot;
                sy = f.sy;
            } else if (still || m === 'still') {
                c.x = c.y = 0;
            } else if (m === 'wander') {
                const G = GAITS[c.gait] || GAITS.walk;
                if (wander(c, dt, R * G.speed, 1.4)) {
                    c.ph += dt * G.step;
                    const s = Math.abs(Math.sin(c.ph));
                    hop = -s * R * G.bob;
                    rot = Math.sin(c.ph) * G.rock;
                } else {
                    sy = 1 + Math.sin(t * 2.4 + c.ph) * 0.03;
                    if (c.face !== 'F' && Math.random() < dt * 0.3) c.dir = -c.dir;
                }
            } else if (m === 'swim' || m === 'whale') {
                wander(c, dt, R * (m === 'whale' ? 0.22 : 0.38), 2.2, 0.5);
                hop = Math.sin(t * 1.6 + c.ph) * R * 0.05;
                rot = Math.sin(t * 1.1 + c.ph) * 3;
                if (m === 'whale') {
                    // 每 8 秒噴一次水
                    const sp = (t + c.ph) % 8 < 2.4;
                    if (sp !== c.spout) {
                        c.spout = sp;
                        c.img.setAttribute('href', 'assets/' + (sp ? c.d.src : c.d.alt));
                    }
                }
            } else if (m === 'bob') {
                hop = Math.sin(t * 1.3 + c.ph) * R * 0.06;
                rot = Math.sin(t * 0.9 + c.ph) * 4;
                if (c.face !== 'F' && Math.random() < dt * 0.08) c.dir = -c.dir;
            } else if (m === 'boat') {
                wander(c, dt, R * 0.2, 2.4, 0.4);
                hop = Math.sin(t * 1.4 + c.ph) * R * 0.04;
                rot = Math.sin(t * 1.1 + c.ph) * 4.5;
            } else if (m === 'dolphin') {
                // 來回游，每 3.6 秒跳出水面畫一道弧線，其餘時間在水面下
                // 游動範圍要用「地理距離」(ppd) 限制，不然縮小地圖時會游到岸上
                const w = (t + c.ph) * 0.22,
                    vx = Math.cos(w);
                c.x = Math.sin(w) * Math.min(B * 2, (c.ppd || 9999) * (c.d.maxDeg || 1.3));
                c.y = 0;
                c.dir = faceDir(c, vx);
                const u = ((t + c.ph) % 3.6) / 3.6;
                if (u < 0.5) {
                    const v = u / 0.5;
                    hop = -Math.sin(Math.PI * v) * R * 0.9;
                    rot = (0.5 - v) * 70 * (vx < 0 ? 1 : -1); // 上升時抬頭、落下時低頭
                    op = Math.min(1, v * 8, (1 - v) * 8);
                    wake = 1 - Math.sin(Math.PI * v);
                } else {
                    op = 0;
                    wake = 0.5;
                }
            } else if (m === 'fin') {
                // 大白鯊：只露出背鰭，在海面上慢慢游一個橫 8 字，鰭微微左右晃、隨波輕輕浮沉（不跳出水面）
                // 橫向振幅用 ppd（每度 px）限制在 ±1.6 度以內，防止游到陸地上
                const T = t + c.ph,
                    w = T * 0.16;
                c.x = Math.sin(w) * Math.min(B * 2.2, (c.ppd || 9999) * 1.6);
                c.y = Math.sin(w * 2) * B * 0.3;
                c.dir = faceDir(c, Math.cos(w));
                hop = Math.sin(T * 1.7) * R * 0.015;
                rot = Math.sin(T * 1.1) * 2.5;
            } else if (m === 'flyfish') {
                // 飛魚：每一輪從水裡衝出來，貼著海面滑翔一小段再入水，下一輪換個方向和高度
                const P = 3.4,
                    T = t + c.ph + (c.d.ph || 0),
                    n = Math.floor(T / P),
                    u = (T % P) / P,
                    sg = n % 2 ? -1 : 1;
                if (u < 0.45) {
                    const v = u / 0.45;
                    c.x = (v - 0.5) * B * 2.4 * sg;
                    c.y = (((n * 37 + Math.round(c.d.ph * 10)) % 5) - 2) * B * 0.11;
                    c.dir = faceDir(c, sg);
                    hop = -Math.sin(Math.PI * v) * R * 0.5;
                    rot = (0.5 - v) * 26 * (sg < 0 ? 1 : -1);
                    op = Math.min(1, v * 10, (1 - v) * 10);
                    wake = 1 - Math.sin(Math.PI * v);
                } else {
                    op = 0;
                    wake = 0.4;
                }
            } else if (m === 'launch') {
                // 火箭：待命 6 秒 → 點火升空 5 秒（帶火焰和濃煙）→ 消失 → 回到發射架
                const T = (t + c.ph) % 14;
                let flame = false;
                if (T < 6) op = Math.min(1, T * 2);
                else if (T < 11) {
                    const u = (T - 6) / 5;
                    c.y = -u * u * B * 3.2;
                    op = Math.min(1, (1 - u) * 4);
                    flame = true;
                    rot = Math.sin(T * 40) * 0.6;
                } else op = 0;
                if (T < 6 || T >= 11) c.y = 0;
                if (flame !== !!c.fl) {
                    c.fl = flame;
                    c.img.setAttribute('href', 'assets/' + (flame ? c.d.alt : c.d.src));
                }
            } else if (m === 'ufo') {
                // UFO：在沙漠上空緩緩飄移、上下浮動、微微傘斜
                const T = t + c.ph;
                c.x = Math.sin(T * 0.25) * B * 0.9;
                c.y = Math.sin(T * 0.4) * B * 0.15;
                hop = Math.sin(T * 1.7) * R * 0.05;
                rot = Math.sin(T * 0.9) * 4;
            } else if (m === 'emerge') {
                // 水怪：週期性從水裡浮出（從下往上長出來）、停一下再沉下去
                const P = c.d.cyc || 12,
                    T = (t + c.ph) % P,
                    V = P * (c.d.vis || 0.5);
                if (T < V) {
                    const u = T / V,
                        e = Math.min(1, u * 5, (1 - u) * 5),
                        ee = e * e * (3 - 2 * e);
                    sy = 0.3 + 0.7 * ee;
                    op = Math.min(1, e * 1.6);
                    hop = (1 - ee) * R * 0.25;
                    rot = Math.sin(T * 1.6) * 3;
                    wake = ee;
                } else {
                    op = 0;
                    wake = 0.3;
                }
            } else if (m === 'ghost') {
                // 幽靈船：緩緩漂移、半透明忍明忍滅
                const T = t + c.ph,
                    w = T * 0.12;
                c.x = Math.sin(w) * Math.min(B * 2, (c.ppd || 9999) * (c.d.maxDeg || 2));
                c.y = Math.sin(w * 1.7) * B * 0.1;
                c.dir = faceDir(c, Math.cos(w));
                hop = Math.sin(T * 1.2) * R * 0.04;
                rot = Math.sin(T * 0.8) * 3;
                op = 0.45 + 0.3 * Math.sin(T * 0.9);
                wake = op;
            } else if (m === 'trek') {
                // 駝駝商隊：沿著一條線慢慢走到盡頭再回頭，步伐帶點搖晃
                const T = t + c.ph,
                    w = T * 0.14;
                c.x = Math.sin(w) * Math.min(B * (c.d.amp || 2.2), (c.ppd || 9999) * (c.d.maxDeg || 3));
                c.y = 0;
                c.dir = faceDir(c, Math.cos(w));
                hop = -Math.abs(Math.sin(T * 3)) * R * (c.d.bounce ?? 0.025);
                rot = Math.sin(T * 3) * (c.d.rock ?? 1.5);
            } else if (m === 'race') {
                // 賽艇在南大洋來回疊式航行，轉向時調頭，船頭略抬、船身傾斜
                const T = t + c.ph,
                    w = T * 0.18;
                c.x = Math.sin(w) * B * 3;
                c.y = Math.sin(w * 2) * B * 0.15;
                c.dir = faceDir(c, Math.cos(w));
                hop = -R * 0.04 - Math.sin(T * 2.1) * R * 0.02;
                rot = -c.dir * 3 + Math.sin(T * 1.3) * 2;
            } else if (m === 'turtle') {
                // 海龜：慢慢游一個橫 8 字，轉彎時翻面；活動範圍用 ppd 限制在 ±1.5 度內
                const T = t + c.ph,
                    w = T * 0.2;
                c.x = Math.sin(w) * Math.min(B * 1.8, (c.ppd || 9999) * 1.5);
                c.y = Math.sin(w * 2) * Math.min(B * 0.35, (c.ppd || 9999) * 0.5);
                c.dir = faceDir(c, Math.cos(w));
                hop = Math.sin(T * 1.5) * R * 0.04;
                rot = Math.sin(T * 0.9) * 3;
            } else if (m === 'climb') {
                // 16 秒一輪：爬上去 → 在樹上啃葉子 → 爬下來 → 休息
                const T = (t + c.ph) % 16;
                let u = 0,
                    moving = false;
                if (T < 4) ((u = T / 4), (moving = true));
                else if (T < 8) u = 1;
                else if (T < 12) ((u = 1 - (T - 8) / 4), (moving = true));
                u = u * u * (3 - 2 * u);
                c.x = 0;
                c.y = -u * B * 0.45;
                if (moving) {
                    const s = Math.sin(T * Math.PI * 2.4);
                    hop = -Math.abs(s) * R * 0.05;
                    rot = s * 4;
                } else {
                    sy = 1 + Math.sin(t * 9 + c.ph) * 0.02; // 啃葉子
                    rot = Math.sin(t * 1.2 + c.ph) * 1.5;
                }
            } else if (m === 'surf') {
                // 橫向振幅用 ppd 限制在 ±1.1 度內，縮小地圖時才不會衝上陸地
                const w = (t + c.ph) * 0.5;
                c.x = Math.sin(w) * Math.min(B * 1.6, (c.ppd || 9999) * 1.1);
                c.y = 0;
                c.dir = faceDir(c, Math.cos(w));
                hop = -Math.abs(Math.sin((t + c.ph) * 2.2)) * R * 0.12;
                rot = Math.sin((t + c.ph) * 1.5) * 8;
            } else if (m === 'ski') {
                // 之字形滑下山坡，滑到底淡出再從上面出現
                const u = ((t + c.ph) % 7) / 7,
                    z = Math.PI * 6;
                c.x = (u - 0.5) * B * 2.4 + Math.sin(u * z) * B * 0.35;
                c.y = (u - 0.5) * B * 1.1;
                c.dir = faceDir(c, 2.4 + Math.cos(u * z) * 0.35 * z);
                rot = Math.cos(u * z) * 10;
                op = Math.min(1, u / 0.08, (1 - u) / 0.1);
            }
            if (c.d.sea && cloudHits.length) {
                const cv = 1 - cloudCover(c.sx + c.x, c.sy + c.y - c.size * 0.3);
                op *= cv;
                wake *= cv;
            }
            const lift = Math.max(0, Math.min(1, -hop / (R * 0.35)));
            c.shadow.setAttribute('transform', `scale(${(1 - lift * 0.4).toFixed(3)})`);
            c.shadow.style.opacity = c.d.noShadow ? '0' : (c.d.sea ? 0.42 * wake : 0.45 * (1 - lift * 0.5) * op).toFixed(2);
            c.body.style.opacity = op.toFixed(2);
            // 夜間暗化：依晨昏線壓低亮度（海上生物依浮沉位置估算當前經緯）
            {
                const nb = nightBrightAt(c.d.lon, c.d.lat);
                if (nb < 1) {
                    // 動物在夜晚最暗到 0.5（比旗幟更暗沒關係，它們不是文字資訊）
                    const br = (0.5 + nb * 0.5).toFixed(2);
                    c.body.style.filter = `brightness(${br}) hue-rotate(${Math.round((1 - nb) * -15)}deg)`;
                } else {
                    c.body.style.filter = '';
                }
            }
            c.wk.setAttribute('transform', `translate(${c.x.toFixed(2)},${c.y.toFixed(2)})`);
            c.body.setAttribute(
                'transform',
                `translate(0,${hop.toFixed(2)}) rotate(${rot.toFixed(1)}) scale(${c.dir},${sy.toFixed(3)})`,
            );
        }
    }

    /* ---------- 雲：固定在地球上的卡通雲 + 地面上的雲影 ---------- */
    let cctx = null,
        cloudT = 0;
    const clouds = [];
    const rng = (seed) => {
        let s = seed >>> 0;
        return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    };
    // 用幾顆圓疊出蓬鬆的雲：底色偏藍灰，每顆圓往上偏一點蓋白色漸層，底部切平，最後輕微模糊讓邊緣柔和
    function makeCloudSprite(seed) {
        const r = rng(seed),
            w = 320,
            h = 200,
            base = h * 0.74;
        const puffs = [];
        const nb = 4 + Math.floor(r() * 2);
        for (let i = 0; i < nb; i++)
            puffs.push([w * (0.2 + (0.6 * i) / (nb - 1)) + (r() - 0.5) * 14, h * 0.62, w * (0.11 + r() * 0.05)]);
        const nt = 2 + Math.floor(r() * 2);
        for (let i = 0; i < nt; i++)
            puffs.push([
                w * (0.36 + (0.28 * i) / Math.max(1, nt - 1)) + (r() - 0.5) * 20,
                h * (0.42 + r() * 0.06),
                w * (0.14 + r() * 0.06),
            ]);
        const canvas = () => {
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            return c;
        };
        const blob = (g, fill) => {
            g.fillStyle = fill;
            g.beginPath();
            for (const [x, y, rr] of puffs) {
                g.moveTo(x + rr, y);
                g.arc(x, y, rr, 0, Math.PI * 2);
            }
            g.fill();
        };
        const raw = canvas(),
            g = raw.getContext('2d');
        blob(g, '#a7b9d2');
        for (const [x, y, rr] of puffs) {
            const gr = g.createRadialGradient(x - rr * 0.35, y - rr * 0.5, rr * 0.1, x, y - rr * 0.12, rr);
            gr.addColorStop(0, '#ffffff');
            gr.addColorStop(0.65, '#f4f8fd');
            gr.addColorStop(1, '#d3dfee');
            g.fillStyle = gr;
            g.beginPath();
            g.arc(x, y - rr * 0.13, rr * 0.93, 0, Math.PI * 2);
            g.fill();
        }
        // 底部漸漸變透明（不要一刀切平，否則像貼紙）
        g.globalCompositeOperation = 'destination-out';
        const cut = g.createLinearGradient(0, base - 18, 0, base + 14);
        cut.addColorStop(0, 'rgba(0,0,0,0)');
        cut.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = cut;
        g.fillRect(0, base - 18, w, h - base + 18);
        g.globalCompositeOperation = 'source-atop';
        const band = g.createLinearGradient(0, base - 34, 0, base);
        band.addColorStop(0, 'rgba(150,172,204,0)');
        band.addColorStop(1, 'rgba(150,172,204,.75)');
        g.fillStyle = band;
        g.fillRect(0, base - 34, w, 34);
        const body = canvas(),
            b = body.getContext('2d');
        b.filter = 'blur(1.2px)';
        b.drawImage(raw, 0, 0);
        // 地上的雲影：同樣的外形塗深色，再大幅模糊
        const sil = canvas(),
            s = sil.getContext('2d');
        s.drawImage(raw, 0, 0);
        s.globalCompositeOperation = 'source-in';
        s.fillStyle = '#0a1a2c';
        s.fillRect(0, 0, w, h);
        const shadow = canvas(),
            sh = shadow.getContext('2d');
        sh.filter = 'blur(9px)';
        sh.drawImage(sil, 0, 0);
        return { body, shadow };
    }
    function buildClouds() {
        cctx = $('#clouds').getContext('2d');
        const sprites = [0, 1, 2, 3].map((i) => makeCloudSprite(1234 + i * 777));
        const r = rng(42);
        for (let i = 0; i < CLOUD_N; i++) {
            clouds.push({
                lon: -180 + 360 * ((i + r() * 0.8) / CLOUD_N),
                lat: -42 + r() * 104,
                w: 24 + r() * 42, // 縮小整體尺寸（之前 48~108），比較不佔畫面空間
                sp: sprites[i % 4],
                a: 0.38 + r() * 0.32, // 更透明、深淺不一，看起來比較自然（之前 0.6~0.8 偏厚重）
                v: 0.7 + r() * 0.6,
            });
        }
    }
    // 這一幀的雲（螢幕座標的橢圓）：海上的小角色飄到雲下時要淡出，不然會變成站在雲上
    const cloudHits = [];
    function cloudCover(x, y) {
        let cv = 0;
        for (const h of cloudHits) {
            const d = Math.hypot((x - h.cx) / h.rx, (y - h.cy) / h.ry);
            if (d < 1.15) cv = Math.max(cv, h.a * Math.min(1, (1.15 - d) / 0.4));
        }
        return Math.min(1, cv * 1.2);
    }
    function drawClouds(dt) {
        cloudHits.length = 0;
        if (!cctx || !W || !projection) return;
        const ctx = cctx,
            t = state.t,
            k = t.k,
            ww = S0 * k;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const fade = Math.max(0, Math.min(1, (4.5 - k) / 2.5)); // 放大到 4.5 倍以上就看不到雲
        if (!fade) return;
        if (state.anim && !reduceMotion.matches) cloudT += dt;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const sc = Math.pow(k, 0.6); // 位置完全跟著地圖；大小只略微放大，免得近看時整片白
        const list = [];
        for (const c of clouds) {
            const lon = c.lon + cloudT * CLOUD_WIND * c.v;
            const fx = ((((lon + 180) / 360) % 1) + 1) % 1;
            const w = c.w * sc,
                h = w * 0.625;
            const y = t.applyY(projection([0, c.lat])[1]) - h * 0.6;
            if (y > H || y + h < 0) continue;
            for (const x0 of [t.x + fx * ww - ww, t.x + fx * ww, t.x + fx * ww + ww]) {
                const x = x0 - w / 2;
                if (x < W + w * 0.3 && x + w * 1.3 > 0) list.push([c, x, y, w, h]);
            }
        }
        // 先畫全部雲影（往右下偏，光從左上來），再畫雲
        ctx.globalAlpha = 0.2 * fade;
        for (const [c, x, y, w, h] of list) ctx.drawImage(c.sp.shadow, x + w * 0.16, y + w * 0.3, w, h);
        for (const [c, x, y, w, h] of list) {
            ctx.globalAlpha = c.a * fade;
            ctx.drawImage(c.sp.body, x, y, w, h);
            cloudHits.push({ cx: x + w * 0.5, cy: y + h * 0.55, rx: w * 0.42, ry: h * 0.26, a: c.a * fade });
        }
        ctx.globalAlpha = 1;
    }

    // 北歐極光：用低解析度的大張畫布畫結光簾（預先繪好的 1×128 漸層條拉伸、疊加），24fps，不在畫面內或放大太多就不畫
    const AURORA = { cv: null, ctx: null, sprites: null, acc: 0, t: 0, drawn: false };
    function auroraSprites() {
        const mk = (stops) => {
            const c = document.createElement('canvas');
            c.width = 1;
            c.height = 128;
            const g = c.getContext('2d'),
                gr = g.createLinearGradient(0, 128, 0, 0);
            stops.forEach(([o, col]) => gr.addColorStop(o, col));
            g.fillStyle = gr;
            g.fillRect(0, 0, 1, 128);
            return c;
        };
        return [
            mk([
                [0, 'rgba(60,255,160,0)'],
                [0.06, 'rgba(150,255,205,.95)'],
                [0.3, 'rgba(70,235,150,.6)'],
                [0.65, 'rgba(60,180,220,.28)'],
                [1, 'rgba(150,90,230,0)'],
            ]),
            mk([
                [0, 'rgba(120,255,200,0)'],
                [0.1, 'rgba(90,240,230,.7)'],
                [0.45, 'rgba(110,140,255,.35)'],
                [0.8, 'rgba(200,90,240,.3)'],
                [1, 'rgba(230,80,200,0)'],
            ]),
        ];
    }
    function drawAurora(dt) {
        const A = AURORA;
        if (!A.cv) {
            A.cv = $('#aurora');
            if (!A.cv) return;
            A.ctx = A.cv.getContext('2d');
            A.sprites = auroraSprites();
        }
        if (!W || !projection) return;
        if (state.anim && !reduceMotion.matches) A.t += dt;
        A.acc += dt;
        if (A.acc < 1 / 24 && A.drawn) return;
        A.acc = 0;
        const S = 0.4,
            cw = Math.max(1, Math.ceil(W * S)),
            ch = Math.max(1, Math.ceil(H * S));
        if (A.cv.width !== cw || A.cv.height !== ch) {
            A.cv.width = cw;
            A.cv.height = ch;
        }
        const ctx = A.ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cw, ch);
        A.drawn = true;
        const fade = Math.max(0, Math.min(1, (9 - state.t.k) / 3));
        if (!fade) return;
        const LON0 = -6,
            LON1 = 44,
            N = 72;
        const xa = screenXY(LON0, 70)[0],
            xb = screenXY(LON1, 70)[0],
            yTop = screenXY(18, 80)[1],
            yBot = screenXY(18, 64)[1];
        if (xb < 0 || xa > W || yBot < 0 || yTop > H || xb <= xa) return;
        const T = A.t,
            gap = (xb - xa) / (N - 1),
            colW = Math.max(1.6, gap * 1.9),
            night = 0.7 + 0.3 * (1 - nightBrightAt(18, 69));
        ctx.globalCompositeOperation = 'lighter';
        for (let cu = 0; cu < 3; cu++) {
            const spr = A.sprites[cu === 1 ? 1 : 0],
                gain = [0.95, 0.65, 0.5][cu];
            for (let i = 0; i < N; i++) {
                const lon = LON0 + ((LON1 - LON0) * i) / (N - 1),
                    lat = 66.5 + cu * 2.2 + 2.4 * Math.sin(lon * 0.085 + cu * 1.9) + 0.9 * Math.sin(lon * 0.31 + T * 0.4 + cu);
                const [x, y] = screenXY(lon, lat),
                    hpx = (y - screenXY(lon, lat + 9)[1]) * 1.15;
                const env = Math.pow(Math.sin((Math.PI * i) / (N - 1)), 0.7),
                    ray = 0.55 + 0.3 * Math.sin(i * 0.45 + T * 0.9 + cu * 2) + 0.15 * Math.sin(i * 1.7 - T * 1.6),
                    h = hpx * ray,
                    sx = x + Math.sin(T * 0.5 + i * 0.15 + cu) * hpx * 0.08;
                ctx.globalAlpha = Math.max(0, fade * env * night * gain * (0.55 + 0.3 * Math.sin(T * 1.1 + i * 0.2 + cu)));
                ctx.drawImage(spr, 0, 0, 1, 128, (sx - colW / 2) * S, (y - h) * S, colW * S, h * S);
            }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    // 藍眼淚（生物螢光海）：在特定海岸夜晚顯示藍色波光，仿北極光架構，共用同一個 canvas
    // 效能：24fps 節流、低解析度、放大太多（k>8）就不畫
    const BIOLUM_SPOTS = [
        // [中心經度, 中心緯度, 半徑度數, 方向角（光帶方向，0=水平）]
        { lon: 119.9, lat: 26.2, r: 0.8  },  // 馬祖列島
        { lon: 121.5, lat: 25.1, r: 0.5  },  // 台灣東北海岸
        { lon: -65.4, lat: 18.1, r: 1.0  },  // 波多黎各 Vieques
        { lon:  73.5, lat:  4.0, r: 1.2  },  // 馬爾地夫 Vaadhoo
        { lon: 150.7, lat:-35.1, r: 0.9  },  // 澳洲 Jervis Bay
    ];
    let _biolumSprite = null;
    function biolumSprite() {
        if (_biolumSprite) return _biolumSprite;
        const c = document.createElement('canvas');
        c.width = 1; c.height = 64;
        const g = c.getContext('2d'),
            gr = g.createLinearGradient(0, 64, 0, 0);
        gr.addColorStop(0,   'rgba(0,100,220,0)');
        gr.addColorStop(0.1, 'rgba(20,160,255,.85)');
        gr.addColorStop(0.35,'rgba(40,220,255,.55)');
        gr.addColorStop(0.65,'rgba(60,180,255,.25)');
        gr.addColorStop(1,   'rgba(100,220,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 1, 64);
        _biolumSprite = c;
        return c;
    }
    function drawBiolum(dt) {
        const A = AURORA; // 共用 canvas / ctx / acc / t
        if (!A.cv || !W || !projection) return;
        const fade0 = Math.max(0, Math.min(1, (9 - state.t.k) / 3)); // 放大太多就淡出
        if (!fade0) return;
        const ctx = A.ctx, S = 0.4, T = A.t;
        const spr = biolumSprite();
        ctx.globalCompositeOperation = 'lighter';
        for (const sp of BIOLUM_SPOTS) {
            const night = 1 - nightBrightAt(sp.lon, sp.lat);
            if (night < 0.3) continue; // 白天跳過
            const fade = fade0 * Math.max(0, (night - 0.3) / 0.7);
            // 沿海岸線排 N 個發光點
            const N = 28, r = sp.r;
            for (let i = 0; i < N; i++) {
                const a = (i / N) * Math.PI * 2;
                const lon = sp.lon + Math.cos(a) * r * 1.8,
                      lat = sp.lat + Math.sin(a) * r * 0.6;
                const [x, y] = screenXY(lon, lat);
                if (x < -80 || x > W + 80 || y < -80 || y > H + 80) continue;
                // 波光：每個點高度隨時間 sin 波動
                const wave = 0.45 + 0.35 * Math.sin(i * 0.65 + T * 2.2 + sp.lon * 0.1)
                           + 0.2  * Math.sin(i * 1.3  - T * 1.5);
                const hpx = Math.max(4, (screenXY(lon, lat + r * 0.5)[1] - y) * -1.2);
                const env = Math.pow(Math.sin((Math.PI * i) / N), 0.5); // 淡入淡出
                const colW = Math.max(2, hpx * 0.9);
                ctx.globalAlpha = Math.max(0, fade * env * wave * 0.75);
                ctx.drawImage(spr, 0, 0, 1, 64,
                    (x - colW / 2) * S, (y - hpx * wave) * S,
                    colW * S, hpx * wave * S);
            }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    // ── 煙火 & 烏雲效果 ───────────────────────────────────────────────────────
    // 主要指數漲≥2%：上空放煙火；跌≥2%：上空出現烏雲+雨滴
    // 使用 #fx canvas（在 SVG 之上），確保烏雲覆蓋船隻/動物
    const WEATHER_T = { t: 0, cv: null, ctx: null }; // 獨立時間，不和極光共用

    // 預繪 sprite：煙火粒子（小圓點漸層）、雨滴（垂直線）
    let _fwSprites = new Map(), _rainSprite = null, _cloudSprite = null;
    // 依顏色快取 sprite（白核心 → 該顏色 → 透明），避免 shadowBlur 的昂貴即時運算
    function fwSprite(col) {
        const key = col.join(',');
        if (_fwSprites.has(key)) return _fwSprites.get(key);
        const c = document.createElement('canvas');
        c.width = 16; c.height = 16;
        const g = c.getContext('2d'),
            gr = g.createRadialGradient(8, 8, 0, 8, 8, 8);
        gr.addColorStop(0,   'rgba(255,255,255,1)');
        gr.addColorStop(0.35, `rgba(${col[0]},${col[1]},${col[2]},1)`);
        gr.addColorStop(1,   `rgba(${col[0]},${col[1]},${col[2]},0)`);
        g.fillStyle = gr;
        g.fillRect(0, 0, 16, 16);
        _fwSprites.set(key, c);
        return c;
    }
    function rainSprite() {
        if (_rainSprite) return _rainSprite;
        const c = document.createElement('canvas');
        c.width = 2; c.height = 18;
        const g = c.getContext('2d'),
            gr = g.createLinearGradient(0, 0, 0, 18);
        gr.addColorStop(0,   'rgba(120,160,220,0)');
        gr.addColorStop(0.3, 'rgba(140,180,240,.7)');
        gr.addColorStop(1,   'rgba(100,140,200,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 2, 18);
        return (_rainSprite = c);
    }
    function cloudSprite() {
        if (_cloudSprite) return _cloudSprite;
        const c = document.createElement('canvas');
        c.width = 64; c.height = 40; // 高度從 32→40，更飽滿
        const g = c.getContext('2d');
        // 底層大橢圓（深灰，雲身主體）
        g.fillStyle = 'rgba(50,50,72,.65)';
        g.beginPath(); g.ellipse(32, 28, 28, 14, 0, 0, Math.PI * 2); g.fill();
        // 頂部凸起（讓雲有立體感）
        g.fillStyle = 'rgba(65,65,88,.7)';
        g.beginPath(); g.ellipse(22, 20, 16, 13, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(38, 17, 15, 13, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(50, 22, 12, 10, 0, 0, Math.PI * 2); g.fill();
        // 頂部亮邊（讓雲看起來有光感）
        g.fillStyle = 'rgba(100,100,130,.3)';
        g.beginPath(); g.ellipse(28, 17, 12, 8, 0, 0, Math.PI * 2); g.fill();
        return (_cloudSprite = c);
    }

    // 煙火：每個國家同時只有一顆煙火（發射 → 升空 → 爆炸成多層同心圓 → 一起變大 → 閃爍淡出）
    const FW_STATE = new Map(); // s → shell 物件
    // 3 層同心圓：[該層點數, 半徑比例(相對最外層), 展開延遲(秒)]
    const FW_RINGS = [
        { n: 10, scale: 1.0,  delay: 0 },    // 最外層：先展開
        { n: 14, scale: 0.65, delay: 0.12 }, // 中層：稍晚一點
        { n: 8,  scale: 0.3,  delay: 0.22 }, // 內層：最晚展開，製造層次感
    ];
    const FW_COLORS = [
        [255,255,180], [255,80,80], [80,200,255],
        [255,120,255], [80,255,160], [255,160,40],
    ];
    // 推進單一國家的煙火狀態機；cx,cy 是旗幟上方的天空座標
    function stepFw(key, T, dt, cx, cy) {
        let sh = FW_STATE.get(key);
        if (!sh || sh.phase === 'done') {
            // 還沒輪到發射：等待隨機間隔
            if (sh && sh.phase === 'done' && T < sh.nextAt) return sh;
            sh = {
                phase: 'launch',
                x: cx + (Math.random() - 0.5) * 20,
                y: cy + 55,          // 從旗幟上方一點的位置發射
                ty: cy - 35 - Math.random() * 25, // 爆炸高度
                t: 0,
                col: FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)],
                // 每層每點各自的閃爍相位
                seeds: FW_RINGS.map(ring => Array.from({ length: ring.n }, () => Math.random() * 10)),
            };
            FW_STATE.set(key, sh);
        }
        sh.t += dt;
        if (sh.phase === 'launch') {
            const dur = 0.5;
            const p = Math.min(1, sh.t / dur);
            sh.y = (cy + 55) + (sh.ty - (cy + 55)) * (1 - Math.pow(1 - p, 2)); // ease-out 上升
            if (p >= 1) { sh.phase = 'burst'; sh.t = 0; sh.bx = sh.x; sh.by = sh.ty; }
        } else if (sh.phase === 'burst') {
            const dur = 1.7;
            const p = Math.min(1, sh.t / dur);
            sh.maxRadius = 42 * (1 - Math.pow(1 - p, 2)); // 最外層半徑上限（ease-out）
            // 亮度曲線：前 70% 維持全亮，最後 30% 才淡出（避免整段都在變暗，看起來忽隱忽現）
            sh.fade = p < 0.7 ? 1 : Math.max(0, 1 - (p - 0.7) / 0.3);
            if (sh.t >= dur) {
                sh.phase = 'done';
                sh.nextAt = T + 0.8 + Math.random() * 1.0; // 下一顆的間隔
            }
        }
        return sh;
    }


    function drawWeather(dt) {
        // 畫在獨立的 #wfx canvas（在 SVG 之後，蓋在國界/旗幟/卡片上面）：
        // 煙火、烏雲蓋在卡片上沒關係（烏雲有形成→消散的呼吸週期，不會一直擋住），
        // 但要跟一般裝飾雲（#clouds，在 SVG 之前）分開，裝飾雲不能擋卡片
        const WT = WEATHER_T;
        if (!WT.cv) {
            WT.cv = $('#wfx');
            if (!WT.cv) return;
            WT.ctx = WT.cv.getContext('2d');
        }
        if (!W || !projection) return;
        if (!state.maps || !state.maps.length) return;
        WT.t += dt;
        const T = WT.t;
        const ctx = WT.ctx;
        const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
        if (WT.cv.width !== cw || WT.cv.height !== ch) {
            WT.cv.width = cw;
            WT.cv.height = ch;
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cw, ch);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const rspr = rainSprite(), cspr = cloudSprite();

        for (const m of state.maps) {
            if (!m.pin) continue;
            const q = state.quotes[m.s];
            if (!q || Math.abs(q.pct) < BIG_MOVE) { FW_STATE.delete(m.s); continue; }
            const [sx, sy] = screenXY(m.lon, m.lat);
            if (sx < -100 || sx > W + 100 || sy < -80 || sy > H + 80) continue;
            // 用固定螢幕像素位移到旗幟上方（不用經緯度位移：高倍率縮放時緯度位移換算的像素會爆增，
            // 導致放大到單一國家時煙火被推到畫面外完全看不到）
            const skyY = sy - 70;

            if (q.pct >= BIG_MOVE) {
                // ── 煙火：發射上升 → 爆炸成圓球 → 慢慢變大 → 閃爍淡出 ──
                const sh = stepFw(m.s, T, dt, sx, skyY);
                if (sh.phase === 'launch') {
                    // 上升軌跡：淡淡深色暈 + 亮點 + 拖尾
                    const spr = fwSprite(sh.col);
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.globalAlpha = 0.15;
                    ctx.beginPath();
                    ctx.arc(sh.x, sh.y, 4, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(15,15,35,1)';
                    ctx.fill();
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = 1;
                    ctx.drawImage(spr, 0, 0, 16, 16, sh.x - 3.5, sh.y - 3.5, 7, 7);
                    ctx.globalAlpha = 0.5;
                    ctx.drawImage(spr, 0, 0, 16, 16, sh.x - 2, sh.y + 5, 4, 10);
                } else if (sh.phase === 'burst') {
                    // 多層同心圓：每層各自延遲展開、各自半徑比例，點與點之間用各自相位閃爍
                    const spr = fwSprite(sh.col);
                    for (let ri = 0; ri < FW_RINGS.length; ri++) {
                        const ring = FW_RINGS[ri];
                        // 這層的展開進度：扣掉延遲後才開始跑（延遲前半徑是 0，不畫）
                        const localT = Math.max(0, sh.t - ring.delay);
                        if (localT <= 0) continue;
                        const radius = sh.maxRadius * ring.scale;
                        if (radius <= 0) continue;
                        for (let i = 0; i < ring.n; i++) {
                            const a = (i / ring.n) * Math.PI * 2 + ri * 0.3; // 每層錯開角度，不會疊成放射線
                            const px = sh.bx + Math.cos(a) * radius,
                                  py = sh.by + Math.sin(a) * radius * 0.85; // 略扁一點更像煙火
                            const twinkle = 0.5 + 0.5 * Math.sin(T * 9 + sh.seeds[ri][i]);
                            const sz = 4.2 + twinkle * 2.2;
                            // 先畫淡淡的深色暈墊底，只是微微提升對比，不是實心黑圈
                            ctx.globalCompositeOperation = 'source-over';
                            ctx.globalAlpha = sh.fade * 0.18;
                            ctx.beginPath();
                            ctx.arc(px, py, sz * 0.85, 0, Math.PI * 2);
                            ctx.fillStyle = 'rgba(15,15,35,1)';
                            ctx.fill();
                            // 再疊上亮點（lighter，發光感）
                            ctx.globalCompositeOperation = 'lighter';
                            const alpha = sh.fade * (0.7 + twinkle * 0.3); // 基礎亮度拉高
                            ctx.globalAlpha = alpha;
                            ctx.drawImage(spr, 0, 0, 16, 16,
                                px - sz, py - sz, sz * 2, sz * 2);
                        }
                    }
                    // 中心核心光球（讓整體看起來更圓更飽滿）
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = sh.fade * 0.6;
                    const coreSz = sh.maxRadius * 0.28;
                    ctx.drawImage(spr, 0, 0, 16, 16,
                        sh.bx - coreSz, sh.by - coreSz, coreSz * 2, coreSz * 2);
                }
                ctx.globalCompositeOperation = 'source-over';
            } else {
                // ── 烏雲 + 雨滴：有「形成→消散→重新形成」的呼吸週期，不會一直擋住卡片 ──
                const CYCLE = 7; // 一次呼吸週期秒數
                // 每個國家用代碼算一個固定相位偏移，週期才不會同步，看起來更自然
                let seed = 0;
                for (let ci = 0; ci < m.s.length; ci++) seed = (seed * 31 + m.s.charCodeAt(ci)) % 9973;
                const offset = (seed % 1000) / 1000 * CYCLE;
                const phase = ((T + offset) % CYCLE) / CYCLE; // 0~1
                // 半正弦波：0 時完全消散（看得到卡片）、0.5 時完全成形（最濃）、1 時又回到消散
                const breath = Math.sin(phase * Math.PI);
                if (breath < 0.03) continue; // 幾乎消散時直接跳過，省運算，也確保卡片完全看得清楚

                const k = state.t.k;
                const cloudW = Math.max(22, Math.min(58, 42 / Math.sqrt(Math.max(1, k * 0.7)))) * (0.7 + breath * 0.3);
                const rainW  = cloudW * 0.92;
                const CLOUD_H = 32 * (0.7 + breath * 0.3);
                ctx.globalCompositeOperation = 'source-over';
                for (let ci = 0; ci < 3; ci++) {
                    const cx2 = sx + (ci - 1) * cloudW * 0.55 + Math.sin(T * 0.2 + ci) * 3,
                          cy2 = skyY + Math.cos(T * 0.18 + ci * 1.5) * 2.5;
                    ctx.globalAlpha = 0.82 * breath;
                    ctx.drawImage(cspr, 0, 0, 64, 40,
                        cx2 - cloudW / 2, cy2 - CLOUD_H / 2,
                        cloudW, CLOUD_H);
                }
                const N_RAIN = 20;
                for (let ri = 0; ri < N_RAIN; ri++) {
                    const r_phase = (ri / N_RAIN + T * 0.22 + ri * 0.11) % 1;
                    const rx = sx + (ri / N_RAIN - 0.5) * rainW,
                          ry = skyY + CLOUD_H / 2 + r_phase * 38;
                    ctx.globalAlpha = Math.sin(r_phase * Math.PI) * 0.55 * breath;
                    ctx.drawImage(rspr, 0, 0, 2, 18,
                        rx - 1, ry, 2, 18);
                }
            }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    function buildSvg() {
        svg = d3.select('#map');
        const cv = $('#terrain');
        tctx = cv.getContext('2d', { alpha: false });
        Terrain.init({ dem: DEM_URL, img: IMG_URL, maxZ: MAX_TILE_Z, onUpdate: scheduleTerrain });
        // 透明的觸控層，讓空白處也能拖曳 / 縮放
        svg.append('rect').attr('class', 'hit').attr('fill', 'transparent');

        gZoom = svg.append('g');
        // 東西向無限循環：國界畫兩份真的路徑（本體 + 右邊副本），平移時接在一起。
        // 不用 SVG <use> 複製，因為 Chrome 重建 <use> 副本時半透明填色會掉成預設的黑色。
        // gLand / gLine / gEdge 各是「兩個群組」的選取，資料綁定和上色會同時套到兩份。
        for (let i = 0; i < 2; i++) {
            const w = gZoom.append('g').attr('class', 'world');
            // 文明帝國式國界三層：寬而淡的漲跌色光暈（land）→ 清楚的漲跌色主線（line）→ 中央白色細線（edge）
            w.append('g').attr('class', 'land');
            w.append('g').attr('class', 'line');
            w.append('g').attr('class', 'edge');
        }
        gWorlds = gZoom.selectAll('g.world');
        gLand = gZoom.selectAll('g.land');
        gLine = gZoom.selectAll('g.line');
        gEdge = gZoom.selectAll('g.edge');
        // 地緣動畫場景（油輪、貨櫃船、無人機；geoscenes.js）：在裝飾動物之下，才不會壓在船上面
        gGeo = svg.append('g').attr('class', 'geo-layer').style('pointer-events', 'none');
        gDecor = svg.append('g').attr('class', 'decor').style('pointer-events', 'none');
        // 夜空星星層（在 terrain canvas 上、動物下）
        gStars = svg.insert('g', '.decor').attr('class', 'stars').style('pointer-events', 'none');
        buildStars();
        // 台股市值前十大公司的建築（corps.js），在動物和旗幟下面
        gCorp = svg.append('g');
        // 暫時不顯示台股前十大的公司建築：設成 true 就會恢復（corps.js 完整保留；不建立時 Corps.layout() 會回傳空陣列，
        // 排版、旗幟避讓和小人都不受影響）。市值排行的資料與旗幟上的前十大名單照常運作
        const SHOW_CORP_BUILDINGS = false;
        if (window.Corps && SHOW_CORP_BUILDINGS) Corps.build(gCorp.node(), { onPick: openCorp });
        // 原住民小人獨立一層，畫在公司建築上面：台灣縮小時整座島都是建築（小城市比島還大），小人才不會被蓋住看不見
        gFolk = svg.append('g').attr('class', 'folk-layer').style('pointer-events', 'none');
        // 央行、白宮等地標圖示
        gLm = svg.append('g').attr('class', 'landmarks');
        gMk = svg.append('g').attr('class', 'markers');
        // 天氣效果（烏雲/煙火）：在動物上、旗幟下
        gWeather = svg.append('g').attr('class', 'weather-layer').style('pointer-events', 'none');
        // 旗幟獨立一層畫在所有動物上方：不用再重排 DOM 節點（重排會讓 iOS Safari 的國旗圖片閃成空白）
        gBub = svg.append('g').attr('class', 'bubbles');
        // 商品 / 債券 / 利率 / 匯率 / 地緣 / 經濟數據的卡片
        gTopic = svg.append('g').attr('class', 'topics').style('display', 'none');

        buildCritters();
        buildClouds();

        buildDefs();
        const g = gMk
            .selectAll('g.mk')
            .data(state.maps, (d) => d.s)
            .enter()
            .append('g')
            .attr('class', 'mk')
            .on('click', (e, d) => openCard(d))
            .on('mouseenter', (e, d) => setHover(d, true, e))
            .on('mouseleave', (e, d) => setHover(d, false, e));
        g.each(function (d) {
            const s = d3.select(this);
            // 3D 動物：原點就是牠腳踩的地面，會在自己國家附近走動，所以整組放在 walker 裡
            const an = s.append('g').attr('class', 'an');
            const wk = an.append('g').attr('class', 'walker');
            wk.append('ellipse').attr('class', 'ring'); // 開盤中：地面上擴散的光圈
            const shadow = wk.append('ellipse').attr('class', 'shadow').attr('filter', 'url(#soft)');
            const body = wk.append('g').attr('class', 'body');
            const info = animalOf(d.a);
            if (info) {
                const img = body
                    .append('image')
                    .attr('class', 'beast')
                    .attr('href', info.src)
                    .attr('filter', 'url(#cast)')
                    .attr('preserveAspectRatio', 'xMidYMax meet');
                // 圖檔載入失敗就退回 emoji
                img.on('error', () => {
                    img.remove();
                    body.append('text').attr('class', 'emoji').text(d.a);
                    scheduleLayout();
                });
            } else body.append('text').attr('class', 'emoji').text(d.a);
            const mood = wk.append('text').attr('class', 'mood');
            walkers.set(d.s, {
                wk: wk.node(),
                body: body.node(),
                shadow: shadow.node(),
                mood: mood.node(),
                face: info ? info.face : 'L',
                gait: info ? info.gait : 'walk',
                x: 0,
                y: 0,
                tx: 0,
                ty: 0,
                wait: (hash(d.s) % 30) / 10,
                dir: 1,
                ph: 0,
            });
            // 文明帝國式城市旗幟：深色外框 + 金色細邊 + 內側淡金線，左上角放國旗
            const b = buildBanner(
                gBub
                    .append('g')
                    .attr('class', 'mk bk')
                    .on('click', () => openCard(d))
                    .on('mouseenter', (e) => setHover(d, true, e, true))
                    .on('mouseleave', (e) => setHover(d, false, e, true))
                    .each(function () {
                        d.bk = this;
                    }),
            );
            const fs = flagSrc(d.flag);
            if (fs) {
                b.append('image').attr('class', 'flag').attr('href', fs).attr('preserveAspectRatio', 'none');
                b.append('rect').attr('class', 'flag-b').attr('rx', 1.5);
            }
            // 旗幟離自己的國家很遠時（電腦版），畫一條虛線連回動物，才看得出是哪個國家
            const ml = b.insert('g', ':first-child').attr('class', 'mlead').style('display', 'none');
            ml.append('line');
            ml.append('circle').attr('r', 3);
            b.append('rect').attr('class', 'fl').attr('rx', 4); // 報價更新時，數字區塊閃一下的光
            b.append('rect').attr('class', 'hl').attr('rx', 3).style('display', 'none'); // 漲跌幅超過 2% 的底色
            const t1 = b.append('text').attr('class', 't1');
            t1.append('tspan').attr('class', 'a');
            t1.append('tspan').attr('class', 'm');
            // 色帶右側：報價時間（開盤中顯示時:分，收盤後顯示日期），深色底小膠囊，才不會和國名混在一起
            b.append('rect').attr('class', 'tsb').attr('rx', 5);
            b.append('text').attr('class', 'ts');
            const t2 = b.append('text').attr('class', 't2');
            t2.append('tspan').attr('class', 'lb');
            t2.append('tspan').attr('class', 'va');
            t2.append('tspan').attr('class', 'pc').attr('dx', 5);
            // 同一國家有多個指數（例如美國：標普 / 那斯達克 / 道瓊 / 費城半導體）
            // 單一指數、但有市值前十大公司列的國家（d.top）也要有 rows（放大時才會用到）
            if (d.group.length > 1 || d.top) {
                const rows = b.append('g').attr('class', 'rows');
                const mkRow = (label) => {
                    const r = rows.append('g').attr('class', 'row');
                    r.append('rect').attr('class', 'rbg');
                    r.append('rect').attr('class', 'rhl').attr('rx', 3).style('display', 'none');
                    r.append('text').attr('class', 'rn').text(label);
                    r.append('text').attr('class', 'rk'); // 公司列的名次（獨立一個字，顏色和名稱不同）
                    r.append('text').attr('class', 'rv');
                    r.append('text').attr('class', 'rp');
                };
                (d.group10 || d.group).forEach((x) => mkRow(x.abbr || x.zh));
                // markets.json 的 extra: "corps"（台灣）：放大時在指數下面多列一條分隔標題 + 市值前十大公司
                if (d.extra === 'corps' || d.top) for (let i = 0; i <= EXTRA_N; i++) mkRow('');
                const dots = b.append('g').attr('class', 'dots');
                (d.group10 || d.group).forEach(() => dots.append('circle').attr('r', 1.9));
            }
        });
        buildTopics();
        buildLandmarks();

        // d3 zoom 內部的 x 可以一直往左右累加；畫面上只用「繞回一圈內」的版本（state.t），世界就能無限循環
        zoomB = d3
            .zoom()
            .scaleExtent([1, 16])
            .on('zoom', (e) => {
                state.t = wrapT(e.transform);
                onTransform(!e.sourceEvent);
            });
        // 股市地圖的雙擊不放大：左鍵是用來降下災難的，連點時地圖才不會一直縮放
        zoomB.filter(
            (e) => (!e.ctrlKey || e.type === 'wheel') && !e.button && !(e.type === 'dblclick' && state.layer === 'stocks'),
        );
        svg.call(zoomB);

        // 上帝視角的災難（disasters.js，目前只在股市地圖）：左鍵點空白處（不是動物 / 旗幟）降下災難，右鍵選災難。
        // 拖曳地圖後放開不算點擊（d3-zoom 會吃掉那一下 click）。
        // 上帝之手先隱藏（ENABLE_GOD_HAND=false）：按鈕、點擊觸發都先關閉，未來真的要用再打開；程式碼整套保留不動
        if (ENABLE_GOD_HAND) {
            svg.on('click.dz', (e) => {
                if (state.layer !== 'stocks' || !window.Disasters || e.target.closest('.mk')) return;
                Disasters.handleClick(e.clientX, e.clientY);
            });
            svg.on('contextmenu.dz', (e) => {
                if (state.layer !== 'stocks' || !window.Disasters) return;
                e.preventDefault();
                Disasters.openMenu(e.clientX, e.clientY);
            });
        }
    }
    // 螢幕座標 → 經緯度（經度繞回 -180～180）
    function geoAt(x, y) {
        const t = state.t,
            p = projection.invert([(x - t.x) / t.k, (y - t.y) / t.k]);
        return [(((p[0] % 360) + 540) % 360) - 180, p[1]];
    }
    // 地緣動畫場景：局勢（ok / warn / bad）取自 markets.json 地緣卡片裡第一個有 tone 的資料列
    function initGeoScenes() {
        if (!window.GeoScenes) return;
        GeoScenes.init({
            layer: gGeo.node(),
            toScreen: screenXY,
            worldW: () => S0 * state.t.k,
            size: () => [W, H, dpr],
            zoom: () => state.t.k,
            enabled: () => state.layer === 'stocks', // 股市地圖的任何篩選都顯示
            reduce: () => !state.anim || reduceMotion.matches,
            tone: (id) => {
                const c = state.topics.find((x) => x.id === id),
                    r = c && c.rows.find((x) => x.tone);
                return r ? r.tone : null;
            },
            t: $t,
        });
        scheduleLayout();
    }
    function initDisasters() {
        if (!ENABLE_GOD_HAND || !window.Disasters) return;
        Disasters.init({
            stage: $('#stage'),
            canvas: $('#fx'),
            shakeEls: ['#terrain', '#clouds', '#aurora', '#map', '#fx'].map((s) => $(s)),
            enabled: () => state.layer === 'stocks',
            toScreen: screenXY,
            toGeo: geoAt,
            zoom: () => state.t.k,
            worldW: () => S0 * state.t.k,
            size: () => [W, H, dpr],
            reduce: () => !state.anim || reduceMotion.matches, // 關閉動畫或減少動態時，地震不搖晃畫面
            toast,
        });
    }

    // 3D 骰子：6 面是固定點數（對面相加為 7，1-6/3-4/2-5），用 CSS 轉動立方體本身讓對應那面朝前，
    // 不是切換圖案；DICE_SHOW_ROT 是「要讓第 n 面朝前」所需的 [rotateX, rotateY] 角度（配合 index.html 裡 .f1~.f6 的固定位置）
    const DICE_SHOW_ROT = {
        1: [0, 0],
        2: [90, 0],
        3: [0, -90],
        4: [0, 90],
        5: [-90, 0],
        6: [0, 180],
    };
    let diceRolling = false,
        diceSpinX = -18, // 目前累積角度，靜止時維持一個小傾角比較好看
        diceSpinY = 28;
    // 把目前角度往「前方」（正向增加）轉到 target（0~359 內的目標角度），外加 extraSpins 整圈，回傳新的累積角度
    function spinTo(current, target, extraSpins) {
        const forward = (((target % 360) - (current % 360)) % 360 + 360) % 360;
        return current + forward + 360 * extraSpins;
    }
    function initDice() {
        const btn = $('#diceBtn'),
            cube = $('#diceCube');
        if (!btn || !cube) return;
        cube.style.transform = `rotateX(${diceSpinX}deg) rotateY(${diceSpinY}deg)`;
        btn.addEventListener('click', () => {
            if (diceRolling) return;
            diceRolling = true;
            btn.classList.add('rolling');
            const reduce = !state.anim || reduceMotion.matches;
            const result = 1 + Math.floor(Math.random() * 6);
            const [showX, showY] = DICE_SHOW_ROT[result];
            const spins = reduce ? 0 : 2 + Math.floor(Math.random() * 2); // 多轉幾圈營造翻滾感
            diceSpinX = spinTo(diceSpinX, showX, spins);
            diceSpinY = spinTo(diceSpinY, showY, spins);
            cube.style.transition = reduce ? 'none' : '';
            cube.style.transform = `rotateX(${diceSpinX}deg) rotateY(${diceSpinY}deg)`;
            const DUR = reduce ? 0 : 900;
            setTimeout(() => {
                btn.classList.remove('rolling');
                diceRolling = false;
                toast(`🎲 ${$t('擲出 {n} 點！', { n: result })}`);
            }, DUR);
        });
    }

    function layoutGeometry() {
        const st = $('#stage');
        W = st.clientWidth;
        H = st.clientHeight;
        if (!W || !H) return;
        svg.attr('viewBox', `0 0 ${W} ${H}`);
        svg.select('rect.hit').attr('width', W).attr('height', H);

        // 高 DPI canvas
        dpr = Math.min(window.devicePixelRatio || 1, 3);
        for (const cv of [tctx.canvas, cctx.canvas]) {
            cv.width = Math.round(W * dpr);
            cv.height = Math.round(H * dpr);
        }

        // Web Mercator：世界是邊長 S0 的正方形，與圖磚座標完全對齊
        const unit = d3
            .geoMercator()
            .scale(1 / (2 * Math.PI))
            .translate([0.5, 0.5]);
        const yN = unit([0, VIEW_N])[1],
            yS = unit([0, VIEW_S])[1];
        S0 = Math.max(W, H / (yS - yN)); // 讓可視範圍在最小縮放時也能填滿畫面
        projection = d3
            .geoMercator()
            .scale(S0 / (2 * Math.PI))
            .translate([S0 / 2, S0 / 2]);
        viewBox = [
            [0, yN * S0],
            [S0, yS * S0],
        ];

        gLand.selectAll('path').data(state.countries).join('path');
        gLine.selectAll('path').data(state.countries).join('path');
        gEdge.selectAll('path').data(state.countries).join('path');
        worldLod.reset();
        folkLand.clear(); // 投影換了，國家輪廓要重建
        worldLandPath = null; // 季節色調的陸地遮罩也要重建（見 drawSeason）
        folkGen++;
        worldLod.update(state.t.k);
        textWCache.clear(); // 換尺寸可能跨過手機 / 桌機的字級設定
        gWorlds.attr('transform', (_, i) => (i ? `translate(${S0},0)` : null)); // 第二份接在世界右邊
        maxK = (Math.pow(2, MAX_TILE_Z + 1) * 256) / (S0 * dpr); // 最高層級再多放大 2 倍
        zoomB.extent([
            [0, 0],
            [W, H],
        ]);
        setZoomLimits();
        paintLand();
    }
    /* ---------- 邊界線的細緻度分級（LOD，世界國界用） ----------
     * 邊界線有大量折點，拖曳 / 縮放時瀏覽器每一幀都要重畫全部，是最主要的卡頓來源。
     * 依縮放倍率（每 2 倍一級）用 Douglas–Peucker 拿掉「螢幕上偏差小於 LOD_TOL 像素」的折點：
     * 畫出來的形狀肉眼看不出差別，但每幀要畫的頂點少很多。各級的路徑字串算一次就快取起來。 */
    const LOD_TOL = 0.5; // 允許的最大偏差（CSS 像素）
    // Douglas–Peucker：p 是 [x0, y0, x1, y1, ...]，標記 a..b 之間要保留的點
    function dpKeep(p, a, b, e2, keep) {
        const st = [a, b];
        while (st.length) {
            const j = st.pop(),
                i = st.pop();
            const ax = p[2 * i],
                ay = p[2 * i + 1],
                dx = p[2 * j] - ax,
                dy = p[2 * j + 1] - ay,
                L = dx * dx + dy * dy;
            let md = e2,
                mi = -1;
            for (let k = i + 1; k < j; k++) {
                let px = p[2 * k] - ax,
                    py = p[2 * k + 1] - ay;
                if (L > 0) {
                    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / L));
                    px -= t * dx;
                    py -= t * dy;
                }
                const d = px * px + py * py;
                if (d > md) {
                    md = d;
                    mi = k;
                }
            }
            if (mi >= 0) {
                keep[mi] = 1;
                st.push(i, mi, mi, j);
            }
        }
    }
    // 接在投影後面的串流：每條線 / 每個環先收集投影後的點，簡化完再送出
    function simplifier(eps) {
        const e2 = eps * eps;
        return (out) => {
            let pts = null,
                poly = false;
            return {
                point(x, y) {
                    if (pts) pts.push(x, y);
                    else out.point(x, y);
                },
                lineStart() {
                    pts = [];
                    out.lineStart();
                },
                lineEnd() {
                    const p = pts,
                        n = p.length / 2;
                    pts = null;
                    if (n <= 3) {
                        for (let i = 0; i < n; i++) out.point(p[2 * i], p[2 * i + 1]);
                        out.lineEnd();
                        return;
                    }
                    const keep = new Uint8Array(n + 1);
                    keep[0] = 1;
                    if (poly) {
                        // 環：先找離起點最遠的點當第二個錨點，小島縮到一個像素以下也還留得住
                        let f = 1,
                            fd = -1;
                        for (let i = 1; i < n; i++) {
                            const dx = p[2 * i] - p[0],
                                dy = p[2 * i + 1] - p[1],
                                d = dx * dx + dy * dy;
                            if (d > fd) {
                                fd = d;
                                f = i;
                            }
                        }
                        keep[f] = 1;
                        p.push(p[0], p[1]); // 補上閉合點，讓最後一段也一起簡化
                        dpKeep(p, 0, f, e2, keep);
                        dpKeep(p, f, n, e2, keep);
                    } else {
                        keep[n - 1] = 1;
                        dpKeep(p, 0, n - 1, e2, keep);
                    }
                    for (let i = 0; i < n; i++) if (keep[i]) out.point(p[2 * i], p[2 * i + 1]);
                    out.lineEnd();
                },
                polygonStart() {
                    poly = true;
                    out.polygonStart();
                },
                polygonEnd() {
                    poly = false;
                    out.polygonEnd();
                },
                sphere() {
                    out.sphere();
                },
            };
        };
    }
    /* 分級路徑（各地圖共用）：
     *   items()  目前要畫的 GeoJSON 陣列（資料還沒好就回傳 null）
     *   maxLv()  最細的一級（再放大就沿用這一級）
     *   digits   路徑座標的小數位數（放大到街道等級要多留幾位，否則看得出鋸齒）
     *   apply(a) 把這一級的路徑字串（和 items() 同順序）寫進 SVG
     * 地圖換尺寸、投影改變時呼叫 reset()；每次縮放呼叫 update(k)，跨級時才會重寫路徑。 */
    const idleCb = window.requestIdleCallback || ((f) => setTimeout(f, 200));
    const idleCancel = window.cancelIdleCallback || clearTimeout;
    function makeLod({ items, maxLv, digits, apply }) {
        const cache = new Map();
        let cur = null,
            idle = 0;
        const paths = (lv, list) => {
            let a = cache.get(lv);
            if (a) return a;
            // 這一級涵蓋倍率 2^lv ~ 2^(lv+1)，最大倍率時偏差也要小於 LOD_TOL
            const simp = simplifier(LOD_TOL / Math.pow(2, lv + 1));
            const p = d3.geoPath({ stream: (s) => projection.stream(simp(s)) });
            if (digits && p.digits) p.digits(digits);
            a = list.map((d) => p(d) || '');
            cache.set(lv, a);
            return a;
        };
        return {
            reset() {
                cache.clear();
                cur = null;
                if (idle) {
                    idleCancel(idle);
                    idle = 0;
                }
            },
            update(k) {
                const list = projection && items();
                if (!list || !list.length) return;
                const top = maxLv();
                const lv = Math.max(0, Math.min(top, Math.floor(Math.log2(k))));
                if (lv === cur) return;
                cur = lv;
                apply(paths(lv, list));
                // 閒置時先把相鄰兩級算好，縮放跨級時就不用當場計算
                if (idle) idleCancel(idle);
                idle = idleCb(() => {
                    idle = 0;
                    for (const l of [lv - 1, lv + 1]) if (l >= 0 && l <= top) paths(l, list);
                });
            },
        };
    }
    // 股市：世界國界（放大到 2^7 倍以上國界已經淡出不畫，不用再分更細）
    const worldLod = makeLod({
        items: () => (gLand && state.countries.length ? state.countries : null),
        maxLv: () => 7,
        apply(a) {
            const idx = new Map(state.countries.map((d, i) => [d, i]));
            const set = function (d) {
                this.setAttribute('d', a[idx.get(d)]);
            };
            gLand.selectAll('path').each(set);
            gLine.selectAll('path').each(set);
            gEdge.selectAll('path').each(set);
        },
    });
    // 縮放 / 拖曳範圍：整個世界（東西向無限循環）
    function setZoomLimits() {
        zoomB.translateExtent(panExtent()).scaleExtent([1, maxK]);
    }
    // 東西向不限制（無限循環），南北仍限制在可視緯度內
    const panExtent = () => [
        [-Infinity, viewBox[0][1]],
        [Infinity, viewBox[1][1]],
    ];
    // 把 x 繞回 (-世界寬, 0]，讓世界本體從畫面左緣（或更左）開始，右邊接一份副本
    function wrapT(t) {
        const ww = S0 * t.k;
        let x = t.x % ww;
        if (x > 0) x -= ww;
        return x === t.x ? t : d3.zoomIdentity.translate(x, t.y).scale(t.k);
    }
    // 地理座標 → 螢幕座標；世界有兩份（本體 + 右邊副本），回傳在畫面內的那一份
    function screenXY(lon, lat) {
        const p = projection([lon, lat]),
            t = state.t;
        let x = t.applyX(p[0]);
        if (x < -40) x += S0 * t.k;
        return [x, t.applyY(p[1])];
    }
    // only：只重畫這幾個國家（hover 進出時只有前後兩個國家會變，不必把全部 177 個國家的屬性重寫一遍）
    function paintLand(only) {
        if (!gLand) return;
        const show = borderIds();
        const hlId = state.highlightId;
        // hover 優先：有 hover 就用 hover，有 click 就用 click，可同時存在但 hover 蓋掉
        const hvId = state.hoverHighlightId;
        gLand.selectAll('path').each(function (d) {
            const id = pad3(d.id);
            if (only && !only.has(id)) return;
            const on = show.has(id),
                hl = id === hlId,
                hv = id === hvId && !hl, // hover（click 時不另外加 hover class）
                b = borderOf(id);
            d3.select(this)
                .classed('on', on || hl || hv)
                .classed('hl-land', hl)
                .classed('hv-land', hv)
                .attr('fill', hl || hv ? null : on ? b.fill : 'none')
                .style('stroke', hl || hv ? null : on ? b.line : null);
        });
        gLine.selectAll('path').each(function (d) {
            const id = pad3(d.id);
            if (only && !only.has(id)) return;
            const on = show.has(id),
                hl = id === hlId,
                hv = id === hvId && !hl;
            d3.select(this)
                .classed('on', on || hl || hv)
                .classed('hl-line', hl)
                .classed('hv-line', hv)
                .style('stroke', hl || hv ? null : on ? borderOf(id).line : null);
        });
        gEdge.selectAll('path').each(function (d) {
            const id = pad3(d.id);
            if (only && !only.has(id)) return;
            d3.select(this)
                .classed('on', show.has(id) || id === hlId || id === hvId)
                .classed('hl-edge', id === hlId)
                .classed('hv-edge', id === hvId && id !== hlId);
        });
    }

    // 地圖上被浮動介面蓋住的邊距（篩選列、手機版概況卡）
    function overlayInsets() {
        const sr = $('#stage').getBoundingClientRect();
        const box = (sel) => {
            const el = $(sel);
            return el && !el.hidden && el.offsetParent !== null ? el.getBoundingClientRect() : null;
        };
        const ins = { t: 0, r: 0, b: 0, l: 0 };
        const chips = box('#chips'),
            hud = box('#hud');
        if (chips) ins.t = chips.bottom - sr.top;
        if (!desktopMQ.matches && hud) ins.t = Math.max(ins.t, hud.bottom - sr.top);
        return ins;
    }
    // 區域縮放：用該區市場的位置算出範圍，按權重由大到小加入；
    // 若再加入某個市場會讓放大倍率低於 REGION_MIN_K，就跳過它（例如手機直式畫面的紐西蘭）。
    // 舊版用涵蓋整片海洋的經緯度框，加上上下兩條欄位吃掉高度，亞太、美洲幾乎沒有放大。
    function regionTransform(key) {
        const world = () =>
            zoomB.constrain()(
                d3.zoomIdentity,
                [
                    [0, 0],
                    [W, H],
                ],
                panExtent(),
            );
        // 手機版全球：縮到最小，經度置中在太平洋（日本到美國西部）；下方兩欄旗幟列十大市值
        if (key === 'all' && !desktopMQ.matches)
            return zoomB.constrain()(
                d3.zoomIdentity.translate(W / 2 - projection([GLOBAL_LON, 0])[0], 0),
                [
                    [0, 0],
                    [W, H],
                ],
                panExtent(),
            );
        // 桌機版全球：世界縮到最小，畫面貼著南界（南緯 58 度）。市場集中在北緯 20～50 度，
        // 這樣美國、中國會落在畫面中上段，南半球（澳洲、智利、阿根廷）完整看得到，上方不會空出一大片北極。
        // 左邊界從日期變更線再往東移一點（西經 155 度），美洲不會貼著左緣，右邊的日本、紐西蘭也放得下
        if (key === 'all')
            return zoomB.constrain()(
                d3.zoomIdentity.translate(-projection([GLOBAL_LEFT_LON, 0])[0], H - projection([0, VIEW_S])[1]),
                [
                    [0, 0],
                    [W, H],
                ],
                panExtent(),
            );
        const topic = TOPICS[key];
        // 手機版主題篩選：縮到最小，經度置中；卡片排成左右兩欄，地圖只當背景和地標底圖
        if (topic && !desktopMQ.matches)
            return zoomB.constrain()(
                d3.zoomIdentity.translate(W / 2 - projection([topic.mlon, 0])[0], 0),
                [
                    [0, 0],
                    [W, H],
                ],
                panExtent(),
            );
        // 主題篩選：範圍涵蓋卡片所在的國家，以及和這些卡片相連的地標（例如地緣的衝突圖示）
        const topicCards = topic ? state.topics.filter((c) => c.cat === key) : [];
        const ms = topic
            ? [
                  ...topicCards,
                  ...state.landmarks.filter((l) => topicCards.some((c) => c.id === l.card)),
                  ...(key === 'geo' && window.GeoScenes ? GeoScenes.anchors() : []), // 動畫航線的端點（紅海南口、航線東端）
              ]
            : state.maps.filter((m) => m.r === key).sort((a, b) => b.w - a.w);
        if (!ms.length) return world();
        const ins = overlayInsets();
        // 預留旗幟的空間：旗幟通常在動物上方，所以上方留比較多
        // 上方還要放得下多指數的整張旗幟（3 個以上指數的國家會多佔一些高度）
        const bs = desktopMQ.matches ? 1 : BUBBLE_SCALE_MOBILE; // 手機版旗幟放大了，預留的空間也要跟著放大
        const px = desktopMQ.matches ? 70 : 46,
            pb = 34,
            minK = topic ? 1 : REGION_MIN_K; // 主題卡片的位置一律納入，不跳過遠的
        // 手機版：有 pin 的國家（上證、韓國）要整張旗幟列在動物上方，上方多留一些空間
        const pt = topic
            ? 130
            : (ms.some((m) => m.group.length >= 3) ? 100 : 72) * bs +
              (!desktopMQ.matches && ms.some((m) => m.pin || m.col) ? PIN_EXTRA_TOP : 0);
        const aw = Math.max(80, W - ins.l - ins.r - px * 2),
            ah = Math.max(80, H - ins.t - ins.b - pt - pb);
        const fitK = (b) => Math.min(aw / Math.max(1, b[2] - b[0]), ah / Math.max(1, b[3] - b[1]));
        let bb = null;
        for (const m of ms) {
            const p = projection([m.lon, m.lat]);
            const nb = bb
                ? [Math.min(bb[0], p[0]), Math.min(bb[1], p[1]), Math.max(bb[2], p[0]), Math.max(bb[3], p[1])]
                : [p[0], p[1], p[0], p[1]];
            if (!bb || fitK(nb) >= minK) bb = nb;
        }
        const k = Math.max(1, Math.min(REGION_MAX_K, fitK(bb)));
        const cx = (bb[0] + bb[2]) / 2,
            cy = (bb[1] + bb[3]) / 2;
        // 對齊可用區域的中心（扣掉被介面蓋住的部分）
        const sx = ins.l + px + aw / 2,
            sy = ins.t + pt + ah / 2;
        const tr = d3.zoomIdentity.translate(sx - k * cx, sy - k * cy).scale(k);
        return zoomB.constrain()(
            tr,
            [
                [0, 0],
                [W, H],
            ],
            panExtent(),
        );
    }
    // 世界會循環，同一個區域在左右各有一份；挑離目前畫面最近的那份，動畫才不會繞地球好幾圈
    function nearestCopy(tr) {
        const t0 = d3.zoomTransform(svg.node());
        const c0 = (W / 2 - t0.x) / t0.k,
            c1 = (W / 2 - tr.x) / tr.k;
        const m = Math.round((c0 - c1) / S0);
        return m ? d3.zoomIdentity.translate(tr.x - tr.k * m * S0, tr.y).scale(tr.k) : tr;
    }
    function applyRegion(animate) {
        if (!projection) return;
        paintLand(); // 國界只顯示目前篩選相關的國家
        const tr = nearestCopy(regionTransform(state.activeRegion));
        animateTo(tr, animate);
        prefetchChips();
    }
    // 套用視角。animate 時飛過去：飛行中 state.flying 為 true，動物 / 旗幟 / 卡片淡出（CSS 的 #map.flying），
    // 也不排版（排版是每幀最重的工作，而且動畫中排出來的位置馬上就過時）；停下來（或被使用者打斷）後排一次再淡入。
    let flyId = 0;
    function animateTo(tr, animate) {
        const id = ++flyId,
            map = $('#map');
        if (animate && state.anim) {
            state.flying = true;
            map.classList.add('flying');
            const done = () => {
                if (id !== flyId) return; // 已經被新的視角取代，由新的那次收尾
                state.flying = false;
                layoutMarkers();
                map.classList.remove('flying');
            };
            svg.transition()
                .duration(900)
                .ease(d3.easeCubicInOut)
                .on('end.fly interrupt.fly cancel.fly', done)
                .call(zoomB.transform, tr);
        } else {
            const was = state.flying;
            state.flying = false;
            svg.interrupt().call(zoomB.transform, tr);
            if (was) layoutMarkers();
            map.classList.remove('flying');
        }
    }
    // 背景先把其它篩選按鈕會飛到的畫面畫好存起來（terrain.js 會等目前畫面的圖磚都好了才開始），
    // 之後切換篩選就是直接讀磁碟快取，不會先出現方塊
    function prefetchChips() {
        if (!Terrain.prefetch || !W) return;
        const views = ['all', 'asia', 'europe', 'americas', 'mea', ...Object.keys(TOPICS)].map((k) => regionTransform(k));
        Terrain.prefetch(views, S0, W, H, dpr);
    }

    // sync：切換篩選 / 飛到某處的動畫（d3 計時器，沒有使用者事件）。國界線（SVG）當下就更新，
    // 但地形畫布與旗幟若排到下一幀才重畫，動畫中就會落後一幀，國界線和國家分離（飛得越快差越多）。
    // 所以動畫時改成在同一個更新裡同步重畫；拖曳是使用者事件，本來就在幀與幀之間處理，維持排到下一幀合併重畫。
    function onTransform(sync) {
        gZoom.attr('transform', state.t.toString());
        folkRefreshSoon();
        // 放大到城市 / 街道等級時，國界（50m 精度）會和真實海岸線對不齊，逐漸淡出
        const op = Math.max(0, Math.min(1, 1 - (Math.log2(state.t.k) - 5) / 2));
        gZoom.style('opacity', op).style('display', op > 0 ? null : 'none');
        if (op > 0) worldLod.update(state.t.k);
        if (sync) {
            cancelAnimationFrame(terrainRaf);
            terrainRaf = 0;
            cancelAnimationFrame(raf);
            raf = 0;
            drawTerrain();
            layoutMarkers();
        } else {
            scheduleTerrain();
            scheduleLayout();
        }
    }

    /* ---------- 標記佈局（螢幕座標，自動避讓） ---------- */
    let raf = 0;
    function scheduleLayout() {
        if (raf) return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            layoutMarkers();
        });
    }
    const inter = (a, b) => {
        const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        return w > 0 && h > 0 ? w * h : 0;
    };
    // 候選位置只需要「由近到遠依序試到第一個放得下的」：用最小堆（O(n) 建堆、每次取最小 O(log n)），
    // 比整批排序快很多（pin 的國家有上萬個格點候選）。比較方式與原本的排序相同：先看 d，再看原始順序 i
    const candLess = (a, b) => a.d < b.d || (a.d === b.d && a.i < b.i);
    function heapDown(h, i) {
        const n = h.length;
        for (;;) {
            let m = i;
            const l = 2 * i + 1,
                r = l + 1;
            if (l < n && candLess(h[l], h[m])) m = l;
            if (r < n && candLess(h[r], h[m])) m = r;
            if (m === i) return;
            [h[i], h[m]] = [h[m], h[i]];
            i = m;
        }
    }
    function heapify(h) {
        for (let i = (h.length >> 1) - 1; i >= 0; i--) heapDown(h, i);
    }
    function heapPop(h) {
        const top = h[0],
            last = h.pop();
        if (h.length) {
            h[0] = last;
            heapDown(h, 0);
        }
        return top;
    }

    /* ---------- 地圖標記的共用元件（股市的城市旗幟用這一套） ----------
     * 畫的時候一律用 attrQ / styleQ / textQ：拖曳時每幀都會重排，只有真的改變的值才寫進 DOM。 */
    // 文明帝國式旗幟的外框：深色底板 + 名稱色帶 + 淡金分隔線 + 金色細邊，下方可加指向圖示的尖角
    function buildBanner(parent) {
        const b = parent.append('g').attr('class', 'bubble');
        b.append('path').attr('class', 'tail-o'); // 尖角的深色外框（畫在底板下面）
        b.append('rect').attr('class', 'bg').attr('rx', 7);
        b.append('rect').attr('class', 'band').attr('rx', 4.5);
        b.append('line').attr('class', 'sep');
        b.append('rect').attr('class', 'inner').attr('rx', 5);
        b.append('rect').attr('class', 'rim').attr('rx', 7);
        b.append('path').attr('class', 'tail');
        return b;
    }
    // bg：底板填色；band：色帶顏色（null = 不畫色帶，例如迷你旗幟）；tail：是否畫尖角；
    // bandH：色帶高度（預設 18；等於 h - 6 時色帶填滿整面旗幟，就不畫分隔線）
    function drawBanner(b, w, h, { bg, band, tail, bandH = 18 }) {
        const BAND_H = bandH,
            sep = band && BAND_H < h - 6;
        b.select('.bg')
            .attrQ('x', 0.5)
            .attrQ('y', 0.5)
            .attrQ('width', w - 1)
            .attrQ('height', h - 1)
            .attrQ('fill', bg);
        b.select('.rim')
            .attrQ('x', 0.5)
            .attrQ('y', 0.5)
            .attrQ('width', w - 1)
            .attrQ('height', h - 1);
        b.select('.inner')
            .attrQ('x', 3)
            .attrQ('y', 3)
            .attrQ('width', w - 6)
            .attrQ('height', h - 6);
        b.select('.band')
            .styleQ('display', band ? null : 'none')
            .attrQ('x', 3)
            .attrQ('y', 3)
            .attrQ('width', w - 6)
            .attrQ('height', BAND_H)
            .attrQ('fill', band || null);
        b.select('.sep')
            .styleQ('display', sep ? null : 'none')
            .attrQ('x1', 4)
            .attrQ('x2', w - 4)
            .attrQ('y1', 3 + BAND_H + 0.5)
            .attrQ('y2', 3 + BAND_H + 0.5);
        b.selectAll('.tail,.tail-o')
            .styleQ('display', tail ? null : 'none')
            .attrQ('d', `M${w / 2 - 6},${h - 1} L${w / 2},${h + 6} L${w / 2 + 6},${h - 1}`);
    }
    // 站在地圖上的圖示（動物 / 地點圖示）：原點是腳下的地面，z 是身高；地上有光圈和柔和的影子
    function sizeFigure(g, img, z) {
        g.select('.ring')
            .attrQ('rx', z * 0.62)
            .attrQ('ry', z * 0.22);
        g.select('.shadow')
            .attrQ('rx', z * 0.36)
            .attrQ('ry', z * 0.1)
            .attrQ('cy', -z * 0.02);
        img.attrQ('x', -z / 2)
            .attrQ('y', -z)
            .attrQ('width', z)
            .attrQ('height', z);
    }
    // 浮動介面在地圖上佔的範圍（四周多留 3px），旗幟不要放進去
    function uiRects(sels) {
        const sr = $('#stage').getBoundingClientRect(),
            out = [];
        for (const sel of sels) {
            const el = $(sel);
            if (!el || el.hidden || el.offsetParent === null) continue;
            const b = el.getBoundingClientRect();
            out.push({ x: b.left - sr.left - 3, y: b.top - sr.top - 3, w: b.width + 6, h: b.height + 6 });
        }
        return out;
    }
    // SVG 文字寬度：同樣的字只量一次（拖曳時每幀量會強迫瀏覽器重新排版）；網頁字型載入後重新量
    const textWCache = new Map();
    if (document.fonts)
        document.fonts.addEventListener('loadingdone', () => {
            textWCache.clear();
            scheduleLayout();
        });
    function textWidth(node) {
        const key = node.getAttribute('class') + '\n' + node.textContent;
        let w = textWCache.get(key);
        if (w === undefined) {
            w = node.getComputedTextLength();
            if (w > 0) textWCache.set(key, w); // 隱藏中量到的是 0，不要記下來
        }
        return w;
    }
    // 還沒建出旗幟就要知道寬度時用：拿看不見的 .bubble 文字量（同一套快取）
    const measT = {};
    function textWidthOf(str, cls = 't1') {
        if (!measT[cls])
            measT[cls] = svg
                .append('g')
                .attr('class', 'bubble')
                .style('visibility', 'hidden')
                .attr('aria-hidden', 'true')
                .append('text')
                .attr('class', cls);
        return textWidth(measT[cls].text(str).node());
    }
    // 量文字裡某個 <tspan> 的寬度（例如 .t2 裡的 .va / .pc）：拿看不見的「父文字 + tspan」量，同一套快取
    const measTs = {};
    function tspanWidthOf(str, parentCls, cls, size) {
        const key = `${parentCls}|${cls}|${size || ''}`;
        if (!measTs[key]) {
            const t = svg
                .append('g')
                .attr('class', 'bubble')
                .style('visibility', 'hidden')
                .attr('aria-hidden', 'true')
                .append('text')
                .attr('class', parentCls);
            if (size) t.style('font-size', size);
            measTs[key] = t.append('tspan').attr('class', cls);
        }
        return textWidth(measTs[key].text(str).node());
    }
    // 台灣旗幟放大時（縮放倍率 ≥ extraK），在加權 / 櫃買下面加一條分隔標題和市值前十大公司（股價 + 漲跌幅）
    const REGION_TOPS = ['asia', 'americas', 'europe'];
    // 十大市值公司列：名稱放大（原本 11px 常被縮到看不清楚），數字稍微縮小讓出位置；整張旗幟也加寬
    const CORP_FS = { rn: 12.5, rv: 13.5, rp: 12.5 };
    const LIST_W = 194;
    const EXTRA_N = 10,
        EXTRA_K = 3; // SEC_H（分隔標題的高度）在下方主題卡片那段定義
    // 其它國家 / 地區：markets.json 的 top 是 top10.json 的國家代碼（cn / jp / kr / in / uk / de / fr / us / ca / hk）。
    // 資料不到十家（還沒讀到、或抓取失敗）就當作沒有，旗幟維持原樣
    const topFeedOf = (m) => {
        const t = m.top && state.tops && state.tops[m.top];
        return t && t.rows && t.rows.length >= EXTRA_N ? t : null;
    };
    const extraList = (m) => {
        // 電腦版點亞太 / 美洲 / 歐洲：該區有十大市值資料的國家直接列出公司，不用再放大
        const byRegion = desktopMQ.matches && state.activeRegion === m.r && REGION_TOPS.includes(m.r);
        if (!byRegion && state.t.k < (m.extraK ?? EXTRA_K)) return [];
        if (m.extra === 'corps') return window.Corps ? Corps.topList().slice(0, EXTRA_N) : [];
        const t = topFeedOf(m);
        return t ? t.rows.slice(0, EXTRA_N) : [];
    };
    // 分隔標題：「台股市值前十大」、「美股市值前十大」…
    // tw-top.json 的 live 是台灣時間的字串（例如 '11/04 13:30'）；換成看的人所在時區的同一個時刻
    function liveAtLocal(str) {
        const m = /^(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/.exec(str || '');
        if (!m) return str || '';
        const y = new Date().getFullYear();
        const ms = Date.UTC(y, +m[1] - 1, +m[2], +m[3] - 8, +m[4]); // 台灣 = UTC+8
        const d = new Date(ms > Date.now() + 30 * 86400e3 ? Date.UTC(y - 1, +m[1] - 1, +m[2], +m[3] - 8, +m[4]) : ms);
        const p2 = (x) => String(x).padStart(2, '0');
        return `${p2(d.getMonth() + 1)}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
    }
    // 台股還沒讀到最新排行（用的是 corps.js 內建的備用數字）時加註「備用」，不要讓人以為是最新的
    // 旗幟上的分隔標題：所有國家統一寫「市值前十大」（國家已經看旗幟與國名，不再加「台股」「德股」…）
    const extraTitle = (m) => (m.extra === 'corps' && window.Corps && !Corps.LIVE ? $t('市值前十大（備用）') : $t('市值前十大'));
    // 這張旗幟能不能整張列出（multi）：有多個指數，或放大到有公司列。單一指數又沒有公司列的國家只有 full / mini
    const hasRows = (m, n = m.group.length) => n > 1 || extraList(m).length > 0;
    // 整張列出（multi）時的旗幟高度（未放大的座標）：色帶 24 + 每個指數 16 + 底部 4，再加上額外的公司列
    const multiH = (m, n) => {
        const ex = extraList(m);
        return 24 + n * 16 + 4 + (ex.length ? SEC_H + ex.length * 16 : 0);
    };
    // 漲跌幅超過這個值（%）的指數用醒目的底色標示（像自選股清單的漲跌幅欄）
    const BIG_MOVE = 2;
    const hlColor = (pct) => (isRed(pct) ? 'hsl(4,74%,47%)' : 'hsl(146,62%,34%)');
    // 詳情卡等 HTML 文字用的漲跌幅：超過 BIG_MOVE 就是實心底色 + 白字的小標籤，否則只有彩色文字
    const pctSpan = (pct, txt) =>
        Math.abs(pct) >= BIG_MOVE
            ? `<span class="pill" style="background:${hlColor(pct)}">${txt}</span>`
            : `<span style="color:${pctColor(pct)}">${txt}</span>`;
    // 旗幟色帶右側的報價時間（使用者的時區，和詳細面板的「最後成交」一致）：
    // 開盤中（含午休）顯示 11:30；收盤後顯示 10/31(六)
    function quoteStamp(m) {
        const q = state.quotes[m.s];
        if (!q || !q.t) return '';
        const d = new Date(q.t * 1000),
            st = marketStatus(m);
        // 開盤中（含午休）且報價是最近的才顯示時間；假日剛好落在午休時段時，舊報價仍顯示日期
        if ((st === 'open' || st === 'break') && Date.now() - d.getTime() < 12 * 3600e3)
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return `${d.getMonth() + 1}/${d.getDate()}(${I18n.weekday(d.getDay())})`;
    }
    // 色帶要放下「國旗 + 名稱 + 時間 + 輪播圓點」需要的寬度（未放大的座標）
    function headNeedW(m, dotW) {
        const ts = quoteStamp(m);
        return Math.ceil(32 + textWidthOf(m.short) + (ts ? 16 + textWidthOf(ts, 'ts') : 0) + 5 + dotW);
    }

    /* ================= 商品 / 債券 / 利率 / 匯率 / 地緣 / 經濟數據 ================= */
    // 卡片的座標一律用「未放大」的尺寸畫（寬 TOPIC_W、色帶 24 + 每列 16 + 底部 4），最後再整個 scale(U)
    const TOPIC_W = 176;
    // 電腦版卡片（連字型）最多放大的倍率
    const TOPIC_SCALE_MAX = 1.7;
    const TOPIC_SCALE_MAX_ECON = 2.2;
    // 卡片邊緣離自己國家的距離上限（px）：超過就寧可縮小卡片，讓它貼近國家
    const TOPIC_NEAR = 200;
    const TOPIC_NEAR_ECON = 280; // 經濟數據的卡片很高，放寬一點，字才能放得更大
    // 資料列 16px；卡內的分隔標題（成長 / 物價 / 就業）只要 12px，不佔太多高度
    const SEC_H = 12;
    // 卡內的分隔標題（成長 / 物價 / 就業）不再佔高度、也不畫：改用每個區塊不同的底色區分（見 style.css 的 .rbg.g0 ~ g3）
    const rowH = (r) => (r.sec ? 0 : 16);
    const topicH = (c) => 24 + c.rows.reduce((s, r) => s + rowH(r), 0) + 4;
    const dateStamp = (t) => {
        const d = new Date(t * 1000);
        return `${d.getMonth() + 1}/${d.getDate()}(${I18n.weekday(d.getDay())})`;
    };
    // 經濟數據的顯示格式（markets.json 每列的 f）。數值來自 state.econ（iKDx-realtime 的 econ.json）
    const LIGHTS = {
        blue: [$t('藍燈'), '#6db3ff'],
        'yellow-blue': [$t('黃藍燈'), '#8fd3d9'],
        green: [$t('綠燈'), '#62d58a'],
        'yellow-red': [$t('黃紅燈'), '#ffb34d'],
        red: [$t('紅燈'), '#ff6b6b'],
    };
    const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
    // 金額換算成「億」：TE 的單位是 USD Million / JPY Billion，其他單位不認得就回傳 null
    // 金額（單位：億）。英文沒有「億」，換成 B（十億）
    const fmtYi = (a) => {
        if (I18n.lang === 'en') {
            const b = a / 10;
            return (b >= 100 ? fmtInt(b) : b >= 10 ? b.toFixed(1) : b.toFixed(2)) + 'B';
        }
        return $t('{n}億', { n: fmtInt(a) });
    };
    // 股價超過 10 萬（韓股）：中日韓用「萬」，英文用 K
    const fmtWan = (p) => (I18n.lang === 'en' ? `${fmtInt(p / 1e3)}K` : $t('{n}萬', { n: (p / 1e4).toFixed(1) }));
    // 月份：英文用 Sep，其他語言用「9月」
    const monthLabel = (n) =>
        I18n.lang === 'en'
            ? new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(2024, n - 1, 1))
            : $t('{m}月', { m: n });
    const toYi = (v, unit) => (/Million/i.test(unit) ? v / 100 : /Billion/i.test(unit) ? v * 10 : null);
    const signed = (n, s) => (n > 0 ? '+' : n < 0 ? '-' : '') + s;
    // 變動值的顯示：四捨五入後是 0 就當「持平」，顯示 0（不帶箭頭、不帶正負號、灰色），不要出現「–0.0」「▲0.0」
    // txt 是已經四捨五入好的絕對值字串（例如 '0.0'、'104'）；回傳 { chg, flat }
    const chgText = (d, txt) => {
        if (d == null) return { chg: '', flat: false };
        if (!(parseFloat(String(txt).replace(/,/g, '')) > 0)) return { chg: '0', flat: true };
        return { chg: `${arrow(d)}${txt}`, flat: false };
    };
    function econView(r, q) {
        const dp = r.dp != null ? r.dp : 1,
            d = q.d;
        const mk = (txt, extra) => {
            const { chg, flat } = chgText(d, txt);
            return { chg, flat, ...extra };
        };
        switch (r.f || 'pct') {
            case 'idx':
                return mk(Math.abs(d ?? 0).toFixed(1), { val: q.v.toFixed(1) });
            case 'k': // 千人（非農就業新增人數）
                return mk(fmtInt(Math.abs(d ?? 0)), { val: `${signed(q.v, fmtInt(Math.abs(q.v)))}K` });
            case 'claims':
                return mk(fmtInt(Math.abs(d ?? 0)), { val: `${fmtInt(q.v)}K` });
            case 'amt': {
                const yi = toYi(q.v, q.unit);
                if (yi == null) return { val: fmtInt(q.v), chg: '' };
                const pyi = q.prev == null ? null : toYi(q.prev, q.unit);
                // 前後期都是正數（外銷訂單）才顯示變動幅度；貿易收支這類會正負翻轉的只顯示數值（差額沒意義，也佔寬度）
                const pct = pyi != null && pyi > 0 && yi > 0 ? ((yi - pyi) / pyi) * 100 : null;
                const { chg, flat } = pct == null ? { chg: '', flat: false } : chgText(pct, Math.abs(pct).toFixed(1) + '%');
                return {
                    val: `${yi < 0 ? '-' : ''}${fmtYi(Math.abs(yi))}`,
                    chg: flat ? '0%' : chg,
                    flat,
                    cd: pyi == null ? 0 : yi - pyi,
                };
            }
            case 'rate': {
                // 央行政策利率：只顯示目前水準（有下限 lo 時是目標區間，例如 3.75–4.00%），不顯示變動
                const rdp = r.dp != null ? r.dp : 2;
                return {
                    val: q.lo != null ? `${q.lo.toFixed(rdp)}–${q.v.toFixed(rdp)}%` : `${q.v.toFixed(rdp)}%`,
                    chg: '',
                    flat: true,
                };
            }
            case 'light': {
                const [name, col] = LIGHTS[q.light] || ['', null];
                return mk(String(Math.abs(d ?? 0)), { val: $t('{v}分 {name}', { v: q.v, name }).trim(), vcol: col });
            }
            default: // pct
                return mk(Math.abs(d ?? 0).toFixed(dp), { val: `${q.v.toFixed(dp)}%` });
        }
    }
    // 期間：'2026-09' → 9月、'2026-Q3' → Q3、'2026-10-24' → 10/24
    function econRefLabel(ref) {
        let m = /^\d{4}-Q(\d)$/.exec(ref || '');
        if (m) return `Q${m[1]}`;
        m = /^\d{4}-(\d{2})-(\d{2})$/.exec(ref || '');
        if (m) return `${+m[1]}/${+m[2]}`;
        m = /^\d{4}-(\d{2})$/.exec(ref || '');
        return m ? monthLabel(+m[1]) : '';
    }
    // 一列資料要顯示的文字：名稱、數值、變動（含顏色）。行情從 state.quotes 取，沒有行情的用 markets.json 寫的 v / d
    function topicRowView(r) {
        if (r.sec) return { sec: r.sec };
        if (r.note) return { note: r.note };
        // bp（基點）：殖利率變動的單位，1bp = 0.01 個百分點。四捨五入到 0.1bp 是 0 就當平盤，顯示「0bp」（灰色）
        const flatBp = (d) => (Math.abs(d) < 0.05 ? 0 : d);
        const bp = (d) => (d === 0 ? '0bp' : `${arrow(d)}${Math.abs(d).toFixed(1)}bp`);
        const v = { lab: r.l, icon: r.icon || null, val: '--', chg: '', col: null, vcol: null };
        if (r.calc) {
            const a = state.quotes[r.calc[0]],
                b = state.quotes[r.calc[1]];
            if (a && b) {
                const d = flatBp((a.c - b.c) * 100),
                    spread = Math.round((a.p - b.p) * 100);
                Object.assign(v, { val: `${spread}bp`, chg: bp(d), col: pctColor(d), cd: d });
                // 長天期殖利率低於短天期（殖利率曲線倒掛），常被視為景氣衰退的前兆
                if (spread < 0) Object.assign(v, { lab: $t('{l} 倒掛', { l: r.l }), vcol: TONES.bad });
            }
        } else if (r.e) {
            const q = state.econ[r.e];
            if (q) {
                const x = econView(r, q);
                Object.assign(v, { val: x.val, chg: x.chg, vcol: x.vcol || null, ref: econRefLabel(q.ref), stale: !!q.stale });
                // 持平（變動四捨五入後是 0）：用灰色的平盤色，不要有漲跌顏色
                if (x.flat) Object.assign(v, { col: FLAT_TEXT, cd: 0 });
                else {
                    const cd = x.cd != null ? x.cd : q.d;
                    if (cd) Object.assign(v, { col: pctColor(cd), cd });
                }
            } else if (r.v != null) {
                // 連不上 econ.json：退回手寫的備用值
                v.val = r.v;
                if (r.d) Object.assign(v, { chg: `${arrow(r.d)}${Math.abs(r.d)}`, col: pctColor(r.d), cd: r.d });
            }
        } else if (r.s) {
            const q = state.quotes[r.s];
            if (q && r.k === 'y') {
                const d = flatBp(q.c * 100);
                Object.assign(v, { val: `${q.p.toFixed(2)}%`, chg: bp(d), col: pctColor(d), cd: d });
            } else if (q) {
                const p = r.dp != null ? q.p.toFixed(r.dp) : fmtN(q.p, 'short');
                Object.assign(v, {
                    val: (r.u || '') + p,
                    chg: isFlat(q.pct) ? '0.00%' : fmtChgPct(q.pct),
                    col: pctColor(q.pct),
                    cd: q.pct,
                    pq: true, // 漲跌幅是百分比（商品、匯率…）：超過 BIG_MOVE 要用醒目的底色
                });
            }
        } else {
            v.val = r.v;
            v.vcol = TONES[r.tone] || null;
            if (r.d) Object.assign(v, { chg: `${arrow(r.d)}${Math.abs(r.d)}`, col: pctColor(r.d), cd: r.d });
        }
        return v;
    }
    // 卡片標題右側的時間：有經濟數據的用最新的統計期間；手動維護的寫在 stamp；有行情的用第一個行情的成交日
    function topicStamp(c) {
        const refs = c.rows.map((r) => r.e && state.econ[r.e] && state.econ[r.e].ref).filter(Boolean);
        if (refs.length) {
            // 期間字串 'YYYY-MM' / 'YYYY-Qn' / 'YYYY-MM-DD'：換成可比較的月份數，取最新的那個
            const key = (s) => {
                const q = /^(\d{4})-Q(\d)$/.exec(s);
                if (q) return +q[1] * 12 + +q[2] * 3;
                const m = /^(\d{4})-(\d{2})/.exec(s);
                return m ? +m[1] * 12 + +m[2] : 0;
            };
            return econRefLabel(refs.reduce((a, b) => (key(b) > key(a) ? b : a)));
        }
        if (c.stamp) return c.stamp;
        for (const r of c.rows) {
            const q = state.quotes[r.s || (r.calc && r.calc[0])];
            if (q && q.t) return dateStamp(q.t);
        }
        return '';
    }
    // 色帶顏色：地緣卡片看狀態（緩和綠、緊張橘、衝突紅）；其他卡片和單一指數的旗幟一樣，
    // 用「最重要的一列」（第一個資料列，markets.json 已依重要程度排好）的漲跌決定紅 / 綠，沒有漲跌資料時是藍色
    const topicBand = (c) => {
        const r = c.rows.find((x) => x.tone);
        if (r) return TONE_BAND[r.tone];
        const lead = c.rows.find((x) => !x.sec && !x.note);
        const cd = lead && topicRowView(lead).cd;
        return cd && !isFlat(cd) ? bandColor(cd) : '#34568a';
    };
    function buildTopics() {
        gTopic.selectAll('*').remove();
        for (const c of state.topics) {
            const hold = gTopic
                .append('g')
                .attr('class', 'mk tk')
                .style('display', 'none')
                .on('click', () => openTopic(c));
            c.el = hold.node();
            // 國家位置的小圖釘與連到卡片的虛線（電腦版卡片不一定貼著國家）
            const lead = hold.append('g').attr('class', 'lead');
            lead.append('line');
            lead.append('circle').attr('r', 3.5);
            const b = buildBanner(hold);
            const fs = flagSrc(c.flag);
            if (fs) {
                b.append('image').attr('class', 'flag').attr('href', fs).attr('preserveAspectRatio', 'none');
                b.append('rect').attr('class', 'flag-b').attr('rx', 1.5);
            }
            const t1 = b.append('text').attr('class', 't1');
            t1.append('tspan').attr('class', 'a');
            b.append('rect').attr('class', 'tsb').attr('rx', 5);
            b.append('text').attr('class', 'ts');
            const rows = b.append('g').attr('class', 'rows');
            c.rows.forEach(() => {
                const r = rows.append('g').attr('class', 'row');
                r.append('rect').attr('class', 'rbg');
                r.append('rect').attr('class', 'rhl').attr('rx', 3).style('display', 'none');
                r.append('text').attr('class', 'rn');
                r.append('text').attr('class', 'rv');
                r.append('text').attr('class', 'rp');
            });
        }
    }
    // r：卡片在畫面上的位置與大小（已含放大倍率 U）；pin：國家位置（電腦版才有）
    function drawTopic(c, r, U, pin) {
        const hold = d3.select(c.el),
            b = hold.select('.bubble'),
            w = r.w / U,
            h = r.h / U;
        hold.styleQ('display', null);
        b.attrQ('transform', `translate(${Math.round(r.x)},${Math.round(r.y)}) scale(${U})`);
        drawBanner(b, w, h, { bg: 'url(#bannerBg)', band: topicBand(c), tail: false });
        const ld = hold.select('.lead').styleQ('display', pin ? null : 'none');
        if (pin) {
            const ex = Math.max(r.x, Math.min(r.x + r.w, pin.x)),
                ey = Math.max(r.y, Math.min(r.y + r.h, pin.y));
            ld.select('line').attrQ('x1', pin.x).attrQ('y1', pin.y).attrQ('x2', ex).attrQ('y2', ey);
            ld.select('circle').attrQ('cx', pin.x).attrQ('cy', pin.y);
        }
        // 標題：國旗 + 國名 + 右側時間膠囊（放不下就不顯示時間）
        const hasFlag = !b.select('.flag').empty();
        b.select('.flag').attrQ('x', 6).attrQ('y', 4).attrQ('width', 24).attrQ('height', 16);
        b.select('.flag-b').attrQ('x', 5.5).attrQ('y', 3.5).attrQ('width', 25).attrQ('height', 17);
        const tx0 = hasFlag ? 32 : 0,
            ts = topicStamp(c),
            pillW = ts ? textWidthOf(ts, 'ts') + 8 : 0,
            pr = w - 5;
        const showTs = !!ts && textWidthOf(c.short) + pillW + 8 <= pr - tx0;
        b.select('.tsb')
            .styleQ('display', showTs ? null : 'none')
            .attrQ('x', pr - pillW)
            .attrQ('y', 5.5)
            .attrQ('width', pillW)
            .attrQ('height', 14);
        b.select('.ts')
            .styleQ('display', showTs ? null : 'none')
            .attrQ('x', pr - 4)
            .attrQ('y', 15.7)
            .textQ(showTs ? ts : '');
        const tx1 = showTs ? pr - pillW : w;
        b.select('.t1')
            .attrQ('x', (tx0 + tx1) / 2)
            .attrQ('y', 17.2);
        b.select('.t1 .a').textQ(hasFlag ? c.short : `${c.flag} ${c.short}`);
        const rows = c.rows.map(topicRowView);
        // 報價剛更新：該列底色閃一下，卡片外框發光
        const rowFlash = c.rows.map((r) => flashOf(r.s) || (r.calc && (flashOf(r.calc[0]) || flashOf(r.calc[1]))) || null);
        setFlash(b, rowFlash.find(Boolean) || null);
        let yAcc = 24;
        const rowY = c.rows.map((r) => {
            const y = yAcc;
            yAcc += rowH(r);
            return y;
        });
        // 區塊編號：第幾個分隔標題之後的列屬於第幾個區塊（g0 ~ g3 各有自己的底色）；inG 是區塊內的序號（隔列淡淡加亮）
        let gi = -1,
            inG = 0;
        const rowG = rows.map((x) => {
            if (x.sec) {
                gi++;
                inG = 0;
                return { g: -1, n: 0 };
            }
            return { g: Math.max(gi, 0), n: inG++ };
        });
        b.selectAll('.row').each(function (_, i) {
            const x = rows[i],
                g = d3.select(this),
                y = rowY[i],
                rn = g.select('.rn'),
                rv = g.select('.rv'),
                rp = g.select('.rp');
            setFlash(g, rowFlash[i]);
            if (x.sec) {
                // 分隔標題不顯示
                g.select('.rbg').styleQ('display', 'none');
                g.select('.rhl').styleQ('display', 'none');
                rn.textQ('');
                rv.textQ('');
                rp.textQ('');
                return;
            }
            const rg = rowG[i];
            g.select('.rbg')
                .styleQ('display', null)
                .attrQ('x', 4)
                .attrQ('y', y)
                .attrQ('width', w - 8)
                .attrQ('height', rowH(c.rows[i]))
                .classed('odd', gi < 0 && rg.n % 2 === 1)
                .classed('sec', false)
                .attr('class', function () {
                    const k = this.getAttribute('class').replace(/\s*\bg\d\b/g, '');
                    return gi >= 0 ? `${k} g${rg.g % 4}` : k;
                });
            rn.classed('sec', false);
            // icon 直接前置在名稱文字裡，避免 SVG text baseline 對齊問題
            const hasIcon = !!x.icon && !x.sec && !x.note;
            const labWithIcon = hasIcon ? `${x.icon} ${x.lab}` : x.lab;
            // 名稱放不下時才縮小字級，數字維持原本大小
            const fit = (txt, room) => {
                const lw = textWidthOf(txt, 'rn');
                return lw > room ? `${Math.max(8, (11 * room) / lw).toFixed(1)}px` : null;
            };
            if (x.note) {
                rn.attrQ('x', 9)
                    .attrQ('y', y + 12.5)
                    .styleQ('font-size', fit(x.note, w - 18))
                    .textQ(x.note);
                rv.textQ('');
                rp.textQ('');
                return;
            }
            const rvx = w - 8 - (x.chg ? numW(x.chg, 'rp', true) + 5 : 0);
            // 名稱縮到最小（8px）還是放不下：改縮小數值字級，兩者才不會疊在一起
            const vw0 = numW(x.val, 'rv', 'dec'),
                labMin = (textWidthOf(labWithIcon, 'rn') * 8) / 11,
                vRoom = rvx - 9 - labMin - 11,
                vs = vw0 > vRoom ? Math.max(0.6, vRoom / vw0) : 1;
            rn.attrQ('x', 9)
                .attrQ('y', y + 12.5)
                .styleQ('font-size', fit(labWithIcon, rvx - vw0 * vs - 11))
                .textQ(labWithIcon);
            rv.attrQ('x', rvx)
                .attrQ('y', y + 13.5)
                .styleQ('font-size', vs < 1 ? `${(15 * vs).toFixed(1)}px` : null)
                .styleQ('fill', x.vcol)
                .numQ(x.val, 'dec');
            // 漲跌幅超過 BIG_MOVE（%）：實心底色 + 白字，和股市旗幟一致
            const big = !!x.pq && !!x.chg && Math.abs(x.cd) >= BIG_MOVE,
                cw = x.chg ? numW(x.chg, 'rp', true) : 0;
            g.select('.rhl')
                .styleQ('display', big ? null : 'none')
                .attrQ('x', w - 8 - cw - 3)
                .attrQ('y', y + 1.5)
                .attrQ('width', big ? cw + 6 : 0)
                .attrQ('height', 14)
                .styleQ('fill', big ? hlColor(x.cd) : null);
            rp.attrQ('x', w - 8)
                .attrQ('y', y + 13.5)
                .styleQ('fill', big ? '#fff' : x.col)
                .numQ(x.chg, true);
        });
    }
    // 目前篩選的卡片位置：手機版排成左右兩欄；電腦版放在各自國家附近，彼此與地標、介面都不重疊
    function layoutTopics(rects) {
        const on = !!TOPICS[state.activeRegion];
        gTopic.styleQ('display', on ? null : 'none');
        if (!on) return;
        const cards = state.topics.filter((c) => c.cat === state.activeRegion);
        for (const c of state.topics) if (c.cat !== state.activeRegion) d3.select(c.el).styleQ('display', 'none');
        if (!desktopMQ.matches) {
            const GAP = 4,
                colW = Math.floor((W - 8 - GAP) / 2);
            const top0 = Math.max(2, ...uiRects(['#chips', '#hud']).map((z) => z.y + z.h)) + GAP;
            // markets.json 的 mc（L / R + 由上而下的序號）指定欄位與順序；沒寫的卡片放進比較短的那欄
            const num = (c) => (c.mc ? +c.mc.slice(1) : 99);
            const order = cards.slice().sort((a, b) => num(a) - num(b));
            const colOf = new Map(),
                colH = [0, 0],
                colN = [0, 0];
            for (const c of order) {
                const col = c.mc ? (c.mc[0] === 'R' ? 1 : 0) : colH[1] < colH[0] ? 1 : 0;
                colOf.set(c, col);
                colH[col] += topicH(c);
                colN[col]++;
            }
            // 卡片太高放不下時整體縮小（不低於 0.6 倍），讓每一欄一眼看完，不用往下滑
            // 底部多留 34px：右下角的災難按鈕與地圖來源標示不要壓到卡片
            const room = H - top0 - 34 - GAP * (Math.max(colN[0], colN[1]) - 1);
            // 經濟數據去掉分隔標題後比較矮，畫面夠高時字可以放更大
            const U = Math.max(
                0.6,
                Math.min(state.activeRegion === 'econ' ? 1.4 : BUBBLE_SCALE_MOBILE, room / Math.max(colH[0], colH[1], 1)),
            );
            const w = Math.min(colW, Math.round(Math.min(200, Math.floor(colW / U)) * U));
            const ys = [top0, top0];
            for (const c of order) {
                const col = colOf.get(c),
                    h = Math.round(topicH(c) * U);
                const r = { x: col ? W - 4 - w : 4, y: ys[col], w, h };
                ys[col] += h + GAP;
                drawTopic(c, r, U, null);
                rects.push(r);
            }
            return;
        }
        // 電腦版空間夠大：卡片連同字型整體放大（U 倍），從最大倍率往下試，取「全部卡片都放得下」的最大值；
        // 最小為 1（原尺寸），這時放不下的卡片才隱藏
        const place = (U, base) => {
            const out = [],
                used = base.slice(),
                gap = 14,
                w = Math.round(TOPIC_W * U);
            let miss = 0,
                far = 0;
            for (const c of cards) {
                const [ax, ay] = screenXY(c.lon, c.lat),
                    h = Math.round(topicH(c) * U);
                if (ax < -10 || ax > W + 10 || ay < -10 || ay > H + 10) {
                    out.push({ c, hit: null });
                    continue;
                }
                const cands = [];
                // 正上、正下、右、左，沿著邊細細滑動（每 0.1 個卡片寬 / 高一格），再往外一圈；
                // 右、左還會把卡片橫向多推開一點（越過擋住的地標），這樣卡片才能盡量貼近自己的國家
                for (const m of [0, 1, 2]) {
                    const up = ay - h - gap - m * (h + 6),
                        dn = ay + gap + m * (h + 6);
                    for (let f = -1.2; f <= 1.201; f += 0.1) {
                        cands.push({ x: ax - w / 2 + f * w, y: up }, { x: ax - w / 2 + f * w, y: dn });
                    }
                    for (let f = -1.2; f <= 1.201; f += 0.1) {
                        for (let j = 0; j < 6; j++) {
                            const off = gap + j * 24 + m * (w + 6);
                            cands.push({ x: ax + off, y: ay - h / 2 + f * h }, { x: ax - w - off, y: ay - h / 2 + f * h });
                        }
                    }
                }
                cands.forEach((q, i) => ((q.i = i), (q.d = (q.x + w / 2 - ax) ** 2 + (q.y + h / 2 - ay) ** 2)));
                cands.sort((p, q) => p.d - q.d || p.i - q.i);
                let hit = null;
                for (const q of cands) {
                    const r = { x: q.x, y: q.y, w, h };
                    if (r.x < 2 || r.y < 2 || r.x + w > W - 2 || r.y + h > H - 2) continue;
                    if (used.some((z) => inter(r, z) > 0)) continue;
                    hit = r;
                    break;
                }
                if (!hit) {
                    miss++;
                    out.push({ c, hit: null });
                    continue;
                }
                used.push(hit);
                out.push({ c, hit, pin: { x: ax, y: ay } });
                // 卡片邊緣離國家的距離（卡片蓋在國家上方算 0）
                far = Math.max(
                    far,
                    Math.hypot(Math.max(hit.x - ax, 0, ax - hit.x - hit.w), Math.max(hit.y - ay, 0, ay - hit.y - hit.h)),
                );
            }
            return { out, miss, used, far };
        };
        // 全部放得下，而且每張卡片都貼近自己的國家（邊緣離國家不超過 TOPIC_NEAR px）的最大倍率；
        // 沒有這樣的倍率就退而求其次，取全部放得下的最大倍率
        let best = null,
            bestU = 1,
            alt = null,
            altU = 1;
        // 經濟數據的卡片去掉分隔標題後比較矮，字可以放得更大
        for (let U = state.activeRegion === 'econ' ? TOPIC_SCALE_MAX_ECON : TOPIC_SCALE_MAX; U > 1.001; U -= 0.1) {
            const t = place(U, rects);
            if (t.miss) continue;
            if (t.far <= (state.activeRegion === 'econ' ? TOPIC_NEAR_ECON : TOPIC_NEAR)) {
                best = t;
                bestU = U;
                break;
            }
            if (!alt) ((alt = t), (altU = U));
        }
        if (!best && alt) ((best = alt), (bestU = altU));
        best = best || place(1, rects);
        for (const { c, hit, pin } of best.out) {
            if (!hit) d3.select(c.el).styleQ('display', 'none');
            else drawTopic(c, hit, bestU, pin);
        }
        rects.push(...best.used.slice(rects.length));
    }
    // 白宮：用幾個簡單的形狀畫（原點在地面正中央，高約 34）
    function drawWhiteHouse(g) {
        const body = '#f6f2e6',
            line = '#8b8168';
        const box = (x, y, w, h, fill) =>
            g
                .append('rect')
                .attr('x', x)
                .attr('y', y)
                .attr('width', w)
                .attr('height', h)
                .attr('fill', fill)
                .attr('stroke', line)
                .attr('stroke-width', 0.6);
        g.append('ellipse').attr('cy', -1).attr('rx', 21).attr('ry', 3.4).attr('fill', '#5da24a');
        box(-20, -11, 9, 10, body);
        box(11, -11, 9, 10, body);
        box(-12, -15, 24, 14, body);
        for (let i = 0; i < 6; i++) box(-9.4 + i * 3.8, -14, 1.7, 12, '#d9d2bd');
        g.append('polygon')
            .attr('points', '-13.5,-15 0,-22.5 13.5,-15')
            .attr('fill', body)
            .attr('stroke', line)
            .attr('stroke-width', 0.6);
        g.append('path')
            .attr('d', 'M-4.5,-22 A4.5,4.5 0 0 1 4.5,-22 Z')
            .attr('fill', body)
            .attr('stroke', line)
            .attr('stroke-width', 0.6);
        g.append('line').attr('y1', -26.5).attr('y2', -33).attr('stroke', line).attr('stroke-width', 0.8);
        g.append('rect').attr('y', -33).attr('width', 6).attr('height', 3.4).attr('fill', '#d1383a');
        box(-1.6, -8, 3.2, 7, '#6b5d45');
        for (const x of [-17, -14, 13.5, 16.5]) box(x, -8, 2, 3.4, '#7f93b5');
    }
    function buildLandmarks() {
        gLm.selectAll('*').remove();
        for (const lm of state.landmarks) {
            const g = gLm
                .append('g')
                .attr('class', `mk lm${lm.anim ? ' lm-' + lm.anim : ''}`)
                .style('display', 'none')
                .on('click', () => {
                    const c = state.topics.find((t) => t.id === lm.card);
                    if (c) openTopic(c);
                });
            lm.el = g.node();
            g.append('ellipse').attr('class', 'lm-sh');
            const i = g.append('g').attr('class', 'lm-i');
            if (lm.icon === 'whitehouse') drawWhiteHouse(i.append('g').attr('class', 'wh'));
            else
                i.append('image')
                    .attr('class', 'lm-img')
                    .attr('href', `assets/icons/${lm.icon}.png`)
                    .attr('preserveAspectRatio', 'xMidYMax meet');
            // 衝突時迸出的火花
            if (lm.anim === 'clash') g.append('image').attr('class', 'lm-spark').attr('href', 'assets/icons/collision.png');
            g.append('text').attr('class', 'lm-t').text(lm.label);
        }
    }
    // 地標不論哪個篩選都在地圖上（被概況卡、篩選列蓋住或在畫面外就先收起來）
    function layoutLandmarks(rects, ui) {
        const k = state.t.k,
            z = Math.max(22, Math.min(36, 16 + k * 3.2));
        for (const lm of state.landmarks) {
            const [sx, sy] = screenXY(lm.lon, lm.lat),
                x = sx + (lm.dx || 0),
                y = sy,
                r = { x: x - z * 0.6, y: y - z * 1.05, w: z * 1.2, h: z * 1.5 };
            const hide = k > 8 || x < -z || x > W + z || y < -z || y > H + z || ui.some((q) => inter(r, q) > 0);
            const g = d3.select(lm.el).styleQ('display', hide ? 'none' : null);
            if (hide) continue;
            g.attrQ('transform', `translate(${x},${y})`);
            g.select('.lm-sh')
                .attrQ('rx', z * 0.5)
                .attrQ('ry', z * 0.16);
            g.select('.lm-img')
                .attrQ('x', -z / 2)
                .attrQ('y', -z)
                .attrQ('width', z)
                .attrQ('height', z);
            g.select('.wh').attrQ('transform', `scale(${z / 34})`);
            g.select('.lm-spark')
                .attrQ('x', z * 0.02)
                .attrQ('y', -z * 1.15)
                .attrQ('width', z * 0.6)
                .attrQ('height', z * 0.6);
            g.select('.lm-t')
                .attrQ('y', z * 0.5)
                .styleQ('font-size', `${Math.max(9, Math.min(11.5, z * 0.38)).toFixed(1)}px`);
            rects.push(r);
        }
    }
    // 主題卡片的詳情：列出所有項目的數值與說明
    function openTopic(c) {
        const T = TOPICS[c.cat] || { icon: '🏛️', label: $t('政策') }; // 白宮卡片不屬於任何篩選，只由地標開啟
        const rows = c.rows
            .map(topicRowView)
            .map((x) =>
                x.sec
                    ? `<div style="margin-top:8px;padding:2px 8px;background:#1f7f95;border-radius:4px"><b style="color:#fff;letter-spacing:4px">${esc(x.sec)}</b></div>`
                    : x.note
                      ? `<div>${esc(x.note)}</div>`
                      : `<div><b>${esc(x.lab)}</b>　<span style="color:${x.vcol || '#fff'}">${esc(x.val)}</span>${x.chg ? `　${x.pq ? pctSpan(x.cd, esc(x.chg)) : `<span style="color:${x.col}">${esc(x.chg)}</span>`}` : ''}${x.ref ? `　<span class="small">${esc(x.ref)}${x.stale ? ' ⚠️' + $t('沿用舊資料') : ''}</span>` : ''}</div>`,
            )
            .join('');
        const quoted = c.rows.some((r) => r.s || r.calc);
        const econ = c.rows.some((r) => r.e);
        const src = econ
            ? $t('資料來源：{src}。各項為最近一次公布的數值，右側小字是統計期間；變動是和前一期的差。', {
                  src: c.src || $t('手動整理'),
              })
            : quoted
              ? $t('行情來自 Yahoo Finance、CNBC、Trading Economics，通常延遲 15 分鐘以上。')
              : $t('資料來源：{src}。這是手動維護的資料，可能不是最新。', { src: c.src || $t('手動整理') });
        showSheet(`
    <div class="hd"><span class="big">${flagHtml(c.flag, 'flg big-flg')}</span>
      <div><div class="nm">${esc(c.short)}</div><div class="sym">${T.icon} ${T.label}</div></div></div>
    <div class="meta" style="margin-top:12px">${rows}</div>
    ${c.note ? `<p class="small">${esc(c.note)}</p>` : ''}
    <p class="small">${esc(src)}</p>`);
    }

    // 旗幟的濾鏡：夜間加藍冷色調 + 微微壓暗（brightness 最低 0.78 保持文字可讀）；
    // hover 時額外提亮 1.3 倍（乘在夜間亮度上，白天夜晚都一致）
    function bubbleFilter(m) {
        const nb = nightBrightAt(m.lon, m.lat);
        const hoverBoost = m.__hover ? 1.3 : 1;
        if (nb >= 1) return hoverBoost > 1 ? `brightness(${hoverBoost})` : null;
        const br = ((0.78 + nb * 0.22) * hoverBoost).toFixed(2);
        const hue = Math.round((1 - nb) * -18);
        return `${nb < 0.2 ? 'url(#cityGlow) ' : ''}brightness(${br}) hue-rotate(${hue}deg)`;
    }
    // hover 進出：只更新旗幟亮度，不觸發國土高亮（國土高亮只在點擊卡片時才出現）
    // isCard：true 表示從旗幟卡片 hover 進出（要讓國界變黃），動物 hover 不傳或傳 false（只顯示提示，不要國界效果）
    function setHover(d, on, ev, isCard) {
        d.__hover = on;
        if (ev) d.__lastEv = ev;
        if (d.bk) d3.select(d.bk).select('.bubble').styleQ('filter', bubbleFilter(d));
        if (isCard) {
            const host = d.type === 'map' ? d : d.type === 'sub' ? state.bySym[d.of] : null;
            const prev = state.hoverHighlightId;
            state.hoverHighlightId = on && host && host.id ? pad3(host.id) : null;
            if (prev !== state.hoverHighlightId) paintLand(new Set([prev, state.hoverHighlightId].filter(Boolean)));
        }
        if (on) isCard ? showCardTip(d, d.__lastEv) : showMarketTip(d, d.__lastEv);
        else hideCtip();
    }
    // 市場動物（walker）的 tooltip：顯示國家名稱 + 動物 emoji + 說明
    function showMarketTip(d, ev) {
        if (!ev) return;
        ctipEl = ctipEl || $('#ctip');
        const icon = d.a || '🐾';
        const name = d.short || d.zh || '';
        // 從 CRITTER_TIPS 找動物對應說明（以 emoji 比對）
        const tips = window.CRITTER_TIPS || {};
        const tipKey = Object.keys(tips).find(k => tips[k][0] === icon && tips[k][2] === '動物');
        const animalName = tipKey ? tips[tipKey][1] : '';
        const desc = tipKey ? tips[tipKey][3] : `${name}的代表動物，點擊旗幟可看更多資訊。`;
        ctipOwner = null;
        ctipEl.innerHTML =
            `<div class="th"><div class="ti">${esc(icon)}</div><div class="tt">` +
            `<div class="tn">${esc(animalName || (name + '的代表動物'))}</div>` +
            `<span class="tk" data-k="動物">動物</span></div></div>` +
            `<div class="td">${esc(desc)}</div>`;
        ctipEl.classList.add('show');
        moveCtip(ev);
    }
    // 旗幟卡片的 tooltip：介紹該「國家 / 市場」本身（不是動物），顯示國旗 + 國名 + 開盤狀態 + 指數名稱
    function showCardTip(d, ev) {
        if (!ev) return;
        ctipEl = ctipEl || $('#ctip');
        const host = d.type === 'map' ? d : d.type === 'sub' ? state.bySym[d.of] : null;
        const name = d.short || d.zh || '';
        const iconHtml = flagHtml(d.flag, 'flg');
        let desc = d.zh || '';
        if (host) {
            const st = marketStatus(host);
            const label = { open: '🟢 ' + $t('開盤中'), break: '🍱 ' + $t('午休中'), closed: '😴 ' + $t('休市') }[st] || '';
            desc = [desc, label].filter(Boolean).join('　');
        }
        ctipOwner = null;
        ctipEl.innerHTML =
            `<div class="th"><div class="ti">${iconHtml}</div><div class="tt">` +
            `<div class="tn">${esc(name)}</div>` +
            `<span class="tk" data-k="國家">${esc($t('國家'))}</span></div></div>` +
            `<div class="td">${esc(desc)}</div>`;
        ctipEl.classList.add('show');
        moveCtip(ev);
    }

    function layoutMarkers() {
        if (!projection || !state.maps.length || state.flying) return;
        if (window.GeoScenes) GeoScenes.layout();
        const t = state.t,
            k = t.k;
        // 手機版全球檢視：只列十大市值國家（markets.json 的 g10），旗幟排成左右兩欄
        const top10 = !desktopMQ.matches && state.activeRegion === 'all';
        // 商品 / 債券 / 利率 / 匯率 / 地緣 / 全球市場篩選：股票動物與旗幟都收起來，只顯示主題卡片
        const topicMode = !!TOPICS[state.activeRegion];
        // 遊戲模式：只顯示地圖和動畫，隱藏所有卡片（和 topicMode 一起讓旗幟消失，但不顯示主題卡片）
        const gameMode = state.activeRegion === 'game';
        const size = Math.max(19, Math.min(30, 14 + k * 2.8)); // 動物身高（px），放大地圖時略微變大
        const rects = [],
            vis = new Map();
        // pin 的國家優先放動物，這樣不會因為鄰近的動物（例如新加坡和馬來西亞）重疊就被隱藏
        // 遊戲模式：動物正常顯示（和一般動畫一致），只隱藏旗幟卡片（見下方 gameMode 把 o.b 清空）
        const arr = topicMode ? [] : state.maps.slice().sort((a, b) => !!b.pin - !!a.pin || b.w - a.w);

        // 第一輪：放動物，太擠的先隱藏（放大後會出現）
        for (const m of arr) {
            const [x, y] = screenXY(m.lon, m.lat);
            const forced = top10 && m.g10; // 旗幟不跟著動物走，動物在畫面外也要保留
            if (!forced && (x < -20 || x > W + 20 || y < -20 || y > H + 20)) continue;
            // 原點是腳下的地面，身體往上長；佔位框也包含牠走動的範圍
            const a = { x: x - size * 0.75, y: y - size * 1.05, w: size * 1.5, h: size * 1.35, an: true, mk: m.s };
            const area = a.w * a.h;
            // 手機版要排進左右兩欄的國家（pin，或 markets.json 指定了 col）動物不能被擠掉，否則旗幟也跟著不見
            if (!forced && rects.some((r) => inter(a, r) / area > (m.pin || (m.col && !desktopMQ.matches) ? 0.8 : 0.3))) continue;
            rects.push(a);
            vis.set(m.s, { m, x, y, a, size, b: null });
        }
        // 台股前十大的建築：放在動物之後、旗幟之前，旗幟會避開建築（動物照常可以站在建築前面）
        if (window.Corps) {
            const tq = state.quotes['^TWII'];
            rects.push(
                ...Corps.layout({
                    W,
                    H,
                    xy: screenXY,
                    pct: tq ? tq.pct : null,
                    visible: !topicMode,
                    avoid: uiRects(['#chips', '#hud']),
                }).map((r) => ({ ...r, corp: true })), // 標記：小人可以站在公司建築前面（台灣縮小時整座島都是建築）
            );
        }
        // 浮動介面（篩選列、概況卡）蓋住的地方，氣泡不要放進去
        const ui = uiRects(['#chips', '#hud']);
        rects.push(...ui);
        // 小角色的基準大小（小角色比市場動物大一點，世界視角也看得出在做什麼）
        const csz = Math.max(24, Math.min(44, 16 + k * 5));
        // 原住民小人（一個國家一組）：整組一起找離國家最近、不被動物 / 建築 / 旗幟 / 介面蓋住的空位。
        // 電腦版：在旗幟排版之前先找，找到後把這塊地方登記成「動物」的佔位框，旗幟就會避開（和市場動物一樣）。
        // 手機版：旗幟排成左右兩欄、不會避讓別人，所以要等旗幟排好再找空位，找不到就在畫面上找最近的空地（會畫一條虛線連回國家）
        const folkShift = new Map();
        // 小人的位置只在「換視角 / 縮放或拖曳停下來之後」重找一次（結果存在 folkCache），拖曳 / 縮放途中沿用上一次的結果：
        // 找位置要對整個畫面的格點做 isPointInPath（國家輪廓有幾千個點），十個國家每一幀都找手機會非常卡
        const folkKey = `${W}x${H}|${state.activeRegion}|${desktopMQ.matches ? 'd' : 'm'}`;
        // 世界地標（泰姬瑪哈陵、自由女神…）不會让人，小人要自己避開
        const lmRects = critters
            .filter((o) => o.d.landmark && !o.d.sea)
            .map((o) => {
                const [lx, ly] = screenXY(o.d.lon, o.d.lat),
                    lz = csz * o.d.s;
                return { x: lx - lz * 0.6, y: ly - lz * 1.1, w: lz * 1.2, h: lz * 1.2 };
            });
        const placeFolk = (avoidIn, wide) => {
            const avoid = avoidIn.concat(lmRects);
            for (const c of critters) {
                if (c.d.mode !== 'folk' || folkShift.has(c.d.market)) continue;
                const grp = critters.filter((o) => o.d.mode === 'folk' && o.d.market === c.d.market);
                let pick = null;
                if (k >= (c.d.minK || 0) && !topicMode) {
                    const [bx, by] = screenXY(c.d.lon, c.d.lat);
                    // 這個位置（相對偏移 dx, dy，縮放 sc，靠攏 sp）上三個人各自佔的框
                    const rectsOf = (dx, dy, sc, sp) => {
                        const cz = csz * sc;
                        return grp.map((o) => ({
                            x: bx + ((o.d.ox || 0) * sp + dx) * cz - cz * 0.9,
                            y: by + ((o.d.oy || 0) * sp + dy) * cz - cz * 1.9,
                            w: cz * 1.8,
                            h: cz * 2.1,
                            an: true,
                        }));
                    };
                    const free = (rs) =>
                        rs.every(
                            (r) =>
                                r.x >= 2 &&
                                r.x + r.w <= W - 2 &&
                                r.y >= 2 &&
                                r.y + r.h <= H - 2 &&
                                // 自己國家的動物：台灣縮小時動物和小人都在島上，可以靠近；其他國家要離開一段距離，才看得清楚小人。
                                // 公司建築：小人畫在它上面（見 gFolk），所以可以站在建築前面，不會被蓋住
                                !avoid.some((q) => {
                                    if (q.corp) return inter(r, q) / (r.w * r.h) > 0.9;
                                    if (q.mk !== c.d.market) return inter(r, q) / (r.w * r.h) > 0.12;
                                    if (q.mk === '^TWII') return inter(r, q) / (r.w * r.h) > 0.8;
                                    const g = q.w * 0.6; // 動物四周留的空隙
                                    return inter(r, { x: q.x - g, y: q.y - g, w: q.w + g * 2, h: q.h + g * 2 }) > 0;
                                }),
                        );
                    const hit = folkCache.get(c.d.market);
                    // 拖曳 / 縮放停下來後，上次的位置如果已經是最好的（正常大小、三個人的腳都在陸地上）而且還是有效，就直接沿用，不用重掃
                    const keep = (h) => {
                        if (!h || !h.pick || h.pick[2] !== 1 || h.key !== folkKey) return false;
                        const [dx, dy, , sp] = h.pick;
                        const rs = rectsOf(...h.pick);
                        return (
                            grp.every((o) =>
                                onLand(c.d.market, bx + ((o.d.ox || 0) * sp + dx) * csz, by + ((o.d.oy || 0) * sp + dy) * csz),
                            ) && free(rs)
                        );
                    };
                    if (hit && hit.key === folkKey && hit.gen === folkGen) {
                        pick = hit.pick;
                        if (pick && !wide) rects.push(...rectsOf(...pick));
                    } else if (keep(hit)) {
                        pick = hit.pick;
                        if (!wide) rects.push(...rectsOf(...pick));
                        folkCache.set(c.d.market, { key: folkKey, gen: folkGen, pick });
                    } else {
                        // 比附近的小範圍更廣：整個畫面裡「在這個國家陸地上」的格點（螢幕座標），由近到遠。
                        // 附近的位置都不行才會掃（惰性），多數情況用不到
                        let mask = null;
                        const landAt = (x, y) => (mask || (mask = landMask(c.d.market, W, H)))(x, y);
                        let landPts = null;
                        const getLandPts = () => {
                            if (landPts) return landPts;
                            const step = Math.max(8, csz * 0.4);
                            landPts = [];
                            for (let gx = 0; gx < W; gx += step)
                                for (let gy = 0; gy < H; gy += step) if (landAt(gx, gy)) landPts.push([gx, gy]);
                            landPts.sort((p, q) => (p[0] - bx) ** 2 + (p[1] - by) ** 2 - ((q[0] - bx) ** 2 + (q[1] - by) ** 2));
                            return landPts;
                        };
                        // 分三級找位置，越前面越嚴格：① 三個人的腳都在自己國家的陸地上 ② 至少 2/3 在陸地上 ③ 整組的中心在陸地上。
                        // 每一級先試正常大小的小人，陸地放不下就縮小（最小約 13px）、或把三個人往中間靠攏（像一小群人擠在小島上）；
                        // 三級都找不到才收起來。這樣國家小（例如台灣）時，三個人也會在島上，不會跑到海上或別的國家
                        // 最嘗試的一級是「腳邊留一點陸地」（台灣這種小島不適用），小人才不會緊貼海岸、看起來在海上
                        const tiers =
                            c.d.market === '^TWII'
                                ? [
                                      [1, false],
                                      [2 / 3, false],
                                      [0, false],
                                  ]
                                : [
                                      [1, true],
                                      [1, false],
                                      [2 / 3, false],
                                      [0, false],
                                  ];
                        outer: for (const [need, margin] of tiers) {
                            for (const sc of FOLK_SCALES) {
                                const cz = csz * sc;
                                if (cz < 13 || (margin && sc < 0.5)) break;
                                for (const sp of FOLK_SPREADS) {
                                    const feet = (dx, dy) =>
                                        grp.map((o) => [
                                            bx + ((o.d.ox || 0) * sp + dx) * cz,
                                            by + ((o.d.oy || 0) * sp + dy) * cz,
                                        ]);
                                    const landOk = (dx, dy) => {
                                        const f = feet(dx, dy);
                                        if (need === 0) {
                                            const cx = f.reduce((s, p) => s + p[0], 0) / f.length,
                                                cy = f.reduce((s, p) => s + p[1], 0) / f.length;
                                            return landAt(cx, cy);
                                        }
                                        // 整個身體（左右、腳下、頭頂）都要在自己國家內，才不會站在國界上、頭露到鄰國
                                        const ok = ([x, y]) =>
                                            landAt(x, y) &&
                                            (!margin ||
                                                (landAt(x - cz * 0.9, y) &&
                                                    landAt(x + cz * 0.9, y) &&
                                                    landAt(x, y + cz * 0.4) &&
                                                    landAt(x, y - cz * 1.8) &&
                                                    landAt(x - cz * 0.9, y - cz) &&
                                                    landAt(x + cz * 0.9, y - cz)));
                                        return f.filter(ok).length >= Math.ceil(f.length * need - 1e-9);
                                    };
                                    const tryAt = (dx, dy) => {
                                        if (!landOk(dx, dy)) return false;
                                        const rs = rectsOf(dx, dy, sc, sp);
                                        if (!free(rs)) return false;
                                        pick = [dx, dy, sc, sp];
                                        if (!wide) rects.push(...rs);
                                        return true;
                                    };
                                    for (const [dx, dy] of FOLK_SPOTS) if (tryAt(dx, dy)) break outer;
                                    if (wide)
                                        for (const [gx, gy] of getLandPts())
                                            if (
                                                tryAt(
                                                    (gx - bx) / cz - (c.d.grpOx || 0) * sp,
                                                    (gy - by) / cz - (c.d.grpOy || 0) * sp,
                                                )
                                            )
                                                break outer;
                                }
                            }
                        }
                        folkCache.set(c.d.market, { key: folkKey, gen: folkGen, pick });
                    }
                }
                folkShift.set(c.d.market, pick);
            }
        };
        if (desktopMQ.matches) placeFolk(rects, false);
        // 第二輪：放氣泡，先試完整版，再試迷你版
        const baseRects = rects.slice();
        // 旗幟整體放大倍率：手機螢幕小，指數數字要放大才看得清楚（旗幟內部仍用原本的座標畫，最後再整個 scale）
        let U = desktopMQ.matches ? 1 : BUBBLE_SCALE_MOBILE;
        // 全球檢視用合併後的指數清單（中國 + 香港）
        const grpOf = (m) => (top10 && m.group10) || m.group;
        // 全球檢視：十大市值國家排兩欄（g10 = L/R + 由上而下的序號），兩欄頂端對齊，地圖留在上方。
        // 多指數的國家整張列出；兩欄放不下時退回 full（多指數輪播）
        const layoutTop10 = () => {
            const ps = [...vis.values()].filter((o) => o.m.g10 && state.quotes[o.m.s]);
            if (!ps.length) return null;
            const GAP = 4;
            const colW = Math.floor((W - 8 - GAP) / 2);
            const multiW = Math.min(colW, Math.round(Math.min(166, Math.floor((W - 10) / 2 / U)) * U));
            const top0 = Math.max(2, ...uiRects(['#chips', '#hud']).map((z) => z.y + z.h)) + GAP;
            // 下緣：地圖資料來源那行字、右下角的災難按鈕之上；較高的那欄買齊底線，另一欄跟它頂端對齊
            const lim = Math.min(
                H - 18,
                ...uiRects(['#dzBtn'])
                    .filter((z) => z.y > H / 2)
                    .map((z) => z.y - GAP),
            );
            // 每張旗幟的未放大高度（multi = 所有指數整張列出）
            const h1 = (o, multi) => {
                const n = grpOf(o.m).length;
                return multi && hasRows(o.m, n) ? multiH(o.m, n) : FULL_H;
            };
            const colsOf = (list) => [0, 1].map((col) => list.filter((o) => (o.m.g10[0] === 'L' ? 0 : 1) === col));
            // 最大放大倍率：讓較高的那欄剛好放進「上緣到下緣」之間（不超過手機版的 U）
            const fitU = (multi) =>
                Math.min(
                    U,
                    ...colsOf(ps).map((seq) =>
                        seq.length ? (lim - top0 - GAP * (seq.length - 1)) / seq.reduce((s, o) => s + h1(o, multi), 0) : U,
                    ),
                );
            // u：這一組旗幟共用的放大倍率。畫面放不下整張列出時會縮小（和主題卡片一樣），
            // 所以多指數的國家不用輪播，也能一眼看完所有指數
            const build = (multi, u) => {
                const iw = Math.min(166, Math.floor(colW / u)); // 未放大的寬度
                const items = ps.map((o) => {
                    const n = grpOf(o.m).length,
                        mu = multi && hasRows(o.m, n);
                    return {
                        o,
                        mu,
                        col: o.m.g10[0] === 'L' ? 0 : 1,
                        no: +o.m.g10.slice(1),
                        w: mu
                            ? Math.round(iw * u)
                            : Math.round(Math.max(n > 1 ? 136 : 118, headNeedW(o.m, n > 1 ? n * 6 + 4 : 0)) * u),
                        h: Math.round(h1(o, multi) * u),
                    };
                });
                const w = Math.min(colW, Math.max(...items.map((it) => it.w)));
                const out = new Map();
                const cols = [0, 1].map((col) => items.filter((it) => it.col === col).sort((a, b) => a.no - b.no));
                const hs = cols.map((seq) => seq.reduce((s, it) => s + it.h + GAP, -GAP));
                // 由上往下排（和主題卡片一樣從篩選列下方開始），超出下緣就放棄
                if (top0 + Math.max(...hs) > lim) return null;
                cols.forEach((seq, col) => {
                    let y = top0;
                    for (const it of seq) {
                        out.set(it.o.m.s, {
                            r: { x: col ? W - 4 - w : 4, y, w, h: it.h },
                            mode: it.mu ? 'multi' : 'full',
                            pos: 'col',
                            u,
                        });
                        y += it.h + GAP;
                    }
                });
                return out;
            };
            const u0 = fitU(true),
                uMulti = u0 < U ? u0 * 0.99 : u0; // 取整數像素會多出幾 px，留一點餘裕
            return (uMulti >= 0.6 && build(true, uMulti)) || build(false, Math.max(0.6, fitU(false)));
        };
        // 手機版：pin 的國家（中、港、日、韓、台、星、馬、印尼）改用左右兩欄排版。
        // 每張旗幟盡量放在自己動物的正上方，同一欄依動物由北到南往下疊，擠不下再整欄往上收，
        // 這樣每張都能完整列出，也不會被擠到離自己國家很遠的地方。排不下時回傳 null，改用一般的避讓排法。
        const layoutPinColumns = () => {
            // 只排目前區域的 pin 國家（全球檢視沿用亞太），不同區域的旗幟不會被塞進同一欄
            const pinR = state.activeRegion === 'all' ? 'asia' : state.activeRegion;
            const ps = [...vis.values()].filter((o) => (o.m.pin || o.m.col) && o.m.r === pinR && state.quotes[o.m.s]);
            if (ps.length < 2) return null;
            const GAP = 4;
            const colW = Math.floor((W - 8 - GAP) / 2); // 每一欄的寬度（左右各留 4px 邊）
            const multiW = Math.min(colW, Math.round(Math.min(166, Math.floor((W - 10) / 2 / U)) * U));
            const colR = [
                [4, 4 + colW],
                [W - 4 - colW, W - 4],
            ];
            const ui = baseRects.filter((z) => !z.an);
            // 上緣：概況卡、篩選列的下方
            const top0 = Math.max(2, ...ui.filter((z) => z.y < H / 3).map((z) => z.y + z.h)) + GAP;
            const bot0 = H - 18; // 下緣：留出地圖資料來源那一行字
            // 依倍率 u 算出這張旗幟的寬高（hu 是未放大的高度）
            const fit = (it, u) => {
                it.u = u;
                it.w = it.rows
                    ? u === U
                        ? multiW
                        : Math.min(colW, Math.round(Math.min(166, Math.floor(colW / u)) * u))
                    : Math.min(colW, Math.round(Math.max(118, headNeedW(it.o.m, 0)) * U));
                it.h = Math.round(it.hu * u);
            };
            const items = ps.map((o) => {
                const n = o.m.group.length;
                const rows = hasRows(o.m, n); // 多指數，或放大後有公司列（英、法、德這類單一指數的國家也是）
                const it = { o, n, rows, hu: rows ? multiH(o.m, n) : FULL_H, mode: rows ? 'multi' : 'full' };
                fit(it, U);
                return it;
            });
            const byS = new Map(items.map((it) => [it.o.m.s, it]));
            for (const it of items) it.parent = (it.o.m.under && byS.get(it.o.m.under)) || null;
            // 分欄：markets.json 的 col（L / R）優先；under 的國家跟著依附的國家；其餘看動物在畫面左半或右半
            const colOf = (it) =>
                it.parent ? colOf(it.parent) : it.o.m.col === 'L' ? 0 : it.o.m.col === 'R' ? 1 : it.o.x < W / 2 ? 0 : 1;
            for (const it of items) it.col = colOf(it);
            // 放大後有公司列的旗幟很高：同一欄放不下時，這一欄的高旗幟一起等比例縮小（最多縮到 0.7 倍），放得下就維持原本大小，字才看得清楚
            for (const c of [0, 1]) {
                const [x0, x1] = colR[c];
                const mine = items.filter((it) => it.col === c);
                const talls = mine.filter((it) => it.hu > 24 + it.n * 16 + 5);
                if (!talls.length) continue;
                const lim = Math.min(
                    bot0,
                    ...ui
                        .concat(uiRects(['#dzBtn']))
                        .filter((z) => z.y > H / 2 && z.x < x1 && z.x + z.w > x0)
                        .map((z) => z.y - GAP),
                );
                const fixed = mine.filter((it) => !talls.includes(it)).reduce((s, it) => s + it.h, 0) + GAP * (mine.length - 1);
                const need = talls.reduce((s, it) => s + it.hu, 0);
                const u = Math.max(0.7, Math.min(U, Math.floor(((lim - top0 - fixed - talls.length) / need) * 100) / 100));
                for (const it of talls) fit(it, u);
            }
            const overX = (it, a) => it.x < a.x + a.w && it.x + it.w > a.x;
            // 一整組（自己 + 接在下面的 under 國家）的總高度
            const blockH = (it) => it.h + items.filter((c) => c.parent === it).reduce((s, c) => s + GAP + blockH(c), 0);
            const stack = (col, jump) => {
                // 依動物由北到南排序；under 的國家緊接在依附的國家之後
                const seq = [];
                const add = (it) => {
                    seq.push(it);
                    items
                        .filter((c) => c.parent === it)
                        .sort((a, b) => a.o.y - b.o.y)
                        .forEach(add);
                };
                items
                    .filter((it) => it.col === col && !it.parent)
                    .sort((a, b) => a.o.y - b.o.y)
                    .forEach(add);
                const [x0, x1] = colR[col];
                let y = top0;
                for (const it of seq) {
                    // 水平：對齊自己的動物，但不超出這一欄；under 的國家和依附的國家左緣對齊
                    it.x = Math.max(x0, Math.min(x1 - it.w, it.parent ? it.parent.x : it.o.x - it.w / 2));
                    // 動物正上方；有 under 的國家（上證 + 香港）要整組一起放在動物上方，下面那張才不會蓋住上面國家的動物
                    const bh = blockH(it);
                    it.want = it.o.a.y - bh - 5;
                    it.y = it.parent ? y : Math.max(y, it.want);
                    // 被上一張擠下來而蓋到自己的動物：改放到動物下方，讓動物露出來
                    if (jump && !it.parent && it.y > it.want && it.y < it.o.a.y + it.o.a.h && overX(it, it.o.a))
                        it.y = it.o.a.y + it.o.a.h + 2;
                    it.tail = bh === it.h; // 下面沒有接別張，才畫指向動物的小尾巴
                    y = it.y + it.h + GAP;
                }
                // 超出畫面下緣（或碰到右下角的災難按鈕之類的介面）：由下往上收（under 的國家會連同依附的國家一起往上推，維持緊貼）
                let lim = Math.min(
                    bot0,
                    ...ui
                        .concat(uiRects(['#dzBtn']))
                        .filter((z) => z.y > H / 2 && z.x < x1 && z.x + z.w > x0)
                        .map((z) => z.y - GAP),
                );
                for (let i = seq.length - 1; i >= 0; i--) {
                    if (seq[i].y + seq[i].h > lim) seq[i].y = lim - seq[i].h;
                    lim = seq[i].y - GAP;
                }
                return !seq.length || seq[0].y >= top0;
            };
            for (const col of [0, 1]) if (!stack(col, true) && !stack(col, false)) return null;
            const out = new Map();
            for (const it of items) {
                const r = { x: it.x, y: it.y, w: it.w, h: it.h };
                // 被開著的面板之類的介面蓋到，就放棄兩欄排法
                if (ui.some((z) => inter(r, z) > 0)) return null;
                // 剛好在自己動物正上方才畫指向動物的小尾巴
                const up = it.tail && !it.parent && Math.abs(it.y - it.want) < 1 && Math.abs(it.x + it.w / 2 - it.o.x) < 6;
                out.set(it.o.m.s, { r, mode: it.mode, pos: up ? 'up' : 'col', u: it.u });
            }
            return out;
        };
        const pinCols = desktopMQ.matches ? null : top10 ? layoutTop10() : layoutPinColumns();
        const place = (order0) => {
            // under 的國家要排在它所依附的國家後面，才找得到對方的旗幟位置
            const order = order0.slice();
            for (const m of order0) {
                const un = m.under;
                if (!un) continue;
                const pi = order.findIndex((x) => x.s === un),
                    ci = order.indexOf(m);
                // 一律緊接在依附的國家之後放，避免中間被其他旗幟先佔走正下方的位置
                if (pi < 0) continue;
                order.splice(ci, 1);
                order.splice(order.findIndex((x) => x.s === un) + 1, 0, m);
            }
            const rs = baseRects.slice();
            for (const o of vis.values()) o.b = null;
            // 兩欄排好的 pin 國家先固定下來，其他國家再從剩下的空間找位置
            if (pinCols)
                for (const [s, b] of pinCols) {
                    const r = { ...b.r };
                    vis.get(s).b = { ...b, r };
                    rs.push(r);
                }
            for (const m of order) {
                const o = vis.get(m.s);
                if (!o || !state.quotes[m.s] || (pinCols && pinCols.has(m.s)) || (top10 && !m.g10)) continue;
                // 多指數的國家：空間夠就整張列出（multi），不夠就輪播（full），再不夠只顯示主指數（mini）
                const n = m.group.length;
                // 窄螢幕：整張列出的旗幟最多佔半個畫面寬，這樣左右可以並排兩張
                const hasList = extraList(m).length > 0;
                const multiW = Math.min(hasList ? LIST_W : 166, Math.floor((W - 10) / 2 / U));
                // 電腦版有十大市值清單的旗幟：動物旁邊擠不下時，沿整個畫面找最近的空位（旗幟會畫引線連回國家），
                // 還是放不下才縮小到 0.86 倍（名稱要盡量維持清楚）
                const smaller = hasList && desktopMQ.matches ? [{ grid: true }, { s: 0.86, grid: true }] : [];
                const modes = (
                    hasRows(m, n)
                        ? [
                              { w: multiW, h: multiH(m, n), mode: 'multi' },
                              ...smaller.map((v) => ({ w: multiW, h: multiH(m, n), mode: 'multi', ...v })),
                              { w: Math.max(n > 1 ? 136 : 118, headNeedW(m, n > 1 ? n * 6 + 4 : 0)), h: FULL_H, mode: 'full' },
                              { w: 80, h: 22, mode: 'mini' },
                          ]
                        : [
                              { w: Math.max(118, headNeedW(m, 0)), h: FULL_H, mode: 'full' },
                              { w: 80, h: 22, mode: 'mini' },
                          ]
                ).map((md) => ({
                    ...md,
                    w: Math.round(md.w * U * (md.s || 1)),
                    h: Math.round(md.h * U * (md.s || 1)),
                    u: md.s ? U * md.s : undefined,
                }));
                outer: for (const md of modes) {
                    const cands = [
                        { x: o.x - md.w / 2, y: o.a.y - md.h - 5, pos: 'up' },
                        { x: o.x - md.w / 2, y: o.a.y + o.a.h + 2, pos: 'down' },
                        { x: o.a.x + o.a.w + 2, y: o.y - md.h / 2, pos: 'right' },
                        { x: o.a.x - md.w - 2, y: o.y - md.h / 2, pos: 'left' },
                    ];
                    // 四個基本方向被擠掉時，沿著邊緣滑動再試（滑動後的旗幟不畫指向動物的小尾巴）
                    for (const f of [-0.25, 0.25, -0.5, 0.5, -0.75, 0.75, -1, 1]) {
                        cands.push({ x: o.x - md.w / 2 + f * md.w, y: o.a.y - md.h - 5, pos: 'up~' });
                        cands.push({ x: o.x - md.w / 2 + f * md.w, y: o.a.y + o.a.h + 2, pos: 'down~' });
                        cands.push({ x: o.a.x + o.a.w + 2, y: o.y - md.h / 2 + f * md.h * 1.1, pos: 'right~' });
                        cands.push({ x: o.a.x - md.w - 2, y: o.y - md.h / 2 + f * md.h * 1.1, pos: 'left~' });
                    }
                    // pin 的國家（上證、韓國）寧可離動物遠一點也要整張列出：沿著整個畫面用格點再找一輪空位
                    if ((m.pin || md.grid) && md.mode !== 'mini') {
                        const st = m.pin ? 8 : 12;
                        for (let gy = 2; gy + md.h <= H - 2; gy += st)
                            for (let gx = 2; gx + md.w <= W - 2; gx += st) cands.push({ x: gx, y: gy, pos: 'grid' });
                    }
                    // markets.json 的 under：緊接在指定國家的旗幟正下方（例如香港放在上證下面），左緣對齊
                    const po = m.under && vis.get(m.under);
                    if (po && po.b && po.b.mode !== 'mini') cands.push({ x: po.b.r.x, y: po.b.r.y + po.b.r.h + 4, pos: 'under' });
                    // 離動物越近越優先（距離相同時維持 上、下、右、左 的順序）
                    const d2 = (c) => (c.x + md.w / 2 - o.x) ** 2 + (c.y + md.h / 2 - (o.y - o.size / 2)) ** 2;
                    // markets.json 的 deskSide：桌機版優先放在動物的指定方向（up / down / left / right）
                    // desktopMQ.matches 每次讀取都有成本，候選位置有上萬個，所以先讀一次
                    const deskSide = desktopMQ.matches ? m.deskSide : null;
                    cands.forEach(
                        (c, i) => ((c.i = i), (c.d = c.pos === 'under' || (deskSide && c.pos === deskSide) ? -1 : d2(c))),
                    );
                    heapify(cands);
                    while (cands.length) {
                        const c = heapPop(cands);
                        const r = { x: c.x, y: c.y, w: md.w, h: md.h };
                        if (r.x < 2 || r.y < 2 || r.x + r.w > W - 2 || r.y + r.h > H - 2) continue;
                        // under 的旗幟是刻意貼在指定國家下面，就算蓋到別人的動物佔位框也沒關係
                        if (rs.some((z) => !(c.pos === 'under' && z.an) && inter(r, z) > 0)) continue;
                        // markets.json 的 nx：選好位置後，旗幟再往右（正）或往左（負）微調 px；擠不下就少挪一點
                        if (m.nx && c.pos !== 'under') {
                            for (const k of [1, 0.75, 0.5, 0.25]) {
                                const r2 = { ...r, x: r.x + m.nx * k };
                                if (r2.x < 2 || r2.x + r2.w > W - 2) continue;
                                if (inter(r2, o.a) > 0 || rs.some((z) => inter(r2, z) > 0)) continue;
                                r.x = r2.x;
                                break;
                            }
                        }
                        rs.push(r);
                        o.b = { r, mode: md.mode, pos: c.pos, u: md.u };
                        break outer;
                    }
                }
            }
            // markets.json 的 swap：這個國家的旗幟和指定國家的旗幟互換位置（各自保持自己的大小，以對方的中心點為中心）
            // above：同樣是互換，但只在自己的旗幟比指定國家的旗幟低的時候才換（讓自己固定排在上面）
            for (const m of order) {
                const a = vis.get(m.s),
                    b = vis.get(m.swap || m.above);
                if (!a || !b || !a.b || !b.b || (pinCols && (pinCols.has(m.s) || pinCols.has(m.swap || m.above)))) continue;
                if (!m.swap && a.b.r.y + a.b.r.h / 2 <= b.b.r.y + b.b.r.h / 2) continue;
                const ca = { x: a.b.r.x + a.b.r.w / 2, y: a.b.r.y + a.b.r.h / 2 },
                    cb = { x: b.b.r.x + b.b.r.w / 2, y: b.b.r.y + b.b.r.h / 2 };
                const ra = { ...a.b.r, x: cb.x - a.b.r.w / 2, y: cb.y - a.b.r.h / 2 },
                    rb = { ...b.b.r, x: ca.x - b.b.r.w / 2, y: ca.y - b.b.r.h / 2 };
                const others = rs.filter((z) => z !== a.b.r && z !== b.b.r);
                const ok = (r) =>
                    r.x >= 2 && r.y >= 2 && r.x + r.w <= W - 2 && r.y + r.h <= H - 2 && !others.some((z) => inter(r, z) > 0);
                if (!ok(ra) || !ok(rb) || inter(ra, rb) > 0) continue;
                const pa = a.b.pos;
                a.b = { ...a.b, r: ra, pos: b.b.pos };
                b.b = { ...b.b, r: rb, pos: pa };
            }
            // 評分：整張列出的多指數國家越多越好，其次是沒被縮成迷你版
            let sc = 0;
            // markets.json 的 pin：一定要整張列出的國家（例如上證、韓國），分數特別高，其他國家只好讓位
            for (const o of vis.values()) {
                if (!o.b) continue;
                sc += (o.b.mode === 'multi' ? 100 : o.b.mode === 'full' ? 10 : 1) * (hasRows(o.m) ? 3 : 1) * (o.m.pin ? 20 : 1);
                // pin 的旗幟離自己的動物越遠越扣分（扣不到讓它變成非整張列出，只是讓位置盡量靠近）
                if (o.m.pin && o.b.mode !== 'mini' && o.b.pos !== 'under') {
                    const dist = Math.hypot(o.b.r.x + o.b.r.w / 2 - o.x, o.b.r.y + o.b.r.h / 2 - o.y);
                    sc -= o.b.mode === 'multi' ? Math.min(2500, dist * 8) : Math.min(150, dist * 0.8);
                }
                // 有 under 的國家如果真的貼在指定國家下面，加一點分，讓排列整齊
                if (o.b.pos === 'under') sc += 1500;
            }
            return sc;
        };
        // 先依權重由大到小放；如果有多指數的國家沒能整張列出，就讓它優先再排一次（最多重排幾次，取最好的）
        const solve = () => {
            let order = arr.slice().sort((a, b) => !!b.pin - !!a.pin || hasRows(b) - hasRows(a));
            let best = null;
            // pin 的國家誰先放會影響彼此的位置，所以正序、反序各排一輪，取分數最高的
            const pins = order.filter((m) => m.pin);
            const starts = [order];
            if (pins.length > 1) {
                const rest = order.filter((m) => !m.pin);
                starts.push([...pins.slice().reverse(), ...rest]);
                // 由北到南（畫面上方到下方）依序放，旗幟才會一層一層往下排整齊
                starts.push([...pins.slice().sort((a, b) => (vis.get(a.s)?.y ?? 0) - (vis.get(b.s)?.y ?? 0)), ...rest]);
            }
            for (const start of starts) {
                order = start;
                const tried = new Set();
                for (let it = 0; it < 6; it++) {
                    const sc = place(order);
                    if (!best || sc > best.sc) best = { sc, snap: [...vis.values()].map((o) => [o, o.b]) };
                    // 沒能整張列出的多指數國家，或沒能以完整版（非迷你）列出的 pin 國家，下一輪優先排
                    const missing = (m) =>
                        (hasRows(m) || m.pin) &&
                        !(top10 && !m.g10) &&
                        !(pinCols && pinCols.has(m.s)) &&
                        !tried.has(m.s) &&
                        vis.get(m.s) &&
                        state.quotes[m.s] &&
                        !(vis.get(m.s).b && (vis.get(m.s).b.mode === 'multi' || (!hasRows(m) && vis.get(m.s).b.mode === 'full')));
                    const miss = order.find((m) => m.pin && missing(m)) || order.find(missing);
                    if (!miss) break;
                    tried.add(miss.s);
                    order = [miss, ...order.filter((m) => m !== miss)];
                }
            }
            return best;
        };
        let best = null;
        if (!desktopMQ.matches) best = solve();
        else {
            // 電腦版空間夠大：旗幟連同字型整體放大。先用原尺寸排一次當基準，再從最大倍率往下試，
            // 取「沒有任何國家比基準更差（整張列出變輪播、變迷你、消失）」的最大倍率。
            // 結果依「畫面大小 + 篩選 + 縮放等級 + 已有報價的市場數」記起來，拖曳時不重算
            const rank = (b) => (b ? { multi: 3, full: 2, mini: 1 }[b.mode] || 0 : 0);
            const key = `${W}x${H}|${state.activeRegion}|${Math.round(Math.log2(Math.max(k, 0.1)) * 2)}|${state.maps.filter((m) => state.quotes[m.s]).length}`;
            let pick = deskUCache.get(key);
            if (pick == null) {
                U = 1;
                best = solve();
                pick = 1;
                // 全球檢視國家多、很擠：倍率上限較低
                const isAll = state.activeRegion === 'all';
                // 上限跟著畫面大小走；全球檢視常被「高度 / 640」這一項卡住（大多數螢幕高度換算出來比 DESK_SCALE_ALL 更小，
                // 導致調高 DESK_SCALE_ALL 常數也沒有效果），所以全球檢視用比較寬鬆的除數，才會真的變大
                const uMax = Math.max(
                    1,
                    Math.min(isAll ? DESK_SCALE_ALL : DESK_SCALE_MAX, W / (isAll ? 1020 : 1180), H / (isAll ? 540 : 640)),
                );
                if (uMax > 1.03) {
                    const base = new Map(best.snap.map(([o, b]) => [o.m.s, rank(b)]));
                    // 篩選的那一區自己的國家一個都不能退步；全球檢視，或其他區（例如中東非洲畫面裡的印度、中國）的國家，
                    // 最多容許 2 個從完整版退成迷你版（不能消失、整張列出的不能退）
                    const okRank = (t) => {
                        let down = 0;
                        for (const [o, b] of t.snap) {
                            const r0 = base.get(o.m.s),
                                r1 = rank(b);
                            if (r1 >= r0) continue;
                            if ((!isAll && o.m.r === state.activeRegion) || r0 === 3) return false;
                            // 區域外、本來就只剩迷你版的鄰近國家（例如看美洲時，畫面邊緣的荷蘭）：放大後擠不下就讓它隱藏，
                            // 不能因為它一個小角色就害整個區域的卡片都放不大
                            if (r0 === 1 && !isAll) continue;
                            if (r1 < 1 || ++down > 2) return false;
                        }
                        return true;
                    };
                    for (const u of [uMax, 1 + (uMax - 1) * 0.75, 1 + (uMax - 1) * 0.5, 1 + (uMax - 1) * 0.25]) {
                        U = u;
                        const t = solve();
                        if (okRank(t)) {
                            best = t;
                            pick = u;
                            break;
                        }
                    }
                }
                if (deskUCache.size > 80) deskUCache.clear();
                deskUCache.set(key, pick);
            } else {
                U = pick;
                best = solve();
            }
            U = pick;
        }
        for (const [o, bb] of best.snap) o.b = bb;
        // 遊戲模式：旗幟幾何算完後直接清空，動物還是正常顯示（渲染迴圈靠 o.b 判斷要不要畫旗幟）
        if (gameMode) for (const o of vis.values()) o.b = null;

        gMk.selectAll('g.mk').each(function (m) {
            const s = d3.select(this),
                bh = d3.select(m.bk),
                o = vis.get(m.s),
                wk = walkers.get(m.s);
            if (!o) {
                s.styleQ('display', 'none');
                bh.styleQ('display', 'none');
                if (wk) wk.vis = false;
                return;
            }
            s.styleQ('display', null).attrQ('transform', `translate(${o.x},${o.y})`);
            bh.styleQ('display', null).attrQ('transform', `translate(${o.x},${o.y})`);
            const st = marketStatus(m),
                q = state.quotes[m.s];
            const pct = q ? q.pct : 0;
            if (wk) {
                wk.vis = true;
                wk.st = st;
                wk.size = o.size;
            }
            const an = s.select('.an').attrQ('class', 'an ' + st);
            const z = o.size * (m.aScale || 1);
            sizeFigure(an, an.select('.beast'), z);
            an.select('.emoji')
                .attrQ('y', -z * 0.45)
                .attrQ('font-size', z * 0.9);
            an.select('.mood')
                .attrQ('x', z * 0.42)
                .attrQ('y', -z * 0.95)
                .attrQ('font-size', Math.max(10, z * 0.42))
                .textQ(st === 'closed' ? '💤' : '');

            const b = bh.select('.bubble');
            if (!o.b || !q) {
                b.styleQ('display', 'none');
                return;
            }
            // 旗幟內部用「未放大」的座標畫，所以寬高要除回倍率，最後在 transform 再 scale(U)
            const Uc = o.b.u || U; // 全球檢視縮小排版時，每張旗幟自己的倍率
            const w = o.b.r.w / Uc,
                h = o.b.r.h / Uc,
                mode = o.b.mode,
                mini = mode === 'mini',
                multi = mode === 'multi';
            const n = grpOf(m).length;
            // 輪播：多指數國家在 full 模式下，每隔幾秒換下一個指數
            const cur = mode === 'full' && n > 1 ? grpOf(m)[state.rot % n] : m;
            const cq = state.quotes[cur.s],
                cp = cq ? cq.pct : 0;
            const col = pctColor(pct);
            // 對齊整數像素，細線才會銳利
            const bx = Math.round(o.b.r.x),
                by = Math.round(o.b.r.y);
            b.styleQ('display', null).attrQ('transform', `translate(${bx - o.x},${by - o.y}) scale(${Uc})`);
            // 夜間：旗幟加藍冷色調 + 微微壓暗，但 brightness 最低 0.78 保持文字可讀；hover 時再提亮（見 bubbleFilter）
            b.styleQ('filter', bubbleFilter(m));
            // 旗幟上半部的名稱色帶（漲跌色；休市時變灰），迷你版不畫色帶
            drawBanner(b, w, h, {
                bg: st === 'closed' ? 'url(#bannerOff)' : 'url(#bannerBg)',
                band: mini ? null : st === 'closed' ? closedBandColor(pct) : bandColor(pct),
                tail: o.b.pos === 'up',
            });
            // 引線：旗幟邊緣離動物頭上超過 18px 才畫（座標是旗幟內部座標，不含倍率）
            {
                const ax = (o.x - bx) / Uc,
                    ay = (o.y - o.size * 0.55 - by) / Uc,
                    nx = Math.max(0, Math.min(w, ax)),
                    ny = Math.max(0, Math.min(h, ay));
                const far = desktopMQ.matches && !mini && Math.hypot(ax - nx, ay - ny) * Uc > 18;
                const ml = b.select('.mlead').styleQ('display', far ? null : 'none');
                if (far) {
                    ml.select('line').attrQ('x1', nx).attrQ('y1', ny).attrQ('x2', ax).attrQ('y2', ay);
                    ml.select('circle').attrQ('cx', ax).attrQ('cy', ay);
                }
            }
            // 國旗：完整版放在名稱色帶左側，迷你版放在漲跌幅左邊
            const hasFlag = !b.select('.flag').empty();
            const fw = mini ? 18 : 24,
                fh = mini ? 12 : 16,
                fx = mini ? 5 : 6,
                fy = mini ? 5 : 4;
            b.select('.flag')
                .attrQ('x', fx)
                .attrQ('y', fy)
                .attrQ('width', fw)
                .attrQ('height', fh)
                .styleQ('opacity', st === 'closed' ? 0.75 : 1);
            b.select('.flag-b')
                .attrQ('x', fx - 0.5)
                .attrQ('y', fy - 0.5)
                .attrQ('width', fw + 1)
                .attrQ('height', fh + 1);
            // 輪播頁碼小圓點（色帶右側）
            const dotW = mode === 'full' && n > 1 ? n * 6 + 4 : 0;
            b.select('.dots')
                .styleQ('display', dotW ? null : 'none')
                .selectAll('circle')
                .styleQ('display', (_, i) => (i < n ? null : 'none'))
                .attrQ('cx', (_, i) => w - 9 - (n - 1 - i) * 6)
                .attrQ('cy', 12)
                .attrQ('class', (_, i) => (i === state.rot % n ? 'on' : null));
            const tx0 = hasFlag ? fx + fw + 2 : 0;
            // 報價時間：靠右（在輪播圓點左邊）；名稱放不下時就不顯示時間
            const ts = mini ? '' : quoteStamp(m),
                tsW = ts ? textWidthOf(ts, 'ts') : 0;
            const pr = w - 5 - dotW,
                pillW = tsW + 8; // 時間膠囊的右緣與寬度
            const showTs = !!ts && textWidthOf(m.short) + pillW + 8 <= pr - tx0;
            b.select('.tsb')
                .styleQ('display', showTs ? null : 'none')
                .attrQ('x', pr - pillW)
                .attrQ('y', 5.5)
                .attrQ('width', pillW)
                .attrQ('height', 14);
            b.select('.ts')
                .styleQ('display', showTs ? null : 'none')
                .attrQ('x', pr - 4)
                .attrQ('y', 15.7)
                .textQ(showTs ? ts : '');
            const tx1 = showTs ? pr - pillW : w - dotW; // 文字置中在國旗和時間膠囊（圓點）之間
            const t1 = b
                .select('.t1')
                .attrQ('x', (tx0 + tx1) / 2)
                .attrQ('y', mini ? h / 2 + 4.5 : 17.2)
                .styleQ('font-size', mini ? '12px' : null);
            const t2 = b
                .select('.t2')
                .attrQ('x', w / 2)
                .attrQ('y', FULL_BASE)
                .styleQ('display', mode === 'full' ? null : 'none');
            b.select('.rows').styleQ('display', multi ? null : 'none');
            if (!mini) {
                t1.select('.a').textQ(hasFlag ? m.short : `${m.flag} ${m.short}`);
                t1.select('.m').textQ('');
            }
            // 報價剛更新：外框發光（群組裡任何一個指數有更新就閃）、數字區塊閃一下
            setFlash(
                b,
                grpOf(m)
                    .map((x) => flashOf(x.s))
                    .find(Boolean) || null,
            );
            const fl = b.select('.fl');
            setFlash(fl, multi ? null : flashOf(mode === 'full' ? cur.s : m.s));
            if (mini)
                fl.attrQ('x', 3)
                    .attrQ('y', 3)
                    .attrQ('width', w - 6)
                    .attrQ('height', h - 6);
            else
                fl.attrQ('x', 4)
                    .attrQ('y', 23)
                    .attrQ('width', w - 8)
                    .attrQ('height', Math.max(0, h - 26));
            // 漲跌幅超過 BIG_MOVE 的數字：實心底色 + 白字（單一指數 / 輪播 / 迷你版共用這顆矩形）
            const hl = b.select('.hl');
            let hlBox = null,
                hlPct = 0;
            if (mode === 'full') {
                const lb = n > 1 ? (cur.abbr || cur.zh) + ' ' : '',
                    vs = cq ? fmtN(cq.p, 'short') : '--',
                    ps = cq ? fmtChgPct(cp) : '';
                t2.select('.lb').textQ(lb);
                t2.select('.va').numQ(vs);
                const big = !!cq && Math.abs(cp) >= BIG_MOVE;
                t2.select('.pc')
                    .attrQ('fill', big ? '#fff' : pctColor(cp))
                    .numQ(ps, true);
                if (big) {
                    // t2 整行置中：算出漲跌幅這一段的位置（lb + va + 5px 間距 + pc）
                    const lw = lb ? tspanWidthOf(lb, 't2', 'lb') : 0,
                        vw = numW(vs),
                        pw = numW(ps, 'rp', true); // .pc 與 .rp 同為 13.5px
                    hlBox = { x: w / 2 - (lw + vw + 5 + pw) / 2 + lw + vw + 5 - 3, y: FULL_BASE - 12.5, w: pw + 6, h: 16 };
                    hlPct = cp;
                }
            } else if (multi) {
                const list = grpOf(m),
                    ex = extraList(m),
                    base = 24 + list.length * 16; // 額外的公司列從這裡開始
                b.selectAll('.row').each(function (_, i) {
                    // 注意：d3 append 的子元素會繼承父層資料，所以要用序號去 group 裡拿對應的指數
                    // 列的種類：idx = 指數；sec = 分隔標題（台股市值前十大）；corp = 公司
                    const r = d3.select(this);
                    const k2 =
                        i < list.length
                            ? 'idx'
                            : ex.length && i === list.length
                              ? 'sec'
                              : ex.length && i <= list.length + ex.length
                                ? 'corp'
                                : null;
                    r.styleQ('display', k2 ? null : 'none');
                    if (!k2) return;
                    const ci = i - list.length - 1; // 公司的序號
                    const x = k2 === 'idx' ? list[i] : k2 === 'corp' ? ex[ci] : null;
                    const y = k2 === 'idx' ? 24 + i * 16 : k2 === 'sec' ? base : base + SEC_H + ci * 16;
                    r.select('.rbg')
                        .attrQ('x', 4)
                        .attrQ('y', y)
                        .attrQ('width', w - 8)
                        .attrQ('height', k2 === 'sec' ? SEC_H : 16)
                        .classed('odd', (k2 === 'idx' ? i : ci) % 2 === 1 && k2 !== 'sec')
                        .classed('sec', k2 === 'sec');
                    r.select('.rn').classed('sec', k2 === 'sec');
                    if (k2 === 'sec') {
                        // 分隔線：和經濟數據卡片的分隔標題同一個樣式
                        setFlash(r, null);
                        r.select('.rn')
                            .attrQ('x', 9)
                            .attrQ('y', y + 9.2)
                            .styleQ('font-size', null)
                            .textQ(extraTitle(m));
                        r.select('.rk').textQ('');
                        r.select('.rv').textQ('');
                        r.select('.rp').textQ('');
                        r.select('.rhl').styleQ('display', 'none');
                        return;
                    }
                    // 指數用即時報價；公司用 tw-top.json 的收盤價與漲跌幅
                    const rq = k2 === 'idx' ? state.quotes[x.s] : x.pct == null ? null : { p: x.price, pct: x.pct };
                    setFlash(r, k2 === 'idx' ? flashOf(x.s) : null);
                    // 數字用 .rv/.rp（<text>）：CSS 的 fill 會蓋過屬性，漲跌色要用行內樣式；兩欄靠右對齊，依漲跌幅實際寬度排
                    // 公司股價超過 10 萬（韓股常見，例如 1,318,000）改用「萬」，不然數字太寬會擠到名稱
                    const vs = rq && rq.p != null ? (k2 === 'corp' && rq.p >= 1e5 ? fmtWan(rq.p) : fmtN(rq.p, 'short')) : '--',
                        ps = rq ? fmtChgPct(rq.pct) : '';
                    // 公司列：名稱放大、數字略縮（CORP_FS）；指數列維持原本字級。寬度要乘上字級比例
                    const isCorp = k2 === 'corp',
                        fs = isCorp ? CORP_FS : null,
                        sv = fs ? fs.rv / 15 : 1,
                        sp = fs ? fs.rp / 13.5 : 1,
                        sn = fs ? fs.rn / 11 : 1;
                    const pw = ps ? numW(ps, 'rp', true) * sp : 0;
                    const rvx = w - 8 - pw - 5;
                    // 名稱放不下時才縮小名稱
                    // 公司列：名次（.rk，靠右對齊在固定欄寬內，個位數和十位數的名稱才會對齊）和名稱（.rn）分開畫，
                    // 名次用淺藍色，和金色的名稱分得出來
                    const nx = isCorp ? 22 : 9,
                        lbl = isCorp ? $t(x.name) : x.abbr || x.zh,
                        lw = textWidthOf(lbl, 'rn') * sn,
                        room = rvx - numW(vs) * sv - nx - 4,
                        baseFs = fs ? fs.rn : 11;
                    r.select('.rk')
                        .attrQ('x', 19.5)
                        .attrQ('y', y + 12.3)
                        .textQ(isCorp ? x.rk : '');
                    r.select('.rn')
                        .attrQ('x', nx)
                        .attrQ('y', y + 12.5)
                        .styleQ(
                            'font-size',
                            lw > room ? `${Math.max(9, (baseFs * room) / lw).toFixed(1)}px` : fs ? `${fs.rn}px` : null,
                        )
                        .textQ(lbl);
                    r.select('.rv')
                        .attrQ('x', rvx)
                        .attrQ('y', y + 13.5)
                        .styleQ('font-size', fs ? `${fs.rv}px` : null)
                        .numQ(vs);
                    const big = !!rq && Math.abs(rq.pct) >= BIG_MOVE;
                    r.select('.rhl')
                        .styleQ('display', big ? null : 'none')
                        .attrQ('x', w - 8 - (big ? pw : 0) - 3)
                        .attrQ('y', y + 1.5)
                        .attrQ('width', big ? pw + 6 : 0)
                        .attrQ('height', 14)
                        .styleQ('fill', big ? hlColor(rq.pct) : null);
                    r.select('.rp')
                        .attrQ('x', w - 8)
                        .attrQ('y', y + 13.5)
                        .styleQ('font-size', fs ? `${fs.rp}px` : null)
                        .styleQ('fill', big ? '#fff' : rq ? pctColor(rq.pct) : null)
                        .numQ(ps, true);
                });
            } else {
                const ms = fmtPct(pct, 1),
                    big = Math.abs(pct) >= BIG_MOVE;
                const adx = hasFlag ? 0 : 3;
                t1.select('.a').textQ(hasFlag ? '' : m.flag);
                t1.select('.m')
                    .attrQ('fill', big ? '#fff' : col)
                    .attrQ('dx', adx)
                    .textQ(ms);
                if (big) {
                    // 迷你版 t1 以 (tx0+tx1)/2 置中：國旗 emoji（沒有國旗圖時）+ 間距 + 漲跌幅
                    const aw = hasFlag ? 0 : tspanWidthOf(m.flag, 't1', 'a', '12px'),
                        mw = tspanWidthOf(ms, 't1', 'm', '12px');
                    hlBox = { x: (tx0 + tx1) / 2 - (aw + adx + mw) / 2 + aw + adx - 3, y: h / 2 - 7, w: mw + 6, h: 14 };
                    hlPct = pct;
                }
            }
            hl.styleQ('display', hlBox ? null : 'none');
            if (hlBox)
                hl.attrQ('x', hlBox.x)
                    .attrQ('y', hlBox.y)
                    .attrQ('width', hlBox.w)
                    .attrQ('height', hlBox.h)
                    .styleQ('fill', hlColor(hlPct));
        });
        // 地標（央行、白宮、地緣動畫）和主題卡片：卡片要避開地標
        layoutLandmarks(rects, ui);
        layoutTopics(rects);

        // 小角色：活動範圍不壓住市場標記才顯示；放大到街道等級就收起來
        // 小角色比市場動物大一點，世界視角也看得出在做什麼
        if (!desktopMQ.matches) placeFolk(rects.concat([...vis.values()].filter((o) => o.b).map((o) => o.b.r)), true);
        const lmPlaced = []; // 已顯示的地標框：擠在一起時前面的優先，後面的等放大再出現，避免互相蓋住
        for (const c of critters) {
            const folk = c.d.mode === 'folk';
            const fs = folk ? folkShift.get(c.d.market) : null;
            // 小人如果陸地放不下，會縮小（fs[2]）並把三個人往中間靠攏（fs[3]）到放得下
            const size = folk && fs ? csz * fs[2] : csz,
                sp = folk && fs ? fs[3] : 1,
                z = size * c.d.s;
            const [x0, y0] = screenXY(c.d.lon, c.d.lat);
            // 原住民小人以位置點為中心，各自往旁邊挪開一點，三個人才不會疊在一起
            const x = x0 + (folk && fs ? ((c.d.ox || 0) * sp + fs[0]) * size : 0),
                y = y0 + (folk && fs ? ((c.d.oy || 0) * sp + fs[1]) * size : 0);
            const reach = { chase: 2.4, dolphin: 2.4, fin: 2.4, flyfish: 1.6, surf: 2, ski: 1.6 }[c.d.mode] || 1.1;
            const r = { x: x - size * reach, y: y - size * 1.1, w: size * reach * 2, h: size * 1.4 };
            const lr = { x: x - z * 0.5, y: y - z, w: z, h: z };
            const hide =
                (folk || c.d.landmark ? k > FOLK_MAX_K : k > 20) ||
                (folk && !fs) || // 找不到空位（或國家縮得只剩一個點）就先收起來
                x < -size * 3 ||
                x > W + size * 3 ||
                y < -size * 2 ||
                y > H + size * 2 ||
                // deco：各地代表動物，可以和市場動物重疊（只有旗幟、卡片、介面擋到才收起來）
                // landmark：世界地標，完全免疫所有碰撞遮擋，永遠顯示
                (!folk && !c.d.landmark && rects.some((q) => !(c.d.deco && q.an) && inter(r, q) / (r.w * r.h) > 0.15)) ||
                (c.d.landmark && lmPlaced.some((q) => inter(lr, q) / (lr.w * lr.h) > 0.55));
            if (!hide && c.d.landmark) lmPlaced.push(lr);
            c.vis = !hide;
            c.size = z;
            c.sx = x;
            c.sy = y;
            c.base = size;
            // 每度經度在螢幕上有幾 px：追逐 / 背鰭巡游的活動範圍要用「地理距離」限制，才不會縮小地圖時跑出海岸線
            if (c.d.maxDeg || ['chase', 'fin', 'surf', 'turtle', 'boat', 'ghost', 'trek'].includes(c.d.mode))
                c.ppd = Math.max(0.5, screenXY(c.d.lon + 1, c.d.lat)[0] - x);
            if (folk && c.d.first) {
                // 每組只由第一個成員負責畫虛線：組的中心不在國家附近（距離超過 3 個基準大小）才畫
                const ld = folkLeads.get(c.d.market);
                const gx = x0 + (c.d.grpOx * sp + (fs ? fs[0] : 0)) * size,
                    gy = y0 + (c.d.grpOy * sp + (fs ? fs[1] : 0)) * size;
                const far = !hide && fs && Math.hypot(gx - x0, gy - y0) > size * 3;
                ld.style.display = far ? '' : 'none';
                if (far) {
                    const ln = ld.firstChild,
                        dt = ld.lastChild;
                    setQ(ln, 'x1', x0.toFixed(1));
                    setQ(ln, 'y1', y0.toFixed(1));
                    setQ(ln, 'x2', gx.toFixed(1));
                    setQ(ln, 'y2', (gy - size * 0.4).toFixed(1));
                    setQ(dt, 'cx', x0.toFixed(1));
                    setQ(dt, 'cy', y0.toFixed(1));
                }
            }
            const disp = hide ? 'none' : '';
            if (c.g.style.display !== disp) c.g.style.display = disp;
            if (hide) continue;
            setQ(c.g, 'transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
            setQ(c.img, 'x', -z / 2);
            setQ(c.img, 'y', -z);
            setQ(c.img, 'width', z);
            setQ(c.img, 'height', z);
            setQ(c.shadow, 'rx', z * (c.d.sea ? 0.46 : 0.36));
            setQ(c.shadow, 'ry', z * (c.d.sea ? 0.12 : 0.1));
            setQ(c.shadow, 'cy', -z * 0.03);
        }
    }

    /* ---------- 日夜晨昏線 ---------- */
    // 日夜遮罩的貼圖（見 drawNight）
    // 快取當前太陽參數（每分鐘只算一次）
    let _sunCache = null,
        _sunCacheMin = -1;
    function sunParams() {
        const now = new Date();
        const min = now.getUTCHours() * 60 + now.getUTCMinutes();
        if (_sunCache && min === _sunCacheMin) return _sunCache;
        const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
        const sunLon = (utcH / 24 - 0.5) * -360;
        const dayOfYear = Math.floor((now - new Date(now.getUTCFullYear(), 0, 0)) / 864e5);
        const decl = ((-23.45 * Math.PI) / 180) * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365);
        _sunCache = { sunLon, decl };
        _sunCacheMin = min;
        return _sunCache;
    }
    // 給定經緯度，回傳「日照強度」0（夜）~ 1（晝），晨昏帶 ±6° 過渡
    function nightBrightAt(lon, lat) {
        const { sunLon, decl } = sunParams();
        const latR = (lat * Math.PI) / 180;
        const ha = ((lon - sunLon) * Math.PI) / 180; // 時角
        const sinAlt = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha);
        // 晨昏帶 ±6°（sin ≈ ±0.1045），柔化邊緣
        return Math.max(0, Math.min(1, (sinAlt + 0.1045) / 0.209));
    }
    // 晨昏線只跟時間有關，和縮放 / 拖曳無關：把全世界的夜色畫成一張小貼圖（Mercator 座標，只涵蓋可視緯度），
    // 每分鐘重畫一次；每一幀只是把貼圖貼到畫面上（以前每一幀逐格呼叫 projection.invert 再 fillRect 十幾萬次，是切換篩選時最大的卡頓來源）
    const NIGHT_TW = 1024; // 貼圖寬（每格約 0.35 度經度）
    const mercY = (lat) => 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI); // 單位 Mercator 的 y（0~1）
    const NIGHT_Y0 = mercY(VIEW_N),
        NIGHT_Y1 = mercY(VIEW_S);
    let nightTex = null,
        nightTexMin = -1;
    function nightTexture() {
        sunParams(); // 順便更新 _sunCacheMin
        if (nightTex && nightTexMin === _sunCacheMin) return nightTex;
        const { sunLon, decl } = _sunCache;
        const TH = Math.ceil(NIGHT_TW * (NIGHT_Y1 - NIGHT_Y0));
        if (!nightTex) {
            nightTex = document.createElement('canvas');
            nightTex.width = NIGHT_TW;
            nightTex.height = TH;
        }
        const g = nightTex.getContext('2d');
        const img = g.createImageData(NIGHT_TW, TH);
        const d = img.data;
        // 亮度 = sin(緯度)·sin(赤緯) + cos(緯度)·cos(赤緯)·cos(時角)：前一項只跟列有關，後面的 cos(時角) 只跟欄有關
        const cosHa = new Float32Array(NIGHT_TW);
        for (let c = 0; c < NIGHT_TW; c++) cosHa[c] = Math.cos((((c + 0.5) / NIGHT_TW) * 360 - 180 - sunLon) * (Math.PI / 180));
        const sd = Math.sin(decl),
            cd = Math.cos(decl);
        for (let r = 0; r < TH; r++) {
            const y = NIGHT_Y0 + ((r + 0.5) / TH) * (NIGHT_Y1 - NIGHT_Y0);
            const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y)));
            const a = Math.sin(lat) * sd,
                b = Math.cos(lat) * cd;
            for (let c = 0; c < NIGHT_TW; c++) {
                // 晨昏帶 ±6°（sin ≈ ±0.1045），柔化邊緣；遮罩不透明度 = 夜色 × 0.62
                const bright = Math.max(0, Math.min(1, (a + b * cosHa[c] + 0.1045) / 0.209));
                const o = (r * NIGHT_TW + c) * 4;
                d[o + 1] = 8;
                d[o + 2] = 30;
                d[o + 3] = Math.round((1 - bright) * 0.62 * 255);
            }
        }
        g.putImageData(img, 0, 0);
        nightTexMin = _sunCacheMin;
        return nightTex;
    }
    function drawNight() {
        if (!tctx || !W) return;
        const tex = nightTexture(),
            t = state.t,
            ww = S0 * t.k, // 世界（一圈）在畫面上的寬度
            y = t.y + NIGHT_Y0 * ww,
            h = (NIGHT_Y1 - NIGHT_Y0) * ww,
            TH = tex.height;
        // 世界左右循環：畫面涵蓋到的每一份都貼；只取畫面內的那一塊來源，放大很多倍時也不會拉出巨大的圖
        const dy0 = Math.max(0, y),
            dy1 = Math.min(H, y + h);
        if (dy1 <= dy0) {
            layoutStars();
            return;
        }
        const tiles = [];
        for (let n = Math.floor(-t.x / ww); n <= Math.floor((W - t.x) / ww); n++) {
            const x = t.x + n * ww,
                dx0 = Math.max(0, x),
                dx1 = Math.min(W, x + ww);
            if (dx1 <= dx0) continue;
            tiles.push([
                ((dx0 - x) / ww) * NIGHT_TW,
                ((dy0 - y) / h) * TH,
                ((dx1 - dx0) / ww) * NIGHT_TW,
                ((dy1 - dy0) / h) * TH,
                dx0 * dpr,
                dy0 * dpr,
                (dx1 - dx0) * dpr,
                (dy1 - dy0) * dpr,
            ]);
        }
        tctx.setTransform(1, 0, 0, 1, 0, 0);
        tctx.globalAlpha = 1;
        // 以 saturation 先讓夜側褪色，再用 source-over 蓋深藍遮罩
        for (const mode of ['saturation', 'source-over']) {
            tctx.globalCompositeOperation = mode;
            for (const q of tiles) tctx.drawImage(tex, ...q);
        }
        tctx.globalCompositeOperation = 'source-over';
        // 同步更新 SVG 星星位置與亮度
        layoutStars();
    }

    /* ---------- 四季：依現實月份 + 緯度，讓溫帶 / 副極地呈現對應的季節色調 ---------- */
    // 只跟緯度和日期有關（跟經度無關），所以比晨昏線更省：只需一條直條貼圖，拉伸貼滿畫面寬度，
    // 不用像夜色一樣逐份世界貼多次。一天只重算一次。
    let _seasonCache = null,
        _seasonDay = -1;
    function seasonParams() {
        const now = new Date();
        const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
        if (_seasonCache && dayOfYear === _seasonDay) return _seasonCache;
        // 北半球「季節相位」0~1：0 = 冬至（約 12/21）、0.25 = 春分、0.5 = 夏至、0.75 = 秋分
        const northPhase = (((dayOfYear - 355) / 365) % 1 + 1) % 1;
        _seasonCache = { northPhase };
        _seasonDay = dayOfYear;
        return _seasonCache;
    }
    // 四個季節的色調與強度：冬季霜白、春天嫩綠、夏天不染色（維持原本翠綠底色）、秋天改用偏冷的落葉褐橙（不要太鮮豔像熱帶橘）
    const SEASON_ANCHORS = [
        { p: 0, col: [225, 232, 242], a: 0.45 }, // 冬：霜白冷色
        { p: 0.25, col: [190, 228, 150], a: 0.22 }, // 春：嫩綠
        { p: 0.5, col: [255, 255, 255], a: 0 }, // 夏：不染色
        { p: 0.75, col: [196, 146, 98], a: 0.42 }, // 秋：偏冷的落葉褐橙（降低飽和度，不要太鮮豔）
    ];
    function seasonColorAt(phase) {
        const n = SEASON_ANCHORS.length;
        for (let i = 0; i < n; i++) {
            const a = SEASON_ANCHORS[i],
                b = SEASON_ANCHORS[(i + 1) % n],
                bp = i === n - 1 ? 1 : b.p;
            if (phase >= a.p && phase <= bp) {
                const t = bp === a.p ? 0 : (phase - a.p) / (bp - a.p);
                return {
                    r: a.col[0] + (b.col[0] - a.col[0]) * t,
                    g: a.col[1] + (b.col[1] - a.col[1]) * t,
                    b: a.col[2] + (b.col[2] - a.col[2]) * t,
                    a: a.a + (b.a - a.a) * t,
                };
            }
        }
        return { r: 255, g: 255, b: 255, a: 0 };
    }
    // 給定緯度（度），回傳現在這裡的季節色調；熱帶（|lat|<10）幾乎無季節，兩極常年冰雪不再疊色，
    // 南北半球的相位相差半年（北冬南夏）。溫帶（約 30°起）就要有感，所以權重在 lat=30 左右已經接近滿強度
    function seasonTintAt(lat) {
        const { northPhase } = seasonParams();
        const latAbs = Math.abs(lat);
        const phase = lat >= 0 ? northPhase : (northPhase + 0.5) % 1;
        const c = seasonColorAt(phase);
        const forestW =
            Math.max(0, Math.min(1, (latAbs - 10) / 20)) * Math.max(0, Math.min(1, (82 - latAbs) / 10));
        return { r: c.r, g: c.g, b: c.b, a: c.a * forestW };
    }
    const SEASON_TH = 256; // 直條貼圖的縱向解析度
    let seasonTex = null,
        seasonTexDay = -1;
    function seasonTexture() {
        seasonParams();
        if (seasonTex && seasonTexDay === _seasonDay) return seasonTex;
        if (!seasonTex) {
            seasonTex = document.createElement('canvas');
            seasonTex.width = 2; // 寬度跟經度無關，拉伸貼滿畫面即可
            seasonTex.height = SEASON_TH;
        }
        const g = seasonTex.getContext('2d');
        const img = g.createImageData(2, SEASON_TH);
        const d = img.data;
        for (let r = 0; r < SEASON_TH; r++) {
            const y = NIGHT_Y0 + ((r + 0.5) / SEASON_TH) * (NIGHT_Y1 - NIGHT_Y0);
            const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y))),
                latDeg = (latRad * 180) / Math.PI;
            const tint = seasonTintAt(latDeg);
            for (let c = 0; c < 2; c++) {
                const o = (r * 2 + c) * 4;
                d[o] = Math.round(tint.r);
                d[o + 1] = Math.round(tint.g);
                d[o + 2] = Math.round(tint.b);
                d[o + 3] = Math.round(tint.a * 255);
            }
        }
        g.putImageData(img, 0, 0);
        seasonTexDay = _seasonDay;
        return seasonTex;
    }
    // 季節色調的陸地遮罩：重複利用國界資料（state.countries）合併成一個 Path2D（世界座標），
    // 用 clip() 讓色調只蓋在陸地上，海洋完全不受影響。投影換了（resize）才重建，見 layoutGeometry 的 worldLandPath = null
    let worldLandPath = null;
    function getWorldLandPath() {
        if (worldLandPath) return worldLandPath;
        if (!projection || !state.countries.length) return null;
        const gp = d3.geoPath(projection);
        const path = new Path2D();
        for (const f of state.countries) {
            const d = gp(f);
            if (d) path.addPath(new Path2D(d));
        }
        worldLandPath = path;
        return worldLandPath;
    }
    function drawSeason() {
        if (!tctx || !W || !projection) return;
        const land = getWorldLandPath();
        if (!land) return;
        const tex = seasonTexture(),
            t = state.t,
            ww = S0 * t.k;
        // 世界可能同時看到好幾份（左右循環），逐份裁切陸地範圍再貼色調
        const n0 = Math.floor(-t.x / ww),
            n1 = Math.floor((W - t.x) / ww);
        for (let n = n0; n <= n1; n++) {
            tctx.save();
            // 把世界座標（含這份世界的位移 n*ww）轉成裝置像素：clip 和 drawImage 都用世界座標畫
            tctx.setTransform(t.k * dpr, 0, 0, t.k * dpr, (t.x + n * ww) * dpr, t.y * dpr);
            tctx.beginPath();
            tctx.clip(land);
            // 貼圖拉滿整個世界寬度與可視緯度範圍（世界座標），裁切後只留在陸地上，海洋完全排除
            tctx.drawImage(tex, 0, 0, 2, SEASON_TH, 0, NIGHT_Y0 * S0, S0, (NIGHT_Y1 - NIGHT_Y0) * S0);
            tctx.restore();
        }
    }

    /* ---------- 夜空星星（SVG，固定在地理座標上） ---------- */
    // 預先固定的星星經緯：分散在全球各大洋 / 高緯度上方，不壓住陸地標記
    const STARS_DATA = (() => {
        // 簡單 LCG 產生穩定的假隨機數
        let s = 0xdeadbeef;
        const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
        const pts = [];
        for (let i = 0; i < 120; i++) {
            const lon = -180 + rand() * 360;
            const lat = -75 + rand() * 150;
            const r = 0.8 + rand() * 1.4; // 半徑 px（邏輯）
            pts.push({ lon, lat, r });
        }
        return pts;
    })();
    function buildStars() {
        if (!gStars) return;
        gStars
            .selectAll('circle')
            .data(STARS_DATA)
            .enter()
            .append('circle')
            .attr('r', (d) => d.r)
            .attr('fill', '#e8f0ff')
            .style('opacity', 0)
            .style('pointer-events', 'none');
    }
    function layoutStars() {
        if (!gStars || !projection) return;
        gStars.selectAll('circle').each(function (d) {
            const nb = nightBrightAt(d.lon, d.lat);
            // 只在深夜（nb < 0.35）才顯示，晨昏帶漸入
            const op = Math.max(0, Math.min(0.9, ((0.35 - nb) / 0.35) * 0.9));
            if (op <= 0) {
                this.style.opacity = 0;
                return;
            }
            const [x, y] = screenXY(d.lon, d.lat);
            // 在畫面外就跳過
            if (x < -10 || x > W + 10 || y < -10 || y > H + 10) {
                this.style.opacity = 0;
                return;
            }
            this.setAttribute('cx', x.toFixed(1));
            this.setAttribute('cy', y.toFixed(1));
            this.style.opacity = op.toFixed(3);
        });
    }

    // 把經緯度框放進可用區域（扣掉被介面蓋住的地方，上方多留給地點旗幟）
    function fitBox(box, kMax = maxK * 0.5) {
        const ins = overlayInsets();
        const px = desktopMQ.matches ? 50 : 30,
            pt = 64,
            pb = 26;
        const aw = Math.max(80, W - ins.l - ins.r - px * 2),
            ah = Math.max(80, H - ins.t - ins.b - pt - pb);
        const a = projection([box[0], box[3]]),
            b = projection([box[2], box[1]]);
        const k = Math.min(kMax, aw / Math.max(1e-9, b[0] - a[0]), ah / Math.max(1e-9, b[1] - a[1]));
        const cx = (a[0] + b[0]) / 2,
            cy = (a[1] + b[1]) / 2;
        const sx = ins.l + px + aw / 2,
            sy = ins.t + pt + ah / 2;
        return d3.zoomIdentity.translate(sx - k * cx, sy - k * cy).scale(k);
    }
    const constrainT = (tr) =>
        zoomB.constrain()(
            tr,
            [
                [0, 0],
                [W, H],
            ],
            zoomB.translateExtent(),
        );
    function flyTo(tr) {
        animateTo(constrainT(tr), true);
    }
    /* ================= 圖層列 / 篩選列 / 其它指數面板 ================= */
    function buildRail() {
        $('#layers').innerHTML = LAYERS.map(
            (l) =>
                `<button class="rl${l.k === state.layer ? ' on' : ''}" data-k="${l.k}" title="${l.title}：${l.desc}${l.ready ? '' : $t('（即將推出）')}"` +
                ` aria-pressed="${l.k === state.layer}"${l.ready ? '' : ' aria-disabled="true"'}>` +
                `<span class="ri">${railIconSvg(l.k)}</span><span class="rt">${l.label}</span>${l.ready ? '' : `<i class="soon">${$t('即將')}</i>`}</button>`,
        ).join('');
        $('#layers').onclick = (e) => {
            const b = e.target.closest('.rl');
            if (!b) return;
            const l = LAYERS.find((x) => x.k === b.dataset.k);
            if (!l.ready) toast(`🚧 ${l.icon} ${$t('{title}（{desc}）即將推出', { title: l.title, desc: l.desc })}`);
        };
    }
    let toastT = 0;
    function toast(msg) {
        const t = $('#toast');
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toastT);
        toastT = setTimeout(() => t.classList.remove('show'), 2200);
    }

    function buildChips() {
        const defs = [
            ['game',     '🎮', $t('遊戲')],       // 遊戲：只顯示地圖，隱藏所有卡片
            ['all',      '🌍', $t('全球')],
            ['americas', '🗽', $t('美洲')],        // 美洲移到亞太左邊
            ['asia',     '⛩️', $t('亞太')],
            ['europe',   '🏰', $t('歐洲')],
            ['mea',      '🐪', $t('中東非洲')],
        ];
        const chip = (k, i, t) =>
            `<button class="chip gbtn" data-k="${k}" aria-pressed="false"><span class="ci">${i}</span>${t}</button>`;
        const nav = $('#chips');
        nav.innerHTML =
            `<div class="crow">${defs.map((d) => chip(...d)).join('')}</div>` +
            '<span class="csep" aria-hidden="true"></span>' +
            `<div class="crow">${Object.entries(TOPICS)
                .map(([k, t]) => chip(k, t.img ? `<img src="${t.img}" alt="">` : t.icon, t.label))
                .join('')}</div>`;
        nav.onclick = (e) => {
            const b = e.target.closest('.chip');
            if (!b) return;
            state.activeRegion = b.dataset.k;
            updateChips();
            applyRegion(true);
            renderHud();
            scheduleLayout();
        };
    }
    function updateChips() {
        document.querySelectorAll('.chip').forEach((b) => {
            const k = b.dataset.k;
            const on = k === state.activeRegion;
            b.classList.toggle('on', on);
            b.setAttribute('aria-pressed', on);
        });
    }

    // CNN 貪婪與恐慌指數的分級（0～24 極度恐慌、25～44 恐慌、45～55 中立、56～75 貪婪、76～100 極度貪婪）
    // 顏色：恐慌藍 → 中立金黃 → 貪婪橘紅；不用紅綠，避免和「紅漲綠跌」設定混淆
    function fngLevel(score) {
        if (score < 25) return { icon: '😱', label: '極度恐慌', color: '#2f6fed' };
        if (score < 45) return { icon: '😨', label: '恐慌', color: '#5aa0ff' };
        if (score <= 55) return { icon: '😐', label: '中立', color: '#f0c75e' };
        if (score <= 75) return { icon: '😏', label: '貪婪', color: '#fb923c' };
        return { icon: '🤑', label: '極度貪婪', color: '#ef4444' };
    }
    function renderFng() {
        const f = state.fng;
        const fill = $('#hpFill');
        const hp = $('.hp');
        const setBar = (pct, color) => {
            fill.style.clipPath = `inset(0 ${100 - pct}% 0 0 round 99px)`;
            $('#hpKnob').style.left = pct + '%';
            hp.querySelector('.fngi').style.setProperty('--fc', color);
        };
        if (!f) {
            setBar(0, '#8a94a6');
            $('#hpIcon').textContent = '😐';
            $('#hpText').textContent = '--';
            hp.title = $t('CNN 貪婪與恐慌指數');
            return;
        }
        const score = Math.round(f.score);
        const lv = fngLevel(f.score);
        setBar(score, lv.color);
        $('#hpIcon').textContent = lv.icon;
        $('#hpText').textContent = `${score} ${$t(lv.label)}`;
        const p = f.prev || {};
        const fmt = (v) => (typeof v === 'number' ? Math.round(v) : '--');
        hp.title =
            $t('CNN 貪婪與恐慌指數') +
            '　' +
            $t('前一日 {a}　一週前 {b}　一個月前 {c}　一年前 {d}', {
                a: fmt(p.close),
                b: fmt(p.week),
                c: fmt(p.month),
                d: fmt(p.year),
            });
    }

    function renderHud() {
        const open = state.maps.filter((m) => marketStatus(m) === 'open');
        renderFng();
        let line;
        const when = state.generated
            ? new Date(state.generated).toLocaleTimeString(I18n.intl, { hour: '2-digit', minute: '2-digit' })
            : '--';
        const topic = TOPICS[state.activeRegion];
        if (state.demo) line = '🎮 ' + $t('演示資料（連不上行情來源，數字是隨機的）');
        else if (topic) {
            const note =
                state.activeRegion === 'econ'
                    ? $t('自動更新，顯示最近一次公布值')
                    : state.activeRegion === 'rate'
                      ? $t('央行利率自動更新')
                      : state.activeRegion === 'geo'
                        ? $t('手動整理，可能不是最新')
                        : $t('行情約延遲 15 分鐘');
            line = `${topic.icon} ${topic.label} · ${$t('更新於 {when}', { when })} · ${note}`;
        } else
            line = `🟢 ${$t('{n} 個市場開盤中', { n: open.length })} · ${$t('更新於 {when}', { when })} · ${$t('資料約延遲 15 分鐘')}`;
        $('#statusLine').textContent = line;
    }

    /* ================= 彈窗 ================= */
    function showSheet(html) {
        const s = $('#sheet');
        const still = !s.hidden; // 已經打開時（例如切換分頁）就不要再播放滑入動畫
        s.innerHTML = `<div class="back"></div><div class="box${still ? ' still' : ''}"><button class="x gbtn" aria-label="${$t('關閉')}">✕</button>${html}</div>`;
        s.hidden = false;
    }
    // 台股前十大公司的詳情卡；c 是 null 時（縮小時的小城市）列出全部十家
    function openCorp(c) {
        const tq = state.quotes['^TWII'];
        const mood = !tq
            ? ''
            : tq.pct >= Corps.BOOM
              ? '🎆 ' + $t('台股大漲，整座城市放煙火！')
              : tq.pct > 0
                ? '💡 ' + $t('台股上漲，建築燈火通明')
                : tq.pct <= Corps.CRASH
                  ? '⛈️ ' + $t('台股重挫，城市籠罩在暴風雨裡')
                  : tq.pct < 0
                    ? '🌫️ ' + $t('台股下跌，城市一片低迷')
                    : '';
        const twii = tq ? `<div class="chg">${$t('台股加權')} ${fmtN(tq.p)}　${pctSpan(tq.pct, fmtChgPct(tq.pct))}</div>` : '';
        const note = Corps.LIVE
            ? `<p class="small">${$t('市值 = {when} × 已發行普通股數（新台幣），價格與漲跌幅對前一個交易日收盤；資料取自證交所與即時報價，每 10 分鐘自動更新；總部地址取自證交所上市公司基本資料。', { when: Corps.LIVE_AT ? $t('{t} 盤中價', { t: liveAtLocal(Corps.LIVE_AT) }) : $t('{d} 收盤價', { d: Corps.DATA_DATE }) })}</p>`
            : `<p class="small">${$t('市值為 {d} 收盤附近的約略數字（新台幣），不同網站的統計口徑可能略有差異；總部地址取自證交所上市公司基本資料。', { d: Corps.DATA_DATE })}</p>`;
        // 漲跌幅四捨五入到 2 位後是 0 就當平盤：灰色「0.00%」，不帶箭頭
        const pctTag = (p) =>
            p == null ? '' : isFlat(p) ? `　<span style="color:${FLAT_TEXT}">0.00%</span>` : `　${pctSpan(p, fmtChgPct(p))}`;
        if (!c) {
            showSheet(`<h3>🏙️ ${$t('台股市值前十大')}</h3>${twii}${mood ? `<p class="desc">${mood}</p>` : ''}
      <div class="meta">${Corps.topList()
          .map(
              (x) =>
                  `<div><b>${x.rk}. ${$t(x.name)}</b>（${x.s}）　${$t('{n} 兆', { n: x.cap.toFixed(2) })}${pctTag(x.pct)}　<span class="small">${$t(x.ind)}</span></div>`,
          )
          .join('')}</div>
      <p class="small">${$t('放大到台灣，就能看到每家公司蓋在自己總部的建築。')}</p>${note}`);
            return;
        }
        showSheet(`
    <div class="hd"><span class="big" style="color:${c.col}">🏢</span>
      <div><div class="nm">${$t(c.name)}</div><div class="sym">${c.s} · ${$t('台股市值第 {n} 名', { n: c.rk })}</div></div></div>
    <div class="px">${$t('{n} 兆', { n: c.cap.toFixed(2) })}</div>
    ${twii}
    <div class="meta">${c.p != null ? `<div><b>${$t('收盤')}</b>　${fmtN(c.p)}${pctTag(c.pct)}</div>` : ''}<div><b>${$t('主要產業')}</b>　${$t(c.ind)}</div><div><b>${$t('總部')}</b>　${c.addr}</div>${mood ? `<div>${mood}</div>` : ''}</div>
    ${note}`);
    }
    function clearHighlight() {
        if (!state.highlightId) return;
        state.highlightId = null;
        paintLand();
    }
    function openCard(m) {
        const q = state.quotes[m.s];
        const isMap = m.type === 'map';
        // 同國其他指數（sub）沿用主指數的國家、時區與交易時段
        const host = isMap ? m : m.type === 'sub' ? state.bySym[m.of] : null;
        const col = q ? pctColor(q.pct) : '#888';
        let meta = '';
        if (host) {
            const st = marketStatus(host);
            const label = { open: '🟢 ' + $t('開盤中'), break: '🍱 ' + $t('午休中'), closed: '😴 ' + $t('休市') }[st];
            const local = new Intl.DateTimeFormat(I18n.intl, {
                timeZone: host.tz,
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).format(new Date());
            meta += `<div><b>${$t('狀態')}</b>　${label}</div><div><b>${$t('當地時間')}</b>　${local}（${host.tz}）</div>`;
            if (st !== 'open') {
                const n = nextOpen(host);
                if (n)
                    meta += `<div><b>${$t('下次開盤')}</b>　${new Date(n).toLocaleString(I18n.intl, { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}${$t('（你的時區）')}</div>`;
            }
        }
        if (q && q.t)
            meta += `<div><b>${$t('最後成交')}</b>　${new Date(q.t * 1000).toLocaleString(I18n.intl, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}${q.stale ? '　⚠️ ' + $t('本輪抓取失敗，沿用舊資料') : ''}</div>`;
        const beast = isMap ? animalOf(m.a) : null;
        const bigIcon = beast
            ? `<img class="beast3d" src="${beast.src}" alt="${m.a}">`
            : flagHtml(isMap ? m.a : m.e, 'flg big-flg');
        const chg = q ? `${arrow(q.pct)} ${q.c >= 0 ? '+' : '−'}${fmtN(Math.abs(q.c))}（${fmtPct(q.pct)}）` : $t('暫無資料');
        // 多指數國家：卡片上方一排分頁，點一下切換到該指數
        const grp = host && host.group && host.group.length > 1 ? host.group : null;
        const tabs = grp
            ? `<div class="gtabs" role="tablist">${grp
                  .map((x) => {
                      const xq = state.quotes[x.s];
                      const xp = xq ? pctSpan(xq.pct, fmtChgPct(xq.pct)) : '<span>--</span>';
                      return `<button class="gtab gbtn${x === m ? ' on' : ''}" role="tab" aria-selected="${x === m}" data-s="${x.s}"><b>${x.abbr || x.zh}</b>${xp}</button>`;
                  })
                  .join('')}</div>`
            : '';
        // 其它十大市值國家：卡片下方列出市值前十大公司（旗幟上只有股價與漲跌幅，市值數字看這裡）
        const tf = host && topFeedOf(host);
        const capTxt = (c) =>
            $t('{n} 兆{cur}', { n: c >= 100 ? c.toFixed(0) : c >= 10 ? c.toFixed(1) : c.toFixed(2), cur: esc($t(tf.cur)) });
        const topHtml = tf
            ? `<h3 style="margin-top:14px">🏢 ${esc($t(tf.title))}</h3>
    <div class="meta">${tf.rows
        .map(
            (x) =>
                `<div><b>${x.rk}. ${esc($t(x.name))}</b>（${esc(x.s)}）　${capTxt(x.cap)}　${
                    isFlat(x.pct) ? `<span style="color:${FLAT_TEXT}">0.00%</span>` : pctSpan(x.pct, fmtChgPct(x.pct))
                }</div>`,
        )
        .join('')}</div>
    <p class="small">${$t('市值 = 本地幣別的市值（Yahoo Finance 盤中資料，約延遲 15 分鐘）；漲跌幅對前一個交易日收盤。不同網站的統計口徑可能略有差異。')}</p>`
            : '';
        showSheet(`
    <div class="hd"><span class="big">${bigIcon}</span>
      <div><div class="nm">${host ? flagHtml(host.flag) + ' ' : ''}${m.zh}</div><div class="sym">${m.s}</div></div></div>
    ${tabs}
    <div class="px">${q ? fmtN(q.p) : '--'}</div>
    <div class="chg" style="color:${col}">${q ? pctSpan(q.pct, chg) : chg}</div>
    <div class="meta">${meta}</div>${topHtml}`);
        // 高亮該國國界並飛到該國位置
        if (host && host.id) {
            state.highlightId = pad3(host.id);
            paintLand();
            // sz：粗估國家半徑（度），無欄位時依經驗值（中小型國 8°，大型國 18°）
            const sz = host.sz ?? (host.big ? 18 : 8);
            flyTo(fitBox([host.lon - sz, host.lat - sz * 0.6, host.lon + sz, host.lat + sz * 0.6], maxK * 0.35));
        }
    }
    function openSettings() {
        const pref = I18n.pref();
        const cur = I18n.LANGS.find((l) => l.code === I18n.lang);
        let tz = '';
        try {
            tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        } catch (e) {}
        const langBtn = (v, label) =>
            `<button class="gtab gbtn${pref === v ? ' on' : ''}" data-act="lang" data-lang="${v}" aria-pressed="${pref === v}"><b>${esc(label)}</b></button>`;
        showSheet(`
    <h3>⚙️ ${$t('設定')}</h3>
    <button class="big-btn gbtn" data-act="color">${state.redUp ? '🔴 ' + $t('紅漲綠跌（點我切換）') : '🟢 ' + $t('綠漲紅跌（點我切換）')}</button>
    <button class="big-btn gbtn" data-act="anim">${state.anim ? '🎬 ' + $t('動畫：開（點我關閉）') : '⏸️ ' + $t('動畫：關（點我開啟）')}</button>
    <h3 style="margin-top:16px">🌐 ${$t('語言')}</h3>
    <div class="gtabs langs">${langBtn('auto', $t('自動'))}${I18n.LANGS.map((l) => langBtn(l.code, l.name)).join('')}</div>
    <p class="small">${$t('目前顯示：{name}。「自動」會跟著瀏覽器的語言；如果偵測錯了，直接點選要用的語言，之後會記住你的選擇。', { name: cur.name })}${I18n.source === 'url' ? ' ' + $t('（這次由網址的 lang 參數指定）') : ''}</p>
    <p class="small">${$t('時間以你所在的時區顯示：{tz}。', { tz })}</p>
    <p class="small">${$t('資料來自 Yahoo Finance，由 GitHub Actions 定時抓取，通常延遲 15 分鐘以上，僅供娛樂參考，不構成投資建議。開盤狀態按各交易所常規時段推算，遇到假日會在資料停止更新後自動變為休市。')}</p>
    <p class="small">${$t('遊戲風地形由程式即時繪製：高度資料來自 AWS Terrain Tiles（Mapzen / SRTM 等），地貌判斷參考 Esri World Imagery（Esri、Maxar、Earthstar Geographics）。3D 動物與小角色圖示來自 Microsoft Fluent Emoji（MIT 授權），國旗圖來自 flagcdn.com。')}</p>`);
    }
    function onSheetClick(e) {
        const s = $('#sheet');
        if (e.target.closest('.x') || e.target.classList.contains('back')) {
            s.hidden = true;
            clearHighlight();
            return;
        }
        const tab = e.target.closest('.gtab');
        if (tab && state.bySym[tab.dataset.s]) {
            openCard(state.bySym[tab.dataset.s]);
            return;
        }
        const a = e.target.closest('[data-act]');
        if (!a) return;
        if (a.dataset.act === 'lang') {
            // 換語言：存起來再重新載入（旗幟、卡片的文字都是載入時建好的）。網址上的 ?lang= 要拿掉，不然會蓋過剛選的語言
            I18n.setPref(a.dataset.lang);
            const u = new URL(location.href);
            if (u.searchParams.has('lang')) {
                u.searchParams.delete('lang');
                location.replace(u.toString());
            } else location.reload();
            return;
        }
        if (a.dataset.act === 'color') {
            state.redUp = !state.redUp;
            store.set('redUp', state.redUp);
            refreshView();
        }
        if (a.dataset.act === 'anim') {
            state.anim = !state.anim;
            store.set('anim', state.anim);
            document.body.classList.toggle('noanim', !state.anim);
        }
        openSettings();
    }

    /* ================= 重新整理 / 啟動 ================= */
    function refreshView() {
        paintLand();
        scheduleLayout();
        renderHud();
    }
    function tick() {
        refreshView();
    }

    // 把 markets.json 裡的名稱、卡片文字換成目前語言（原文是繁體中文；字典沒有的字串維持中文）。
    // 地緣、白宮的說明文字是手動維護的新聞式內容，不翻譯（維持中文）
    function localizeCfg(cfg) {
        if (I18n.lang === 'zh-TW') return;
        const loc = (o, keys) => keys.forEach((k) => typeof o[k] === 'string' && (o[k] = $t(o[k])));
        for (const i of cfg.items) loc(i, ['zh', 'short', 'abbr']);
        for (const c of cfg.topics || []) {
            const news = c.cat === 'geo' || c.cat === 'policy';
            loc(c, news ? ['short', 'src', 'stamp'] : ['short', 'src', 'stamp', 'note']);
            for (const r of c.rows) loc(r, news ? ['l', 'sec', 'v'] : ['l', 'sec', 'v', 'note']);
        }
        for (const l of cfg.landmarks || []) loc(l, ['label']);
    }
    async function init() {
        document.body.classList.toggle('noanim', !state.anim);
        I18n.applyDom();
        const [cfg, topo] = await Promise.all([fetchJSON('markets.json'), d3.json(TOPO_URL)]);
        localizeCfg(cfg);
        state.cfg = cfg;
        state.maps = cfg.items.filter((i) => i.type === 'map').sort((a, b) => a.w - b.w);
        state.topics = cfg.topics || [];
        state.landmarks = cfg.landmarks || [];
        cfg.items.forEach((i) => (state.bySym[i.s] = i));
        // 同國其他指數（type "sub"，of 指向主指數）併成一組，主指數排第一個
        state.maps.forEach((m) => (m.group = [m, ...cfg.items.filter((i) => i.type === 'sub' && i.of === m.s)]));
        // 手機全球檢視的合併版：上證的旗幟連同恒生的指數一起列出
        state.maps.forEach(
            (m) => (m.group10 = m.merge10 && state.bySym[m.merge10] ? [...m.group, ...state.bySym[m.merge10].group] : null),
        );
        state.maps.forEach((m) => (state.byId[pad3(m.id)] = m));
        state.countries = topojson.feature(topo, topo.objects.countries).features;
        await Promise.all([loadQuotes(), loadTwTop(), loadTops(), loadEcon(), loadFng()]);

        // 預設從「全球」開始；開啟 autoRegionOn() 時改選「現在正在開盤」的區域（都休市就選最快開盤的），之後由使用者自己切換
        state.activeRegion = autoRegionOn() ? pickAutoRegion() : 'all';
        // 網址加上 #fx、#geo、#asia… 可以直接開在指定的篩選
        const hash = location.hash.slice(1);
        if (TOPICS[hash] || ['all', 'asia', 'americas', 'europe', 'mea'].includes(hash)) state.activeRegion = hash;

        buildSvg();
        buildRail();
        buildChips();
        layoutGeometry();
        updateChips();
        applyRegion(false);
        renderHud();
        scheduleLayout();
        initDisasters();
        initDice();
        initGeoScenes();
        $('#loading').classList.add('gone');
        // 載入完成後才顯示手機版設定按鈕（避免在載入動畫下方露出）
        $('#btnSet').style.display = 'flex';
        startWalk();

        $('#sheet').addEventListener('click', onSheetClick);
        $('#btnSet').addEventListener('click', openSettings);
        // Esc：關掉詳情卡
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                $('#sheet').hidden = true;
                clearHighlight();
            }
        });

        let rt = 0;
        if (window.ResizeObserver) {
            new ResizeObserver(() => {
                clearTimeout(rt);
                rt = setTimeout(() => {
                    const st = $('#stage');
                    if (st.clientWidth === W && st.clientHeight === H) return;
                    layoutGeometry();
                    applyRegion(false);
                    scheduleLayout();
                }, 120);
            }).observe($('#stage'));
        }

        // 手機版：篩選列緊貼在概況卡下面，概況卡實際多高就留多高（見 style.css 的 --hud-h）
        if (window.ResizeObserver) {
            let hudH = 0;
            new ResizeObserver(() => {
                const hh = Math.ceil($('#hud').getBoundingClientRect().height);
                if (!hh || hh === hudH) return;
                hudH = hh;
                document.documentElement.style.setProperty('--hud-h', `${hh}px`);
                layoutGeometry();
                applyRegion(false);
                scheduleLayout();
            }).observe($('#hud'), { box: 'border-box' });
        }

        setInterval(async () => {
            const old = state.quotes;
            await Promise.all([loadQuotes(), loadTwTop(), loadTops(), loadEcon(), loadFng()]);
            animateQuotes(old);
            tick();
        }, 60000);
        setInterval(tick, 30000);
        // 多指數旗幟每 4 秒換下一個指數（只在有輪播的旗幟時才重排）
        setInterval(() => {
            if (document.hidden) return;
            state.rot++;
            if (!gBub.select('.dots:not([style*="none"])').empty()) scheduleLayout();
        }, 4000);
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden) {
                const old = state.quotes;
                await Promise.all([loadQuotes(), loadTwTop(), loadTops(), loadEcon(), loadFng()]);
                animateQuotes(old);
                tick();
            }
        });
    }

    init().catch((e) => {
        console.error(e);
        const l = $('#loading');
        if (l)
            l.innerHTML =
                '<div class="spin">😵</div><p>' +
                (window.I18n ? I18n.t('地圖載入失敗，請檢查網路後重新整理') : '地圖載入失敗，請檢查網路後重新整理') +
                '</p>';
    });
})();
