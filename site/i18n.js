/* 多語系（i18n）
 *
 * 程式與 markets.json 裡的文字都以「繁體中文原文」當 key：I18n.t('商品') → 目前語言的翻譯。
 * - 繁體中文（zh-TW）不需要字典，原文就是顯示的文字。
 * - 其他語言的字典放在 i18n/<語言代碼>.js（I18n.add(...)），格式是 { "中文原文": "譯文" }。
 * - 字典裡沒有的字串會直接顯示中文原文，不會空白（所以翻譯可以一點一點補）。
 * - 含變數的字串用 {名稱} 當占位符：I18n.t('{n} 個市場開盤中', { n: 3 })，譯文裡也要有同名的 {n}。
 *
 * 語言怎麼決定（優先順序）：
 *   1. 網址 ?lang=ja（只對這次開啟有效）
 *   2. 使用者在「設定」裡選過的語言（存在 localStorage，'auto' 表示跟隨瀏覽器）
 *   3. 瀏覽器語言（navigator.languages，依序比對）
 *   4. 都比不到就用 English
 * 時間一律用「看的人所在的時區」顯示（瀏覽器的時區），只有格式（日期順序、星期名稱）跟著語言走。
 *
 * 這支檔案必須在其它 js 之前載入：它會用 document.write 同步載入字典，
 * 這樣後面的 js 在最上層就能直接呼叫 I18n.t()。
 */
(function () {
    'use strict';
    var LANGS = [
        { code: 'zh-TW', name: '繁體中文', intl: 'zh-TW' },
        { code: 'en', name: 'English', intl: 'en-US' },
        { code: 'ja', name: '日本語', intl: 'ja-JP' },
        { code: 'ko', name: '한국어', intl: 'ko-KR' },
        { code: 'zh-CN', name: '简体中文', intl: 'zh-CN' },
    ];
    var KEY = 'stockv.lang';
    var byCode = {};
    LANGS.forEach(function (l) {
        byCode[l.code.toLowerCase()] = l.code;
    });

    function saved() {
        try {
            return localStorage.getItem(KEY);
        } catch (e) {
            return null;
        }
    }
    // 瀏覽器語言標籤 → 支援的語言代碼（認不得回傳 null）
    function fromTag(tag) {
        var s = String(tag || '').toLowerCase().replace('_', '-');
        if (byCode[s]) return byCode[s];
        if (/^zh/.test(s)) return /(^zh-(tw|hk|mo)|hant)/.test(s) ? 'zh-TW' : 'zh-CN';
        if (/^ja/.test(s)) return 'ja';
        if (/^ko/.test(s)) return 'ko';
        if (/^en/.test(s)) return 'en';
        return null;
    }
    function fromBrowser() {
        var list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]) || [];
        for (var i = 0; i < list.length; i++) {
            var c = fromTag(list[i]);
            if (c) return c;
        }
        return null;
    }
    function detect() {
        var q = null;
        try {
            q = new URLSearchParams(location.search).get('lang');
        } catch (e) {}
        var c = q && fromTag(q);
        if (c) return { lang: c, source: 'url' };
        var s = saved();
        c = s && s !== 'auto' && fromTag(s);
        if (c) return { lang: c, source: 'saved' };
        c = fromBrowser();
        if (c) return { lang: c, source: 'browser' };
        return { lang: 'en', source: 'default' };
    }

    var d = detect();
    var lang = d.lang;
    var info = LANGS.filter(function (l) {
        return l.code === lang;
    })[0];
    var dict = {};
    var missing = {};
    var HAN = /[\u4e00-\u9fff]/;

    function t(key, params) {
        if (key == null) return '';
        var has = Object.prototype.hasOwnProperty.call(dict, key);
        var s = has ? dict[key] : key;
        if (!has && lang !== 'zh-TW' && HAN.test(key)) missing[key] = 1; // 字典沒有這個 key（譯文跟原文一樣的不算）
        if (params) s = String(s).replace(/\{(\w+)\}/g, function (m, k) {
            return params[k] != null ? params[k] : m;
        });
        return s;
    }

    var WEEK_ZH = '日一二三四五六';
    var I18n = {
        LANGS: LANGS,
        lang: lang,
        source: d.source, // 'url' | 'saved' | 'browser' | 'default'
        intl: info.intl, // 給 Intl.* 用的 locale
        t: t,
        add: function (code, obj) {
            if (code === lang) for (var k in obj) dict[k] = obj[k];
        },
        // 使用者的選擇：'auto' 或語言代碼
        pref: function () {
            var s = saved();
            return s && s !== 'auto' && fromTag(s) ? fromTag(s) : 'auto';
        },
        setPref: function (p) {
            try {
                localStorage.setItem(KEY, p === 'auto' ? 'auto' : p);
            } catch (e) {}
        },
        // 瀏覽器偵測到的語言（設定面板顯示「自動」是哪一種用）
        browserLang: function () {
            return fromBrowser() || 'en';
        },
        // 字典裡沒有的中文字串（開發時用：在 console 執行 I18n.missingKeys()）
        missingKeys: function () {
            return Object.keys(missing);
        },
        // 星期的簡短名稱：中文用「三」，其他語言用 Intl 的短名稱（Wed / 水 / 수）
        weekday: function (dow) {
            if (lang === 'zh-TW' || lang === 'zh-CN') return WEEK_ZH.charAt(dow);
            try {
                return new Intl.DateTimeFormat(info.intl, { weekday: 'short' }).format(new Date(2024, 0, 7 + dow));
            } catch (e) {
                return WEEK_ZH.charAt(dow);
            }
        },
        // 靜態 HTML：data-i18n（文字）、data-i18n-aria（aria-label）、data-i18n-title（title）
        applyDom: function () {
            var root = document.documentElement;
            root.lang = lang;
            document.title = t('股市村');
            [['data-i18n', null], ['data-i18n-aria', 'aria-label'], ['data-i18n-title', 'title']].forEach(function (p) {
                var nodes = document.querySelectorAll('[' + p[0] + ']');
                for (var i = 0; i < nodes.length; i++) {
                    var v = t(nodes[i].getAttribute(p[0]));
                    if (p[1]) nodes[i].setAttribute(p[1], v);
                    else nodes[i].textContent = v;
                }
            });
        },
    };
    window.I18n = I18n;

    // 同步載入字典（繁體中文不用）；載入失敗（沒有這個檔）就當作沒有字典，全部顯示中文原文
    if (lang !== 'zh-TW') document.write('<script src="i18n/' + lang + '.js"><\/script>');
})();
