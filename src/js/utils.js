export const AXIS_MARGIN = 74;
export const TIME_AXIS_HEIGHT = 34;
export const LABEL_MARGIN = 30;
export const CANDLE_SPACING = 2;
export const PRICE_STEPS = 5;

export function parseDateUTC(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    return isNaN(date.getTime()) ? null : date;
}

export function toISODate(date) {
    return date.toISOString().split('T')[0];
}

export function addMonthsClamped(date, monthDelta) {
    const targetMonth = date.getUTCMonth() + monthDelta;
    const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const daysInTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    const targetDay = Math.min(date.getUTCDate(), daysInTargetMonth);
    return new Date(Date.UTC(targetYear, normalizedMonth, targetDay));
}

export function generateMonthTicks(startDateStr, endDateStr) {
    const startDate = parseDateUTC(startDateStr);
    const endDate = parseDateUTC(endDateStr);
    if (!startDate || !endDate || startDate > endDate) return [];

    const ticks = [];
    let cursor = new Date(startDate.getTime());
    while (cursor <= endDate) {
        ticks.push(toISODate(cursor));
        const next = addMonthsClamped(cursor, 1);
        if (next.getTime() === cursor.getTime()) break;
        cursor = next;
    }

    const endISO = toISODate(endDate);
    if (ticks[ticks.length - 1] !== endISO) {
        ticks.push(endISO);
    }

    return ticks;
}

export function distanceToLineSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

export function getLineParameters(line, scaleType = 'linear') {
    if (!line) {
        console.warn('Invalid line for parameters:', line);
        return { m: 0, b: 0 };
    }
    let x1, y1, x2, y2;
    if (line.type === 'infinite') {
        x1 = line.point1?.x ?? 0;
        y1 = line.point1?.y ?? 0;
        x2 = line.point2?.x ?? 0;
        y2 = line.point2?.y ?? 0;
    } else {
        x1 = line.start?.x ?? 0;
        y1 = line.start?.y ?? 0;
        x2 = line.end?.x ?? 0;
        y2 = line.end?.y ?? 0;
    }
    let m, b;
    const dx = x2 - x1;
    const lineScaleType = line.scaleType || scaleType;
    if (Math.abs(dx) < 0.0001) {
        m = Infinity;
        b = x1;
    } else if (lineScaleType === 'logarithmic') {
        const logY1 = Math.log10(Math.max(y1, 1e-10));
        const logY2 = Math.log10(Math.max(y2, 1e-10));
        m = (logY2 - logY1) / dx;
        b = logY1 - m * x1;
    } else {
        m = (y2 - y1) / dx;
        b = y1 - m * x1;
    }
    return { m, b };
}

export function getDrawingPointX(chart, point, candleWidth = null, spacing = null) {
    if (!point) return 0;
    if (!point.time || !chart?.getIndexForDate) return point.x ?? 0;

    const date = parseDateUTC(point.time);
    const index = chart.getIndexForDate(date);
    if (!Number.isFinite(index) || index < 0) return point.x ?? 0;

    const resolvedCandleWidth = candleWidth ?? chart.getCandleWidth?.() ?? 0;
    const resolvedSpacing = spacing ?? chart.getBarSpacing?.() ?? CANDLE_SPACING;
    const slotWidth = resolvedCandleWidth + resolvedSpacing;
    const centerOffset = slotWidth > 0 ? resolvedCandleWidth / 2 / slotWidth : 0;
    return index + centerOffset;
}

export function getLinePoints(chart, line, width, height, candleWidth, spacing, numPoints) {
    if (!chart || !chart.view || !chart.dataManager || !line) {
        console.error('Invalid arguments for getLinePoints:', { chart, line });
        return [];
    }
    const points = [];
    let xMin, xMax;
    const slotWidth = candleWidth + spacing;
    const chartWidth = width - AXIS_MARGIN;
    const startX = getDrawingPointX(chart, line.start, candleWidth, spacing);
    const endX = getDrawingPointX(chart, line.end, candleWidth, spacing);
    const point1X = getDrawingPointX(chart, line.point1, candleWidth, spacing);
    const point2X = getDrawingPointX(chart, line.point2, candleWidth, spacing);
    const lineForMath = line.type === 'infinite'
        ? {
            ...line,
            point1: line.point1 ? { ...line.point1, x: point1X } : line.point1,
            point2: line.point2 ? { ...line.point2, x: point2X } : line.point2,
        }
        : {
            ...line,
            start: line.start ? { ...line.start, x: startX } : line.start,
            end: line.end ? { ...line.end, x: endX } : line.end,
        };
    if (line.type === 'infinite') {
        xMin = (-chart.view.offsetX / slotWidth) - 2;
        xMax = ((chartWidth - chart.view.offsetX) / slotWidth) + 2;
    } else {
        xMin = Math.min(startX, endX);
        xMax = Math.max(startX, endX);
    }
    const lineScaleType = line.scaleType || chart.options.scaleType;
    const { m, b } = getLineParameters(lineForMath, lineScaleType);
    const dx = xMax === xMin ? 0.0001 : (xMax - xMin) / (numPoints - 1);

    if (m === Infinity) {
        const x = b;
        const canvasX = x * (candleWidth + spacing) + chart.view.offsetX;
        if (canvasX >= -candleWidth && canvasX <= width - AXIS_MARGIN) {
            points.push({ x: canvasX, y: 0 });
            points.push({ x: canvasX, y: height });
        }
    } else {
        for (let i = 0; i < numPoints; i++) {
            const x = xMin + i * dx;
            let price;
            if (lineScaleType === 'logarithmic') {
                price = Math.pow(10, m * x + b);
            } else {
                price = m * x + b;
            }
            const canvasX = x * (candleWidth + spacing) + chart.view.offsetX;
            const canvasY = priceToY(price, height, chart.view, chart.options.scaleType);
            if (canvasX >= -candleWidth && canvasX <= width - AXIS_MARGIN && isFinite(canvasY)) {
                points.push({ x: canvasX, y: canvasY });
            }
        }
    }
    return points;
}

export function priceToY(price, height, view, scaleType) {
    if (scaleType === 'logarithmic') {
        const logPrice = Math.log10(Math.max(price, 1e-10));
        const logRange = Math.max(view.maxLogPrice - view.minLogPrice, 1e-10);
        const normalized = (logPrice - view.minLogPrice) / logRange;
        return height - normalized * height * view.scaleY + view.offsetY;
    } else {
        const priceRange = Math.max(view.maxPrice - view.minPrice, 1e-10);
        const normalized = (price - view.minPrice) / priceRange;
        return height - normalized * height * view.scaleY + view.offsetY;
    }
}

export function yToPrice(y, height, view, scaleType) {
    const normalizedY = (height - (y - view.offsetY)) / (height * view.scaleY);
    if (scaleType === 'logarithmic') {
        const logRange = Math.max(view.maxLogPrice - view.minLogPrice, 1e-10);
        const logPrice = view.minLogPrice + normalizedY * logRange;
        return Math.max(Math.pow(10, logPrice), 1e-10);
    } else {
        const priceRange = Math.max(view.maxPrice - view.minPrice, 1e-10);
        return view.minPrice + normalizedY * priceRange;
    }
}

export function formatDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
}

export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
