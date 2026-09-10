import test from 'node:test';
import assert from 'node:assert/strict';

import { Chart } from '../src/js/chart.js';
import { toISODate } from '../src/js/utils.js';

// Equity/ETF/FX feeds skip weekends and holidays, and a venue outage does the
// same to a crypto series, so index<->date has to read each candle's own time.
function weekdayBars(count, startISO = '2025-01-01') {
    const bars = [];
    const cursor = new Date(`${startISO}T00:00:00Z`);
    while (bars.length < count) {
        const day = cursor.getUTCDay();
        if (day !== 0 && day !== 6) {
            bars.push({ time: toISODate(cursor), open: 1, high: 2, low: 0, close: 1 });
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return bars;
}

function dailyBars(count, startISO = '2025-01-01') {
    const start = Date.parse(`${startISO}T00:00:00Z`);
    return Array.from({ length: count }, (_, i) => ({
        time: toISODate(new Date(start + i * 86400000)),
        open: 1,
        high: 2,
        low: 0,
        close: 1,
    }));
}

function createChart(data, interval = '1D') {
    const chart = Object.create(Chart.prototype);
    chart.dataManager = { data, interval };
    chart.view = { offsetX: 0 };
    chart.isCompactViewport = () => false;
    return chart;
}

test('indexes inside a gapped series resolve to that candle\'s own date', () => {
    const bars = weekdayBars(261);
    const chart = createChart(bars);

    assert.equal(toISODate(chart.getDateForIndex(0)), bars[0].time);
    assert.equal(toISODate(chart.getDateForIndex(130)), bars[130].time);
    assert.equal(toISODate(chart.getDateForIndex(260)), bars[260].time);
});

test('dates inside a gapped series resolve to the candle at or after them', () => {
    const bars = weekdayBars(261);
    const chart = createChart(bars);

    const decemberFirst = bars.findIndex(bar => bar.time === '2025-12-01');
    assert.ok(decemberFirst > 0, 'fixture should contain 2025-12-01');
    assert.equal(chart.getIndexForDate(new Date('2025-12-01T00:00:00Z')), decemberFirst);

    // A weekend date has no candle of its own, so it lands on the next one.
    const monday = bars.findIndex(bar => bar.time === '2025-03-10');
    assert.equal(chart.getIndexForDate(new Date('2025-03-08T00:00:00Z')), monday);
});

test('index and date round-trip through each other on gapped data', () => {
    const bars = weekdayBars(261);
    const chart = createChart(bars);

    for (let index = 0; index < bars.length; index += 7) {
        assert.equal(chart.getIndexForDate(chart.getDateForIndex(index)), index);
    }
});

test('outside the series both directions step at the nominal interval', () => {
    const bars = weekdayBars(261);
    const chart = createChart(bars);
    const last = Date.parse(`${bars[bars.length - 1].time}T00:00:00Z`);

    // The crosshair and drawing tools legitimately address empty slots.
    assert.equal(toISODate(chart.getDateForIndex(bars.length)), toISODate(new Date(last + 86400000)));
    assert.equal(chart.getIndexForDate(new Date(last + 3 * 86400000)), bars.length + 2);

    const first = Date.parse(`${bars[0].time}T00:00:00Z`);
    assert.equal(toISODate(chart.getDateForIndex(-2)), toISODate(new Date(first - 2 * 86400000)));
    assert.equal(chart.getIndexForDate(new Date(first - 2 * 86400000)), -2);
});

test('contiguous series behave exactly as the old linear mapping did', () => {
    const bars = dailyBars(400);
    const chart = createChart(bars);
    const first = Date.parse(`${bars[0].time}T00:00:00Z`);

    for (const index of [0, 1, 99, 399]) {
        assert.equal(chart.getDateForIndex(index).getTime(), first + index * 86400000);
        assert.equal(chart.getIndexForDate(new Date(first + index * 86400000)), index);
    }
});

test('monthly data with a missing month still maps by candle', () => {
    const months = ['2025-01-01', '2025-02-01', '2025-04-01', '2025-05-01']
        .map(time => ({ time, open: 1, high: 2, low: 0, close: 1 }));
    const chart = createChart(months, '1M');

    assert.equal(toISODate(chart.getDateForIndex(3)), '2025-05-01');
    assert.equal(chart.getIndexForDate(new Date('2025-04-01T00:00:00Z')), 2);
    // March has no candle, so it resolves forward to April's.
    assert.equal(chart.getIndexForDate(new Date('2025-03-01T00:00:00Z')), 2);
    assert.equal(chart.getIndexForDate(new Date('2025-07-01T00:00:00Z')), 5);
});

test('the time axis still draws ticks over a gapped series', () => {
    const bars = weekdayBars(261);
    const chart = createChart(bars);
    const ticks = chart.getCalendarTimeTicks(0, bars.length, 4, 1, 1220);

    assert.ok(ticks.length > 0, 'a gapped year should not render a blank axis');
    for (const tick of ticks) {
        assert.ok(tick.x >= 0 && tick.x <= 1220, `tick at ${tick.x}px should be on canvas`);
    }
});
