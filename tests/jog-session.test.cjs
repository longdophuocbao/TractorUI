// Run with: node tests/jog-session.test.cjs
// Exercise the actual UI function with a minimal DOM and ROS publisher.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('        function setJogEnabled(enabled) {');
const end = html.indexOf("        document.addEventListener('input'", start);
assert.ok(start >= 0 && end > start, 'JOG UI function missing');
const messages = [];
const timers = new Map();
let nextTimer = 1;
const elements = {
    'jog-enable': { checked: false },
    'jog-slider': { disabled: true, value: 0, offsetParent: {} },
};
const context = vm.createContext({
    ros: { isConnected: true },
    ROSLIB: { Message: function (value) { Object.assign(this, value); } },
    document: { hidden: false, getElementById: id => elements[id] },
    jogPub: { publish: message => messages.push(message.data) },
    JOG_PUBLISH_MS: 100,
    jogTimer: null,
    slBusy: false,
    jogRate: () => -elements['jog-slider'].value / 100,
    resetJogSlider: () => { elements['jog-slider'].value = 0; },
    setInterval: callback => { const id = nextTimer++; timers.set(id, callback); return id; },
    clearInterval: id => timers.delete(id),
    slMessage: () => {},
    t: value => value,
});
vm.runInContext(html.slice(start, end), context);

// Closing/resetting an inactive panel must not publish the neutral JOG that
// caused the recorded automatic-steering takeovers.
context.setJogEnabled(false);
context.setJogEnabled(false);
assert.deepEqual(messages, []);

context.setJogEnabled(true);
elements['jog-slider'].value = -40;
[...timers.values()][0]();
assert.deepEqual(messages, [0.4]);
context.setJogEnabled(false);
assert.deepEqual(messages, [0.4, 0]);
assert.equal(timers.size, 0);
context.setJogEnabled(false);
assert.deepEqual(messages, [0.4, 0], 'repeated close emitted extra stop');

// Hiding an active panel stops its stream once, including a centered slider.
context.setJogEnabled(true);
context.document.hidden = true;
[...timers.values()][0]();
assert.equal(timers.size, 0);
assert.deepEqual(messages, [0.4, 0, 0]);
context.setJogEnabled(false);
assert.deepEqual(messages, [0.4, 0, 0]);
console.log('PASS: inactive UI emits no JOG, active session sends one stop');
