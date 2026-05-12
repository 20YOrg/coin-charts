import { DataManager } from './data-manager.js';
import { initEvents } from './events.js';
import { renderGrid, renderCandles, renderCrosshair, renderCrosshairAxisLabels, renderDrawingFeedback, renderLines } from './rendering.js';
import { renderIndicators } from './indicators.js';
import { priceToY, yToPrice, formatDate, parseDateUTC, toISODate, addMonthsClamped, generateMonthTicks, AXIS_MARGIN, TIME_AXIS_HEIGHT, CANDLE_SPACING } from './utils.js';

const DRAWINGS_STORAGE_KEY = 'coin-charts:btc-usd:drawings:v1';

function isValidDrawingPoint(point) {
    return point
        && Number.isFinite(point.x)
        && Number.isFinite(point.y);
}

function sanitizeDrawingPoint(point) {
    if (!isValidDrawingPoint(point)) return null;
    return {
        x: point.x,
        y: point.y,
        ...(typeof point.time === 'string' ? { time: point.time } : {}),
    };
}

function sanitizeDrawing(line) {
    if (!line || typeof line !== 'object') return null;
    const base = {
        type: line.type,
        scaleType: line.scaleType === 'logarithmic' ? 'logarithmic' : 'linear',
        color: typeof line.color === 'string' ? line.color : '#2962ff',
        width: Number.isFinite(line.width) ? line.width : 2,
        style: ['solid', 'dashed', 'dotted'].includes(line.style) ? line.style : 'solid',
        text: typeof line.text === 'string' ? line.text : '',
        textColor: typeof line.textColor === 'string' ? line.textColor : '#131722',
        textBold: Boolean(line.textBold),
        textSize: Number.isFinite(line.textSize) ? Math.min(32, Math.max(8, line.textSize)) : 12,
        textOffsetX: Number.isFinite(line.textOffsetX) ? Math.max(-240, Math.min(240, line.textOffsetX)) : 0,
        textOffsetY: Number.isFinite(line.textOffsetY) ? Math.max(-180, Math.min(180, line.textOffsetY)) : 0,
        locked: Boolean(line.locked),
    };

    if (line.type === 'finite' && isValidDrawingPoint(line.start) && isValidDrawingPoint(line.end)) {
        return { ...base, start: sanitizeDrawingPoint(line.start), end: sanitizeDrawingPoint(line.end) };
    }

    if ((line.type === 'infinite' || line.type === 'fibonacci' || line.type === 'measure') && isValidDrawingPoint(line.point1) && isValidDrawingPoint(line.point2)) {
        return { ...base, point1: sanitizeDrawingPoint(line.point1), point2: sanitizeDrawingPoint(line.point2) };
    }

    if ((line.type === 'horizontal' || line.type === 'vertical') && isValidDrawingPoint(line.point1)) {
        return { ...base, point1: sanitizeDrawingPoint(line.point1) };
    }

    return null;
}

export class Chart {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dataManager = new DataManager(this);
        this.options = {
            candleWidth: options.candleWidth || 10,
            upColor: options.upColor || '#F08852',
            downColor: options.downColor || '#6D96E7',
            background: options.background || '#FFFFFF',
            axisColor: options.axisColor || '#000000',
            scaleType: options.scaleType || 'linear',
            gridColor: options.gridColor || '#F3F3F3',
        };
        this.view = {
            offsetX: 0,
            scaleX: 1,
            scaleY: 1,
            offsetY: 0,
            minPrice: 0,
            maxPrice: 100,
            minLogPrice: 0,
            maxLogPrice: 2,
            autoScaleY: true,
            timeRange: null,
            priceStep: null,
        };
        this.isDragging = false;
        this.isResizingY = false;
        this.isResizingX = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.crosshair = null;
        this.showCrosshair = true;
        this.movingAverages = [
            { enabled: true, period: 7, color: '#0000FF' },   // 7-day MA
            { enabled: true, period: 30, color: '#FF0000' },  // 30-day MA
            { enabled: true, period: 365, color: '#00FF00' }, // 365-day MA
        ];
        this.isDrawingLine = false;
        this.isDrawingInfiniteLine = false;
        this.isDrawingHorizontalLine = false;
        this.isDrawingVerticalLine = false;
        this.isDrawingFibonacci = false;
        this.isDrawingMeasure = false;
        this.lineStartPoint = null;
        this.snapPoint = null;
        this.lines = [];
        this.selectedLineIndex = -1;
        this.hoveredLineIndex = -1;
        this.isMovingLine = false;
        this.activeLineHandle = null;
        this.drawingHistory = [];
        this.drawingDragSnapshot = null;
        this.drawingDragChanged = false;
        this.renderQueued = false;
        this.inertiaFrame = null;
        this.dragVelocityX = 0;
        this.dragVelocityY = 0;
        this.lastDragTime = 0;
        this.drawingsReady = false;

        this.resize();
        this.dataManager.setData(options.data || []);
        this.loadDrawings();
        initEvents(this);
        this.scrollToLatest();
        this.render();
    }

    loadDrawings() {
        try {
            const raw = localStorage.getItem(DRAWINGS_STORAGE_KEY);
            if (!raw) {
                this.drawingsReady = true;
                return;
            }
            const saved = JSON.parse(raw);
            if (!Array.isArray(saved)) {
                this.drawingsReady = true;
                return;
            }
            this.lines = saved.map(sanitizeDrawing).filter(Boolean);
            this.lines.forEach(line => this.ensureDrawingTimes(line));
            this.selectedLineIndex = -1;
            this.hoveredLineIndex = -1;
        } catch (error) {
            console.warn('Unable to load drawings', error);
        } finally {
            this.drawingsReady = true;
        }
    }

    ensurePointTime(point) {
        if (!point || point.time) return;
        const slotWidth = this.getSlotWidth();
        const centerOffset = slotWidth > 0 ? this.getCandleWidth() / 2 / slotWidth : 0;
        const date = this.getDateForIndex(Math.round(point.x - centerOffset));
        if (date) point.time = toISODate(date);
    }

    ensureDrawingTimes(line) {
        if (!line) return;
        if (line.type === 'finite') {
            this.ensurePointTime(line.start);
            this.ensurePointTime(line.end);
        } else if (line.type === 'horizontal' || line.type === 'vertical') {
            this.ensurePointTime(line.point1);
        } else {
            this.ensurePointTime(line.point1);
            this.ensurePointTime(line.point2);
        }
    }

    saveDrawings() {
        if (!this.drawingsReady) return;
        try {
            this.lines.forEach(line => this.ensureDrawingTimes(line));
            const drawings = this.lines.map(sanitizeDrawing).filter(Boolean);
            localStorage.setItem(DRAWINGS_STORAGE_KEY, JSON.stringify(drawings));
        } catch (error) {
            console.warn('Unable to save drawings', error);
        }
    }

    updateScaleRanges(minPrice, maxPrice) {
        let safeMinPrice = Number.isFinite(minPrice) ? minPrice : 0;
        let safeMaxPrice = Number.isFinite(maxPrice) ? maxPrice : safeMinPrice + 1;

        if (this.options.scaleType === 'logarithmic') {
            safeMinPrice = Math.max(safeMinPrice, 1e-10);
            safeMaxPrice = Math.max(safeMaxPrice, safeMinPrice + 1e-10);
        } else if (safeMaxPrice <= safeMinPrice) {
            const padding = Math.max(Math.abs(safeMinPrice) * 0.05, 1);
            safeMinPrice -= padding;
            safeMaxPrice += padding;
        }

        const logMinPrice = Math.max(safeMinPrice, 1e-10);
        const logMaxPrice = Math.max(safeMaxPrice, logMinPrice + 1e-10);
        this.view.minPrice = safeMinPrice;
        this.view.maxPrice = safeMaxPrice;
        this.view.minLogPrice = Math.log10(logMinPrice);
        this.view.maxLogPrice = Math.log10(logMaxPrice);
        this.view.scaleY = 1;
        this.view.offsetY = 0;
    }

    setAutoScaleY(enabled) {
        this.view.autoScaleY = enabled;
        if (enabled) {
            this.view.scaleY = 1;
            this.view.offsetY = 0;
        }
    }

    scrollToLatest() {
        const width = this.canvas.offsetWidth;
        const chartWidth = width - AXIS_MARGIN;
        const lastIndex = this.dataManager.data.length - 1;
        this.view.offsetX = chartWidth - (lastIndex * this.getSlotWidth()) - this.getCandleWidth();
        this.clampOffsetX();
    }

    setCandleInterval(interval) {
        const previousTimeRange = this.view.timeRange ? { ...this.view.timeRange } : null;
        const changed = this.dataManager.setInterval(interval);
        if (!changed) return false;

        this.setAutoScaleY(true);
        this.view.priceStep = null;

        if (previousTimeRange) {
            const startIndex = this.getIndexAtOrAfter(previousTimeRange.startDate);
            const endIndex = this.getIndexAtOrBefore(previousTimeRange.endDate);
            if (this.setVisibleIndexRange(startIndex, endIndex)) {
                this.view.timeRange = previousTimeRange;
                this.render();
                return true;
            }
        }

        this.scrollToLatest();
        this.render();
        return true;
    }

    zoomTimeAt(anchorX, zoomFactor) {
        const oldSlotWidth = this.getSlotWidth();
        const chartX = (anchorX - this.view.offsetX) / oldSlotWidth;
        this.view.scaleX = Math.min(80, Math.max(0.0008, this.view.scaleX * zoomFactor));
        const newSlotWidth = this.getSlotWidth();
        this.view.offsetX = anchorX - chartX * newSlotWidth;
        this.clearTimeRange();
    }

    zoomPriceAt(mouseY, chartHeight, zoomFactor) {
        const anchorPrice = yToPrice(mouseY, chartHeight, this.view, this.options.scaleType);
        this.setAutoScaleY(false);

        if (this.options.scaleType === 'logarithmic') {
            const anchorLog = Math.log10(anchorPrice);
            const minDistance = anchorLog - this.view.minLogPrice;
            const maxDistance = this.view.maxLogPrice - anchorLog;
            this.updateScaleRanges(
                Math.pow(10, anchorLog - minDistance / zoomFactor),
                Math.pow(10, anchorLog + maxDistance / zoomFactor)
            );
        } else {
            const minDistance = anchorPrice - this.view.minPrice;
            const maxDistance = this.view.maxPrice - anchorPrice;
            this.updateScaleRanges(
                anchorPrice - minDistance / zoomFactor,
                anchorPrice + maxDistance / zoomFactor
            );
        }
    }

    panPriceByPixels(deltaY, chartHeight) {
        if (!deltaY) return;
        this.setAutoScaleY(false);

        if (this.options.scaleType === 'logarithmic') {
            const logAtTop = Math.log10(yToPrice(0, chartHeight, this.view, this.options.scaleType));
            const logAtDelta = Math.log10(yToPrice(deltaY, chartHeight, this.view, this.options.scaleType));
            const logShift = logAtTop - logAtDelta;
            this.updateScaleRanges(
                Math.pow(10, this.view.minLogPrice + logShift),
                Math.pow(10, this.view.maxLogPrice + logShift)
            );
        } else {
            const priceShift = yToPrice(0, chartHeight, this.view, this.options.scaleType)
                - yToPrice(deltaY, chartHeight, this.view, this.options.scaleType);
            this.updateScaleRanges(
                this.view.minPrice + priceShift,
                this.view.maxPrice + priceShift
            );
        }
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.offsetWidth * dpr;
        this.canvas.height = this.canvas.offsetHeight * dpr;
        this.ctx.scale(dpr, dpr);
        const width = this.canvas.offsetWidth;
        const lastIndex = this.dataManager.data.length - 1;
        if (this.view.timeRange) {
            const startIndex = this.getIndexAtOrAfter(this.view.timeRange.startDate);
            const endIndex = this.getIndexAtOrBefore(this.view.timeRange.endDate);
            this.setVisibleIndexRange(startIndex, endIndex);
        } else {
            this.clampOffsetX();
        }
        this.render();
    }

    getHorizontalBounds() {
        const width = this.canvas.offsetWidth;
        const chartWidth = width - AXIS_MARGIN;
        const lastIndex = this.dataManager.data.length - 1;
        const candleWidth = this.getCandleWidth();
        const slotWidth = this.getSlotWidth();
        const contentWidth = lastIndex * slotWidth + candleWidth;

        if (!this.dataManager.data.length) {
            return { minOffsetX: 0, maxOffsetX: 0 };
        }

        if (contentWidth <= chartWidth) {
            const offsetX = chartWidth - contentWidth;
            return { minOffsetX: offsetX, maxOffsetX: offsetX };
        }

        return {
            minOffsetX: chartWidth - contentWidth,
            maxOffsetX: 0,
        };
    }

    clampOffsetX() {
        const { minOffsetX, maxOffsetX } = this.getHorizontalBounds();
        this.view.offsetX = Math.min(maxOffsetX, Math.max(minOffsetX, this.view.offsetX));
    }

    getCandleWidth(scaleX = this.view.scaleX) {
        return Math.max(0.08, this.options.candleWidth * scaleX);
    }

    getBarSpacing(scaleX = this.view.scaleX) {
        return scaleX >= 1 ? CANDLE_SPACING : Math.max(0.02, CANDLE_SPACING * scaleX);
    }

    getSlotWidth(scaleX = this.view.scaleX) {
        return this.getCandleWidth(scaleX) + this.getBarSpacing(scaleX);
    }

    getIndexAtOrAfter(dateStr) {
        const target = parseDateUTC(dateStr);
        if (!target) return -1;
        return this.dataManager.data.findIndex(candle => {
            const candleDate = parseDateUTC(candle.time);
            return candleDate && candleDate >= target;
        });
    }

    getIndexAtOrBefore(dateStr) {
        const target = parseDateUTC(dateStr);
        if (!target) return -1;
        for (let i = this.dataManager.data.length - 1; i >= 0; i--) {
            const candleDate = parseDateUTC(this.dataManager.data[i].time);
            if (candleDate && candleDate <= target) return i;
        }
        return -1;
    }

    getNearestIndex(dateStr) {
        const target = parseDateUTC(dateStr);
        if (!target || !this.dataManager.data.length) return -1;

        let nearestIndex = -1;
        let nearestDistance = Infinity;
        this.dataManager.data.forEach((candle, index) => {
            const candleDate = parseDateUTC(candle.time);
            if (!candleDate) return;
            const distance = Math.abs(candleDate.getTime() - target.getTime());
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        });
        return nearestIndex;
    }

    setVisibleIndexRange(startIndex, endIndex) {
        if (startIndex < 0 || endIndex < startIndex) return false;

        const width = this.canvas.offsetWidth;
        const availableWidth = Math.max(1, width - AXIS_MARGIN - 24);
        const candleCount = Math.max(1, endIndex - startIndex + 1);
        const slotWidth = Math.max(0.02, availableWidth / candleCount);

        this.view.scaleX = Math.max(0.0008, slotWidth / (this.options.candleWidth + CANDLE_SPACING));
        const actualSlotWidth = this.getSlotWidth();
        this.view.offsetX = 12 - startIndex * actualSlotWidth;
        this.view.offsetY = 0;
        this.setAutoScaleY(true);
        this.clampOffsetX();
        return true;
    }

    setMonthRange(months, anchorDateStr) {
        const anchorDate = parseDateUTC(anchorDateStr);
        if (!anchorDate || months < 1) return false;

        const startDate = addMonthsClamped(anchorDate, -months);
        const startDateStr = toISODate(startDate);
        const endDateStr = toISODate(anchorDate);
        const startIndex = this.getIndexAtOrAfter(startDateStr);
        const endIndex = this.getIndexAtOrBefore(endDateStr);

        if (!this.setVisibleIndexRange(startIndex, endIndex)) return false;

        this.view.timeRange = {
            startDate: startDateStr,
            endDate: endDateStr,
            tickDates: generateMonthTicks(startDateStr, endDateStr),
        };
        this.render();
        return true;
    }

    setDateRange(startDateStr, endDateStr, tickDates = null) {
        const startIndex = this.getIndexAtOrAfter(startDateStr);
        const endIndex = this.getIndexAtOrBefore(endDateStr);
        if (!this.setVisibleIndexRange(startIndex, endIndex)) return false;

        this.view.timeRange = tickDates ? {
            startDate: startDateStr,
            endDate: endDateStr,
            tickDates,
        } : null;
        this.render();
        return true;
    }

    setAllRange() {
        if (!this.dataManager.data.length) return false;
        const startDate = this.dataManager.data[0].time;
        const endDate = this.dataManager.data[this.dataManager.data.length - 1].time;
        return this.setDateRange(startDate, endDate);
    }

    setQuickRange(rangeKey) {
        if (!this.dataManager.data.length) return false;
        const endDateStr = this.dataManager.data[this.dataManager.data.length - 1].time;
        const endDate = parseDateUTC(endDateStr);
        if (!endDate) return false;

        if (rangeKey === 'ALL') {
            return this.setAllRange();
        }

        let startDate;
        let tickDates = null;
        switch (rangeKey) {
            case '1D':
                startDate = new Date(endDate.getTime());
                break;
            case '5D':
                startDate = new Date(endDate.getTime());
                startDate.setUTCDate(startDate.getUTCDate() - 5);
                break;
            case '1M':
                startDate = addMonthsClamped(endDate, -1);
                break;
            case '3M':
                startDate = addMonthsClamped(endDate, -3);
                break;
            case '6M':
                startDate = addMonthsClamped(endDate, -6);
                break;
            case 'YTD':
                startDate = new Date(Date.UTC(endDate.getUTCFullYear(), 0, 1));
                break;
            case '1Y':
                startDate = addMonthsClamped(endDate, -12);
                break;
            case '5Y':
                startDate = addMonthsClamped(endDate, -60);
                break;
            default:
                return false;
        }

        const startDateStr = toISODate(startDate);
        if (['1M', '3M', '6M', '1Y', '5Y'].includes(rangeKey)) {
            tickDates = generateMonthTicks(startDateStr, endDateStr);
        }

        return this.setDateRange(startDateStr, endDateStr, tickDates);
    }

    clearTimeRange() {
        this.view.timeRange = null;
    }

    requestRender() {
        if (this.renderQueued) return;
        this.renderQueued = true;
        requestAnimationFrame(() => {
            this.renderQueued = false;
            this.render();
        });
    }

    formatPriceLabel(price) {
        const absPrice = Math.abs(price);
        if (absPrice >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
        if (absPrice >= 1) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
        return price.toLocaleString('en-US', { maximumFractionDigits: 6 });
    }

    isCompactViewport() {
        return this.canvas.offsetWidth <= 720;
    }

    getNicePriceStep(range, chartHeight) {
        const targetSpacing = this.isCompactViewport() ? 72 : 44;
        const targetTickCount = Math.max(2, Math.floor(chartHeight / targetSpacing));
        const rawStep = range / targetTickCount;
        const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(rawStep, 1e-10))));
        const normalized = rawStep / magnitude;

        if (normalized <= 1) return magnitude;
        if (normalized <= 2) return 2 * magnitude;
        if (normalized <= 5) return 5 * magnitude;
        return 10 * magnitude;
    }

    getStablePriceStep(range, chartHeight) {
        const targetSpacing = this.isCompactViewport() ? 72 : 44;
        const targetTickCount = Math.max(2, Math.floor(chartHeight / targetSpacing));
        const currentStep = this.view.priceStep;
        if (currentStep) {
            const currentTickCount = range / currentStep;
            if (currentTickCount >= targetTickCount * 0.65 && currentTickCount <= targetTickCount * 1.45) {
                return currentStep;
            }
        }

        const nextStep = this.getNicePriceStep(range, chartHeight);
        this.view.priceStep = nextStep;
        return nextStep;
    }

    getLogPriceTicks(chartHeight) {
        const minPrice = Math.max(this.view.minPrice, 1e-10);
        const maxPrice = Math.max(this.view.maxPrice, minPrice * 1.0001);
        const logSpan = Math.log10(maxPrice) - Math.log10(minPrice);
        const ticks = [];

        if (logSpan < 0.35) {
            const step = this.getNicePriceStep(maxPrice - minPrice, chartHeight);
            const minTick = Math.ceil(minPrice / step) * step;
            for (let price = minTick; price <= maxPrice + step * 0.5; price += step) {
                const y = priceToY(price, chartHeight, this.view, this.options.scaleType);
                if (y >= -1 && y <= chartHeight + 1) {
                    ticks.push({ price, y, label: this.formatPriceLabel(price) });
                }
            }
            return ticks;
        }

        const minPower = Math.floor(Math.log10(minPrice));
        const maxPower = Math.ceil(Math.log10(maxPrice));
        const multipliers = [1, 2, 5];

        for (let power = minPower; power <= maxPower; power++) {
            multipliers.forEach((multiplier) => {
                const price = multiplier * Math.pow(10, power);
                if (price < minPrice || price > maxPrice) return;
                const y = priceToY(price, chartHeight, this.view, this.options.scaleType);
                if (y >= -1 && y <= chartHeight + 1) {
                    ticks.push({ price, y, label: this.formatPriceLabel(price) });
                }
            });
        }

        return ticks;
    }

    getPriceTicks(chartHeight) {
        if (this.options.scaleType === 'logarithmic') {
            return this.getLogPriceTicks(chartHeight);
        }

        const priceRange = Math.max(this.view.maxPrice - this.view.minPrice, 1e-10);
        const step = this.getStablePriceStep(priceRange, chartHeight);
        const minTick = Math.ceil(this.view.minPrice / step) * step;
        const ticks = [];

        for (let price = minTick; price <= this.view.maxPrice + step * 0.5; price += step) {
            const y = priceToY(price, chartHeight, this.view, this.options.scaleType);
            if (y >= -1 && y <= chartHeight + 1) {
                ticks.push({ price, y, label: this.formatPriceLabel(price) });
            }
        }

        return ticks;
    }

    getNearestIndexForDate(date) {
        let nearestIndex = -1;
        let nearestDistance = Infinity;

        this.dataManager.data.forEach((candle, index) => {
            const candleDate = parseDateUTC(candle.time);
            if (!candleDate) return;
            const distance = Math.abs(candleDate.getTime() - date.getTime());
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        });

        return nearestIndex;
    }

    getIntervalSpec() {
        const match = this.dataManager.interval.match(/^(\d+)(D|W|M)$/);
        if (!match) return { amount: 1, unit: 'D' };
        return { amount: Number.parseInt(match[1], 10), unit: match[2] };
    }

    getDateForIndex(index) {
        const data = this.dataManager.data;
        if (!data.length) return null;

        const { amount, unit } = this.getIntervalSpec();
        const anchorDate = parseDateUTC(data[0].time);
        if (!anchorDate) return null;

        if (unit === 'M') {
            return addMonthsClamped(anchorDate, index * amount);
        }

        const dayMultiplier = unit === 'W' ? 7 : 1;
        const nextDate = new Date(anchorDate.getTime());
        nextDate.setUTCDate(nextDate.getUTCDate() + index * amount * dayMultiplier);
        return nextDate;
    }

    getIndexForDate(date) {
        const data = this.dataManager.data;
        if (!date || !data.length) return -1;

        const firstDate = parseDateUTC(data[0].time);
        if (!firstDate) return -1;

        const { amount, unit } = this.getIntervalSpec();
        if (unit === 'M') {
            const monthDelta = (date.getUTCFullYear() - firstDate.getUTCFullYear()) * 12
                + date.getUTCMonth()
                - firstDate.getUTCMonth();
            return Math.round(monthDelta / amount);
        }

        const dayMultiplier = unit === 'W' ? 7 : 1;
        const intervalMs = amount * dayMultiplier * 86400000;
        return Math.round((date - firstDate) / intervalMs);
    }

    getCalendarTimeTicks(startIndex, endIndex, candleWidth, spacing, chartWidth) {
        const axisStartIndex = Math.max(0, startIndex);
        if (endIndex <= axisStartIndex) return [];

        const startDate = this.getDateForIndex(axisStartIndex);
        const endDate = this.getDateForIndex(endIndex - 1);
        if (!startDate || !endDate) return [];

        const ticks = [];
        let lastTickMonthKey = null;
        const addTick = (date, label, emphasis = false) => {
            const index = this.getIndexForDate(date);
            if (index < axisStartIndex || index >= endIndex) return;
            const x = index * (candleWidth + spacing) + this.view.offsetX;
            if (x < 0 || x > chartWidth) return;
            ticks.push({ x, label, emphasis });
        };

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formatDayLabel = (date) => {
            if (date.getUTCDate() === 1) return monthNames[date.getUTCMonth()];
            return String(date.getUTCDate());
        };
        const spanDays = Math.max(1, (endDate - startDate) / 86400000);
        const monthSpan = Math.max(
            1,
            (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12
                + endDate.getUTCMonth()
                - startDate.getUTCMonth()
                + 1
        );
        const minTimeLabelSpacing = this.isCompactViewport() ? 84 : 64;
        const maxTimeTicks = Math.max(2, Math.floor(chartWidth / minTimeLabelSpacing));

        if (spanDays > 120) {
            const monthIntervals = spanDays > 365 * 3
                ? [3, 6, 12, 24, 60]
                : [1, 2, 3, 6, 12];
            const monthInterval = monthIntervals.find(interval => Math.ceil(monthSpan / interval) <= maxTimeTicks) || 60;
            const startMonthIndex = startDate.getUTCFullYear() * 12 + startDate.getUTCMonth();
            const endMonthIndex = endDate.getUTCFullYear() * 12 + endDate.getUTCMonth();
            const firstTickMonth = Math.floor(startMonthIndex / monthInterval) * monthInterval;

            for (let monthIndex = firstTickMonth; monthIndex <= endMonthIndex + monthInterval; monthIndex += monthInterval) {
                const year = Math.floor(monthIndex / 12);
                const month = monthIndex % 12;
                const date = new Date(Date.UTC(year, month, 1));
                const isYear = month === 0;
                addTick(date, isYear ? String(year) : monthNames[month], isYear);
            }
        } else {
            const dayIntervals = spanDays > 45 ? [7, 14, 30] : [1, 2, 3, 5, 7, 14];
            const dayInterval = dayIntervals.find(interval => Math.ceil(spanDays / interval) <= maxTimeTicks) || 30;
            const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
            const dayRemainder = Math.floor((cursor - new Date(Date.UTC(1970, 0, 1))) / 86400000) % dayInterval;
            cursor.setUTCDate(cursor.getUTCDate() - dayRemainder);
            while (cursor <= endDate) {
                const monthKey = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}`;
                const isNewMonth = monthKey !== lastTickMonthKey;
                const label = isNewMonth ? monthNames[cursor.getUTCMonth()] : formatDayLabel(cursor);
                addTick(new Date(cursor), label, isNewMonth);
                lastTickMonthKey = monthKey;
                cursor.setUTCDate(cursor.getUTCDate() + dayInterval);
            }
        }

        return ticks;
    }

    getTimeTicks(startIndex, endIndex, candleWidth, spacing, chartWidth) {
        const minSpacing = this.isCompactViewport() ? 74 : 54;
        const filterOverlaps = (ticks) => {
            const visible = ticks
                .filter(tick => tick.x >= 8 && tick.x <= chartWidth - 8)
                .sort((a, b) => a.x - b.x);
            const kept = [];
            visible.forEach((tick) => {
                const spacingScale = tick.emphasis ? 0.72 : 1;
                const tooClose = kept.some(existing => Math.abs(existing.x - tick.x) < minSpacing * spacingScale);
                if (!tooClose || tick.emphasis) {
                    for (let i = kept.length - 1; i >= 0; i--) {
                        if (tick.emphasis && !kept[i].emphasis && Math.abs(kept[i].x - tick.x) < minSpacing * spacingScale) {
                            kept.splice(i, 1);
                        }
                    }
                    kept.push(tick);
                    kept.sort((a, b) => a.x - b.x);
                }
            });
            return kept;
        };

        if (this.view.timeRange?.tickDates?.length) {
            return filterOverlaps(this.view.timeRange.tickDates.map((dateStr) => {
                const index = this.getIndexForDate(parseDateUTC(dateStr));
                const x = index * (candleWidth + spacing) + this.view.offsetX;
                return { x, label: formatDate(dateStr), emphasis: false };
            }).filter(({ x }, index) => {
                const dateIndex = this.getIndexForDate(parseDateUTC(this.view.timeRange.tickDates[index]));
                return dateIndex >= 0 && x >= 0 && x <= chartWidth;
            }));
        }

        return filterOverlaps(this.getCalendarTimeTicks(startIndex, endIndex, candleWidth, spacing, chartWidth));
    }

    getDrawablePriceTicks(priceTicks, chartHeight) {
        const minSpacing = this.isCompactViewport() ? 34 : 24;
        const sorted = [...priceTicks].sort((a, b) => a.y - b.y);
        const drawable = [];
        sorted.forEach((tick) => {
            if (tick.y < 14 || tick.y > chartHeight - 14) return;
            const last = drawable[drawable.length - 1];
            if (last && tick.y - last.y < minSpacing) return;
            drawable.push(tick);
        });
        return drawable;
    }

    renderLastPriceMarker(chartWidth, chartHeight) {
        const lastCandle = this.dataManager.data[this.dataManager.data.length - 1];
        if (!lastCandle) return;

        const y = priceToY(lastCandle.close, chartHeight, this.view, this.options.scaleType);
        if (y < 0 || y > chartHeight) return;

        const label = this.formatPriceLabel(lastCandle.close);
        const labelHeight = 24;
        const labelWidth = Math.max(70, this.ctx.measureText(label).width + 18);
        const markerY = Math.round(Math.max(1, Math.min(chartHeight - labelHeight - 1, y - labelHeight / 2)));

        this.ctx.save();
        this.ctx.strokeStyle = '#089981';
        this.ctx.setLineDash([1, 3]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, Math.round(y) + 0.5);
        this.ctx.lineTo(chartWidth, Math.round(y) + 0.5);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.fillStyle = '#089981';
        this.ctx.strokeStyle = '#089981';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.roundRect(chartWidth, markerY, labelWidth, labelHeight, 3);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, chartWidth + 8, markerY + labelHeight / 2);
        this.ctx.restore();
    }

    render() {
        this.saveDrawings();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = this.options.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.dataManager.data.length) return;

        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;
        const chartHeight = height - TIME_AXIS_HEIGHT;
        const chartWidth = width - AXIS_MARGIN;
        const candleWidth = this.getCandleWidth();
        const spacing = this.getBarSpacing();

        const visibleStartIndex = Math.floor(-this.view.offsetX / (candleWidth + spacing));
        const visibleEndIndex = Math.ceil((chartWidth - this.view.offsetX) / (candleWidth + spacing));
        const startIndex = Math.max(0, visibleStartIndex);
        const endIndex = Math.min(this.dataManager.data.length, visibleEndIndex);
        const visibleData = this.dataManager.data.slice(startIndex, endIndex);

        // Compute price range for rendering (not labels)
        if (visibleData.length && this.view.autoScaleY) {
            const prices = visibleData.flatMap(d => [d.high, d.low]);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const range = maxPrice - minPrice;
            const topPadding = range * 0.1 || 0.01;
            const bottomPadding = range * 0.22 || 0.01;
            this.updateScaleRanges(minPrice - bottomPadding, maxPrice + topPadding);
        } else {
            if (!this.dataManager.data.length) {
                this.updateScaleRanges(1e-10, 100);
            }
        }

        const priceTicks = this.getPriceTicks(chartHeight);
        const timeTicks = this.getTimeTicks(visibleStartIndex, visibleEndIndex, candleWidth, spacing, chartWidth);
        const isDrawingTool = this.isDrawingLine || this.isDrawingInfiniteLine || this.isDrawingHorizontalLine || this.isDrawingVerticalLine || this.isDrawingFibonacci || this.isDrawingMeasure;

        this.canvas.parentElement?.classList.toggle('drawing-mode', isDrawingTool);
        this.canvas.parentElement?.classList.toggle('line-selected-mode', this.selectedLineIndex !== -1);
        this.canvas.parentElement?.classList.toggle('line-dragging-mode', this.isMovingLine || !!this.activeLineHandle);

        renderGrid(this.ctx, this.options, this.dataManager.data, this.view, width, height, candleWidth, spacing, priceTicks, timeTicks);
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(0, 0, chartWidth, chartHeight);
        this.ctx.clip();
        renderCandles(this.ctx, this.options, this.dataManager.data, this.view, width, height, candleWidth, spacing);
        renderIndicators(this.ctx, this.movingAverages, this.dataManager.data, this.view, width, height, candleWidth, spacing, this.options.scaleType);
        renderLines(this.ctx, this.lines, this.selectedLineIndex, this, width, height, candleWidth, spacing);
        renderDrawingFeedback(this.ctx, this, width, height, candleWidth, spacing);
        renderCrosshair(this.ctx, this.crosshair, this.showCrosshair, isDrawingTool, false, this.options, this.dataManager.data, this.view, width, height, candleWidth, spacing);
        this.ctx.restore();

        this.ctx.fillStyle = this.options.axisColor;
        this.ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';

        this.getDrawablePriceTicks(priceTicks, chartHeight).forEach(({ y, label }) => {
            this.ctx.fillText(label, chartWidth + 8, y);
        });

        const timeAxisCenterY = chartHeight + TIME_AXIS_HEIGHT / 2;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        timeTicks.forEach(({ x, label, emphasis }) => {
            const fontSize = this.isCompactViewport() ? 12 : 13;
            this.ctx.font = `${emphasis ? '600' : '400'} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
            this.ctx.fillText(label, x, timeAxisCenterY);
        });

        this.renderLastPriceMarker(chartWidth, chartHeight);
        renderCrosshairAxisLabels(this.ctx, this.crosshair, this.showCrosshair, isDrawingTool, false, this.options, this.dataManager.data, this.view, width, height, candleWidth, spacing, this);
    }
}
