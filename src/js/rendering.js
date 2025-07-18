import { priceToY, yToPrice, formatDate, getLinePoints, generateFutureDate, AXIS_MARGIN, LABEL_MARGIN, CANDLE_SPACING, PRICE_STEPS } from './utils.js';

export function renderGrid(ctx, options, data, view, width, height, candleWidth, spacing) {
    const chartHeight = height - AXIS_MARGIN;

    ctx.strokeStyle = options.gridColor;
    ctx.lineWidth = 1;

    // Draw horizontal price grid lines
    for (let i = 0; i <= PRICE_STEPS; i++) {
        const y = LABEL_MARGIN + ((chartHeight - 2 * LABEL_MARGIN) * i) / PRICE_STEPS;
        ctx.beginPath();
        ctx.moveTo(0, chartHeight - y);
        ctx.lineTo(width - AXIS_MARGIN, chartHeight - y);
        ctx.stroke();
    }

    // Draw vertical time grid lines, including future dates
    const labelInterval = Math.max(1, Math.floor(150 / (candleWidth + spacing)));
    ctx.font = '12px Arial';
    const textWidth = ctx.measureText('2025-01-01').width;
    const textCenterOffset = 20 + (textWidth / 2);

    // Calculate the visible range of candle indices
    const startIndex = Math.floor(-view.offsetX / (candleWidth + spacing));
    const endIndex = Math.ceil((width - AXIS_MARGIN - view.offsetX) / (candleWidth + spacing));

    // Draw grid lines and labels for both past and future
    for (let i = startIndex; i <= endIndex; i += labelInterval) {
        const x = (i * (candleWidth + spacing) + view.offsetX);
        if (x >= 0 && x <= width - AXIS_MARGIN) {
            ctx.beginPath();
            ctx.moveTo(x + textCenterOffset, 0);
            ctx.lineTo(x + textCenterOffset, chartHeight - LABEL_MARGIN);
            ctx.stroke();

            // Determine the time for the label
            let time;
            if (i >= 0 && i < data.length) {
                time = data[i]?.time || '';
            } else if (i >= data.length && data.length > 0) {
                time = generateFutureDate(data, i);
            } else {
                continue; // Skip invalid indices
            }
            ctx.fillStyle = options.axisColor;
            ctx.fillText(formatDate(time), x + 20, chartHeight + 10);
        }
    }
}

export function renderCandles(ctx, options, data, view, width, height, candleWidth, spacing) {
    const chartHeight = height - AXIS_MARGIN;
    const startIndex = Math.max(0, Math.floor(-view.offsetX / (candleWidth + spacing)));
    const endIndex = Math.min(data.length, Math.ceil((width - AXIS_MARGIN - view.offsetX) / (candleWidth + spacing)));

    data.slice(startIndex, endIndex).forEach((candle, i) => {
        const trueIndex = startIndex + i;
        const x = (trueIndex * (candleWidth + spacing) + view.offsetX);
        if (x < -candleWidth || x > width - AXIS_MARGIN) return;

        const isUp = candle.close >= candle.open;
        ctx.fillStyle = isUp ? options.upColor : options.downColor;

        const highY = priceToY(candle.high, chartHeight, view, options.scaleType);
        const lowY = priceToY(candle.low, chartHeight, view, options.scaleType);
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, highY);
        ctx.lineTo(x + candleWidth / 2, lowY);
        ctx.strokeStyle = ctx.fillStyle;
        ctx.stroke();

        const openY = priceToY(candle.open, chartHeight, view, options.scaleType);
        const closeY = priceToY(candle.close, chartHeight, view, options.scaleType);
        const bodyHeight = Math.abs(openY - closeY);
        const bodyY = Math.min(openY, closeY);
        ctx.fillRect(x, bodyY, candleWidth, bodyHeight);
    });
}

export function renderCrosshair(ctx, crosshair, showCrosshair, isDrawingLine, isDrawingInfiniteLine, options, data, view, width, height, candleWidth, spacing) {
    if (!showCrosshair || !crosshair || isDrawingLine || isDrawingInfiniteLine) return;
    const { x, y } = crosshair;
    const chartHeight = height - AXIS_MARGIN;

    // Draw crosshair lines
    ctx.strokeStyle = '#666';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, chartHeight - LABEL_MARGIN);
    ctx.moveTo(0, y);
    ctx.lineTo(width - AXIS_MARGIN, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Calculate price and time
    const price = yToPrice(y, chartHeight, view, options.scaleType);
    const candleIndex = Math.round((x - view.offsetX) / (candleWidth + spacing));
    let time = '';

    // Always show time, including future dates
    if (data.length > 0) {
        if (candleIndex >= 0 && candleIndex < data.length) {
            time = data[candleIndex]?.time || '';
        } else if (candleIndex >= data.length) {
            time = generateFutureDate(data, candleIndex);
        } else {
            // For negative indices, use the first candle's time or empty
            time = data[0]?.time || '';
        }
    }

    // Draw price and time box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x + 10, y - 30, 120, 40);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.fillText(`Price: ${price.toFixed(2)}`, x + 15, y - 15);
    ctx.fillText(`Time: ${formatDate(time)}`, x + 15, y);
}

export function renderLines(ctx, lines, selectedLineIndex, chart, width, height, candleWidth, spacing) {
    const chartHeight = height - AXIS_MARGIN;
    console.log('Rendering lines:', lines.length, lines);

    lines.forEach((line, index) => {
        if (!line || (!line.start && !line.point1) || !line.scaleType) {
            console.warn('Invalid line object at index', index, line);
            return;
        }
        try {
            const isSelected = index === selectedLineIndex;
            ctx.strokeStyle = isSelected ? 'blue' : 'red';
            ctx.lineWidth = isSelected ? 4 : 2;
            const points = getLinePoints(chart, line, width, chartHeight, candleWidth, spacing, 50);
            if (!points || points.length < 2) {
                console.warn('No valid points for line:', line);
                return;
            }
            ctx.beginPath();
            for (let i = 0; i < points.length; i++) {
                const { x, y } = points[i];
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        } catch (e) {
            console.error('Error rendering line', index, line, e);
        }
    });
    ctx.lineWidth = 1;
}