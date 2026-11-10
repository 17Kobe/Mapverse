const fs = require('fs');
const topojson = require('topojson-client');
const d3geo = require('d3-geo');
const topo = JSON.parse(fs.readFileSync('countries-50m.json', 'utf8'));
const countries = topojson.feature(topo, topo.objects.countries).features;

function isLand(lon, lat) {
    const pt = [lon, lat];
    for (const f of countries) {
        if (d3geo.geoContains(f, pt)) return f.properties ? f.properties.name : true;
    }
    return false;
}

const pts = {
    'turtle-ship current (129.3,34.6)': [129.3, 34.6],
    'turtle-ship candidate A (128.0,34.0)': [128.0, 34.0],
    'turtle-ship candidate B (127.9,33.8)': [127.9, 33.8],
    'turtle-ship candidate C (128.6,33.6)': [128.6, 33.6],
    'turtle-ship candidate D (129.0,34.0)': [129.0, 34.0],
};
for (const [name, [lon, lat]] of Object.entries(pts)) {
    console.log(name, '->', isLand(lon, lat) || 'WATER (OK)');
}
