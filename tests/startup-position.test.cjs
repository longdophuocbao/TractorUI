// Run with: node tests/startup-position.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('        function resetTractorPositionSource(');
const end = html.indexOf('        let localizationStartupPayload', start);
assert.ok(start >= 0 && end > start);
const moves = [], miniMoves = [], views = [], positionGroups = [];
const context = vm.createContext({
    hasEskfMapPosition: false, smoothOdomX: null, smoothOdomY: null,
    mapOriginLat: null, mapOriginLon: null,
    firstGpsFix: false, latestLat: null, latestLon: null,
    isHeadingUp: true, isPannedAway: false, isRecentering: false,
    webSubscriptions: {setGroupEnabled: (group, enabled) => positionGroups.push([group, enabled])},
    defaultTractorZoom: 20,
    tractorMarker: { setLatLng: point => moves.push([...point]) },
    miniTractorMarker: { setLatLng: point => miniMoves.push([...point]) },
    latDisplay: {}, lonDisplay: {},
    map: { setView: point => views.push([...point]), getZoom: () => 19 },
    checkRecenterVisibility() {},
});
vm.runInContext(html.slice(start, end), context);
const gpsStart = html.indexOf("            subscribeToTopic('/gps/fix'");
const gpsEnd = html.indexOf('            subscribeToTopic(', gpsStart + 1);
context.subscribeToTopic = (name, type, callback) => { context.receiveGps = callback; };
vm.runInContext(html.slice(gpsStart, gpsEnd), context);
const fix = (lat, lon, status = 0) => ({ latitude: lat, longitude: lon, status: { status } });

// A valid non-RTK fix displays both markers without any map origin or ESKF seed.
context.receiveGps(fix(22.6, 120.3));
assert.deepEqual(moves.at(-1), [22.6, 120.3]);
assert.deepEqual(miniMoves.at(-1), [22.6, 120.3]);
assert.deepEqual(views.at(-1), [22.6, 120.3]);
assert.equal(context.mapOriginLat, null);
assert.equal(context.hasEskfMapPosition, false);
context.receiveGps(fix(22.61, 120.31, 1)); // FLOAT is also usable for display.
assert.equal(context.latestLat, 22.61);
const count = moves.length;
for (const bad of [fix(22, 120, -1), fix(NaN, 120), fix(22, Infinity), fix(91, 120), fix(22, 181), { latitude: 22, longitude: 120 }]) {
    context.receiveGps(bad);
}
assert.equal(moves.length, count);

// The first ESKF map position takes ownership; raw fixes cannot fight it.
context.updateTractorMapPosition(22.62, 120.32, 'eskf');
context.receiveGps(fix(23, 121));
assert.equal(context.hasEskfMapPosition, true);
assert.deepEqual(positionGroups.at(-1), ['startup-position', false]);
assert.equal(context.latestLat, 22.62);
assert.equal(context.latestLon, 120.32);
assert.deepEqual(moves.at(-1), [22.62, 120.32]);
assert.equal(context.latDisplay.innerText, '22.620000');
assert.ok(html.includes("updateTractorMapPosition(tractorLat, tractorLon, 'eskf')"));

// Reset/disconnect permits startup GPS again; panned maps remain under user control.
context.smoothOdomX = 4;
context.mapOriginLat = 22.6;
context.resetTractorPositionSource(true);
assert.deepEqual(positionGroups.at(-1), ['startup-position', true]);
assert.equal(context.smoothOdomX, null);
assert.equal(context.mapOriginLat, null);
context.isPannedAway = true;
const viewCount = views.length;
context.receiveGps(fix(0, 120)); // Latitude zero is a valid coordinate.
assert.equal(context.latestLat, 0);
assert.equal(views.length, viewCount);
assert.deepEqual(miniMoves.at(-1), [0, 120]);
console.log('PASS startup GPS display, quality checks, ESKF handoff, reconnect and recenter');
