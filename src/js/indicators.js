import { priceToY, AXIS_MARGIN, CANDLE_SPACING } from './utils.js';

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
    const chartHeight = height - AXIS_MARGIN;
    movingAverages.forEach((ma, index) => {
        if (!ma.enabled) return;
        const maData = calculateMovingAverage(data, ma.period);
        ctx.strokeStyle = ma.color;
        ctx.beginPath();
        maData.forEach((value, i) => {
            if (value === null) return;
            const x = (i * (candleWidth + spacing) + view.offsetX);
            if (x < -candleWidth || x > width - AXIS_MARGIN) return;
            const y = priceToY(value, chartHeight, view, scaleType);
            if (i === 0 || maData[i - 1] === null) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    });
}