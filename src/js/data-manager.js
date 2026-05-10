import { parseDateUTC, toISODate } from './utils.js';

export class DataManager {
    constructor(chart) {
        this.chart = chart;
        this.rawData = [];
        this.data = [];
        this.interval = '1D';
    }

    setData(data) {
        this.rawData = data.filter(d => {
            const date = parseDateUTC(d.time);
            return d.time && date && !isNaN(d.open) && !isNaN(d.high) && !isNaN(d.low) && !isNaN(d.close);
        }).sort((a, b) => parseDateUTC(a.time) - parseDateUTC(b.time));
        this.data = this.aggregateData(this.interval);
        this.chart.render();
    }

    setInterval(interval) {
        this.interval = interval;
        this.data = this.aggregateData(interval);
        return this.data.length > 0;
    }

    aggregateData(interval) {
        if (interval === '1D') return [...this.rawData];

        const match = interval.match(/^(\d+)(D|W|M)$/);
        if (!match) return [...this.rawData];

        const amount = Number.parseInt(match[1], 10);
        const unit = match[2];
        const buckets = new Map();

        this.rawData.forEach((candle) => {
            const date = parseDateUTC(candle.time);
            if (!date) return;
            const key = this.getBucketKey(date, amount, unit);
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
