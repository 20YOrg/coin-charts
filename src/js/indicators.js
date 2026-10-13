import { priceToY, AXIS_MARGIN, TIME_AXIS_HEIGHT, CANDLE_SPACING } from './utils.js';

export function calculateMovingAverage(data, period) {
    const maData = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            maData.push(null);
            continue;
        }
        const sum = data.slice(i - period + 1, i + 1).reduce((acc, d) => acc + d.close, 0);
        maData.push(sum / period);
    }
    return maData;
}

export function renderIndicators(ctx, movingAverages, data, view, width, height, candleWidth, spacing, scaleType) {
    const chartHeight = height - TIME_AXIS_HEIGHT;
    const startIndex = Math.max(0, Math.floor(-view.offsetX / (candleWidth + spacing)));
    const endIndex = Math.min(data.length, Math.ceil((width - AXIS_MARGIN - view.offsetX) / (candleWidth + spacing)));

    movingAverages.forEach((ma, index) => {
        if (!ma.enabled) return;
        const firstIndex = Math.max(0, startIndex - ma.period);
        const lastIndex = Math.min(data.length - 1, endIndex);
        if (firstIndex > lastIndex) return;

        let rollingSum = 0;
        const values = new Map();
        for (let i = firstIndex; i <= lastIndex; i++) {
            rollingSum += data[i].close;
            if (i - ma.period >= firstIndex) {
                rollingSum -= data[i - ma.period].close;
            }
            if (i >= ma.period - 1) {
                values.set(i, rollingSum / ma.period);
            }
        }

        ctx.strokeStyle = ma.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let hasPoint = false;
        for (let i = startIndex; i <= endIndex; i++) {
            const value = values.get(i);
            if (value === undefined) continue;
            const x = (i * (candleWidth + spacing) + view.offsetX);
            if (x < -candleWidth || x > width - AXIS_MARGIN) continue;
            const y = priceToY(value, chartHeight, view, scaleType);
            if (!hasPoint) {
                ctx.moveTo(x, y);
                hasPoint = true;
            }
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    });
}

// Bollinger Bands over data[startIndex..endIndex]. result[i - startIndex] is
// { middle, upper, lower } or null where fewer than `period` closes exist.
// Uses the population standard deviation (divide by N), as TradingView does.
export function calculateBollingerBands(data, period, mult, startIndex = 0, endIndex = data.length - 1) {
    const result = [];
    if (endIndex < startIndex) return result;
    const firstIndex = Math.max(0, startIndex - period + 1);
    // Sum deviations from a nearby price so large prices don't swamp the
    // variance in floating point (sumSq - sum^2 / N cancels badly otherwise).
    const shift = data[firstIndex].close;
    let sum = 0;
    let sumSq = 0;
    for (let i = firstIndex; i <= endIndex; i++) {
        const d = data[i].close - shift;
        sum += d;
        sumSq += d * d;
        if (i - period >= firstIndex) {
            const old = data[i - period].close - shift;
            sum -= old;
            sumSq -= old * old;
        }
        if (i < startIndex) continue;
        if (i < period - 1) {
            result.push(null);
            continue;
        }
        const mean = sum / period;
        const deviation = Math.sqrt(Math.max(0, sumSq / period - mean * mean));
        const middle = mean + shift;
        result.push({ middle, upper: middle + mult * deviation, lower: middle - mult * deviation });
    }
    return result;
}

function hexToRgba(hex, alpha) {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!match) return `rgba(142, 92, 247, ${alpha})`;
    const value = parseInt(match[1], 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

// Screen points for the visible bands, or null when the indicator is off.
// Computed once per frame; the fill and the lines are drawn in separate passes
// so the fill can sit beneath the candles.
export function getBollingerPoints(bollinger, data, view, width, height, candleWidth, spacing, scaleType) {
    if (!bollinger?.enabled || !data.length) return null;
    const chartHeight = height - TIME_AXIS_HEIGHT;
    const slot = candleWidth + spacing;
    const startIndex = Math.max(0, Math.floor(-view.offsetX / slot));
    const endIndex = Math.min(data.length - 1, Math.ceil((width - AXIS_MARGIN - view.offsetX) / slot));
    if (startIndex > endIndex) return null;

    const bands = calculateBollingerBands(data, bollinger.period, bollinger.mult, startIndex, endIndex);
    const points = [];
    bands.forEach((band, offset) => {
        if (!band) return;
        const x = (startIndex + offset) * slot + view.offsetX;
        if (x < -candleWidth || x > width - AXIS_MARGIN) return;
        points.push({
            x,
            middle: priceToY(band.middle, chartHeight, view, scaleType),
            upper: priceToY(band.upper, chartHeight, view, scaleType),
            lower: priceToY(band.lower, chartHeight, view, scaleType),
        });
    });
    return points.length ? points : null;
}

export function renderBollingerFill(ctx, bollinger, points) {
    if (!points || points.length < 2) return;
    ctx.save();
    ctx.fillStyle = hexToRgba(bollinger.color, 0.1);
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.upper) : ctx.moveTo(p.x, p.upper)));
    for (let i = points.length - 1; i >= 0; i--) ctx.lineTo(points[i].x, points[i].lower);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

export function renderBollingerLines(ctx, bollinger, points) {
    if (!points) return;
    ctx.save();
    ctx.strokeStyle = bollinger.color;
    ctx.lineWidth = 1.25;
    ['upper', 'middle', 'lower'].forEach(key => {
        ctx.beginPath();
        points.forEach((p, i) => (i ? ctx.lineTo(p.x, p[key]) : ctx.moveTo(p.x, p[key])));
        ctx.stroke();
    });
    ctx.restore();
}
