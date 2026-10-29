// Run with: node tests/xte-display.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('        function formatCrossTrackError(offset, pathYaw, vehicleYaw) {');
const end = html.indexOf('        function updateCrossTrackDisplay()', start);
assert.ok(start >= 0 && end > start, 'XTE formatter missing');

const context = vm.createContext({ Math });
vm.runInContext(html.slice(start, end), context);

assert.deepEqual(
    {...context.formatCrossTrackError(1.01, 0, 0)},
    {direction: 'left', magnitude: '1.01 m', text: '<<< 1.01 m'},
);
assert.deepEqual(
    {...context.formatCrossTrackError(-1.01, 0, 0)},
    {direction: 'right', magnitude: '1.01 m', text: '1.01 m >>>'},
);
assert.deepEqual(
    {...context.formatCrossTrackError(1.01, 0, Math.PI)},
    {direction: 'right', magnitude: '1.01 m', text: '1.01 m >>>'},
    'direction must reverse when travelling back along the same reference',
);
assert.deepEqual(
    {...context.formatCrossTrackError(0.004, 0, 0)},
    {direction: 'center', magnitude: '0.00 m', text: '0.00 m'},
);

for (const value of [
    context.formatCrossTrackError(1.01, 0, 0),
    context.formatCrossTrackError(-1.01, 0, 0),
]) {
    assert.ok(!/[+−-]/.test(value.magnitude), 'magnitude contains a sign');
}

console.log('PASS: XTE uses unsigned magnitude and separate direction arrows');
