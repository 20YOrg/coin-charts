import { parseDateUTC, toISODate, toIntervalKey, parseIntervalSpec } from './utils.js';

export class DataManager {
    constructor(chart) {
        this.chart = chart;
        this.rawData = [];
        this.data = [];
        this.interval = '1D';
        // Granularity of rawData. Aggregation can only ever coarsen, so anything
        // finer than this has to be refetched from the data source by the host app.
        this.baseInterval = '1D';
    }

    // Loading a series also selects it for display. Callers that want a coarser
    // view call setInterval afterwards, so a stale selection can never silently
    // aggregate freshly loaded data into something the caller did not ask for.
    setData(data, baseInterval = '1D') {
        this.baseInterval = baseInterval;
        this.interval = baseInterval;
        this.rawData = data.filter(d => {
            const date = parseDateUTC(d.time);
            return d.time && date && !isNaN(d.open) && !isNaN(d.high) && !isNaN(d.low) && !isNaN(d.close);
        }).sort((a, b) => parseDateUTC(a.time) - parseDateUTC(b.time));
        this.data = [...this.rawData];
        this.chart.render();
    }

    // True when `interval` is at least as coarse as the loaded base data.
    canAggregateTo(interval) {
        const target = parseIntervalSpec(interval);
        const base = parseIntervalSpec(this.baseInterval);
        if (target.unit === 'M') return true;
        if (base.unit === 'M') return false;
        return target.ms >= base.ms;
    }

    setInterval(interval) {
        if (!this.canAggregateTo(interval)) return false;
        this.interval = interval;
        this.data = this.aggregateData(interval);
        return this.data.length > 0;
    }

    aggregateData(interval) {
        if (interval === this.baseInterval) return [...this.rawData];

        const spec = parseIntervalSpec(interval);
        if (!this.canAggregateTo(interval)) return [...this.rawData];

        const buckets = new Map();

        this.rawData.forEach((candle) => {
            const date = parseDateUTC(candle.time);
            if (!date) return;
            const key = this.getBucketKey(date, spec.amount, spec.unit);
            if (!buckets.has(key)) {
                buckets.set(key, {
                    time: key,
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                });
                return;
            }

            const bucket = buckets.get(key);
            bucket.high = Math.max(bucket.high, candle.high);
            bucket.low = Math.min(bucket.low, candle.low);
            bucket.close = candle.close;
        });

        return Array.from(buckets.values()).sort((a, b) => parseDateUTC(a.time) - parseDateUTC(b.time));
    }

    getBucketKey(date, amount, unit) {
        if (unit === 'm' || unit === 'h') {
            const bucketMs = amount * (unit === 'm' ? 60000 : 3600000);
            const floored = Math.floor(date.getTime() / bucketMs) * bucketMs;
            return toIntervalKey(new Date(floored), { amount, unit, ms: bucketMs });
        }

        if (unit === 'D') {
            const epochDay = Math.floor(date.getTime() / 86400000);
            const bucketDay = Math.floor(epochDay / amount) * amount;
            return toISODate(new Date(bucketDay * 86400000));
        }

        if (unit === 'W') {
            const epochDay = Math.floor(date.getTime() / 86400000);
            const mondayOffset = (date.getUTCDay() + 6) % 7;
            const mondayDay = epochDay - mondayOffset;
            const bucketWeek = Math.floor(mondayDay / (amount * 7)) * amount * 7;
            return toISODate(new Date(bucketWeek * 86400000));
        }

        const monthIndex = date.getUTCFullYear() * 12 + date.getUTCMonth();
        const bucketMonth = Math.floor(monthIndex / amount) * amount;
        const year = Math.floor(bucketMonth / 12);
        const month = bucketMonth % 12;
        return toISODate(new Date(Date.UTC(year, month, 1)));
    }

    async loadDataFromCSV(url) {
        try {
            const response = await fetch(url);
            const csvText = await response.text();
            const rows = csvText.split('\n').map(row => row.split(','));
            const headers = rows[0];
            const data = rows.slice(1).map(row => ({
                time: row[0],
                open: parseFloat(row[1]),
                high: parseFloat(row[2]),
                low: parseFloat(row[3]),
                close: parseFloat(row[4]),
            })).filter(row => row.time && !isNaN(row.close));
            this.setData(data);
        } catch (e) {
            console.error('Failed to load CSV:', e);
        }
    }
}
