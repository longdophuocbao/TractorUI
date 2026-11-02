/* Operator guidance comes only from fresh initializer/ESKF telemetry. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.TractorStartupStatus = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const labels = {
        en: {
            offline: ['Localization disconnected', 'Connection lost. Wait for live localization status.'],
            stale: ['Waiting for localization status', 'No fresh status. Keep automatic steering OFF.'],
            waiting_gnss: ['Waiting to initialize localization', 'Keep the tractor STILL. Waiting for GNSS quality to lock the origin.'],
            locked_gnss: ['Origin locked — waiting for GNSS quality', 'Keep the tractor still and automatic steering OFF. Waiting for GNSS quality before obtaining heading.'],
            sampling_origin: ['Locking the origin', 'Keep the tractor STILL while position samples are collected.'],
            waiting_heading: ['Origin locked — obtain initial heading', 'Keep automatic steering OFF. Drive FORWARD STRAIGHT manually at ≥ {speed} m/s to obtain heading.'],
            starting_filter: ['Waiting for ESKF initialization', 'Position and heading sent. Keep automatic steering OFF until initialization is confirmed.'],
            ready: ['Localization initialized', 'ESKF has confirmed initialization.'],
            samples: 'Samples', time: 'Stable time'
        },
        zh: {
            offline: ['定位連線中斷', '連線已中斷，請等待即時定位狀態。'],
            stale: ['等待定位狀態', '尚無最新狀態，請保持自動轉向關閉。'],
            waiting_gnss: ['等待定位初始化', '請保持車輛靜止，等待 GNSS 品質達標以鎖定原點。'],
            locked_gnss: ['原點已鎖定，等待 GNSS 品質', '請保持車輛靜止及自動轉向關閉，等待 GNSS 品質達標後取得航向。'],
            sampling_origin: ['正在鎖定原點', '正在收集位置樣本，請保持車輛靜止。'],
            waiting_heading: ['原點已鎖定，請取得初始航向', '請保持自動轉向關閉，手動向前直行達 ≥ {speed} m/s 以取得航向。'],
            starting_filter: ['等待 ESKF 初始化確認', '已送出位置與航向，確認初始化完成前請勿開啟自動轉向。'],
            ready: ['定位已初始化', 'ESKF 已確認初始化完成。'],
            samples: '樣本', time: '穩定時間'
        },
        vi: {
            offline: ['Mất kết nối định vị', 'Chờ kết nối và trạng thái định vị mới.'],
            stale: ['Chờ trạng thái định vị', 'Chưa có trạng thái mới. Giữ tự động lái TẮT.'],
            waiting_gnss: ['Chờ chốt gốc định vị', 'GIỮ XE ĐỨNG YÊN. Chờ GNSS đạt chất lượng để chốt gốc.'],
            locked_gnss: ['Đã chốt gốc — chờ chất lượng GNSS', 'Giữ xe đứng yên và tự động lái TẮT. Chờ GNSS đạt chất lượng trước khi lấy hướng.'],
            sampling_origin: ['Đang chốt gốc', 'GIỮ XE ĐỨNG YÊN trong khi hệ thống lấy mẫu vị trí.'],
            waiting_heading: ['Đã chốt gốc — cần lấy hướng ban đầu', 'Giữ tự động lái TẮT. Lái tay TIẾN THẲNG đạt ≥ {speed} m/s để lấy hướng.'],
            starting_filter: ['Chờ ESKF khởi tạo', 'Đã gửi vị trí và hướng. Chờ xác nhận khởi tạo trước khi bật tự động lái.'],
            ready: ['Định vị đã khởi tạo', 'ESKF đã xác nhận khởi tạo xong.'],
            samples: 'Số mẫu', time: 'Thời gian ổn định'
        }
    };
    function viewModel(payload, ageMs, connected, language) {
        const text = labels[language] || labels.vi;
        let phase = payload && payload.operator_phase;
        let progress = '';
        if (!connected) phase = 'offline';
        else if (!payload || !Number.isFinite(ageMs) || ageMs < 0 || ageMs > 5000) phase = 'stale';
        else if (phase === 'ready' && payload.estimator_initialized !== true) phase = 'starting_filter';
        else if (phase === 'waiting_heading' && (payload.origin_locked !== true || payload.seed_published === true)) phase = 'stale';
        else if (!['waiting_gnss', 'sampling_origin', 'waiting_heading', 'starting_filter', 'ready'].includes(phase)) phase = 'stale';
        if (phase === 'waiting_gnss' && payload.origin_locked === true) phase = 'locked_gnss';
        if (phase === 'sampling_origin') {
            const p = payload;
            if ([p.origin_sample_count, p.origin_min_samples, p.origin_sample_duration_sec, p.origin_min_duration_sec].every(Number.isFinite)) {
                progress = `${text.samples}: ${p.origin_sample_count}/${p.origin_min_samples} · ${text.time}: ${p.origin_sample_duration_sec.toFixed(1)}/${p.origin_min_duration_sec} s`;
            }
        }
        const speed = payload && Number.isFinite(payload.minimum_heading_speed_mps) && payload.minimum_heading_speed_mps > 0
            ? String(payload.minimum_heading_speed_mps) : '0.4';
        return {
            phase, progress,
            level: phase === 'ready' ? 'ready' : ['offline', 'stale'].includes(phase) ? 'lost' : 'waiting',
            title: text[phase][0], message: text[phase][1].replace('{speed}', speed)
        };
    }
    return {viewModel};
});
