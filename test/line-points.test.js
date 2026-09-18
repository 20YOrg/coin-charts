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
