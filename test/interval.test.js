import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDateUTC, parseIntervalSpec, isSubDailySpec, toIntervalKey, formatDate, formatDuration } from '../src/js/utils.js';
import { DataManager } from '../src/js/data-manager.js';

const stubChart = () => ({ render() {} });

const hourlyCandles = (count, startISO = '2026-08-10T00:00:00Z') => {
    const start = Date.parse(startISO);
    return Array.from({ length: count }, (_, i) => {
        const time = new Date(start + i * 3600000).toISOString().slice(0, 19) + 'Z';
        return { time, open: 100 + i, high: 110 + i, low: 90 + i, close: 105 + i };
    });
};

test('parseDateUTC keeps reading plain dates the way it always did', () => {
    assert.equal(parseDateUTC('2026-08-13').toISOString(), '2026-08-13T00:00:00.000Z');
    assert.equal(parseDateUTC('2026-8-3').toISOString(), '2026-08-03T00:00:00.000Z');
    assert.equal(parseDateUTC(''), null);
    assert.equal(parseDateUTC('nonsense'), null);
});

test('parseDateUTC reads sub-daily timestamps, treating naive strings as UTC', () => {
    assert.equal(parseDateUTC('2026-08-13T14:30:00Z').toISOString(), '2026-08-13T14:30:00.000Z');
    assert.equal(parseDateUTC('2026-08-13T14:30:00').toISOString(), '2026-08-13T14:30:00.000Z');
});

test('interval specs cover minutes and hours, not just days and up', () => {
    assert.deepEqual(parseIntervalSpec('30m'), { amount: 30, unit: 'm', ms: 1800000 });
    assert.deepEqual(parseIntervalSpec('4h'), { amount: 4, unit: 'h', ms: 14400000 });
    assert.deepEqual(parseIntervalSpec('1D'), { amount: 1, unit: 'D', ms: 86400000 });
    assert.equal(parseIntervalSpec('3M').ms, null, 'months are calendar-based, so carry no fixed ms');
    assert.deepEqual(parseIntervalSpec('garbage'), { amount: 1, unit: 'D', ms: 86400000 });
});

test('sub-daily keys keep the time of day, daily keys do not', () => {
    const date = new Date('2026-08-13T14:30:00Z');
    assert.equal(toIntervalKey(date, parseIntervalSpec('30m')), '2026-08-13T14:30:00Z');
    assert.equal(toIntervalKey(date, parseIntervalSpec('1D')), '2026-08-13');
    assert.equal(isSubDailySpec(parseIntervalSpec('1h')), true);
    assert.equal(isSubDailySpec(parseIntervalSpec('1D')), false);
});

test('aggregation coarsens hourly candles into 4h buckets with correct OHLC', () => {
    const manager = new DataManager(stubChart());
    manager.setData(hourlyCandles(8), '1h');
    assert.equal(manager.data.length, 8);

    assert.equal(manager.setInterval('4h'), true);
    assert.equal(manager.data.length, 2);

    const [first] = manager.data;
    assert.equal(first.time, '2026-08-10T00:00:00Z');
    assert.equal(first.open, 100, 'open comes from the first candle in the bucket');
    assert.equal(first.close, 108, 'close comes from the last candle in the bucket');
    assert.equal(first.high, 113, 'high is the max across the bucket');
    assert.equal(first.low, 90, 'low is the min across the bucket');
});

test('aggregation refuses to invent data finer than what was loaded', () => {
    const manager = new DataManager(stubChart());
    manager.setData(hourlyCandles(8), '1h');

    assert.equal(manager.canAggregateTo('30m'), false);
    assert.equal(manager.setInterval('30m'), false, 'a finer interval needs a refetch, not aggregation');
    assert.equal(manager.interval, '1h', 'the rejected interval must not be applied');
    assert.equal(manager.canAggregateTo('1D'), true);
});

test('loading a series selects it, discarding any earlier coarser view', () => {
    const manager = new DataManager(stubChart());
    manager.setData(hourlyCandles(48), '1h');
    manager.setInterval('1D');
    assert.equal(manager.interval, '1D');
    assert.equal(manager.data.length, 2);

    manager.setData(hourlyCandles(8, '2026-08-12T00:00:00Z'), '30m');
    assert.equal(manager.interval, '30m', 'a stale 1D view must not survive a finer reload');
    assert.equal(manager.data.length, 8, 'freshly loaded candles are shown as-is');
});

test('labels carry the time only when the candle has one', () => {
    assert.equal(formatDate('2026-08-13'), '2026-08-13');
    assert.equal(formatDate('2026-08-13T14:30:00Z'), '2026-08-13 14:30');
    assert.equal(formatDuration(90 * 60000), '2h');
    assert.equal(formatDuration(30 * 60000), '30m');
    assert.equal(formatDuration(3 * 86400000), '3d');
});
