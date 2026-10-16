// Run: node tests/subscriptions.test.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    new vm.Script(match[1]);
}
const start = html.indexOf('        // Own subscription lifetimes;');
const end = html.indexOf('        // --- 9.', start);
const context = vm.createContext({ assert });
vm.runInContext(`
const ros = {isConnected: true};
const document = {hidden: false, addEventListener() {}};
let isSettingsOpen = false, currentSettingsTab = 'user', isEngineerUnlocked = true;
let currentTopicSub = null, topicRefreshGeneration = 0;
const topicSelector = {value: '/debug', selectedIndex: 0, options: [{dataset:{type:'std_msgs/String'}}]};
const topicRawData = {};
const t = (key) => key;
let refreshCount = 0;
function refreshTopics() { refreshCount++; }
function updateChart() {}
function subscribeSteerLimitTopics() {
    subscribeToTopic('/steering_angle_actual', 'std_msgs/Float64', () => {}, 100, 'engineer');
}
const topics = [];
const ROSLIB = {Topic: class {
    constructor(options) { Object.assign(this, options); this.active = false; topics.push(this); }
    subscribe(callback) { this.active = true; this.callback = callback; }
    unsubscribe() { this.active = false; }
}};
`, context);
vm.runInContext(html.slice(start, end), context);
vm.runInContext(`
subscribeToTopic('/gps/fix', 'sensor_msgs/NavSatFix', () => {}, 100);
syncOptionalSubscriptions();
assert.equal(topicSubscriptions.size, 1, 'closed settings receive core only');
isSettingsOpen = true;
syncOptionalSubscriptions();
assert.equal(topicSubscriptions.size, 1, 'user tab receives core only');
currentSettingsTab = 'engineer';
syncOptionalSubscriptions();
assert.equal(topicSubscriptions.size, 4, 'engineer opens chart, calibration and debug');
assert.equal(currentTopicSub.throttle_rate, 200);
assert.equal(currentTopicSub.queue_length, 1);
assert.equal(currentTopicSub.reconnect_on_close, false);
const count = topics.length;
syncOptionalSubscriptions();
assert.equal(topics.length, count, 'repeated synchronization is idempotent');
const debug = currentTopicSub;
document.hidden = true;
syncOptionalSubscriptions();
assert.equal(topicSubscriptions.size, 1, 'background pauses optional subscriptions');
assert.equal(debug.active, false);
assert.equal(currentTopicSub, null);
document.hidden = false;
syncOptionalSubscriptions();
assert.equal(topicSubscriptions.size, 4);
isEngineerUnlocked = false;
syncOptionalSubscriptions();
assert.equal(topicSubscriptions.size, 1, 'locking stops optional subscriptions');
isEngineerUnlocked = true;
syncOptionalSubscriptions();
ros.isConnected = false;
clearTopicSubscriptions();
currentTopicSub = null;
syncOptionalSubscriptions();
assert.equal(topics.filter(t => t.active).length, 0, 'disconnect cleans all subscriptions');
ros.isConnected = true;
subscribeToTopic('/gps/fix', 'sensor_msgs/NavSatFix', () => {}, 100);
syncOptionalSubscriptions();
assert.equal(topics.filter(t => t.active).length, 4, 'reconnect registers each topic once');
subscribeToTopic('/gps/fix', 'sensor_msgs/NavSatFix', () => {}, 100);
assert.equal(topics.filter(t => t.active && t.name === '/gps/fix').length, 1);
isSettingsOpen = false;
syncOptionalSubscriptions();
assert.equal(topicSubscriptions.size, 1, 'closing leaves vehicle telemetry active');
`, context);
console.log('Subscription lifecycle and inline JavaScript syntax checks passed.');
