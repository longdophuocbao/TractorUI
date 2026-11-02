const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {viewModel} = require('../localization-status.js');
const payload = {operator_phase: 'waiting_gnss', origin_locked: false, seed_published: false, estimator_initialized: false, minimum_heading_speed_mps: .4};
for (const lang of ['vi', 'en', 'zh']) {
    let view = viewModel(payload, 50, true, lang);
    assert.equal(view.level, 'waiting');
    assert.ok(view.message.length > 10);
    view = viewModel({...payload, operator_phase: 'sampling_origin', origin_sample_count: 25, origin_min_samples: 10, origin_sample_duration_sec: 2.4, origin_min_duration_sec: 5}, 50, true, lang);
    assert.ok(view.progress.includes('25/10') && view.progress.includes('2.4/5'));
    view = viewModel({...payload, operator_phase: 'waiting_heading', origin_locked: true}, 50, true, lang);
    assert.equal(view.phase, 'waiting_heading');
    assert.ok(view.message.includes('0.4'));
    // No drive instruction if the origin is not locked or telemetry is stale.
    assert.equal(viewModel({...payload, operator_phase: 'waiting_heading'}, 50, true, lang).phase, 'stale');
    assert.equal(viewModel({...payload, operator_phase: 'waiting_heading', origin_locked: true}, 6000, true, lang).phase, 'stale');
    assert.equal(viewModel({...payload, operator_phase: 'ready'}, 50, true, lang).phase, 'starting_filter');
    const ready = {...payload, operator_phase: 'ready', estimator_initialized: true};
    assert.equal(viewModel(ready, 50, true, lang).level, 'ready');
    assert.equal(viewModel(ready, 6000, true, lang).level, 'lost');
    assert.equal(viewModel(ready, 50, false, lang).phase, 'offline');
    assert.equal(viewModel(null, 50, true, lang).phase, 'stale');
    assert.equal(viewModel({...payload, operator_phase: 'unknown'}, 50, true, lang).phase, 'stale');
    assert.equal(viewModel({...payload, origin_locked: true}, 50, true, lang).phase, 'locked_gnss');
}
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert.ok(html.includes('role="status" aria-live="polite"'));
assert.ok(html.includes("name: '/tractor_eskf/initialization_status'"));
assert.ok(html.indexOf('src="localization-status.js"') < html.indexOf('TractorStartupStatus.viewModel'));
console.log('PASS operator guidance, localization truth, stale/disconnect and three languages');
