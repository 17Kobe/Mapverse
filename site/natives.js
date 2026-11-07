/* 各國的原住民小人：該國主要指數上漲時歡呼跳舞、下跌時沮喪哭泣，平盤時散步、揮手、眨眼。
 *
 * 由 app.js 呼叫：
 *   Natives.FOLK        角色清單（每個角色一筆：market 是看哪個指數的漲跌，lon/lat 是位置，look 是外觀）
 *   Natives.markup(look, uid)  畫出一個角色的所有姿勢（SVG 字串，每個姿勢是一個 <g data-pose="…">）
 *   Natives.VIEWBOX     角色 SVG 的 viewBox
 *
 * 姿勢：idle / idleBlink（站著、眨眼）、wave1 / wave2（揮手）、cheerA / cheerB（歡呼，左右手交替）、
 *       sadA / sadB（沮喪、擦眼淚）。app.js 依漲跌挑姿勢輪流顯示，再加上跳躍 / 呼吸的位移。
 * 漲跌超過 2% 時，帶 class="big" 的元素（彩帶、閃電）才會顯示。
 *
 * 要推廣到其他國家：在 FOLK 加幾筆（market 填該國主指數代碼），外觀調 look 的顏色與頭飾就好。
 * 服飾請以該族群真實的傳統色彩與紋樣為靈感，保持友善、不要刻板化（不畫武器、不畫草裙）。
 */
(function () {
    const VIEWBOX = '0 -16 128 144';

    // 外觀範本：skin 膚色、top 上衣、trim 衣服上的菱形織紋兩色、pants 褲 / 裙、hair 頭髮、
    // gear 頭飾（feather 羽毛頭帶 / flower 花環 / band 織紋頭帶）、gearColors 頭飾顏色、
    // hairStyle（short 短髮 / long 長髮加辮子 / bob 娃娃頭）、skirt 是否穿裙、k 身高比例
    const LOOKS = {
        // 紅色菱形紋上衣 + 羽毛頭帶（泰雅、賽德克等族群的織紋常見紅 / 黑 / 白）
        red: {
            skin: ['#f3c397', '#d28f5c'],
            top: ['#d9483c', '#951f1b'],
            trim: ['#161616', '#fff6e0'],
            pants: ['#3b4060', '#252944'],
            hair: ['#2c2c36', '#0d0d13'],
            gear: 'feather',
            gearColors: ['#fff6e0', '#e24a3b', '#2f7fd1'],
            hairStyle: 'short',
            skirt: false,
            k: 1,
        },
        // 靛藍上衣 + 百合花環 + 長辮子（排灣族以百合花與華麗的織繡聞名）
        blue: {
            skin: ['#f0bb8e', '#cc8653'],
            top: ['#3a6cb8', '#1f3f7d'],
            trim: ['#ffd24d', '#fff6e0'],
            pants: ['#7a2f4b', '#511d33'],
            hair: ['#2a2430', '#0c0a10'],
            gear: 'flower',
            gearColors: ['#ffffff', '#ff9d2e', '#4caf50'],
            hairStyle: 'long',
            skirt: true,
            k: 0.96,
        },
        // 小朋友：綠色上衣 + 織紋頭帶
        green: {
            skin: ['#f5c79f', '#d7955f'],
            top: ['#3fa56b', '#216c43'],
            trim: ['#ffcf4a', '#e24a3b'],
            pants: ['#6a4a2f', '#442d1b'],
            hair: ['#302a2a', '#100c0c'],
            gear: 'band',
            gearColors: ['#e24a3b', '#ffcf4a', '#2f7fd1'],
            hairStyle: 'bob',
            skirt: false,
            k: 0.8,
        },
    };

    // 台灣：三位小人住在中央山脈東側，ox / oy 是相對於位置點的偏移（單位：小角色的基準大小）
    const FOLK = [
        { id: 'tw-1', market: '^TWII', lon: 121.3, lat: 23.4, ox: -0.95, oy: 0.1, s: 1.7, look: LOOKS.red, ph: 0 },
        { id: 'tw-2', market: '^TWII', lon: 121.3, lat: 23.4, ox: 0.15, oy: -0.1, s: 1.65, look: LOOKS.blue, ph: 1.7 },
        { id: 'tw-3', market: '^TWII', lon: 121.3, lat: 23.4, ox: 1.2, oy: 0.12, s: 1.4, look: LOOKS.green, ph: 3.1 },
    ];

    // ───────── 全球十大國家的代表人物 ─────────
    // 每個國家一組三人（大人男、大人女、小孩），和台灣一樣看該國主要指數的漲跌做動作。
    // 服飾取自各國日常仍看得到的傳統與節慶穿著（和服 / 韓服 / 紗麗 / 旗袍 / 巴伐利亞傳統服…），
    // 保持友善、不要刻板化（不畫武器）。外觀欄位除了上面的 skin / top / trim / pants / hair / gear / hairStyle / skirt / k，還有：
    //   pattern     上衣花紋：diamond（預設，織紋）/ plain（素色）/ plaid（格紋）/ stripe（橫條紋，stripeColors 可指定多色）/ dots（小花點）
    //   outfit      連身長衣裙：kimono 和服 / qipao 旗袍 / hanbok 韓服（短上衣 + 高腰長裙）/ sari 紗麗
    //   obi         和服腰帶 [主色, 線色]；bow 韓服胸前的結（色）；collar 領子顏色（旗袍 / 中山裝為立領，和服 / 韓服為交領）
    //   buttons     鈕扣顏色；frog 盤扣顏色；scarf 圍巾顏色；tie 領帶顏色
    //   shorts      短褲（socks 長襪顏色、braces 吊帶顏色）；apron 圍裙（兩色）；lace 胸前綁帶；sleeve 袖子另用的顏色
    //   emblem      帽子上的圖案：star / maple
    const SK = {
        fair: ['#f8d9bd', '#d9a074'],
        light: ['#f5cda4', '#d79b66'],
        tan: ['#e3ae80', '#b97e4c'],
        brown: ['#c58e60', '#98623a'],
        deep: ['#a9714a', '#7d4b2a'],
    };
    const HAIR = {
        black: ['#2c2c36', '#0d0d13'],
        dark: ['#3a2a22', '#150d09'],
        brown: ['#6a4228', '#33200f'],
        blond: ['#e7c36a', '#b58a2c'],
        red: ['#b5532c', '#6e2a10'],
    };
    const PANTS = {
        navy: ['#34406e', '#222a4d'],
        black: ['#33343f', '#17181f'],
        jeans: ['#3e6bb5', '#274a86'],
        white: ['#f4f1e6', '#d2cdb8'],
        slate: ['#4a5262', '#2d3340'],
    };
    const mk = (o) =>
        Object.assign(
            {
                hairStyle: 'short',
                skirt: false,
                k: 1,
                gear: 'none',
                gearColors: ['#fff', '#fff', '#fff'],
                trim: ['#ffffff', '#ffffff'],
            },
            o,
        );
    const GREEN = '#2f9e6b';
    const COUNTRY_LOOKS = {
        // 美國：牛仔帽 + 牛仔襯衫 / 星星頭帶 + 條紋上衣 / 棒球帽小朋友
        us: [
            mk({
                skin: SK.light,
                top: ['#4f7fc4', '#2f5390'],
                pattern: 'plain',
                buttons: '#e9eefc',
                pants: PANTS.jeans,
                hair: HAIR.brown,
                gear: 'cowboy',
                gearColors: ['#b07a40', '#6b4421', '#8a2f2a'],
            }),
            mk({
                skin: SK.deep,
                top: ['#ffffff', '#dfe3f0'],
                trim: ['#e24a3b', '#e24a3b'],
                pattern: 'stripe',
                pants: PANTS.jeans,
                hair: HAIR.black,
                hairStyle: 'long',
                gear: 'starband',
                gearColors: ['#1f3f7d', '#ffffff', '#e24a3b'],
                k: 0.96,
            }),
            mk({
                skin: SK.tan,
                top: ['#e24a3b', '#a52a22'],
                pattern: 'plain',
                pants: PANTS.navy,
                hair: HAIR.dark,
                gear: 'cap',
                gearColors: ['#1f3f7d', '#e24a3b', '#ffffff'],
                emblem: 'star',
                k: 0.8,
            }),
        ],
        // 中國：中山裝 / 旗袍 + 髮簪 / 熊貓帽小朋友
        cn: [
            mk({
                skin: SK.light,
                top: ['#2f5fa8', '#1b3a73'],
                pattern: 'plain',
                frog: '#ffd24d',
                collar: '#ffd24d',
                pants: PANTS.black,
                hair: HAIR.black,
            }),
            mk({
                skin: SK.light,
                top: ['#d9344a', '#9a1c33'],
                trim: ['#ffd24d', '#ffe9a0'],
                pattern: 'plain',
                outfit: 'qipao',
                pants: ['#d9344a', '#9a1c33'],
                frog: '#ffd24d',
                collar: '#ffd24d',
                hair: HAIR.black,
                hairStyle: 'bun',
                gear: 'pin',
                gearColors: ['#ffd24d', '#ff6f61', '#ffffff'],
                k: 0.96,
            }),
            mk({
                skin: SK.light,
                top: ['#f2b63c', '#c88a12'],
                trim: ['#e24a3b', '#e24a3b'],
                pattern: 'plain',
                pants: PANTS.navy,
                hair: HAIR.black,
                gear: 'panda',
                gearColors: ['#ffffff', '#1d1d24', '#ffffff'],
                k: 0.8,
            }),
        ],
        // 日本：法被 + 頭巾 / 和服 + 髮簪 / 甚平小朋友
        jp: [
            mk({
                skin: SK.light,
                top: ['#1f3a7a', '#12224d'],
                pattern: 'diamond',
                pants: ['#2c3347', '#1a1f2e'],
                hair: HAIR.black,
                gear: 'hachimaki',
                gearColors: ['#ffffff', '#e24a3b', '#ffffff'],
            }),
            mk({
                skin: SK.light,
                top: ['#f08fb0', '#c9577f'],
                trim: ['#ffd9e6', '#ffffff'],
                pattern: 'dots',
                outfit: 'kimono',
                pants: ['#f08fb0', '#c9577f'],
                obi: ['#e8b83a', '#a8780f'],
                collar: '#ffffff',
                hair: HAIR.black,
                hairStyle: 'bun',
                gear: 'pin',
                gearColors: ['#ffd24d', '#ffffff', '#ff6f91'],
                k: 0.96,
            }),
            mk({
                skin: SK.light,
                top: ['#2d9c93', '#1b625d'],
                pattern: 'plain',
                shorts: true,
                pants: ['#2d9c93', '#1b625d'],
                hair: HAIR.black,
                hairStyle: 'bob',
                k: 0.8,
            }),
        ],
        // 韓國：韓服 + 갓（黑色寬簷帽）/ 韓服 + 髮簪 / 韓服 + 小帽子的小朋友
        kr: [
            mk({
                skin: SK.light,
                top: ['#f4f1e6', '#d5cfb9'],
                pattern: 'plain',
                vcollar: '#2f5fb0',
                bow: '#2f5fb0',
                pants: ['#4a78c0', '#2e5192'],
                hair: HAIR.black,
                gear: 'gat',
                gearColors: ['#15151c', '#4a4a58', '#c8283c'],
            }),
            mk({
                skin: SK.light,
                top: ['#ffb7c5', '#e57b92'],
                trim: ['#ffe3ea', '#ffffff'],
                pattern: 'plain',
                outfit: 'hanbok',
                pants: ['#3f6fd0', '#264a96'],
                vcollar: '#ffffff',
                bow: '#c8283c',
                hair: HAIR.black,
                hairStyle: 'bun',
                gear: 'pin',
                gearColors: ['#ffd24d', '#e24a3b', '#ffffff'],
                k: 0.96,
            }),
            mk({
                skin: SK.light,
                top: ['#ffd24d', '#e0a81a'],
                pattern: 'stripe',
                stripeColors: ['#e24a3b', GREEN, '#2f7fd1'],
                pants: ['#e24a8f', '#b02a68'],
                hair: HAIR.black,
                bow: '#c8283c',
                gear: 'jobawi',
                gearColors: ['#1b1b22', '#ffd24d', '#e24a3b'],
                k: 0.8,
            }),
        ],
        // 印度：頭巾 + 庫爾塔 / 紗麗 + 額頭紅點 / 甘地帽小朋友
        in: [
            mk({
                skin: SK.brown,
                top: ['#f6efe0', '#d8cfb4'],
                pattern: 'plain',
                collar: '#e8a23a',
                buttons: '#c9831a',
                pants: PANTS.white,
                hair: HAIR.black,
                gear: 'turban',
                gearColors: ['#f2a33a', '#c9751a', '#d9344a'],
            }),
            mk({
                skin: SK.brown,
                top: ['#2fa293', '#1b6b60'],
                trim: ['#ffd24d', '#fff1b0'],
                pattern: 'plain',
                outfit: 'sari',
                pants: ['#dd3c63', '#a01f45'],
                hair: HAIR.black,
                hairStyle: 'long',
                gear: 'bindi',
                gearColors: ['#d9344a', '#ffd24d', '#ffffff'],
                k: 0.96,
            }),
            mk({
                skin: SK.brown,
                top: ['#f28a2e', '#c4601a'],
                pattern: 'plain',
                buttons: '#ffffff',
                pants: PANTS.white,
                hair: HAIR.black,
                gear: 'gandhicap',
                gearColors: ['#ffffff', '#e4dfcf', '#ffffff'],
                k: 0.8,
            }),
        ],
        // 英國：圓頂禮帽 + 領帶 / 紅外套 + 蘇格蘭裙 + 小帽 / 戴報童帽的學生
        uk: [
            mk({
                skin: SK.fair,
                top: ['#4b5568', '#2d3446'],
                pattern: 'plain',
                buttons: '#d0d4e0',
                tie: '#d9344a',
                pants: ['#2d3446', '#1b2030'],
                hair: HAIR.brown,
                gear: 'bowler',
                gearColors: ['#23232b', '#3a3a46', '#d9344a'],
            }),
            mk({
                skin: SK.fair,
                top: ['#d9342f', '#951914'],
                trim: ['#d9342f', '#ffffff'],
                pattern: 'plain',
                buttons: '#161616',
                skirt: true,
                pants: ['#2c4b8f', '#1b2f63'],
                hair: HAIR.brown,
                hairStyle: 'bob',
                gear: 'fascinator',
                gearColors: ['#1f3f7d', '#ffffff', '#d9344a'],
                k: 0.96,
            }),
            mk({
                skin: SK.fair,
                top: ['#c0392b', '#8c2418'],
                pattern: 'plain',
                shorts: true,
                socks: '#cfd3de',
                pants: PANTS.slate,
                hair: HAIR.blond,
                gear: 'cap',
                gearColors: ['#4a5260', '#2d323d', '#c0392b'],
                k: 0.8,
            }),
        ],
        // 德國：巴伐利亞皮褲 + 提洛爾帽 / 迪恩德爾裙 + 花環 / 小朋友
        de: [
            mk({
                skin: SK.fair,
                top: ['#ffffff', '#dde5f5'],
                trim: ['#3a6cb8', '#3a6cb8'],
                pattern: 'plaid',
                shorts: true,
                socks: '#f4f1e6',
                braces: '#2f8f5a',
                pants: ['#7a5a3a', '#4e3621'],
                hair: HAIR.brown,
                gear: 'tyrol',
                gearColors: ['#4f6b4a', '#2c3f2a', '#f4efe0'],
            }),
            mk({
                skin: SK.fair,
                top: ['#c0345a', '#85193a'],
                trim: ['#ffd24d', '#fff6e0'],
                pattern: 'plain',
                lace: true,
                sleeve: ['#ffffff', '#e4e4ee'],
                skirt: true,
                pants: ['#c0345a', '#85193a'],
                apron: ['#fff6e0', '#ecdcb6'],
                hair: HAIR.blond,
                hairStyle: 'long',
                gear: 'flower',
                gearColors: ['#ffffff', '#ffd24d', '#4f8a4f'],
                k: 0.96,
            }),
            mk({
                skin: SK.fair,
                top: ['#d9342f', '#951914'],
                trim: ['#ffffff', '#ffffff'],
                pattern: 'plaid',
                shorts: true,
                socks: '#e8e8ee',
                braces: '#f2c14e',
                pants: ['#3a3a44', '#1f1f27'],
                hair: HAIR.blond,
                gear: 'tyrol',
                gearColors: ['#7a6a4a', '#4a3d28', '#d9342f'],
                k: 0.8,
            }),
        ],
        // 法國：貝雷帽 + 條紋衫 + 圍巾 / 藍貝雷帽 + 紅圍巾 / 小廚師
        fr: [
            mk({
                skin: SK.fair,
                top: ['#ffffff', '#dde3f0'],
                pattern: 'stripe',
                stripeColors: ['#1f3f7d'],
                scarf: '#d9344a',
                pants: ['#2c3347', '#1a1f2e'],
                hair: HAIR.dark,
                gear: 'beret',
                gearColors: ['#23232b', '#3a3a46', '#23232b'],
            }),
            mk({
                skin: SK.light,
                top: ['#f4f4f8', '#d3d7e6'],
                trim: ['#d9344a', '#ffffff'],
                pattern: 'plain',
                scarf: '#d9344a',
                skirt: true,
                pants: ['#2f5fb0', '#1c3a7d'],
                hair: HAIR.brown,
                hairStyle: 'bob',
                gear: 'beret',
                gearColors: ['#d9344a', '#9a1c2e', '#d9344a'],
                k: 0.96,
            }),
            mk({
                skin: SK.fair,
                top: ['#ffffff', '#dfe3ee'],
                pattern: 'plain',
                buttons: '#8a93a8',
                scarf: '#2f5fb0',
                pants: PANTS.slate,
                hair: HAIR.brown,
                gear: 'chef',
                gearColors: ['#ffffff', '#dfe3ee', '#ffffff'],
                k: 0.8,
            }),
        ],
        // 加拿大：格紋伐木工衫 + 毛帽 / 楓葉毛帽 + 北歐毛衣 / 連帽毛領外套小朋友
        ca: [
            mk({
                skin: SK.fair,
                top: ['#d9342f', '#951914'],
                trim: ['#161616', '#161616'],
                pattern: 'plaid',
                pants: ['#3b4a6a', '#252f46'],
                hair: HAIR.brown,
                gear: 'toque',
                gearColors: ['#2f5f4a', '#1c3d2e', '#ffffff'],
            }),
            mk({
                skin: SK.tan,
                top: ['#f4f4f8', '#d0d4e2'],
                trim: ['#d9342f', '#d9342f'],
                pattern: 'diamond',
                scarf: '#d9342f',
                pants: PANTS.jeans,
                hair: HAIR.dark,
                hairStyle: 'long',
                gear: 'toque',
                gearColors: ['#d9342f', '#951914', '#ffffff'],
                emblem: 'maple',
                k: 0.96,
            }),
            mk({
                skin: SK.light,
                top: ['#3a82d6', '#1f559c'],
                pattern: 'plain',
                buttons: '#ffffff',
                pants: PANTS.navy,
                hair: HAIR.brown,
                gear: 'hood',
                gearColors: ['#3a82d6', '#ffffff', '#ffffff'],
                k: 0.8,
            }),
        ],
    };
    // 每個國家一組：[國家代碼, 主指數, 經度, 緯度]（位置只是起點，app.js 會找附近在該國陸地上的空位）。
    // 三個人的相對位置、大小和台灣一樣
    const COUNTRY_FOLK = [
        ['us', '^GSPC', -92, 37.5],
        ['cn', '000001.SS', 104, 30.5],
        ['jp', '^N225', 138, 36],
        ['kr', '^KS11', 127.8, 36.5],
        ['in', '^BSESN', 78.5, 22.5],
        ['uk', '^FTSE', -2, 53],
        ['de', '^GDAXI', 10.8, 49.5],
        ['fr', '^FCHI', 2, 46.5],
        ['ca', '^GSPTSE', -105, 55],
    ];
    const SLOTS = [
        { ox: -0.95, oy: 0.1, s: 1.7, ph: 0 },
        { ox: 0.15, oy: -0.1, s: 1.65, ph: 1.7 },
        { ox: 1.2, oy: 0.12, s: 1.4, ph: 3.1 },
    ];
    for (const [cc, market, lon, lat] of COUNTRY_FOLK)
        COUNTRY_LOOKS[cc].forEach((look, i) => FOLK.push({ id: `${cc}-${i + 1}`, market, lon, lat, ...SLOTS[i], minK: 1, look }));

    // 各姿勢：aL / aR = 左右手臂 [手肘, 手], front 表示手臂畫在頭的前面（擦眼淚）；
    // head = [旋轉角度, 往下偏移]；eyes：open / happy / sad / closed；mouth：smile / open / frown / wail；
    // tears：眼淚數量；fx：cheer（星星）/ rain（烏雲雨）
    const POSES = {
        idle: {
            aL: [
                [41, 82],
                [42, 97],
            ],
            aR: [
                [87, 82],
                [86, 97],
            ],
            head: [0, 0],
            eyes: 'open',
            mouth: 'smile',
        },
        idleBlink: {
            aL: [
                [41, 82],
                [42, 97],
            ],
            aR: [
                [87, 82],
                [86, 97],
            ],
            head: [0, 0],
            eyes: 'closed',
            mouth: 'smile',
        },
        wave1: {
            aL: [
                [41, 82],
                [42, 97],
            ],
            aR: [
                [99, 76],
                [106, 56],
            ],
            head: [-3, 0],
            eyes: 'open',
            mouth: 'smile',
        },
        wave2: {
            aL: [
                [41, 82],
                [42, 97],
            ],
            aR: [
                [97, 72],
                [96, 52],
            ],
            head: [-3, 0],
            eyes: 'happy',
            mouth: 'smile',
        },
        cheerA: {
            aL: [
                [32, 62],
                [26, 38],
            ],
            aR: [
                [96, 62],
                [102, 38],
            ],
            head: [0, -1],
            eyes: 'happy',
            mouth: 'open',
            fx: 'cheerA',
        },
        cheerB: {
            aL: [
                [28, 72],
                [13, 82],
            ],
            aR: [
                [90, 54],
                [88, 28],
            ],
            head: [-5, -1],
            eyes: 'happy',
            mouth: 'open',
            fx: 'cheerB',
        },
        sadA: {
            aL: [
                [43, 84],
                [54, 99],
            ],
            aR: [
                [85, 84],
                [74, 99],
            ],
            head: [6, 3],
            eyes: 'sad',
            mouth: 'frown',
            tears: 1,
            fx: 'rainA',
        },
        sadB: {
            aL: [
                [43, 84],
                [54, 99],
            ],
            aR: [
                [94, 76],
                [78, 55],
            ],
            head: [-4, 3],
            eyes: 'sad',
            mouth: 'wail',
            tears: 2,
            front: 'aR',
            fx: 'rainB',
        },
    };

    const STAR = 'M0 -6 L1.8 -1.8 L6 0 L1.8 1.8 L0 6 L-1.8 1.8 L-6 0 L-1.8 -1.8Z';

    function fx(kind) {
        if (kind === 'cheerA' || kind === 'cheerB') {
            const pts =
                kind === 'cheerA'
                    ? [
                          [18, 20, 1],
                          [110, 14, 0.8],
                          [8, 56, 0.7],
                          [118, 50, 1],
                      ]
                    : [
                          [26, 8, 0.9],
                          [102, 24, 1],
                          [12, 38, 1],
                          [116, 70, 0.7],
                      ];
            let s = pts
                .map(
                    ([x, y, k]) =>
                        `<path d="${STAR}" transform="translate(${x} ${y}) scale(${k})" fill="#ffe27a" stroke="#f5a623" stroke-width=".7"/>`,
                )
                .join('');
            // 漲超過 2%：多撒一把彩帶
            const conf =
                kind === 'cheerA'
                    ? [
                          [30, 6, '#ff5a5a', 20],
                          [52, -6, '#4aa3ff', -30],
                          [78, 0, '#ffd24d', 40],
                          [98, -8, '#5ee08a', -20],
                          [64, 6, '#ff8de0', 10],
                      ]
                    : [
                          [40, 2, '#ffd24d', -20],
                          [60, -8, '#ff5a5a', 30],
                          [86, 4, '#4aa3ff', -40],
                          [106, -4, '#5ee08a', 15],
                          [20, -2, '#ff8de0', 25],
                      ];
            s += `<g class="big">${conf.map(([x, y, c, r]) => `<rect x="${x}" y="${y}" width="6" height="3.2" rx="1" fill="${c}" transform="rotate(${r} ${x + 3} ${y + 1.6})"/>`).join('')}</g>`;
            return s;
        }
        if (kind === 'rainA' || kind === 'rainB') {
            const dy = kind === 'rainA' ? 0 : 6;
            let s =
                '<g transform="translate(64 -4)"><ellipse cx="-12" cy="2" rx="13" ry="8" fill="#8793a8"/><ellipse cx="6" cy="-2" rx="15" ry="9.5" fill="#9aa6bb"/><ellipse cx="17" cy="4" rx="11" ry="7" fill="#8793a8"/><rect x="-24" y="4" width="52" height="7" rx="3.5" fill="#8793a8"/></g>';
            for (const x of [48, 60, 72, 84])
                s += `<line x1="${x}" y1="${10 + dy + (x % 3) * 2}" x2="${x - 2}" y2="${16 + dy + (x % 3) * 2}" stroke="#7cc7ff" stroke-width="2" stroke-linecap="round"/>`;
            // 跌超過 2%：閃電
            s +=
                '<path class="big" d="M70 8 L61 22 L67 22 L62 34 L76 17 L69 17 Z" fill="#ffd84d" stroke="#e0a100" stroke-width=".8" stroke-linejoin="round"/>';
            return s;
        }
        return '';
    }

    // 上半身輪廓：std 一般 / slim 旗袍和服（腰身窄）/ short 韓服短上衣
    const TORSOS = {
        std: 'M46 64 Q64 58 82 64 L86 100 Q64 106 42 100 Z',
        slim: 'M47 64 Q64 58 81 64 L82 92 L46 92 Z',
        short: 'M46 64 Q64 58 82 64 L83 84 Q64 88 45 84 Z',
    };
    const torsoKey = (look) =>
        look.outfit === 'hanbok' ? 'short' : look.outfit === 'qipao' || look.outfit === 'kimono' ? 'slim' : 'std';
    const MAPLE =
        'M0 -7 L1.6 -3.6 L4.2 -4.6 L3.4 -1.4 L6.6 -2.2 L4.4 0.8 L5.6 1.6 L1 3 L0.6 5 L-0.6 5 L-1 3 L-5.6 1.6 L-4.4 0.8 L-6.6 -2.2 L-3.4 -1.4 L-4.2 -4.6 L-1.6 -3.6Z';

    // ───────── 頭飾：每個回傳一段 SVG（頭圓心 64,40、半徑 24.5；頭頂約 y=15）─────────
    const GEARS = {
        none: () => '',
        // 台灣：紅色織紋頭帶 + 帝王雉羽毛（泰雅、賽德克）
        feather: (look, [c1, c2]) =>
            `<path d="M40 27 Q64 19 88 27 L88.5 33 Q64 25 39.5 33 Z" fill="${look.top[0]}"/>` +
            [0, 1, 2, 3, 4, 5, 6]
                .map((i) => `<path d="M${46 + i * 6} 28.5 l2.6 2.2 l-2.6 2.2 l-2.6 -2.2 Z" fill="${look.trim[i % 2]}"/>`)
                .join('') +
            // 一根帝王雉（台灣特有的黑長尾雉）的黑白橫紋長尾羽，插在頭帶側邊，底部繫一小撮紅色絨球
            `<g transform="translate(86 27) rotate(22)"><path d="M0 0 Q-7 -16 -1.5 -37 Q6.5 -18 0 0 Z" fill="#1d2a46" stroke="#0e1628" stroke-width=".6"/>` +
            [-9, -16.5, -24, -31]
                .map(
                    (y) =>
                        `<path d="M-4.8 ${y} Q0 ${y - 2.4} 4.4 ${y}" stroke="${c1}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,
                )
                .join('') +
            `<path d="M0 -1 Q-1.5 -18 -0.6 -34" stroke="#0e1628" stroke-width=".7" fill="none"/><circle cx="0" cy="1.5" r="3.4" fill="${c2}"/></g>`,
        // 台灣：百合花環（排灣）；德國：雪絨花
        flower: (look, [c1, c2, c3]) => {
            const flower = (x, y, r) =>
                `<g transform="translate(${x} ${y}) scale(${r})"><circle cx="0" cy="-3.4" r="3" fill="${c1}"/><circle cx="3.4" cy="0" r="3" fill="${c1}"/><circle cx="0" cy="3.4" r="3" fill="${c1}"/><circle cx="-3.4" cy="0" r="3" fill="${c1}"/><circle r="2.1" fill="${c2}"/></g>`;
            return (
                `<path d="M41 28 Q64 15 87 28" fill="none" stroke="${c3}" stroke-width="3.4" stroke-linecap="round"/>` +
                [
                    [45, 27, 0.8],
                    [54, 21, 0.9],
                    [64, 17.5, 1.05],
                    [74, 21, 0.9],
                    [83, 27, 0.8],
                ]
                    .map(([x, y, r]) => flower(x, y, r))
                    .join('') +
                `<ellipse cx="38.5" cy="30" rx="4" ry="2.3" fill="${c3}" transform="rotate(-35 38.5 30)"/><ellipse cx="89.5" cy="30" rx="4" ry="2.3" fill="${c3}" transform="rotate(35 89.5 30)"/>`
            );
        },
        // 織紋頭帶（小朋友）
        band: (look, [c1, c2, c3]) =>
            `<path d="M40 25 Q64 18 88 25 L88.5 31 Q64 24 39.5 31 Z" fill="${c1}"/>` +
            [0, 1, 2, 3, 4, 5, 6]
                .map((i) => `<path d="M${46 + i * 6} 26.5 l2.4 2 l-2.4 2 l-2.4 -2 Z" fill="${i % 2 ? c2 : '#fff6e0'}"/>`)
                .join('') +
            `<path d="M86 28 Q92 36 89 46" stroke="${c3}" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="89" cy="47" r="2.8" fill="${c2}"/>`,
        // 美國：牛仔帽
        cowboy: (look, [c1, c2, c3]) =>
            `<path d="M26 22 Q44 34 64 31 Q84 34 102 22 Q95 15 64 16 Q33 15 26 22Z" fill="${c1}" stroke="${c2}" stroke-width="1.2" stroke-linejoin="round"/>` +
            `<path d="M44 19 Q41 -4 64 -5 Q87 -4 84 19 Q64 24 44 19Z" fill="${c1}" stroke="${c2}" stroke-width="1" stroke-linejoin="round"/>` +
            `<path d="M44.4 13.5 Q64 20 83.6 13.5 L84 19 Q64 24 44 19Z" fill="${c3}"/>` +
            `<path d="M52 -2 Q64 4 76 -2" stroke="${c2}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
        // 美國 / 英國：棒球帽、報童帽
        cap: (look, [c1, c2, c3]) => {
            let s =
                `<path d="M41 29 Q39 6 64 5 Q89 6 87 29 Q64 22 41 29Z" fill="${c1}"/>` +
                `<path d="M64 5.5 L64 24" stroke="#000" stroke-opacity=".18" stroke-width="1"/><circle cx="64" cy="6" r="2.4" fill="${c2}"/>` +
                `<path d="M37 29.5 Q64 42 91 29.5 Q89 24 64 25 Q39 24 37 29.5Z" fill="${c2}"/>`;
            if (look.emblem === 'star') s += `<path d="${STAR}" transform="translate(64 15) scale(1.15)" fill="${c3}"/>`;
            return s;
        },
        // 美國：星星頭帶
        starband: (look, [c1, c2, c3]) =>
            `<path d="M40 27 Q64 19 88 27 L88.5 32 Q64 24 39.5 32 Z" fill="${c1}"/>` +
            [
                [47, 28.6],
                [55.5, 25.6],
                [64, 24.6],
                [72.5, 25.6],
                [81, 28.6],
            ]
                .map(([x, y]) => `<path d="${STAR}" transform="translate(${x} ${y}) scale(.5)" fill="${c2}"/>`)
                .join('') +
            `<path d="M86 29 Q93 36 91 46" stroke="${c3}" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="91" cy="47.5" r="2.6" fill="${c3}"/>`,
        // 日本：白頭巾（鉢卷）+ 紅日
        hachimaki: (look, [c1, c2]) =>
            `<path d="M40 25 Q64 18 88 25 L88.5 31 Q64 24 39.5 31 Z" fill="${c1}"/><circle cx="64" cy="24.5" r="3.2" fill="${c2}"/>` +
            `<path d="M87 27 L99 32 L97 36 L87 32Z" fill="${c1}"/><path d="M88 29 L97 41 L93.5 42.5 L86.5 31Z" fill="${c1}"/>`,
        // 日本 / 韓國 / 中國：髮簪（插在髮髻上，c1 簪身、c2 c3 小花）
        pin: (look, [c1, c2, c3]) =>
            `<path d="M62 8 L100 -10" stroke="${c1}" stroke-width="2.2" stroke-linecap="round"/><circle cx="100.5" cy="-10.5" r="2.6" fill="${c2}"/>` +
            [
                [72, 12],
                [78, 15],
                [74, 18.5],
            ]
                .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="3.1" fill="${i === 1 ? c3 : c2}"/>`)
                .join('') +
            `<circle cx="75" cy="15.2" r="1.3" fill="${c1}"/>`,
        // 韓國：갓（黑色寬簷帽）+ 繫在下巴的帽纓
        gat: (look, [c1, c2, c3]) =>
            `<ellipse cx="64" cy="19" rx="33" ry="8.5" fill="${c1}"/>` +
            `<path d="M50 18 Q49 -2 52 -7 Q64 -11 76 -7 Q79 -2 78 18Z" fill="${c1}"/><path d="M55 -3 Q64 -6 73 -3" stroke="${c2}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
            `<path d="M33 22 Q36 44 48 58" stroke="${c3}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M95 22 Q92 44 80 58" stroke="${c3}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
        // 韓國：小朋友的黑色小帽（金邊 + 紅色流蘇）
        jobawi: (look, [c1, c2, c3]) =>
            `<path d="M42 28 Q42 8 64 6 Q86 8 86 28 Q64 22 42 28Z" fill="${c1}"/><path d="M43 22.5 Q64 17 85 22.5 L85.5 26.5 Q64 21.5 42.5 26.5Z" fill="${c2}"/>` +
            `<ellipse cx="64" cy="6.5" rx="6" ry="2.4" fill="${c2}"/>` +
            `<path d="M43 26 Q38 34 41 46" stroke="${c3}" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="41" cy="47" r="2.4" fill="${c3}"/>` +
            `<path d="M85 26 Q90 34 87 46" stroke="${c3}" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="87" cy="47" r="2.4" fill="${c3}"/>`,
        // 印度：頭巾
        turban: (look, [c1, c2, c3]) =>
            `<path d="M38 30 Q36 4 64 3 Q92 4 90 30 Q64 21 38 30Z" fill="${c1}"/><ellipse cx="64" cy="3.5" rx="10" ry="3.4" fill="${c1}"/>` +
            ['M40 25 Q64 13 88 25', 'M39.5 19 Q64 7 88.5 19', 'M41 13 Q64 3 87 13']
                .map((d) => `<path d="${d}" stroke="${c2}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".85"/>`)
                .join('') +
            `<path d="M44 29 Q60 14 84 6" stroke="${c2}" stroke-width="1.6" fill="none" opacity=".7"/>` +
            `<circle cx="64" cy="20.5" r="3.4" fill="${c3}" stroke="#ffd24d" stroke-width="1.2"/><circle cx="63" cy="19.5" r="1" fill="#fff"/>`,
        // 印度：額頭上的紅點
        bindi: (look, [c1]) => `<circle cx="64" cy="29.5" r="2.4" fill="${c1}"/>`,
        // 印度：白色甘地帽
        gandhicap: (look, [c1, c2]) =>
            `<path d="M41 28 Q42 12 64 13 Q86 12 87 28 Q64 22 41 28Z" fill="${c1}"/><path d="M41.5 24 Q64 18 86.5 24 L87 28 Q64 22 41 28Z" fill="${c2}"/>` +
            `<path d="M50 14 L50 24 M64 13 L64 22 M78 14 L78 24" stroke="${c2}" stroke-width="1" opacity=".8"/>`,
        // 英國：圓頂禮帽
        bowler: (look, [c1, c2, c3]) =>
            `<ellipse cx="64" cy="22" rx="30" ry="6.5" fill="${c1}" stroke="${c2}" stroke-width="1"/>` +
            `<path d="M45 21 Q43 -1 64 -2 Q85 -1 83 21Z" fill="${c1}"/><path d="M52 5 Q55 0 61 -0.5" stroke="#fff" stroke-opacity=".28" stroke-width="2" fill="none" stroke-linecap="round"/>` +
            `<path d="M44.4 15 Q64 21 83.6 15 L83.2 21 Q64 26 44.8 21Z" fill="${c3}"/>`,
        // 英國：側戴的小帽 + 羽毛
        fascinator: (look, [c1, c2, c3]) =>
            `<path d="M40 30 Q64 19 88 30" stroke="${c1}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
            `<path d="M83 13 Q98 2 105 -10" stroke="${c3}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M86 11 Q101 4 107 -4" stroke="${c2}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
            `<g transform="rotate(-18 80 15)"><ellipse cx="80" cy="15" rx="12" ry="6.2" fill="${c1}"/><path d="M72 12 Q80 7 89 12" stroke="${c2}" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="84" cy="14" r="2.2" fill="${c3}"/></g>`,
        // 德國：提洛爾帽 + 羽毛
        tyrol: (look, [c1, c2, c3]) =>
            `<ellipse cx="64" cy="22" rx="32" ry="7" fill="${c1}"/>` +
            `<path d="M45 21 L51 -2 Q64 -7 77 -2 L83 21Z" fill="${c1}"/><path d="M51 -1 Q64 4 77 -1" stroke="${c2}" stroke-width="1.5" fill="none"/>` +
            `<path d="M45.5 15 Q64 21 82.5 15 L83 21 Q64 26 45 21Z" fill="${c2}"/>` +
            `<g transform="translate(77 14) rotate(16)"><path d="M0 0 Q-4 -14 0 -26 Q5 -14 0 0Z" fill="${c3}" stroke="#8a6a3a" stroke-width=".7"/><path d="M0 0 L0 -23" stroke="#8a6a3a" stroke-width=".8"/></g>`,
        // 法國：貝雷帽
        beret: (look, [c1, c2]) =>
            `<g transform="rotate(-9 64 14)"><ellipse cx="66" cy="13" rx="29" ry="12" fill="${c1}"/><ellipse cx="64" cy="8" rx="20" ry="4.5" fill="#fff" opacity=".13"/><rect x="63" y="-4.5" width="5" height="7.5" rx="2.5" fill="${c2}"/></g>` +
            `<path d="M40 27 Q64 21 88 27 L88 31 Q64 25 40 31Z" fill="${c2}"/>`,
        // 法國：廚師帽
        chef: (look, [c1, c2]) =>
            `<g fill="${c1}" stroke="${c2}" stroke-width="1"><circle cx="49" cy="7" r="11"/><circle cx="79" cy="7" r="11"/><circle cx="64" cy="-3" r="12.5"/>` +
            `<path d="M45 8 L83 8 L84 24 Q64 30 44 24Z"/></g><path d="M44 21 Q64 27 84 21 L84 25.5 Q64 31.5 44 25.5Z" fill="${c2}"/>`,
        // 加拿大：針織毛帽（emblem: maple 楓葉）
        toque: (look, [c1, c2, c3]) => {
            let s =
                `<path d="M40 28 Q38 5 64 4 Q90 5 88 28 Q64 20 40 28Z" fill="${c1}"/>` +
                `<path d="M39.5 22 Q64 14 88.5 22 L88.2 29.5 Q64 22 39.8 29.5Z" fill="${c2}"/>` +
                [46, 53, 60, 67, 74, 81]
                    .map((x) => `<path d="M${x} 20 L${x} 27" stroke="#000" stroke-opacity=".15" stroke-width="1.4"/>`)
                    .join('') +
                `<circle cx="64" cy="1" r="6" fill="${c3}"/>`;
            if (look.emblem === 'maple') s += `<path d="${MAPLE}" transform="translate(64 13) scale(.95)" fill="#fff"/>`;
            return s;
        },
        // 加拿大：連帽外套的帽子 + 毛領
        hood: (look, [c1, c2]) =>
            `<circle cx="64" cy="40" r="28.5" fill="none" stroke="${c1}" stroke-width="9"/>` +
            `<circle cx="64" cy="40" r="25.2" fill="none" stroke="${c2}" stroke-width="5.2" stroke-dasharray="3.2 1.4" stroke-linecap="round"/>`,
        // 中國：熊貓帽
        panda: (look, [c1, c2]) =>
            `<circle cx="43" cy="14" r="9" fill="${c2}"/><circle cx="85" cy="14" r="9" fill="${c2}"/><circle cx="43" cy="14" r="4" fill="#cfa7a7"/><circle cx="85" cy="14" r="4" fill="#cfa7a7"/>` +
            `<path d="M38 36 Q34 4 64 3 Q94 4 90 36 Q64 24 38 36Z" fill="${c1}"/>` +
            `<ellipse cx="51.5" cy="24" rx="5.2" ry="7" fill="${c2}" transform="rotate(22 51.5 24)"/><ellipse cx="76.5" cy="24" rx="5.2" ry="7" fill="${c2}" transform="rotate(-22 76.5 24)"/>` +
            `<circle cx="52" cy="23" r="1.6" fill="#fff"/><circle cx="76" cy="23" r="1.6" fill="#fff"/><ellipse cx="64" cy="28.5" rx="4.2" ry="2.6" fill="${c2}"/>`,
    };

    // 小花點（和服）：在 x0..x1 × y0..y1 的格點上放小花
    const dotsIn = (x0, x1, y0, y1, color) => {
        let s = '';
        for (let r = 0, y = y0; y <= y1; y += 9, r++)
            for (let x = x0 + (r % 2) * 5; x <= x1; x += 10)
                s += `<g transform="translate(${x} ${y})" fill="${color}"><circle cx="0" cy="-1.7" r="1.3"/><circle cx="1.7" cy="0" r="1.3"/><circle cx="0" cy="1.7" r="1.3"/><circle cx="-1.7" cy="0" r="1.3"/></g>`;
        return s;
    };

    // 一個姿勢的完整圖形
    function pose(look, p, id) {
        const P = POSES[p];
        const g = (n) => `${id}-${n}`;
        const U = (n) => `url(#${g(n)})`;
        const [tr, ty] = P.head;
        const sleeve = look.sleeve ? U('sleeve') : U('top');
        const arm = (a, side) => {
            const sx = side === 'L' ? 47 : 81;
            return (
                `<path d="M${sx} 67 L${a[0][0]} ${a[0][1]}" stroke="${sleeve}" stroke-width="12" stroke-linecap="round" fill="none"/>` +
                `<path d="M${a[0][0]} ${a[0][1]} L${a[1][0]} ${a[1][1]}" stroke="${look.skin[1]}" stroke-width="9" stroke-linecap="round" fill="none"/>` +
                `<circle cx="${a[1][0]}" cy="${a[1][1]}" r="5.4" fill="${U('skin')}"/>`
            );
        };

        // 腿 / 裙（lower 在鞋子下面；長衣裙 lower2 要蓋住鞋面，所以畫在上衣後面）
        let lower;
        let lower2 = '';
        let over = ''; // 長衣裙上面的配件（腰帶、胸前的結、紗麗的披肩…），要蓋在裙子上面
        const oc = look.outfit;
        if (oc) {
            lower = '';
            if (oc === 'kimono') {
                lower2 =
                    `<path d="M45 90 L83 90 L88 117 Q64 124 40 117 Z" fill="${U('pants')}"/>` +
                    dotsIn(48, 80, 98, 114, look.trim[1]) +
                    `<path d="M40 117 Q64 124 88 117" fill="none" stroke="${look.trim[0]}" stroke-width="2.6"/>`;
                over =
                    `<rect x="43" y="83" width="42" height="15" rx="3" fill="${look.obi[0]}"/><path d="M43 90.5 L85 90.5" stroke="${look.obi[1]}" stroke-width="2"/>` +
                    `<path d="M64 85.5 l4 5 l-4 5 l-4 -5Z" fill="${look.obi[1]}"/>`;
            } else if (oc === 'qipao') {
                lower2 =
                    `<path d="M46 90 L82 90 L85 117 Q64 123 43 117 Z" fill="${U('pants')}"/>` +
                    `<path d="M43 117 Q64 123 85 117" fill="none" stroke="${look.trim[0]}" stroke-width="2.6"/><path d="M83 99 L85 117" stroke="${look.trim[0]}" stroke-width="1.6"/>` +
                    [
                        [56, 101],
                        [72, 106],
                        [60, 111],
                    ]
                        .map(([x, y]) => `<path d="M${x} ${y} q4 -3 8 0 q-4 3 -8 0Z" fill="${look.trim[0]}" opacity=".85"/>`)
                        .join('');
            } else if (oc === 'hanbok') {
                lower2 =
                    `<path d="M46 81 Q64 77 82 81 L99 118 Q64 128 29 118 Z" fill="${U('pants')}"/>` +
                    [
                        [50, 86, 41, 121],
                        [57, 85, 52, 124],
                        [64, 84, 64, 125],
                        [71, 85, 76, 124],
                        [78, 86, 87, 121],
                    ]
                        .map(
                            ([x1, y1, x2, y2]) =>
                                `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#fff" stroke-opacity=".16" stroke-width="2"/>`,
                        )
                        .join('') +
                    `<path d="M46 79 Q64 75 82 79 L82.5 84 Q64 80 45.5 84Z" fill="#ffffff"/>`;
            } else if (oc === 'sari') {
                lower2 =
                    `<path d="M43 84 Q64 80 85 84 L91 118 Q64 125 37 118 Z" fill="${U('pants')}"/>` +
                    [
                        [50, 90, 45, 121],
                        [57, 89, 54, 123],
                        [64, 88, 64, 124],
                        [71, 89, 74, 123],
                        [78, 90, 83, 121],
                    ]
                        .map(
                            ([x1, y1, x2, y2]) =>
                                `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#fff" stroke-opacity=".2" stroke-width="1.6"/>`,
                        )
                        .join('') +
                    `<path d="M37.5 112.5 Q64 119.5 90.5 112.5 L91 118 Q64 125 37 118Z" fill="${look.trim[0]}"/><path d="M38 115 Q64 122 90 115" stroke="${look.trim[1]}" stroke-width="1" fill="none"/>`;
                // 披在肩上垂到腰間的紗麗尾巴（斜過胸前），兩側鑲金邊
                over = `<path d="M48 62 L60 60 L88 100 L74 104 Z" fill="${U('pants')}"/><path d="M48 62 L74 104" stroke="${look.trim[0]}" stroke-width="2.4"/><path d="M60 60 L88 100" stroke="${look.trim[0]}" stroke-width="2.4"/>`;
            }
        } else if (look.skirt) {
            lower =
                `<rect x="52" y="100" width="10" height="20" rx="5" fill="${look.skin[1]}"/><rect x="66" y="100" width="10" height="20" rx="5" fill="${look.skin[1]}"/>` +
                `<path d="M44 94 Q64 89 84 94 L91 113 Q64 119 37 113 Z" fill="${U('pants')}"/>` +
                `<path d="M38 108 Q64 114 90 108 L91 113 Q64 119 37 113 Z" fill="${look.trim[0]}"/>` +
                `<path d="M40 110.5 l4 2.5 4 -2.5 4 2.5 4 -2.5 4 2.5 4 -2.5 4 2.5 4 -2.5 4 2.5 4 -2.5 4 2.5" fill="none" stroke="${look.trim[1]}" stroke-width="1.3"/>`;
            // 圍裙（迪恩德爾）
            if (look.apron)
                lower += `<path d="M54 100 L74 100 L79 113 Q64 118 49 113Z" fill="${look.apron[0]}" stroke="${look.apron[1]}" stroke-width="1"/>`;
        } else if (look.shorts) {
            // 短褲 + 小腿（有長襪就畫襪子）
            lower =
                `<rect x="51" y="108" width="9" height="13" rx="4" fill="${look.skin[1]}"/><rect x="68" y="108" width="9" height="13" rx="4" fill="${look.skin[1]}"/>` +
                (look.socks
                    ? `<rect x="50.5" y="111" width="10" height="11" rx="3" fill="${look.socks}"/><rect x="67.5" y="111" width="10" height="11" rx="3" fill="${look.socks}"/>`
                    : '') +
                `<rect x="48" y="94" width="14" height="18" rx="6.5" fill="${U('pants')}"/><rect x="66" y="94" width="14" height="18" rx="6.5" fill="${U('pants')}"/>`;
        } else {
            lower = `<rect x="48" y="94" width="14" height="26" rx="6.5" fill="${U('pants')}"/><rect x="66" y="94" width="14" height="26" rx="6.5" fill="${U('pants')}"/>`;
        }
        const shoes =
            '<ellipse cx="55" cy="122" rx="9" ry="5" fill="#4a2f1f"/><ellipse cx="73" cy="122" rx="9" ry="5" fill="#4a2f1f"/>';

        // 上衣：花紋依 pattern 決定（預設是台灣的菱形織紋 + 腰帶）
        const pat = look.pattern || 'diamond';
        const tk = torsoKey(look);
        let deco = '';
        let belt = '';
        if (pat === 'diamond') {
            let diamonds = '';
            for (let r = 0; r < 2; r++)
                for (let i = 0; i < 6; i++) {
                    const cx = 50 + i * 5.7 + (r ? 2.85 : 0),
                        cy = 76 + r * 8;
                    if (cx > 80) continue;
                    diamonds += `<path d="M${cx} ${cy - 3.3} L${cx + 3} ${cy} L${cx} ${cy + 3.3} L${cx - 3} ${cy} Z" fill="${look.trim[(i + r) % 2]}"/>`;
                }
            deco =
                `<path d="M44.5 71 Q64 66 83.5 71 L84 72.5 Q64 67.5 44 72.5 Z" fill="${look.trim[1]}" opacity=".85"/>` + diamonds;
            if (!oc) belt = `<path d="M43 93 Q64 98 85 93 L85.5 99 Q64 104.5 42.5 99 Z" fill="${look.trim[0]}"/>`;
        } else if (pat === 'plaid') {
            deco =
                [68, 76, 84, 92]
                    .map((y) => `<rect x="40" y="${y}" width="50" height="3.6" fill="${look.trim[0]}" opacity=".55"/>`)
                    .join('') +
                [51, 59, 67, 75]
                    .map((x) => `<rect x="${x}" y="56" width="3.6" height="50" fill="${look.trim[0]}" opacity=".55"/>`)
                    .join('');
        } else if (pat === 'stripe') {
            const cols = look.stripeColors || [look.trim[0]];
            deco = [0, 1, 2, 3, 4, 5]
                .map((i) => `<rect x="40" y="${65 + i * 7}" width="50" height="3.6" fill="${cols[i % cols.length]}"/>`)
                .join('');
        } else if (pat === 'dots') {
            deco = dotsIn(52, 80, 70, 84, look.trim[1]);
        }
        // 鈕扣 / 盤扣 / 交領 / 胸前的結 / 領帶 / 圍巾尾巴 / 胸前綁帶 / 吊帶
        let trimmings = '';
        if (look.buttons)
            trimmings += [72, 80, 88, 96]
                .filter((y) => y < (tk === 'short' ? 82 : tk === 'slim' ? 92 : 99))
                .map((y) => `<circle cx="64" cy="${y}" r="1.7" fill="${look.buttons}"/>`)
                .join('');
        if (look.frog)
            trimmings += [73, 82, 91]
                .map(
                    (y) =>
                        `<path d="M55 ${y} Q59.5 ${y - 3.5} 64 ${y} Q68.5 ${y + 3.5} 73 ${y}" stroke="${look.frog}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="64" cy="${y}" r="2" fill="${look.frog}"/>`,
                )
                .join('');
        if (look.vcollar) {
            const e = tk === 'short' ? 79 : 85;
            trimmings += `<path d="M52 62 L64 ${e} L76 62 L72 60 L64 ${e - 12} L56 60Z" fill="${look.vcollar}"/><path d="M76 62 L64 ${e} L59 ${e - 7}" stroke="${look.vcollar}" stroke-opacity=".6" stroke-width="1.5" fill="none"/>`;
        }
        if (look.collar && oc === 'kimono')
            trimmings += `<path d="M52 62 L64 86 L76 62 L72 60 L64 74 L56 60Z" fill="${look.collar}"/>`;
        if (look.tie) trimmings += `<path d="M64 66 L68.5 72 L65.6 90 L64 92 L62.4 90 L59.5 72Z" fill="${look.tie}"/>`;
        if (look.scarf) trimmings += `<path d="M69 68 L79 84 L72.5 87 L65 72Z" fill="${look.scarf}"/>`;
        if (look.lace)
            trimmings += [70, 77, 84]
                .map(
                    (y) =>
                        `<path d="M58 ${y} L70 ${y + 5} M70 ${y} L58 ${y + 5}" stroke="${look.trim[0]}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
                )
                .join('');
        if (look.braces)
            trimmings += `<path d="M54 61 L54 96 M74 61 L74 96" stroke="${look.braces}" stroke-width="3.2" stroke-linecap="round"/><path d="M52 86 L76 86 L77 100 L51 100Z" fill="${U('pants')}"/><circle cx="54" cy="90" r="1.6" fill="${look.braces}"/><circle cx="74" cy="90" r="1.6" fill="${look.braces}"/>`;
        const torso =
            `<path d="${TORSOS[tk]}" fill="${U('top')}"/><g clip-path="url(#${g('tc-' + tk)})">${deco}</g>` + belt + trimmings;
        // 韓服胸前的結（要蓋在裙子上面）
        if (look.bow)
            over += `<path d="M64 76.5 Q53 68 51 77 Q56 83 64 76.5Z" fill="${look.bow}"/><path d="M64 76.5 Q75 68 77 77 Q72 83 64 76.5Z" fill="${look.bow}"/><path d="M63 77.5 L58.5 95 L62.6 95 L65 79Z" fill="${look.bow}"/><path d="M65 77.5 L69.5 95 L65.5 95 L63.4 79Z" fill="${look.bow}"/>`;

        // 頭
        const hairBack =
            look.hairStyle === 'long'
                ? `<path d="M40 34 Q34 62 44 72 L50 68 Q46 52 48 36 Z" fill="${U('hair')}"/><path d="M88 34 Q94 62 84 72 L78 68 Q82 52 80 36 Z" fill="${U('hair')}"/>` +
                  `<ellipse cx="42" cy="76" rx="4.5" ry="6" fill="${U('hair')}"/><ellipse cx="86" cy="76" rx="4.5" ry="6" fill="${U('hair')}"/>` +
                  `<rect x="38.5" y="70" width="7" height="3" rx="1.5" fill="${look.trim[0]}"/><rect x="82.5" y="70" width="7" height="3" rx="1.5" fill="${look.trim[0]}"/>`
                : look.hairStyle === 'bob'
                  ? `<path d="M39 32 Q35 52 42 58 L52 54 L76 54 L86 58 Q93 52 89 32 Z" fill="${U('hair')}"/>`
                  : look.hairStyle === 'bun'
                    ? `<circle cx="64" cy="9" r="10" fill="${U('hair')}"/><path d="M39 36 Q36 52 44 58 L50 52 Q46 44 48 36Z M89 36 Q92 52 84 58 L78 52 Q82 44 80 36Z" fill="${U('hair')}"/>`
                    : '';
        const hairTop =
            look.hairStyle === 'short'
                ? `<path d="M39 38 Q35 12 64 11 Q93 12 89 38 Q85 24 64 23 Q43 24 39 38 Z" fill="${U('hair')}"/>`
                : `<path d="M39 40 Q35 11 64 10 Q93 11 89 40 Q86 24 64 22 Q42 24 39 40 Z" fill="${U('hair')}"/>`;

        // 頭飾
        const gear = (GEARS[look.gear] || GEARS.band)(look, look.gearColors);
        // 立領（中山裝、旗袍）/ 圍巾繞在脖子上：跟著頭一起動
        let neckwear = '';
        if (look.collar && oc !== 'kimono')
            neckwear = `<path d="M55 59 Q64 66 73 59 L74.5 67 Q64 73 53.5 67Z" fill="${look.collar}"/>`;
        if (look.scarf) neckwear = `<path d="M52 61 Q64 70 76 61 L78 68 Q64 77 50 68Z" fill="${look.scarf}"/>`;

        // 眼睛 / 嘴
        const ink = '#2a1b14';
        const eyes = {
            open: [55, 73]
                .map(
                    (x) =>
                        `<ellipse cx="${x}" cy="42" rx="3.1" ry="4" fill="${ink}"/><circle cx="${x - 1}" cy="40.4" r="1.2" fill="#fff"/>`,
                )
                .join(''),
            closed: [55, 73]
                .map(
                    (x) =>
                        `<path d="M${x - 3.6} 42 Q${x} 45.2 ${x + 3.6} 42" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
                )
                .join(''),
            happy: [55, 73]
                .map(
                    (x) =>
                        `<path d="M${x - 3.8} 43.5 Q${x} 37.5 ${x + 3.8} 43.5" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
                )
                .join(''),
            sad:
                [55, 73]
                    .map(
                        (x) =>
                            `<ellipse cx="${x}" cy="43" rx="3" ry="3.8" fill="${ink}"/><circle cx="${x - 1}" cy="41.6" r="1.5" fill="#fff"/><circle cx="${x + 1.2}" cy="44.4" r=".9" fill="#bfe6ff"/>`,
                    )
                    .join('') +
                `<path d="M49.5 37.5 L59 33.5" stroke="${ink}" stroke-width="2" stroke-linecap="round"/><path d="M78.5 37.5 L69 33.5" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`,
        }[P.eyes];
        const mouth = {
            smile: `<path d="M58 51 Q64 57 70 51" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
            open: `<path d="M56 49.5 Q64 64 72 49.5 Z" fill="#7a2a2a"/><ellipse cx="64" cy="57" rx="3.6" ry="2.2" fill="#ff8a8a"/>`,
            frown: `<path d="M58 56.5 Q64 50.5 70 56.5" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
            wail: '<ellipse cx="64" cy="55.5" rx="4" ry="5" fill="#7a2a2a"/><ellipse cx="64" cy="58" rx="2.6" ry="1.8" fill="#ff8a8a"/>',
        }[P.mouth];
        let tears = '';
        if (P.tears >= 1)
            tears += '<path d="M52 47 Q55.4 52 52 55 Q48.6 52 52 47Z" fill="#8fd3ff" stroke="#5aa9dd" stroke-width=".6"/>';
        if (P.tears >= 2)
            tears += '<path d="M76 47 Q79.4 52 76 55 Q72.6 52 76 47Z" fill="#8fd3ff" stroke="#5aa9dd" stroke-width=".6"/>';

        const head =
            `<g transform="translate(64 ${44 + ty}) rotate(${tr}) translate(-64 -44)">` +
            hairBack +
            `<rect x="58" y="56" width="12" height="11" fill="${look.skin[1]}"/>` +
            neckwear +
            `<circle cx="40" cy="43" r="4.5" fill="${U('skin')}"/><circle cx="88" cy="43" r="4.5" fill="${U('skin')}"/>` +
            `<circle cx="64" cy="40" r="24.5" fill="${U('skin')}"/>` +
            hairTop +
            gear +
            '<ellipse cx="48.5" cy="49" rx="4.6" ry="3" fill="#ff7a7a" opacity=".32"/><ellipse cx="79.5" cy="49" rx="4.6" ry="3" fill="#ff7a7a" opacity=".32"/>' +
            eyes +
            mouth +
            tears +
            '</g>';

        const front = P.front ? arm(P[P.front], P.front === 'aL' ? 'L' : 'R') : '';
        const back = (P.front === 'aL' ? '' : arm(P.aL, 'L')) + (P.front === 'aR' ? '' : arm(P.aR, 'R'));
        return `<g data-pose="${p}" style="display:none">${fx(P.fx)}${lower}${shoes}${torso}${lower2}${over}${back}${head}${front}</g>`;
    }

    // 一個角色：定義漸層 + 所有姿勢。uid 要唯一（同一頁面有多個角色時 id 不能重複）
    function markup(look, uid) {
        const id = `nv-${uid}`;
        const lin = (n, c) =>
            `<linearGradient id="${id}-${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient>`;
        const defs =
            '<defs>' +
            lin('top', look.top) +
            lin('pants', look.pants) +
            lin('hair', look.hair) +
            (look.sleeve ? lin('sleeve', look.sleeve) : '') +
            Object.keys(TORSOS)
                .map((k) => `<clipPath id="${id}-tc-${k}"><path d="${TORSOS[k]}"/></clipPath>`)
                .join('') +
            `<radialGradient id="${id}-skin" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="${look.skin[0]}"/><stop offset="1" stop-color="${look.skin[1]}"/></radialGradient></defs>`;
        const k = look.k || 1;
        const body = Object.keys(POSES)
            .map((p) => pose(look, p, id))
            .join('');
        return `${defs}<g transform="translate(64 124) scale(${k}) translate(-64 -124)">${body}</g>`;
    }

    window.Natives = { FOLK, LOOKS, VIEWBOX, markup, POSES: Object.keys(POSES) };
})();
