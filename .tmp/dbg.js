// 暫時的除錯工具：起一個靜態伺服器，用 Edge 載入頁面，印出新小角色的位置與被誰擋住
const http = require('http'),
    fs = require('fs'),
    path = require('path'),
    { execFileSync } = require('child_process');
const root = path.join(__dirname, '..', 'site');
const types = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
    const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
    fs.readFile(f, (e, d) => {
        if (e) return (r.statusCode = 404), r.end();
        r.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream');
        r.end(d);
    });
});
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
srv.listen(8771, '127.0.0.1', () => {
    const hashes = process.argv.slice(2);
    for (const h of hashes) {
        try {
            const out = execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--window-size=1920,913', '--virtual-time-budget=25000', '--dump-dom', 'http://127.0.0.1:8771/#' + h], { maxBuffer: 1 << 28, timeout: 90000, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
            for (const m of out.matchAll(/<g class="cr"([^>]*)>([\s\S]*?)<\/g>\s*<\/g>/g)) {
                const f = m[2].match(/href="assets\/(critters\/(?:panda|brown-bear|flying-fish|shark)[^"]*)"/);
                if (f) console.log(h, f[1], (m[1].match(/data-dbg="([^"]*)"/) || [])[1]);
            }
        } catch (e) {
            console.log(h, 'ERR', String(e).slice(0, 200));
        }
    }
    srv.close();
});
