import { priceToY, yToPrice, formatDate, toISODate, getLinePoints, AXIS_MARGIN, TIME_AXIS_HEIGHT, CANDLE_SPACING } from './utils.js';

const FIB_LEVELS = [
    { value: 0, label: '0' },
    { value: 0.236, label: '0.236' },
    { value: 0.382, label: '0.382' },
    { value: 0.5, label: '0.5' },
    { value: 0.618, label: '0.618' },
    { value: 0.786, label: '0.786' },
    { value: 1, label: '1' },
];

function formatFibPrice(price) {
    return Math.abs(price) >= 1000
        ? price.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : price.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function renderFibonacci(ctx, line, isSelected, chart, chartWidth, chartHeight, slotWidth) {
    const point1 = line.point1;
    const point2 = line.point2;
    if (!point1 || !point2) return;

    const x1 = point1.x * slotWidth + chart.view.offsetX;
    const x2 = point2.x * slotWidth + chart.view.offsetX;
    const startX = Math.max(0, Math.min(x1, x2));
    const endX = chartWidth;
    const topPrice = point1.y;
    const bottomPrice = point2.y;
    const range = bottomPrice - topPrice;

    ctx.save();
    ctx.lineWidth = line.width || 1;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    FIB_LEVELS.forEach((level) => {
        const price = topPrice + range * level.value;
        const y = priceToY(price, chartHeight, chart.view, chart.options.scaleType);
        if (!Number.isFinite(y) || y < -20 || y > chartHeight + 20) return;

        ctx.strokeStyle = line.color || (level.value === 0 || level.value === 1 ? '#2962ff' : 'rgba(41, 98, 255, 0.72)');
        ctx.setLineDash(level.value === 0 || level.value === 1 ? [] : [5, 4]);
        ctx.beginPath();
        ctx.moveTo(Math.max(0, startX), Math.round(y) + 0.5);
        ctx.lineTo(endX, Math.round(y) + 0.5);
        ctx.stroke();

        const label = `${level.label}  ${formatFibPrice(price)}`;
        const textX = Math.min(endX - 88, Math.max(6, startX + 6));
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
        const labelWidth = ctx.measureText(label).width + 10;
        ctx.fillRect(textX - 5, y - 9, labelWidth, 18);
        ctx.fillStyle = line.color || '#2962ff';
        ctx.fillText(label, textX, y);
    });

    if (isSelected) {
        ctx.setLineDash([]);
        ctx.strokeStyle = '#131722';
        ctx.fillStyle = '#ffffff';
        ctx.lineWidth = 2;
        [point1, point2].forEach((point) => {
            const x = point.x * slotWidth + chart.view.offsetX;
            const y = priceToY(point.y, chartHeight, chart.view, chart.options.scaleType);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
    }

    ctx.restore();
}

export function renderGrid(ctx, options, data, view, width, height, candleWidth, spacing, priceTicks = [], timeTicks = []) {
    const chartHeight = height - TIME_AXIS_HEIGHT;
    const chartWidth = width - AXIS_MARGIN;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(chartWidth, 0, AXIS_MARGIN, chartHeight);
    ctx.fillRect(0, chartHeight, width, TIME_AXIS_HEIGHT);

    ctx.strokeStyle = '#f0f3fa';
    ctx.lineWidth = 1;

    priceTicks.forEach(({ y }) => {
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(chartWidth, Math.round(y) + 0.5);
        ctx.stroke();
    });

    timeTicks.forEach(({ x }) => {
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, chartHeight);
        ctx.stroke();
    });

    ctx.strokeStyle = '#d1d4dc';
    ctx.beginPath();
    ctx.moveTo(chartWidth + 0.5, 0);
    ctx.lineTo(chartWidth + 0.5, chartHeight);
    ctx.moveTo(0, chartHeight + 0.5);
    ctx.lineTo(width, chartHeight + 0.5);
    ctx.stroke();
}

export function renderCandles(ctx, options, data, view, width, height, candleWidth, spacing) {
    const chartHeight = height - TIME_AXIS_HEIGHT;
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
    const chartHeight = height - TIME_AXIS_HEIGHT;
    const chartWidth = width - AXIS_MARGIN;

    ctx.strokeStyle = '#9aa0aa';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, chartHeight);
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(chartWidth, Math.round(y) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
}

export function renderCrosshairAxisLabels(ctx, crosshair, showCrosshair, isDrawingLine, isDrawingInfiniteLine, options, data, view, width, height, candleWidth, spacing, chart = null) {
    if (!showCrosshair || !crosshair || isDrawingLine || isDrawingInfiniteLine) return;
    const { x, y } = crosshair;
    const chartHeight = height - TIME_AXIS_HEIGHT;
    const chartWidth = width - AXIS_MARGIN;
    const price = yToPrice(y, chartHeight, view, options.scaleType);
    const candleIndex = Number.isInteger(crosshair.candleIndex)
        ? crosshair.candleIndex
        : Math.round((x - view.offsetX - candleWidth / 2) / (candleWidth + spacing));
    if (candleIndex < 0) return;

    const priceText = price >= 1000
        ? price.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    const labelHeight = 24;
    const labelWidth = AXIS_MARGIN;
    const labelY = Math.round(Math.max(1, Math.min(chartHeight - labelHeight - 1, y - labelHeight / 2)));

    ctx.fillStyle = '#131722';
    ctx.fillRect(chartWidth, labelY, labelWidth, labelHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(priceText, chartWidth + 8, labelY + labelHeight / 2);

    const date = chart?.getDateForIndex?.(candleIndex);
    const timeText = data[candleIndex]?.time ? formatDate(data[candleIndex].time) : date ? formatDate(toISODate(date)) : '';
    if (!timeText) return;
    const timeWidth = Math.max(72, ctx.measureText(timeText).width + 18);
    const timeX = Math.round(Math.max(1, Math.min(chartWidth - timeWidth - 1, x - timeWidth / 2)));
    const timeAxisCenterY = chartHeight + TIME_AXIS_HEIGHT / 2;
    ctx.fillStyle = '#131722';
    ctx.fillRect(timeX, timeAxisCenterY - labelHeight / 2, timeWidth, labelHeight);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(timeText, timeX + timeWidth / 2, timeAxisCenterY);
}

export function renderLines(ctx, lines, selectedLineIndex, chart, width, height, candleWidth, spacing) {
    const chartHeight = height - TIME_AXIS_HEIGHT;
    const chartWidth = width - AXIS_MARGIN;
    const slotWidth = candleWidth + spacing;

    lines.forEach((line, index) => {
        if (!line || (!line.start && !line.point1)) {
            console.warn('Invalid line object at index', index, line);
            return;
        }
        try {
            const isSelected = index === selectedLineIndex;
            if (line.type === 'fibonacci') {
                renderFibonacci(ctx, line, isSelected, chart, chartWidth, chartHeight, slotWidth);
                return;
            }
            const points = getLinePoints(chart, line, width, chartHeight, candleWidth, spacing, 50);
            if (!points || points.length < 2) {
                console.warn('No valid points for line:', line);
                return;
            }
            ctx.strokeStyle = line.color || (isSelected ? '#2962ff' : '#f23645');
            ctx.lineWidth = line.width || (isSelected ? 3 : 2);
            if (line.style === 'dashed') ctx.setLineDash([8, 5]);
            if (line.style === 'dotted') ctx.setLineDash([2, 5]);
            ctx.beginPath();
            for (let i = 0; i < points.length; i++) {
                const { x, y } = points[i];
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            const showLineText = (line.text || (index === chart.hoveredLineIndex && index !== chart.editingLineTextIndex)) && points.length >= 2;
            if (showLineText) {
                const midIndex = Math.floor(points.length / 2);
                const midPoint = points[midIndex];
                const prevPoint = points[Math.max(0, midIndex - 1)];
                const nextPoint = points[Math.min(points.length - 1, midIndex + 1)];
                let angle = Math.atan2(nextPoint.y - prevPoint.y, nextPoint.x - prevPoint.x);
                if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
                const label = line.text || '+ Add text';
                ctx.save();
                ctx.translate(midPoint.x, midPoint.y);
                ctx.rotate(angle);
                ctx.fillStyle = line.text ? (line.textColor || '#131722') : '#6fcad7';
                ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(label, 0, -8);
                ctx.restore();
            }

            if (isSelected) {
                const anchors = line.type === 'finite'
                    ? [line.start, line.end]
                    : [line.point1, line.point2];
                ctx.save();
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#131722';
                ctx.lineWidth = 2;
                anchors.forEach((anchor) => {
                    if (!anchor) return;
                    const x = anchor.x * slotWidth + chart.view.offsetX;
                    const y = priceToY(anchor.y, chartHeight, chart.view, chart.options.scaleType);
                    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
                    if (x < -8 || x > chartWidth + 8 || y < -8 || y > chartHeight + 8) return;
                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                });
                ctx.restore();
            }
        } catch (e) {
            console.error('Error rendering line', index, line, e);
        }
    });
    ctx.lineWidth = 1;
}

export function renderDrawingFeedback(ctx, chart, width, height, candleWidth, spacing) {
    if (!chart.snapPoint || (!chart.isDrawingLine && !chart.isDrawingInfiniteLine && !chart.isDrawingFibonacci)) return;

    const chartHeight = height - TIME_AXIS_HEIGHT;
    const chartWidth = width - AXIS_MARGIN;
    const slotWidth = candleWidth + spacing;
    const snapX = chart.snapPoint.x * slotWidth + chart.view.offsetX;
    const snapY = priceToY(chart.snapPoint.y, chartHeight, chart.view, chart.options.scaleType);
    if (!Number.isFinite(snapX) || !Number.isFinite(snapY)) return;

    ctx.save();
    ctx.strokeStyle = '#2962ff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 1.5;

    if (chart.lineStartPoint) {
        const previewLine = chart.isDrawingFibonacci
            ? {
                type: 'fibonacci',
                scaleType: chart.options.scaleType,
                point1: chart.lineStartPoint,
                point2: { x: chart.snapPoint.x, y: chart.snapPoint.y },
            }
            : chart.isDrawingLine
            ? {
                type: 'finite',
                scaleType: chart.options.scaleType,
                start: chart.lineStartPoint,
                end: { x: chart.snapPoint.x, y: chart.snapPoint.y },
            }
            : {
                type: 'infinite',
                scaleType: chart.options.scaleType,
                point1: chart.lineStartPoint,
                point2: { x: chart.snapPoint.x, y: chart.snapPoint.y },
            };
        if (chart.isDrawingFibonacci) {
            renderFibonacci(ctx, previewLine, true, chart, chartWidth, chartHeight, slotWidth);
        }

        const points = chart.isDrawingFibonacci ? [] : getLinePoints(chart, previewLine, width, chartHeight, candleWidth, spacing, 64);
        if (points.length >= 2) {
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.setLineDash([]);
        }

        const startX = chart.lineStartPoint.x * slotWidth + chart.view.offsetX;
        const startY = priceToY(chart.lineStartPoint.y, chartHeight, chart.view, chart.options.scaleType);
        if (startX >= 0 && startX <= chartWidth && startY >= 0 && startY <= chartHeight) {
            ctx.beginPath();
            ctx.arc(startX, startY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }

    if (snapX >= 0 && snapX <= chartWidth && snapY >= 0 && snapY <= chartHeight) {
        const radius = chart.snapPoint.source === 'ohlc' ? 5 : 4;
        ctx.beginPath();
        ctx.arc(snapX, snapY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (chart.snapPoint.source === 'ohlc') {
            ctx.beginPath();
            ctx.arc(snapX, snapY, radius + 3, 0, Math.PI * 2);
            ctx.globalAlpha = 0.18;
            ctx.fillStyle = '#2962ff';
            ctx.fill();
        }
    }

    ctx.restore();
}
