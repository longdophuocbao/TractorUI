const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {Manager} = require('../subscriptions.js');

class Ros extends EventEmitter {
    constructor() { super(); this.isConnected = false; }
    connect() { this.isConnected = true; this.emit('connection'); }
    close() { this.isConnected = false; this.emit('close'); }
}
class Topic {
    static active = new Set();
    static instances = [];
    constructor(options) { this.options = options; Topic.instances.push(this); }
    subscribe(callback) { this.callback = callback; Topic.active.add(this); }
    unsubscribe() { Topic.active.delete(this); }
}
let now = 0;
const ros = new Ros(), manager = new Manager(ros, Topic, () => now);
let oldCalls = 0, calls = 0, inspected = 0;
const odom = {name: '/odom/absolute', messageType: 'nav_msgs/Odometry', throttleRate: 100};
manager.set('map', odom, () => { oldCalls++; });
assert.equal(Topic.active.size, 0);
ros.connect();
assert.equal(Topic.active.size, 1);
const first = [...Topic.active][0];
manager.set('map', odom, () => { calls++; });
assert.equal([...Topic.active][0], first, 'repeated registration rebuilt the wire');
first.callback({});
assert.equal(calls, 1);
assert.equal(oldCalls, 0, 'reconnect retained an obsolete callback');
assert.equal(first.options.queue_length, 1);
assert.equal(first.options.reconnect_on_close, false);
now = 99;
first.callback({});
assert.equal(calls, 2, 'client limiter dropped a wire-throttled sample due to jitter');

// The topic inspector shares the map subscription, with its own slower cadence.
manager.set('inspector', {...odom, messageType: 'nav_msgs/msg/Odometry', group: 'engineer', throttleRate: 500}, () => { inspected++; });
manager.setGroupEnabled('engineer', true);
assert.equal(Topic.active.size, 1);
for (now = 200; now <= 1100; now += 100) first.callback({});
assert.equal(inspected, 2);
manager.setGroupEnabled('engineer', false);
assert.equal(Topic.active.size, 1);

// Hidden diagnostic-only topics have no wire subscription; core faults stay live.
manager.set('imu-chart', {name: '/imu', messageType: 'sensor_msgs/Imu', group: 'engineer', throttleRate: 100}, () => {});
manager.set('fault', {name: '/fault', messageType: 'std_msgs/Bool', events: true, throttleRate: 100}, () => {});
assert.equal(Topic.active.size, 2);
manager.setGroupEnabled('engineer', true);
assert.equal(Topic.active.size, 3);
const fault = [...Topic.active].find(t => t.options.name === '/fault');
assert.equal(fault.options.throttle_rate, 0);
assert.equal(fault.options.queue_length, 0);
manager.setGroupEnabled('engineer', false);
assert.equal(Topic.active.has(fault), true);
assert.equal([...Topic.active].some(t => t.options.name === '/imu'), false);

for (let reconnect = 0; reconnect < 20; reconnect++) {
    ros.close();
    assert.equal(Topic.active.size, 0);
    ros.connect();
    manager.set('map', odom, () => { calls++; });
    assert.equal(Topic.active.size, 2);
}
const before = calls;
first.callback({});
assert.equal(calls, before, 'a queued callback from the old socket was delivered');
const current = [...Topic.active].find(t => t.options.name === '/odom/absolute');
current.callback({});
assert.equal(calls, before + 1);
assert.equal(ros.listenerCount('connection'), 1);
assert.equal(ros.listenerCount('close'), 1);

// Slow inspection never throttles or coalesces acknowledgements.
let acks = [], shown = [];
manager.set('depth-acks', {name: '/ack', messageType: 'std_msgs/Int32', events: true}, m => acks.push(m.data));
manager.set('ack-inspector', {name: '/ack', messageType: 'std_msgs/Int32', group: 'engineer', throttleRate: 500}, m => shown.push(m.data));
manager.setGroupEnabled('engineer', true);
const ack = [...Topic.active].find(t => t.options.name === '/ack');
for (let i = 0; i < 20; i++) { now += 10; ack.callback({data: i}); }
assert.equal(acks.length, 20);
assert.equal(shown.length, 1);
manager.setGroupEnabled('engineer', false);
assert.equal(Topic.active.has(ack), true);

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert.ok(html.indexOf('src="subscriptions.js"') < html.indexOf('new TractorSubscriptions.Manager'));
assert.ok(html.includes("webSubscriptions.setGroupEnabled('startup-position', false)"));
const start = html.indexOf('        function isEngineerTelemetryVisible() {');
const end = html.indexOf('        function unlockEngineer()', start);
const context = vm.createContext({isSettingsOpen: false, currentSettingsTab: 'engineer', isEngineerUnlocked: true});
vm.runInContext(html.slice(start, end), context);
assert.equal(context.isEngineerTelemetryVisible(), false);
context.isSettingsOpen = true;
assert.equal(context.isEngineerTelemetryVisible(), true);
context.currentSettingsTab = 'user';
assert.equal(context.isEngineerTelemetryVisible(), false);
context.currentSettingsTab = 'engineer'; context.isEngineerUnlocked = false;
assert.equal(context.isEngineerTelemetryVisible(), false);
console.log('PASS shared subscriptions, 20 reconnects, visibility, stale callbacks and lossless event consumers');

// Exercise the exact bundled ROSLIB, including subscribe IDs and queued close cleanup.
const browser = {console, setTimeout, clearTimeout, setInterval, clearInterval};
browser.global = browser; browser.self = browser; browser.window = browser;
vm.createContext(browser);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../roslib.min.js'), 'utf8'), browser);
const actualRos = new browser.ROSLIB.Ros();
const wireSubscriptions = new Map();
actualRos.socket = {send(encoded) {
    const packet = JSON.parse(encoded);
    if (packet.op === 'subscribe') wireSubscriptions.set(packet.id, packet.topic);
    if (packet.op === 'unsubscribe') wireSubscriptions.delete(packet.id);
}};
const actualManager = new Manager(actualRos, browser.ROSLIB.Topic, () => 0);
let delivered = 0;
actualManager.set('map', odom, () => { delivered++; });
for (let i = 0; i < 20; i++) {
    actualRos.isConnected = true;
    actualRos.emit('connection');
    actualManager.set('map', odom, () => { delivered++; });
    assert.equal(wireSubscriptions.size, 1);
    assert.equal(actualRos.listeners('/odom/absolute').length, 1);
    assert.equal(actualRos.listeners('close').length, 1);
    actualRos.emit('/odom/absolute', {sample: i});
    actualRos.isConnected = false;
    wireSubscriptions.clear(); // The server discards subscriptions with the socket.
    actualRos.emit('close');
    assert.equal(actualRos.listeners('/odom/absolute').length, 0);
}
assert.equal(delivered, 20);
console.log('PASS bundled ROSLIB: 20 real subscribe/unsubscribe/reconnect cycles without duplicate listeners');
