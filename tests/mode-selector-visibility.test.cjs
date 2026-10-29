// Run with: node tests/mode-selector-visibility.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('        function updateGuidanceModeSelectorVisibility() {');
const end = html.indexOf('        function updatePathModeUI()', start);
assert.ok(start >= 0 && end > start, 'mode-selector visibility function missing');

const classes = new Set();
const attributes = {};
const selector = {
    classList: {
        toggle(name, enabled) {
            if (enabled) classes.add(name);
            else classes.delete(name);
        },
    },
    setAttribute(name, value) { attributes[name] = value; },
};
const context = vm.createContext({
    document: { querySelector: value => value === '.hmi-mode-group' ? selector : null },
    currentControlMode: 'record',
    plannerState: 1,
    pathFollowerState: 0,
});
vm.runInContext(html.slice(start, end), context);

function expectHidden(hidden) {
    context.updateGuidanceModeSelectorVisibility();
    assert.equal(classes.has('is-guidance-active'), hidden);
    assert.equal(attributes['aria-hidden'], String(hidden));
}

expectHidden(false);
context.plannerState = 2; // Recording A-B points is not yet guidance.
expectHidden(false);
context.plannerState = 3; // A-B guidance active.
expectHidden(true);
context.plannerState = 1; // Cancel/stop returns the selector.
expectHidden(false);

context.currentControlMode = 'path';
context.pathFollowerState = 3; // Path ready, waiting for Start.
expectHidden(false);
context.pathFollowerState = 4; // Path follower running.
expectHidden(true);
context.pathFollowerState = 0; // Stopped.
expectHidden(false);

console.log('PASS: mode selector is hidden only during active A-B/path guidance');
