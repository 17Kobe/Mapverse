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
        { src: 'critters/osaka-castle.svg', lon: 134.807, lat: 34.2, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true },  // 大阪城
        { src: 'critters/forbidden-city.svg', lon: 116.4, lat: 39.9, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 紫禁城
        { src: 'critters/terracotta-army.svg', lon: 109.3, lat: 34.4, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 兵馬俑
        { src: 'critters/zhangjiajie.svg', lon: 110.5, lat: 29.1, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true },   // 張家界
        { src: 'critters/gyeongbokgung.svg', lon: 126.98, lat: 37.58, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 景福宮
        { src: 'critters/n-seoul-tower.svg', lon: 127.542, lat: 36.51, mode: 'still', face: 'F', s: 1.0, deco: true, landmark: true }, // 首爾塔（南山）：原座標和景福宮幾乎重疊（僅差 0.03 度），地標碰撞收起邏輯會讓它幾乎永遠被景福宮蓋住而不顯示，拉開距離修正
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
        { src: 'critters/komodo-dragon.svg', lon: 119.49, lat: -8.55, mode: 'wander', face: 'R', gait: 'heavy', s: 1.0, deco: true, landmark: true }, // 科莫多巨蜥（素材朝右畫）
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
        { src: 'animals/tiger.png', lon: 79.0, lat: 21.0, mode: 'wander', s: 1.0, deco: true, maxDeg: 2 },  // 印度：老虎在森林漫步
        { src: 'critters/wombat.svg', lon: 146.0, lat: -42.0, mode: 'still', face: 'F', s: 0.9, deco: true },         // 澳洲：袋熊鑽洞
        { src: 'critters/jaguar.svg', lon: -65.0, lat: -6.0, mode: 'wander', s: 1.0, deco: true, maxDeg: 2 }, // 南美：美洲豹穿越雨林（素材已重畫為朝左）
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
        { src: 'critters/fennec-fox.svg', lon: 20.0, lat: 18.0, mode: 'wander', s: 0.8, deco: true, maxDeg: 2 }, // 撒哈拉：耳廓狐
        { src: 'critters/grizzly-salmon.svg', lon: -155.8, lat: 58.6, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 阿拉斯加：灰熊抓鮭魚
        { src: 'critters/amazon-rainforest.svg', lon: -71.0, lat: -8.0, mode: 'still', face: 'F', s: 1.8, deco: true, landmark: true }, // 亞馬遜雨林
        // ── 第六批補充（股市重鎮地標 + 傳說生物 + 動物） ──────────────────
        { src: 'critters/merlion.svg', lon: 103.854, lat: 1.287, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 新加坡：魚尾獅
        { src: 'critters/petronas-towers.svg', lon: 101.712, lat: 3.158, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 馬來西亞：雙峰塔
        { src: 'critters/bran-castle.svg', lon: 25.367, lat: 45.514, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 羅馬尼亞：布蘭城堡
        { src: 'critters/djenne-mosque.svg', lon: -4.555, lat: 13.906, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 馬利：傑內大清真寺
        { src: 'critters/persepolis.svg', lon: 52.891, lat: 29.935, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 伊朗：波斯波利斯
        { src: 'critters/bigfoot.svg', lon: -122.5, lat: 48.0, mode: 'wander', s: 1.1, deco: true, maxDeg: 2 }, // 北美森林：大腳怪
        { src: 'critters/mermaid.svg', lon: 5.0, lat: 61.0, mode: 'bob', face: 'F', s: 1.0, sea: true, deco: true }, // 北歐海域：美人魚
        { src: 'critters/chupacabra.svg', lon: -66.5, lat: 18.2, mode: 'wander', s: 0.95, deco: true, maxDeg: 2 }, // 波多黎各：卓柏卡布拉
        { src: 'critters/kiwi-bird.svg', lon: 173.5, lat: -41.2, mode: 'wander', gait: 'waddle', s: 0.85, deco: true, maxDeg: 2 }, // 紐西蘭：奇異鳥
        { src: 'critters/platypus.svg', lon: 151.0, lat: -33.5, mode: 'bob', face: 'F', s: 0.85, sea: true, deco: true }, // 澳洲：鴨嘴獸
        { src: 'critters/snow-leopard.svg', lon: 78.0, lat: 39.0, mode: 'wander', s: 1.0, deco: true, maxDeg: 2 }, // 中亞帕米爾高原：雪豹
        { src: 'critters/puffin.svg', lon: -14.0, lat: 65.5, mode: 'bob', face: 'F', s: 0.8, sea: true, deco: true }, // 冰島：海鸚
        // ── 第七批補充（用戶列的 12 個世界地標） ──────────────────────
        { src: 'critters/grand-palace.svg', lon: 100.49, lat: 13.75, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 泰國：大皇宮與玉佛寺
        { src: 'critters/wat-arun.svg', lon: 101.586, lat: 14.593, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 泰國：鄭王廟（黎明寺）
        { src: 'critters/brandenburg-gate.svg', lon: 14.1, lat: 53.256, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 德國：布蘭登堡門
        { src: 'critters/tower-bridge.svg', lon: -0.0754, lat: 51.5055, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 英國：倫敦塔橋
        { src: 'critters/venice-canal.svg', lon: 12.3155, lat: 45.4408, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 義大利：威尼斯水都
        { src: 'critters/empire-state.svg', lon: -73.9857, lat: 40.7484, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 美國：帝國大廈
        { src: 'critters/hollywood-sign.svg', lon: -118.3215, lat: 34.1341, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 美國：好萊塢標誌
        { src: 'critters/alishan-train.svg', lon: 120.8025, lat: 23.5088, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 台灣：阿里山森林小火車
        { src: 'critters/itsukushima-torii.svg', lon: 132.32, lat: 34.296, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 日本：嚴島神社大鳥居
        { src: 'critters/burj-al-arab.svg', lon: 53.884, lat: 24.35, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 阿聯：帆船飯店
        { src: 'critters/hobbiton.svg', lon: 175.6818, lat: -37.8722, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 紐西蘭：哈比村
        { src: 'critters/dead-sea.svg', lon: 36.366, lat: 32, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 死海
        // ── 第八批補充（用戶列的世界地標） ──────────────────────────
        { src: 'critters/matterhorn.svg', lon: 7.6586, lat: 45.9763, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 瑞士/義大利：馬特洪峰
        { src: 'critters/kilimanjaro.svg', lon: 37.3556, lat: -3.0674, mode: 'still', face: 'F', s: 1.3, deco: true, landmark: true }, // 坦尚尼亞：吉力馬札羅山
        { src: 'critters/monument-valley.svg', lon: -110.0046, lat: 36.9983, mode: 'still', face: 'F', s: 1.2, deco: true, landmark: true }, // 美國：紀念碑谷
        { src: 'critters/iceberg.svg', lon: -30.0, lat: -65.0, mode: 'bob', s: 1.1, sea: true, deco: true, landmark: true }, // 南大洋：漂浮冰山
        { src: 'critters/table-mountain.svg', lon: 18.4232, lat: -33.9628, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 南非：桌山
        { src: 'critters/darvaza-crater.svg', lon: 58.4396, lat: 40.2522, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 土庫曼：地獄之門
        // ── 第九批補充（太魯閣、雷門燈籠、雙層巴士、凱旋門） ──────────
        { src: 'critters/taroko-gorge.svg', lon: 121.62, lat: 24.16, mode: 'still', face: 'F', s: 1.1, sea: true, deco: true, landmark: true }, // 台灣：太魯閣峽谷
        { src: 'critters/kaminarimon-lantern.svg', lon: 139.296, lat: 36.581, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 日本：淺草寺雷門燈籠
        { src: 'critters/double-decker-bus.svg', lon: -1.5, lat: 52.3, mode: 'wander', s: 1.0, deco: true, maxDeg: 2 }, // 英國：紅色雙層巴士
        { src: 'critters/arc-de-triomphe.svg', lon: 2.295, lat: 48.8738, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 法國：凱旋門
        // ── 第十批補充（剩下 9 個：黑熊、龜船、天壇、舞龍、海狸、騎警、熱氣球、啤酒節、嘟嘟車） ──
        { src: 'critters/formosan-black-bear.svg', lon: 121.0, lat: 23.7, mode: 'wander', s: 1.0, deco: true, maxDeg: 2 }, // 台灣：台灣黑熊
        { src: 'critters/turtle-ship.svg', lon: 129.3, lat: 34.6, mode: 'bob', s: 1.1, sea: true, deco: true, landmark: true }, // 南韓：李舜臣龜船（往東南移到釜山外海，離海岸線更遠，確實落在海上）
        { src: 'critters/temple-of-heaven.svg', lon: 116.9, lat: 39.5, mode: 'still', face: 'F', s: 1.1, deco: true, landmark: true }, // 中國：天壇：原座標 lon 117.2 跟萬里長城完全相同、又離紫禁城很近，同時被兩個地標夾殺幾乎永遠蓋住，拉開距離修正
        { src: 'critters/dragon-dance.svg', lon: 108.0, lat: 30.0, mode: 'still', face: 'F', s: 1.1, deco: true }, // 中國：舞龍
        { src: 'critters/beaver.svg', lon: -95.0, lat: 54.0, mode: 'bob', s: 1.0, sea: true, deco: true }, // 加拿大：海狸
        { src: 'critters/mountie.svg', lon: -106.0, lat: 50.45, mode: 'still', face: 'F', s: 1.0, deco: true }, // 加拿大：皇家騎警
        { src: 'critters/montgolfier-balloon.svg', lon: 2.5, lat: 47.0, mode: 'bob', s: 1.0, deco: true, landmark: true }, // 法國：蒙格菲熱氣球
        { src: 'critters/oktoberfest.svg', lon: 11.55, lat: 48.14, mode: 'still', face: 'F', s: 1.0, deco: true }, // 德國：慕尼黑啤酒節
        { src: 'critters/tuk-tuk.svg', lon: 77.0, lat: 20.5, mode: 'wander', s: 1.0, deco: true, maxDeg: 2 }, // 印度：嘟嘟車
        // ── 第十一批補充 ──────────────────────────────────────────────
        { src: 'critters/guilin-karst.svg', lon: 110.3, lat: 25.27, mode: 'bob', s: 1.1, sea: true, deco: true, landmark: true }, // 中國：桂林山水與竹筏
    ];
