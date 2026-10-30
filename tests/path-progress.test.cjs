// Run with: node tests/path-progress.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('        function formatPathDuration(seconds) {');
const end = html.indexOf('        function updatePathModeUI()', start);
assert.ok(start >= 0 && end > start, 'path progress helpers missing');

const classes = new Set();
const values = { distance: '', time: '' };
const panel = {
    hidden: true,
    classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } },
    setAttribute() {},
};
const elements = {
    'path-progress-panel': panel,
    'path-remaining-distance': { set innerText(value) { values.distance = value; } },
    'path-total-time': { set innerText(value) { values.time = value; } },
};
const context = vm.createContext({
    document: { getElementById: id => elements[id] },
    currentControlMode: 'path',
    pathFollowerState: 4,
    pathRemainingDistanceM: 12.34,
    pathEstimatedTotalTimeS: 3661,
});
vm.runInContext(html.slice(start, end), context);

assert.equal(context.formatPathDuration(0), '00:00');
assert.equal(context.formatPathDuration(125), '02:05');
assert.equal(context.formatPathDuration(3661), '1:01:01');
context.updatePathProgressUI();
assert.ok(classes.has('is-visible'));
assert.equal(panel.hidden, false, 'progress must unhide while Path is running');
assert.equal(values.distance, '12.3 m');
assert.equal(values.time, '1:01:01');

context.pathFollowerState = 3;
context.updatePathProgressUI();
assert.ok(!classes.has('is-visible'), 'progress must hide when Path is not running');
assert.equal(panel.hidden, true, 'hidden attribute must be restored when Path stops');

console.log('PASS: Path distance and total-time display follows the active follower state');
