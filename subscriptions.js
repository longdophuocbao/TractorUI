/* One ROS subscription per topic, shared by visible UI consumers. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.TractorSubscriptions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    class Manager {
        constructor(ros, Topic, now = () => performance.now()) {
            this.ros = ros;
            this.Topic = Topic;
            this.now = now;
            this.records = new Map();
            this.transports = new Map();
            this.groups = new Map([['always', true], ['engineer', false], ['startup-position', true]]);
            this.connected = !!ros.isConnected;
            ros.on('connection', () => {
                this.connected = true;
                for (const record of this.records.values()) record.lastDelivered = -Infinity;
                this.reconcile();
            });
            ros.on('close', () => {
                this.connected = false;
                this.reconcile();
            });
        }

        set(id, options, callback) {
            const record = {
                name: options.name, messageType: options.messageType,
                group: options.group || 'always', events: !!options.events,
                throttleRate: options.events ? 0 : Math.max(0, options.throttleRate || 0),
                callback, lastDelivered: -Infinity,
            };
            // ROS 1/ROS 2 spellings refer to the same message contract.
            const type = record.messageType.replace('/msg/', '/');
            for (const [otherId, other] of this.records) {
                if (otherId !== id && other.name === record.name
                        && other.messageType.replace('/msg/', '/') !== type) {
                    throw new Error('Conflicting message types for ' + record.name);
                }
            }
            this.records.set(id, record);
            this.reconcile();
            return {unsubscribe: () => this.remove(id)};
        }

        remove(id) {
            this.records.delete(id);
            this.reconcile();
        }

        setGroupEnabled(group, enabled) {
            if (this.groups.get(group) === enabled) return;
            this.groups.set(group, enabled);
            for (const record of this.records.values()) {
                if (record.group === group) record.lastDelivered = -Infinity;
            }
            this.reconcile();
        }

        reconcile() {
            const topics = new Map();
            if (this.connected) {
                for (const record of this.records.values()) {
                    if (!this.groups.get(record.group)) continue;
                    if (!topics.has(record.name)) topics.set(record.name, []);
                    topics.get(record.name).push(record);
                }
            }
            for (const [name, transport] of this.transports) {
                if (!topics.has(name)) {
                    transport.topic.unsubscribe();
                    this.transports.delete(name);
                }
            }
            for (const [name, consumers] of topics) {
                const throttleRate = Math.min(...consumers.map(record => record.throttleRate));
                const queueLength = consumers.some(record => record.events) ? 0 : 1;
                const signature = `${consumers[0].messageType.replace('/msg/', '/')}|${throttleRate}|${queueLength}`;
                const previous = this.transports.get(name);
                if (previous && previous.signature === signature) continue;
                if (previous) previous.topic.unsubscribe();
                const topic = new this.Topic({
                    ros: this.ros, name, messageType: consumers[0].messageType,
                    throttle_rate: throttleRate, queue_length: queueLength,
                    reconnect_on_close: false,
                });
                // This bundled ROSLIB version copies callOnConnection without
                // binding it when automatic reconnect is disabled.
                if (typeof this.ros.callOnConnection === 'function') {
                    topic.callForSubscribeAndAdvertise = this.ros.callOnConnection.bind(this.ros);
                }
                this.transports.set(name, {topic, signature});
                topic.subscribe(message => {
                    if (!this.connected || this.transports.get(name)?.topic !== topic) return;
                    const now = this.now();
                    for (const record of this.records.values()) {
                        if (record.name !== name || !this.groups.get(record.group)) continue;
                        // The wire already throttles the fastest consumer.
                        // Only slower shared consumers need another limiter.
                        if (record.throttleRate > throttleRate
                                && now - record.lastDelivered < record.throttleRate) continue;
                        record.lastDelivered = now;
                        record.callback(message);
                    }
                });
            }
        }
    }
    return {Manager};
});
