import test from 'node:test';
import assert from 'node:assert/strict';

import { Chart } from '../src/js/chart.js';
import { renderCrosshairAxisLabels, renderLineAxisLabels, renderLines } from '../src/js/rendering.js';

function createContext() {
    const texts = [];
    const noop = () => {};
    return {
        texts,
        save: noop,
        restore: noop,
        fillRect: noop,
        strokeRect: noop,
        beginPath: noop,
        roundRect: noop,
        fill: noop,
        stroke: noop,
        moveTo: noop,
        lineTo: noop,
        setLineDash: noop,
        arc: noop,
        translate: noop,
        rotate: noop,
        measureText: (text) => ({ width: String(text).length * 7 }),
        fillText: (text) => texts.push(String(text)),
    };
}

function createChart(formatter, ctx = createContext()) {
    const chart = Object.create(Chart.prototype);
    chart.options = {
        priceFormatter: formatter,
        scaleType: 'linear',
        axisLabelBackground: '#000',
        axisLabelText: '#fff',
        axisColor: '#000',
        handleFill: '#fff',
        handleStroke: '#000',
        lastPriceColor: '#0a0',
    };
    chart.ctx = ctx;
    chart.view = {
        minPrice: 0,
        maxPrice: 200,
        minLogPrice: 0,
        maxLogPrice: Math.log10(200),
        offsetX: 0,
        offsetY: 0,
        scaleY: 1,
        priceStep: null,
    };
    chart.lines = [];
    chart.hoveredLineIndex = -1;
    chart.selectedLineIndex = -1;
    chart.isMovingLine = false;
    chart.activeLineHandle = null;
    chart.isCompactViewport = () => false;
    chart.getDateForIndex = () => new Date('2024-01-01T00:00:00Z');
    chart.getCandleWidth = () => 10;
    return chart;
}

test('one priceFormatter is used by every price display', () => {
    const values = [];
    const formatter = (value) => {
        values.push(value);
        return `price:${value}`;
    };
    const ctx = createContext();
    const chart = createChart(formatter, ctx);

    // Price-axis tick.
    chart.view.minPrice = 100;
    chart.view.maxPrice = 100;
    chart.getPriceTicks(100);

    // Crosshair price label.
    renderCrosshairAxisLabels(ctx, { x: 10, y: 50, candleIndex: 0 }, true, false, false,
        chart.options, [{ time: '2024-01-01' }], chart.view, 300, 200, 10, 2, chart);

    // Current-price label.
    chart.view.minPrice = 0;
    chart.view.maxPrice = 200;
    chart.dataManager = { data: [{ close: 123 }] };
    chart.renderLastPriceMarker(200, 150);

    // OHLC box values and change.
    const children = [];
    globalThis.document = { createElement: () => ({ style: {} }) };
    chart.ohlcInfo = {
        hidden: true,
        style: {},
        classList: { toggle() {} },
        replaceChildren: (...items) => { children.splice(0, children.length, ...items); },
        children,
    };
    chart.canvas = { offsetWidth: 800, parentElement: { clientWidth: 800 } };
    chart.crosshair = { x: 20, candleIndex: 0 };
    chart.showCrosshair = true;
    chart.dataManager.data = [{ open: 100, high: 130, low: 90, close: 120 }];
    chart.updateOhlcInfo(false);

    // Horizontal-line price label.
    chart.lines = [{ type: 'horizontal', point1: { x: 0, y: 125 } }];
    renderLineAxisLabels(ctx, chart.lines, chart, 300, 200, 10, 2);

    // Fibonacci drawing prices and measure drawing price delta.
    renderLines(ctx, [{ type: 'fibonacci', point1: { x: 0, y: 100 }, point2: { x: 1, y: 120 } }], -1,
        chart, 300, 200, 10, 2);
    renderLines(ctx, [{ type: 'measure', point1: { x: 0, y: 100 }, point2: { x: 1, y: 120 } }], -1,
        chart, 300, 200, 10, 2);

    assert.ok(values.includes(100), 'price axis');
    assert.ok(values.some((value) => value > 0 && value < 200), 'crosshair label');
    assert.ok(values.includes(123), 'current price');
    const ohlcTexts = children.map((child) => child.textContent);
    assert.ok(['price:100', 'price:130', 'price:90', 'price:120'].every((text) => ohlcTexts.includes(text)), 'OHLC prices');
    assert.ok(ohlcTexts.some((text) => text.startsWith('+price:20')), 'OHLC change');
    assert.ok(values.includes(125), 'horizontal line');
    assert.ok(ctx.texts.some((text) => text.includes('price:')), 'drawing labels');
});

test('default price formatting remains backward compatible', () => {
    const chart = createChart(undefined);

    assert.equal(chart.formatPrice(0.1234567), '0.123457');
    assert.equal(chart.formatPrice(12.345), '12.35');
    assert.equal(chart.formatPrice(1234.5), '1,235');
    assert.equal(chart.formatOhlcValue(12.3), '12.30');
    assert.equal(chart.formatOhlcValue(1234.5), '1,235');
});
