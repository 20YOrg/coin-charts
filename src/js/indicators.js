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
