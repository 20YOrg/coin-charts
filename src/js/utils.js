export const AXIS_MARGIN = 90;
export const LABEL_MARGIN = 30;
export const CANDLE_SPACING = 2;
export const PRICE_STEPS = 5;

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

export function getLineParameters(line) {
    if (!line || !line.scaleType) {
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
    if (Math.abs(dx) < 0.0001) {
        m = Infinity;
        b = x1;
    } else if (line.scaleType === 'logarithmic') {
        const logY1 = Math.log10(Math.max(y1, 1e-10));
        const logY2 = Math.log10(Math.max(y2, 1e-10));
        m = (logY2 - logY1) / dx;
        b = logY1 - m * x1;
    } else {
        m = (y2 - y1) / dx;
        b = y1 - m * x1;
    }
    console.log('Line parameters:', { m, b, line });
    return { m, b };
}

export function getLinePoints(chart, line, width, height, candleWidth, spacing, numPoints) {
    if (!chart || !chart.view || !chart.dataManager || !line) {
        console.error('Invalid arguments for getLinePoints:', { chart, line });
        return [];
    }
    const points = [];
    let xMin, xMax;
    if (line.type === 'infinite') {
        xMin = Math.max(0, -chart.view.offsetX / (candleWidth + spacing) - 10);
        // Extend far into the future (1000 candles beyond visible range)
        xMax = (width - AXIS_MARGIN - chart.view.offsetX) / (candleWidth + spacing) + 1000;
    } else {
        xMin = Math.min(line.start?.x ?? 0, line.end?.x ?? 0);
        xMax = Math.max(line.start?.x ?? 0, line.end?.x ?? 0);
    }
    const { m, b } = getLineParameters(line);
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
            if (line.scaleType === 'logarithmic') {
                price = Math.pow(10, m * x + b);
            } else {
                price = m * x + b;
            }
            price = Math.max(price, 1e-10);
            const canvasX = x * (candleWidth + spacing) + chart.view.offsetX;
            const canvasY = priceToY(price, height, chart.view, chart.options.scaleType);
            if (canvasX >= -candleWidth && canvasX <= width - AXIS_MARGIN && isFinite(canvasY)) {
                points.push({ x: canvasX, y: canvasY });
            }
        }
    }
    console.log('Line points:', { line, points });
    return points;
}

export function priceToY(price, height, view, scaleType) {
    price = Math.max(price, 1e-10);
    if (scaleType === 'logarithmic') {
        const logPrice = Math.log10(price);
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
        return Math.max(view.minPrice + normalizedY * priceRange, 1e-10);
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

export function generateFutureDate(data, targetIndex) {
    if (!data || data.length === 0) return '';
    const lastCandle = data[data.length - 1];
    const secondLastCandle = data[data.length - 2] || lastCandle;
    const lastDate = new Date(lastCandle.time);
    if (isNaN(lastDate.getTime())) return '';
    const timeDiffMs = new Date(lastCandle.time) - new Date(secondLastCandle.time) || 24 * 60 * 60 * 1000; // Default to 1 day
    const daysIntoFuture = (targetIndex - (data.length - 1)) * (timeDiffMs / (24 * 60 * 60 * 1000));
    const futureDate = new Date(lastDate);
    futureDate.setDate(lastDate.getDate() + Math.round(daysIntoFuture));
    return futureDate.toISOString().split('T')[0];
}