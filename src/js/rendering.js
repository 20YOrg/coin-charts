import { priceToY, yToPrice, formatDate, toISODate, getLinePoints, getDrawingPointX, AXIS_MARGIN, TIME_AXIS_HEIGHT, CANDLE_SPACING } from './utils.js';

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

function formatMeasureValue(value, chart) {
    if (chart?.formatPrice) return chart.formatPrice(value, formatMeasureValue);
    const abs = Math.abs(value);
    return abs >= 1000
        ? value.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatAxisPrice(price, chart) {
    if (chart?.formatPrice) return chart.formatPrice(price, formatAxisPrice);
    return Math.abs(price) >= 1000
        ? price.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : price.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatTradingViewDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const day = date.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'UTC' });
    const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const year = date.toLocaleDateString('en-US', { year: '2-digit', timeZone: 'UTC' });
    return `${weekday} ${day} ${month} '${year}`;
}

function getDateForChartX(chart, x, slotWidth) {
    if (!chart?.getDateForIndex || !Number.isFinite(x) || !Number.isFinite(slotWidth) || slotWidth <= 0) return null;
    const candleWidth = chart.getCandleWidth?.() ?? 0;
    const centerOffset = candleWidth / 2 / slotWidth;
    const pointX = (x - chart.view.offsetX) / slotWidth;
    const index = Math.round(pointX - centerOffset);
    return chart.getDateForIndex(index);
}

function drawPriceAxisLabel(ctx, price, y, chartWidth, chartHeight, chart) {
    if (!Number.isFinite(price) || !Number.isFinite(y) || y < 0 || y > chartHeight) return;
    const labelHeight = 24;
    const labelY = Math.round(Math.max(1, Math.min(chartHeight - labelHeight - 1, y - labelHeight / 2)));

    ctx.save();
    ctx.fillStyle = ctx.chartOptions?.axisLabelBackground || '#131722';
    ctx.fillRect(chartWidth, labelY, AXIS_MARGIN, labelHeight);
    ctx.fillStyle = ctx.chartOptions?.axisLabelText || '#ffffff';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatAxisPrice(price, chart), chartWidth + 8, labelY + labelHeight / 2);
    ctx.restore();
}

function drawTimeAxisLabel(ctx, date, x, chartWidth, chartHeight) {
    if (!Number.isFinite(x) || x < 0 || x > chartWidth) return;
    const label = formatTradingViewDate(date);
    if (!label) return;
    const labelHeight = 24;
    const timeAxisCenterY = chartHeight + TIME_AXIS_HEIGHT / 2;

    ctx.save();
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const labelWidth = Math.max(104, ctx.measureText(label).width + 18);
    const labelX = Math.round(Math.max(1, Math.min(chartWidth - labelWidth - 1, x - labelWidth / 2)));
    ctx.fillStyle = ctx.chartOptions?.axisLabelBackground || '#131722';
    ctx.fillRect(labelX, timeAxisCenterY - labelHeight / 2, labelWidth, labelHeight);
    ctx.fillStyle = ctx.chartOptions?.axisLabelText || '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, labelX + labelWidth / 2, timeAxisCenterY);
    ctx.restore();
}

function renderMeasure(ctx, line, isSelected, chart, chartWidth, chartHeight, slotWidth) {
    const point1 = line.point1;
    const point2 = line.point2;
    if (!point1 || !point2) return;

    const x1 = getDrawingPointX(chart, point1) * slotWidth + chart.view.offsetX;
    const x2 = getDrawingPointX(chart, point2) * slotWidth + chart.view.offsetX;
    const y1 = priceToY(point1.y, chartHeight, chart.view, chart.options.scaleType);
    const y2 = priceToY(point2.y, chartHeight, chart.view, chart.options.scaleType);
    if (![x1, x2, y1, y2].every(Number.isFinite)) return;

    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);
    const delta = point2.y - point1.y;
    const percent = point1.y ? (delta / point1.y) * 100 : 0;
    const bars = Math.round(Math.abs(getDrawingPointX(chart, point2) - getDrawingPointX(chart, point1)));
    const date1 = point1.time ? new Date(`${point1.time}T00:00:00Z`) : null;
    const date2 = point2.time ? new Date(`${point2.time}T00:00:00Z`) : null;
    const days = date1 && date2 ? Math.round(Math.abs(date2 - date1) / 86400000) : bars;
    const label = `${formatMeasureValue(delta, chart)} (${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%)  ${bars} bars, ${days}d`;

    ctx.save();
    const isPositive = delta >= 0;
    const color = isPositive ? '#089981' : '#ff4d5f';
    const fillColor = isPositive ? 'rgba(8, 153, 129, 0.16)' : 'rgba(255, 77, 95, 0.17)';
    const frameColor = isPositive ? 'rgba(8, 153, 129, 0.62)' : 'rgba(255, 77, 95, 0.62)';
    const isHovered = chart.hoveredLineIndex === chart.lines.indexOf(line);
    const rectLeft = Math.max(0, left);
    const rectRight = Math.min(chartWidth, right);
    const rectTop = Math.max(0, top);
    const rectBottom = Math.min(chartHeight, bottom);
    const rectWidth = Math.max(1, rectRight - rectLeft);
    const rectHeight = Math.max(1, rectBottom - rectTop);
    const measureX = rectLeft + rectWidth / 2;
    const measureY = rectTop + rectHeight / 2;

    ctx.fillStyle = fillColor;
    ctx.fillRect(rectLeft, rectTop, rectWidth, rectHeight);

    if (isSelected || isHovered) {
        ctx.strokeStyle = frameColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(Math.round(rectLeft) + 0.5, Math.round(rectTop) + 0.5, rectWidth, rectHeight);
        ctx.setLineDash([]);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(measureX) + 0.5, rectTop);
    ctx.lineTo(Math.round(measureX) + 0.5, rectBottom);
    ctx.moveTo(rectLeft, Math.round(measureY) + 0.5);
    ctx.lineTo(rectRight, Math.round(measureY) + 0.5);
    ctx.stroke();

    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const labelWidth = ctx.measureText(label).width + 16;
    const labelHeight = 24;
    const labelX = Math.max(4, Math.min(chartWidth - labelWidth - 4, (x1 + x2) / 2 - labelWidth / 2));
    const labelY = Math.max(4, Math.min(chartHeight - labelHeight - 4, top - labelHeight - 8));
    ctx.fillStyle = chart.options.axisLabelBackground;
    ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
    ctx.fillStyle = chart.options.axisLabelText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, labelX + labelWidth / 2, labelY + labelHeight / 2);

    if (isSelected) {
        ctx.fillStyle = chart.options.handleFill;
        ctx.strokeStyle = chart.options.handleStroke;
        ctx.lineWidth = 2;
        [point1, point2].forEach((point) => {
            const x = getDrawingPointX(chart, point) * slotWidth + chart.view.offsetX;
            const y = priceToY(point.y, chartHeight, chart.view, chart.options.scaleType);
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
    }
    ctx.restore();
}

function applyLineStyle(ctx, line) {
    ctx.strokeStyle = line.color || '#2962ff';
    ctx.lineWidth = line.width || 2;
    if (line.style === 'dashed') ctx.setLineDash([8, 5]);
    if (line.style === 'dotted') ctx.setLineDash([2, 5]);
}

function strokeInteractionHalo(ctx, color, lineWidth, isStrong = false) {
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth + (isStrong ? 9 : 6);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
}

function drawStepBadge(ctx, x, y, label, color = '#2962ff') {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 0.5);
    ctx.restore();
}

function drawTinyStatusLabel(ctx, x, y, text, chartWidth, chartHeight) {
    ctx.save();
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const width = ctx.measureText(text).width + 12;
    const left = Math.max(4, Math.min(chartWidth - width - 4, x + 12));
    const top = Math.max(4, Math.min(chartHeight - 22, y - 34));
    ctx.fillStyle = 'rgba(19, 23, 34, 0.86)';
    ctx.beginPath();
    ctx.roundRect(left, top, width, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, left + width / 2, top + 10);
    ctx.restore();
}

function drawEditingCaret(ctx, label, textSize) {
    const blinkOn = Math.floor(performance.now() / 530) % 2 === 0;
    if (!blinkOn) return;
    const textWidth = ctx.measureText(label).width;
    const x = label ? textWidth / 2 + 2 : 2;
    const baselineY = -Math.max(8, textSize * 0.65);
    const topY = baselineY - textSize - 2;
    const bottomY = baselineY + 3;
    ctx.save();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ctx.chartOptions?.handleStroke || '#131722';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, bottomY);
    ctx.stroke();
    ctx.restore();
}

function renderAxisLine(ctx, line, isSelected, chart, chartWidth, chartHeight, slotWidth) {
    const point = line.point1;
    if (!point) return;
    let labelPoint = null;
    let handlePoint = null;
    const lineIndex = chart.lines.indexOf(line);
    const isHovered = lineIndex === chart.hoveredLineIndex;
    const isDragging = isSelected && (chart.isMovingLine || chart.activeLineHandle);
    ctx.save();
    applyLineStyle(ctx, line);
    ctx.beginPath();
    if (line.type === 'horizontal') {
        const y = priceToY(point.y, chartHeight, chart.view, chart.options.scaleType);
        if (!Number.isFinite(y)) {
            ctx.restore();
            return;
        }
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(chartWidth, Math.round(y) + 0.5);
        const x = Math.max(10, Math.min(chartWidth - 10, getDrawingPointX(chart, point) * slotWidth + chart.view.offsetX));
        labelPoint = { x: x + (line.textOffsetX || 0), y: y + (line.textOffsetY || 0), angle: 0 };
        handlePoint = { x, y };
    } else {
        const x = getDrawingPointX(chart, point) * slotWidth + chart.view.offsetX;
        if (!Number.isFinite(x)) {
            ctx.restore();
            return;
        }
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, chartHeight);
        const y = Math.max(10, Math.min(chartHeight - 10, priceToY(point.y, chartHeight, chart.view, chart.options.scaleType)));
        labelPoint = { x: x + (line.textOffsetX || 0), y: y + (line.textOffsetY || 0), angle: -Math.PI / 2 };
        handlePoint = { x, y };
    }
            const isTouchPulse = lineIndex === chart.selectedLineIndex && chart.touchDragFeedbackUntil && performance.now() < chart.touchDragFeedbackUntil;
            if (isSelected || isHovered || isTouchPulse) {
                strokeInteractionHalo(ctx, (isDragging || isTouchPulse) ? 'rgba(41, 98, 255, 0.24)' : 'rgba(41, 98, 255, 0.13)', line.width || 2, isDragging || isTouchPulse);
            }
    ctx.stroke();
    ctx.setLineDash([]);
    if (isSelected && handlePoint) {
        ctx.fillStyle = chart.options.handleFill;
        ctx.strokeStyle = chart.options.handleStroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(handlePoint.x, handlePoint.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
    const showText = labelPoint
        && (line.text || lineIndex === chart.hoveredLineIndex || lineIndex === chart.editingLineTextIndex);
    if (showText) {
        const label = line.text || (lineIndex === chart.editingLineTextIndex ? '' : '+ Add text');
        const textSize = line.textSize || 12;
        ctx.save();
        ctx.translate(labelPoint.x, labelPoint.y);
        ctx.rotate(labelPoint.angle);
        ctx.fillStyle = line.text ? (line.textColor || chart.options.axisColor) : '#6fcad7';
        ctx.font = `${line.textBold ? '700' : '400'} ${textSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, 0, -Math.max(8, textSize * 0.65));
        if (lineIndex === chart.editingLineTextIndex) {
            drawEditingCaret(ctx, line.text || '', textSize);
        }
        ctx.restore();
    }
    ctx.restore();
}

function renderFibonacci(ctx, line, isSelected, chart, chartWidth, chartHeight, slotWidth) {
    const point1 = line.point1;
    const point2 = line.point2;
    if (!point1 || !point2) return;

    const x1 = getDrawingPointX(chart, point1) * slotWidth + chart.view.offsetX;
    const x2 = getDrawingPointX(chart, point2) * slotWidth + chart.view.offsetX;
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

        const label = `${level.label}  ${chart.formatPrice(price, formatFibPrice)}`;
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
        ctx.strokeStyle = chart.options.handleStroke;
        ctx.fillStyle = chart.options.handleFill;
        ctx.lineWidth = 2;
        [point1, point2].forEach((point) => {
            const x = getDrawingPointX(chart, point) * slotWidth + chart.view.offsetX;
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

    ctx.fillStyle = options.axisBackground;
    ctx.fillRect(chartWidth, 0, AXIS_MARGIN, chartHeight);
    ctx.fillRect(0, chartHeight, width, TIME_AXIS_HEIGHT);

    ctx.strokeStyle = options.gridColor;
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

    ctx.setLineDash([]);
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

    ctx.strokeStyle = options.crosshairColor;
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
    if (!Number.isFinite(y) || y < 0 || y > chartHeight) return;
    const price = yToPrice(y, chartHeight, view, options.scaleType);
    const candleIndex = Number.isInteger(crosshair.candleIndex)
        ? crosshair.candleIndex
        : Math.round((x - view.offsetX - candleWidth / 2) / (candleWidth + spacing));
    if (candleIndex < 0) return;

    const priceText = formatAxisPrice(price, chart);
    const labelHeight = 24;
    const labelWidth = AXIS_MARGIN;
    const labelY = Math.round(Math.max(1, Math.min(chartHeight - labelHeight - 1, y - labelHeight / 2)));

    ctx.fillStyle = options.axisLabelBackground;
    ctx.fillRect(chartWidth, labelY, labelWidth, labelHeight);
    ctx.fillStyle = options.axisLabelText;
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
    ctx.fillStyle = options.axisLabelBackground;
    ctx.fillRect(timeX, timeAxisCenterY - labelHeight / 2, timeWidth, labelHeight);
    ctx.fillStyle = options.axisLabelText;
    ctx.textAlign = 'center';
    ctx.fillText(timeText, timeX + timeWidth / 2, timeAxisCenterY);
}

export function renderLines(ctx, lines, selectedLineIndex, chart, width, height, candleWidth, spacing) {
    const chartHeight = height - TIME_AXIS_HEIGHT;
    const chartWidth = width - AXIS_MARGIN;
    const slotWidth = candleWidth + spacing;
    ctx.chartOptions = chart.options;

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
            if (line.type === 'measure') {
                renderMeasure(ctx, line, isSelected, chart, chartWidth, chartHeight, slotWidth);
                return;
            }
            if (line.type === 'horizontal' || line.type === 'vertical') {
                renderAxisLine(ctx, line, isSelected, chart, chartWidth, chartHeight, slotWidth);
                return;
            }
            const points = getLinePoints(chart, line, width, chartHeight, candleWidth, spacing, 50);
            if (!points || points.length < 2) {
                console.warn('No valid points for line:', line);
                return;
            }
            const isHovered = index === chart.hoveredLineIndex;
            const isDragging = isSelected && (chart.isMovingLine || chart.activeLineHandle);
            const isTouchPulse = index === chart.selectedLineIndex && chart.touchDragFeedbackUntil && performance.now() < chart.touchDragFeedbackUntil;
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
            if (isSelected || isHovered || isTouchPulse) {
                strokeInteractionHalo(ctx, (isDragging || isTouchPulse) ? 'rgba(41, 98, 255, 0.24)' : 'rgba(41, 98, 255, 0.13)', line.width || (isSelected ? 3 : 2), isDragging || isTouchPulse);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            const showLineText = (line.text || index === chart.hoveredLineIndex || index === chart.editingLineTextIndex)
                && points.length >= 2;
            if (showLineText) {
                const midIndex = Math.floor(points.length / 2);
                const midPoint = points[midIndex];
                const prevPoint = points[Math.max(0, midIndex - 1)];
                const nextPoint = points[Math.min(points.length - 1, midIndex + 1)];
                let angle = Math.atan2(nextPoint.y - prevPoint.y, nextPoint.x - prevPoint.x);
                if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
                const label = line.text || (index === chart.editingLineTextIndex ? '' : '+ Add text');
                ctx.save();
                ctx.translate(midPoint.x + (line.textOffsetX || 0), midPoint.y + (line.textOffsetY || 0));
                ctx.rotate(angle);
                ctx.fillStyle = line.text ? (line.textColor || chart.options.axisColor) : '#6fcad7';
                const textSize = line.textSize || 12;
                ctx.font = `${line.textBold ? '700' : '400'} ${textSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(label, 0, -Math.max(8, textSize * 0.65));
                if (index === chart.editingLineTextIndex) {
                    drawEditingCaret(ctx, line.text || '', textSize);
                }
                ctx.restore();
            }

            if (isSelected) {
                const anchors = line.type === 'finite'
                    ? [line.start, line.end]
                    : [line.point1, line.point2];
                ctx.save();
                ctx.fillStyle = chart.options.handleFill;
                ctx.strokeStyle = chart.options.handleStroke;
                ctx.lineWidth = 2;
                anchors.forEach((anchor) => {
                    if (!anchor) return;
                    const x = getDrawingPointX(chart, anchor) * slotWidth + chart.view.offsetX;
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

export function renderLineAxisLabels(ctx, lines, chart, width, height, candleWidth, spacing) {
    const chartHeight = height - TIME_AXIS_HEIGHT;
    const chartWidth = width - AXIS_MARGIN;
    const slotWidth = candleWidth + spacing;
    ctx.chartOptions = chart.options;

    lines.forEach((line) => {
        if (!line?.point1) return;

        if (line.type === 'horizontal') {
            const y = priceToY(line.point1.y, chartHeight, chart.view, chart.options.scaleType);
            drawPriceAxisLabel(ctx, line.point1.y, y, chartWidth, chartHeight, chart);
        } else if (line.type === 'vertical') {
            const x = getDrawingPointX(chart, line.point1) * slotWidth + chart.view.offsetX;
            drawTimeAxisLabel(ctx, getDateForChartX(chart, x, slotWidth), x, chartWidth, chartHeight);
        }
    });

    if (chart.isDrawingVerticalLine && chart.snapPoint) {
        const x = getDrawingPointX(chart, chart.snapPoint, candleWidth, spacing) * slotWidth + chart.view.offsetX;
        drawTimeAxisLabel(ctx, getDateForChartX(chart, x, slotWidth), x, chartWidth, chartHeight);
    }

    if (chart.isDrawingHorizontalLine && chart.snapPoint) {
        const y = priceToY(chart.snapPoint.y, chartHeight, chart.view, chart.options.scaleType);
        drawPriceAxisLabel(ctx, chart.snapPoint.y, y, chartWidth, chartHeight, chart);
    }
}

export function renderDrawingFeedback(ctx, chart, width, height, candleWidth, spacing) {
    if (!chart.snapPoint || (!chart.isDrawingLine && !chart.isDrawingInfiniteLine && !chart.isDrawingHorizontalLine && !chart.isDrawingVerticalLine && !chart.isDrawingFibonacci && !chart.isDrawingMeasure)) return;

    const chartHeight = height - TIME_AXIS_HEIGHT;
    const chartWidth = width - AXIS_MARGIN;
    const slotWidth = candleWidth + spacing;
    ctx.chartOptions = chart.options;
    const snapX = getDrawingPointX(chart, chart.snapPoint, candleWidth, spacing) * slotWidth + chart.view.offsetX;
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
                point2: { ...chart.snapPoint },
            }
            : chart.isDrawingMeasure
            ? {
                type: 'measure',
                scaleType: chart.options.scaleType,
                point1: chart.lineStartPoint,
                point2: { ...chart.snapPoint },
            }
            : chart.isDrawingLine
            ? {
                type: 'finite',
                scaleType: chart.options.scaleType,
                start: chart.lineStartPoint,
                end: { ...chart.snapPoint },
            }
            : {
                type: 'infinite',
                scaleType: chart.options.scaleType,
                point1: chart.lineStartPoint,
                point2: { ...chart.snapPoint },
            };
        if (chart.isDrawingFibonacci) {
            renderFibonacci(ctx, previewLine, true, chart, chartWidth, chartHeight, slotWidth);
        } else if (chart.isDrawingMeasure) {
            renderMeasure(ctx, previewLine, true, chart, chartWidth, chartHeight, slotWidth);
        }

        const points = (chart.isDrawingFibonacci || chart.isDrawingMeasure) ? [] : getLinePoints(chart, previewLine, width, chartHeight, candleWidth, spacing, 64);
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

        const startX = getDrawingPointX(chart, chart.lineStartPoint, candleWidth, spacing) * slotWidth + chart.view.offsetX;
        const startY = priceToY(chart.lineStartPoint.y, chartHeight, chart.view, chart.options.scaleType);
        if (startX >= 0 && startX <= chartWidth && startY >= 0 && startY <= chartHeight) {
            ctx.beginPath();
            ctx.arc(startX, startY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            drawStepBadge(ctx, startX, startY, '1');
        }
        if (snapX >= 0 && snapX <= chartWidth && snapY >= 0 && snapY <= chartHeight) {
            drawStepBadge(ctx, snapX, snapY, '2');
            drawTinyStatusLabel(ctx, snapX, snapY, 'Set second point', chartWidth, chartHeight);
        }
    } else if (!(chart.isDrawingHorizontalLine || chart.isDrawingVerticalLine)) {
        drawTinyStatusLabel(ctx, snapX, snapY, 'Set first point', chartWidth, chartHeight);
    }

    if (chart.isDrawingHorizontalLine || chart.isDrawingVerticalLine) {
        ctx.setLineDash([4, 4]);
        renderAxisLine(ctx, {
            type: chart.isDrawingHorizontalLine ? 'horizontal' : 'vertical',
            scaleType: chart.options.scaleType,
            point1: { ...chart.snapPoint },
            color: '#2962ff',
            width: 2,
            style: 'solid',
        }, true, chart, chartWidth, chartHeight, slotWidth);
        ctx.setLineDash([]);
        drawTinyStatusLabel(ctx, snapX, snapY, chart.isDrawingHorizontalLine ? 'Place horizontal line' : 'Place vertical line', chartWidth, chartHeight);
    }

    if (snapX >= 0 && snapX <= chartWidth && snapY >= 0 && snapY <= chartHeight) {
        const radius = chart.snapPoint.source === 'ohlc' ? 5 : 4;
        if (chart.snapPoint.source === 'ohlc') {
            ctx.save();
            ctx.strokeStyle = 'rgba(41, 98, 255, 0.24)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.moveTo(Math.round(snapX) + 0.5, Math.max(0, snapY - 28));
            ctx.lineTo(Math.round(snapX) + 0.5, Math.min(chartHeight, snapY + 28));
            ctx.moveTo(Math.max(0, snapX - 28), Math.round(snapY) + 0.5);
            ctx.lineTo(Math.min(chartWidth, snapX + 28), Math.round(snapY) + 0.5);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

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
            ctx.globalAlpha = 1;
            ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label = 'OHLC';
            const labelWidth = ctx.measureText(label).width + 12;
            const labelX = Math.max(4, Math.min(chartWidth - labelWidth - 4, snapX + 10));
            const labelY = Math.max(4, Math.min(chartHeight - 22, snapY - 30));
            ctx.fillStyle = 'rgba(41, 98, 255, 0.92)';
            ctx.beginPath();
            ctx.roundRect(labelX, labelY, labelWidth, 20, 4);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, labelX + labelWidth / 2, labelY + 10);
        }
    }

    ctx.restore();
}
