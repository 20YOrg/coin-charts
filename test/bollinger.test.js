import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBollingerBands } from '../src/js/indicators.js';

const candles = (closes) => closes.map(close => ({ open: close, high: close, low: close, close }));

test('a constant series has zero band width', () => {
    const bands = calculateBollingerBands(candles(Array(40).fill(65000)), 20, 2);
    for (const band of bands.slice(19)) {
        assert.equal(band.middle, 65000);
        assert.equal(band.upper, 65000);
        assert.equal(band.lower, 65000);
    }
});

test('bands match a hand-computed population standard deviation', () => {
    const closes = [3, 8, 1, 9, 4, 7, 2, 6, 5, 10];
    const bands = calculateBollingerBands(candles(closes), 5, 2.5);

    // Window ending at index 7: 9, 4, 7, 2, 6 -> mean 5.6
    // squared deviations: 11.56 + 2.56 + 1.96 + 12.96 + 0.16 = 29.2, / 5 = 5.84
    const sd = Math.sqrt(5.84);
    const band = bands[7];
    assert.ok(Math.abs(band.middle - 5.6) < 1e-12);
    assert.ok(Math.abs(band.upper - (5.6 + 2.5 * sd)) < 1e-12);
    assert.ok(Math.abs(band.lower - (5.6 - 2.5 * sd)) < 1e-12);
});

test('the first N-1 candles have no band', () => {
    const bands = calculateBollingerBands(candles([1, 2, 3, 4, 5, 6, 7]), 5, 2);
    assert.deepEqual(bands.slice(0, 4), [null, null, null, null]);
    assert.notEqual(bands[4], null);
});

test('a visible-range slice matches the same candles computed over the full series', () => {
    const closes = Array.from({ length: 120 }, (_, i) => 60000 + 1500 * Math.sin(i / 7) + i * 13);
    const full = calculateBollingerBands(candles(closes), 20, 2);
    const slice = calculateBollingerBands(candles(closes), 20, 2, 50, 90);
    assert.equal(slice.length, 41);
    slice.forEach((band, offset) => {
        const expected = full[50 + offset];
        for (const key of ['middle', 'upper', 'lower']) {
            assert.ok(Math.abs(band[key] - expected[key]) < 1e-6, `${key} at ${50 + offset}`);
        }
    });
});
