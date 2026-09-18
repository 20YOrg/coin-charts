import test from 'node:test';
import assert from 'node:assert/strict';
import { getLinePoints, AXIS_MARGIN } from '../src/js/utils.js';

const WIDTH = 1206;
const HEIGHT = 600;
const CHART_WIDTH = WIDTH - AXIS_MARGIN;
const SPACING = 2;

// A chart whose viewport shows `visibleCandles` bars, with candle index 0 at the
// left edge of the chart area.
const stubChart = (visibleCandles) => {
    const slotWidth = CHART_WIDTH / visibleCandles;
    const candleWidth = slotWidth - SPACING;
    return {
        candleWidth,
        chart: {
            view: { offsetX: 0, offsetY: 0, scaleY: 1, minPrice: 0, maxPrice: 200 },
            options: { scaleType: 'linear' },
            dataManager: {},
        },
    };
};

// A finite segment spanning 100 candles, sloping upward.
const segment = () => ({
    type: 'finite',
    start: { x: 0, y: 100 },
    end: { x: 100, y: 180 },
});

test('a finite line stays drawable at every zoom level, not just zoomed out', () => {
    for (const visibleCandles of [101, 67, 44, 28, 18, 11, 7, 1.5]) {
        const { chart, candleWidth } = stubChart(visibleCandles);
        const points = getLinePoints(chart, segment(), WIDTH, HEIGHT, candleWidth, SPACING, 50);
        assert.ok(
            points.length >= 2,
            `expected at least 2 points with ${visibleCandles} candles on screen, got ${points.length}`,
        );
    }
});

test('a finite line is sampled out to both screen edges when it overflows the viewport', () => {
    const { chart, candleWidth } = stubChart(1.5);
    const points = getLinePoints(chart, segment(), WIDTH, HEIGHT, candleWidth, SPACING, 50);
    const first = points[0];
    const last = points[points.length - 1];
    assert.ok(first.x <= 0.5, `line should start at the left edge, started at ${first.x}`);
    assert.ok(
        last.x >= CHART_WIDTH - 0.5,
        `line should reach the right edge (${CHART_WIDTH}), stopped at ${last.x}`,
    );
});

test('a finite line inside the viewport is still sampled end to end', () => {
    const { chart, candleWidth } = stubChart(200);
    const slotWidth = candleWidth + SPACING;
    const points = getLinePoints(chart, segment(), WIDTH, HEIGHT, candleWidth, SPACING, 50);
    assert.equal(points.length, 50);
    assert.ok(Math.abs(points[0].x - 0) < 0.5);
    assert.ok(Math.abs(points[points.length - 1].x - 100 * slotWidth) < 0.5);
});

test('a finite line scrolled off screen yields no points', () => {
    const { chart, candleWidth } = stubChart(50);
    const slotWidth = candleWidth + SPACING;
    chart.view.offsetX = -200 * slotWidth; // candles 200+ are on screen; the line ends at 100
    const points = getLinePoints(chart, segment(), WIDTH, HEIGHT, candleWidth, SPACING, 50);
    assert.equal(points.length, 0);
});

test('infinite lines keep spanning the viewport at high zoom', () => {
    const { chart, candleWidth } = stubChart(1.5);
    const line = { type: 'infinite', point1: { x: 0, y: 100 }, point2: { x: 100, y: 180 } };
    const points = getLinePoints(chart, line, WIDTH, HEIGHT, candleWidth, SPACING, 50);
    assert.ok(points.length >= 2);
    assert.ok(points[0].x <= 0.5);
    assert.ok(points[points.length - 1].x >= CHART_WIDTH - 0.5);
});

// A viewport whose viewMax does not survive the round trip back to pixels:
// (CHART_WIDTH - offsetX) / slotWidth * slotWidth + offsetX comes out at
// 1132.0000000000005 rather than 1132, which the bounds test used to discard.
const LOSSY_SLOT_WIDTH = 1584.8;
const LOSSY_OFFSET_X = -2171.176;

test('the round trip through viewMax really is lossy for this viewport', () => {
    const viewMax = (CHART_WIDTH - LOSSY_OFFSET_X) / LOSSY_SLOT_WIDTH;
    assert.ok(
        viewMax * LOSSY_SLOT_WIDTH + LOSSY_OFFSET_X > CHART_WIDTH,
        'fixture no longer triggers the rounding error it is meant to cover',
    );
});

test('both ends land exactly on the screen edges despite the rounding error', () => {
    const chart = {
        view: { offsetX: LOSSY_OFFSET_X, offsetY: 0, scaleY: 1, minPrice: 0, maxPrice: 200 },
        options: { scaleType: 'linear' },
        dataManager: {},
    };
    const candleWidth = LOSSY_SLOT_WIDTH - SPACING;
    for (const line of [
        { type: 'infinite', point1: { x: 0, y: 100 }, point2: { x: 100, y: 180 } },
        { type: 'finite', start: { x: -50, y: 100 }, end: { x: 150, y: 180 } },
    ]) {
        const points = getLinePoints(chart, line, WIDTH, HEIGHT, candleWidth, SPACING, 50);
        assert.equal(points.length, 50, `${line.type}: lost a sample to rounding`);
        assert.equal(points[0].x, 0, `${line.type}: left end`);
        assert.equal(points[points.length - 1].x, CHART_WIDTH, `${line.type}: right end`);
    }
});

test('a vertical line sitting on the right edge is not rounded off screen', () => {
    // A vertical line has a single x, so losing it to rounding drops the whole
    // line. Sweep zoom and pan combinations with the line parked on the edge.
    let dropped = 0;
    for (let n = 1; n <= 300; n++) {
        const slotWidth = CHART_WIDTH / (n / 7);
        for (let k = 0; k < 20; k++) {
            const offsetX = -k * slotWidth * 1.37;
            const edgeX = (CHART_WIDTH - offsetX) / slotWidth;
            const chart = {
                view: { offsetX, offsetY: 0, scaleY: 1, minPrice: 0, maxPrice: 200 },
                options: { scaleType: 'linear' },
                dataManager: {},
            };
            const line = { type: 'finite', start: { x: edgeX, y: 100 }, end: { x: edgeX, y: 180 } };
            const points = getLinePoints(chart, line, WIDTH, HEIGHT, slotWidth - SPACING, SPACING, 50);
            if (points.length < 2) dropped++;
            else if (points[0].x > CHART_WIDTH) dropped++;
        }
    }
    assert.equal(dropped, 0, `${dropped} edge-parked vertical lines went missing`);
});

test('a vertical line genuinely past the right edge is still skipped', () => {
    const slotWidth = 20;
    const chart = {
        view: { offsetX: 0, offsetY: 0, scaleY: 1, minPrice: 0, maxPrice: 200 },
        options: { scaleType: 'linear' },
        dataManager: {},
    };
    const x = (CHART_WIDTH + 40) / slotWidth;
    const line = { type: 'finite', start: { x, y: 100 }, end: { x, y: 180 } };
    const points = getLinePoints(chart, line, WIDTH, HEIGHT, slotWidth - SPACING, SPACING, 50);
    assert.equal(points.length, 0);
});
