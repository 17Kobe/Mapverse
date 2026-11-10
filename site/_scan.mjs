import fs from 'fs';
const text = fs.readFileSync('app.js', 'utf-8');
const items = [];
const re = /\{[^{}]*?landmark:\s*true[^{}]*?\}/gs;
let m;
while ((m = re.exec(text))) {
    const block = m[0];
    const srcm = /src:\s*'critters\/([^']+)'/.exec(block);
    const lonm = /lon:\s*(-?[\d.]+)/.exec(block);
    const latm = /lat:\s*(-?[\d.]+)/.exec(block);
    if (srcm && lonm && latm) {
        items.push({ name: srcm[1], lon: parseFloat(lonm[1]), lat: parseFloat(latm[1]) });
    }
}
console.log('total landmark items:', items.length);
function dist(a, b) {
    const dlon = (a.lon - b.lon) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
    const dlat = a.lat - b.lat;
    return Math.hypot(dlon, dlat);
}
const pairs = [];
for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
        pairs.push({ d: dist(items[i], items[j]), a: items[i], b: items[j] });
    }
}
pairs.sort((x, y) => x.d - y.d);
for (const p of pairs.slice(0, 50)) {
    console.log(
        p.d.toFixed(3).padStart(6),
        p.a.name.padEnd(28),
        p.a.lon.toFixed(2).padStart(8) + ',' + p.a.lat.toFixed(2).padStart(7),
        '  ',
        p.b.name.padEnd(28),
        p.b.lon.toFixed(2).padStart(8) + ',' + p.b.lat.toFixed(2).padStart(7),
    );
}
