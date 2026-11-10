const fs = require('fs');
let src = fs.readFileSync(__dirname + '/critters_block.js', 'utf8');
src = src.replace(/^\s*const CRITTERS = /, '').replace(/;\s*$/, '');
const arr = eval(src);
console.log('total entries:', arr.length);
const landmarks = arr.filter(d => d.landmark);
console.log('landmark entries:', landmarks.length);
fs.writeFileSync(__dirname + '/landmarks.json', JSON.stringify(landmarks, null, 1));
