import { DataManager } from './data-manager.js';
import { initEvents } from './events.js';
import { renderGrid, renderCandles, renderCrosshair, renderCrosshairAxisLabels, renderDrawingFeedback, renderLines, renderLineAxisLabels } from './rendering.js';
import { renderIndicators } from './indicators.js';
import { priceToY, yToPrice, formatDate, parseDateUTC, toISODate, addMonthsClamped, generateMonthTicks, AXIS_MARGIN, TIME_AXIS_HEIGHT, CANDLE_SPACING, normalizeDrawing } from './utils.js';

const DRAWINGS_STORAGE_KEY = 'coin-charts:btc-usd:drawings:v1';
const CHART_THEMES = {
    light: {
        background: '#ffffff',
        axisBackground: '#ffffff',
        axisColor: '#131722',
        gridColor: '#f0f3fa',
        crosshairColor: '#9aa0aa',
        axisLabelBackground: '#131722',
        axisLabelText: '#ffffff',
        handleFill: '#ffffff',
        handleStroke: '#131722',
        upColor: '#089981',
        downColor: '#f23645',
        lastPriceColor: '#089981',
    },
    dark: {
        background: '#0f131a',
        axisBackground: '#0f131a',
        axisColor: '#c7d0df',
        gridColor: '#222a35',
        crosshairColor: '#6f7b8c',
        axisLabelBackground: '#d7e3f5',
        axisLabelText: '#101419',
        handleFill: '#111827',
        handleStroke: '#d7e3f5',
        upColor: '#22ab94',
        downColor: '#f7525f',
        lastPriceColor: '#22ab94',
    },
};

export class Chart {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ohlcInfo = canvas.parentElement?.querySelector('#ohlc-info') || null;
        this.dataManager = new DataManager(this);
        const themeName = CHART_THEMES[options.theme] ? options.theme : 'light';
        const theme = CHART_THEMES[themeName];
        this.options = {
            candleWidth: options.candleWidth || 10,
            theme: themeName,
            upColor: options.upColor || theme.upColor,
            downColor: options.downColor || theme.downColor,
            background: options.background || theme.background,
            axisBackground: options.axisBackground || theme.axisBackground,
            axisColor: options.axisColor || theme.axisColor,
            scaleType: options.scaleType || 'linear',
            gridColor: options.gridColor || theme.gridColor,
            crosshairColor: options.crosshairColor || theme.crosshairColor,
            axisLabelBackground: options.axisLabelBackground || theme.axisLabelBackground,
            axisLabelText: options.axisLabelText || theme.axisLabelText,
            handleFill: options.handleFill || theme.handleFill,
            handleStroke: options.handleStroke || theme.handleStroke,
            lastPriceColor: options.lastPriceColor || theme.lastPriceColor,
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

    setTheme(themeName) {
        const theme = CHART_THEMES[themeName] || CHART_THEMES.light;
        this.options.theme = CHART_THEMES[themeName] ? themeName : 'light';
        this.options.upColor = theme.upColor;
        this.options.downColor = theme.downColor;
        this.options.background = theme.background;
        this.options.axisBackground = theme.axisBackground;
        this.options.axisColor = theme.axisColor;
        this.options.gridColor = theme.gridColor;
        this.options.crosshairColor = theme.crosshairColor;
        this.options.axisLabelBackground = theme.axisLabelBackground;
        this.options.axisLabelText = theme.axisLabelText;
        this.options.handleFill = theme.handleFill;
        this.options.handleStroke = theme.handleStroke;
        this.options.lastPriceColor = theme.lastPriceColor;
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
            this.lines = saved.map(normalizeDrawing).filter(Boolean);
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
            const drawings = this.lines.map(normalizeDrawing).filter(Boolean);
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

    formatOhlcValue(price) {
        if (!Number.isFinite(price)) return '--';
        return Math.abs(price) >= 1000
            ? price.toLocaleString('en-US', { maximumFractionDigits: 0 })
            : price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    createOhlcSpan(className, text) {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        return span;
    }

    updateOhlcInfo(isDrawingTool) {
        if (!this.ohlcInfo) return;
        const candleIndex = Number.isInteger(this.crosshair?.candleIndex) ? this.crosshair.candleIndex : -1;
        const candle = this.dataManager.data[candleIndex];
        if (!this.showCrosshair || !this.crosshair || isDrawingTool || !candle) {
            this.ohlcInfo.hidden = true;
            this.ohlcInfo.replaceChildren();
            return;
        }

        const change = candle.close - candle.open;
        const changePercent = candle.open ? (change / candle.open) * 100 : 0;
        const direction = change >= 0 ? 'up' : 'down';
        const signedChange = `${change >= 0 ? '+' : ''}${this.formatOhlcValue(change)}`;
        const signedPercent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
        const isCompact = this.isCompactViewport();

        this.ohlcInfo.replaceChildren(
            this.createOhlcSpan('ohlc-label', 'O'),
            this.createOhlcSpan(`ohlc-value ${direction}`, this.formatOhlcValue(candle.open)),
            this.createOhlcSpan('ohlc-label', 'H'),
            this.createOhlcSpan(`ohlc-value ${direction}`, this.formatOhlcValue(candle.high)),
            this.createOhlcSpan('ohlc-label', 'L'),
            this.createOhlcSpan(`ohlc-value ${direction}`, this.formatOhlcValue(candle.low)),
            this.createOhlcSpan('ohlc-label', 'C'),
            this.createOhlcSpan(`ohlc-value ${direction}`, this.formatOhlcValue(candle.close)),
            this.createOhlcSpan(`ohlc-change ${direction}`, `${signedChange} (${signedPercent})`),
        );
        this.ohlcInfo.classList.toggle('mobile-box', isCompact);
        if (isCompact) {
            this.ohlcInfo.style.width = 'max-content';
            this.ohlcInfo.style.maxWidth = 'none';
            this.ohlcInfo.style.display = 'flex';
            this.ohlcInfo.style.flexWrap = 'nowrap';
            Array.from(this.ohlcInfo.children).forEach((child) => {
                child.style.flex = '0 0 auto';
                child.style.whiteSpace = 'nowrap';
            });
            const containerWidth = this.canvas.parentElement?.clientWidth || this.canvas.offsetWidth;
            const clampedX = Math.max(10, Math.min(containerWidth - 10, this.crosshair.x));
            this.ohlcInfo.style.left = `${clampedX}px`;
        } else {
            this.ohlcInfo.style.left = '';
            this.ohlcInfo.style.width = '';
            this.ohlcInfo.style.maxWidth = '';
            this.ohlcInfo.style.display = '';
            this.ohlcInfo.style.flexWrap = '';
        }
        this.ohlcInfo.hidden = false;
        if (isCompact) {
            const containerWidth = this.canvas.parentElement?.clientWidth || this.canvas.offsetWidth;
            const halfWidth = this.ohlcInfo.offsetWidth / 2;
            const clampedX = Math.max(halfWidth + 10, Math.min(containerWidth - halfWidth - 10, this.crosshair.x));
            this.ohlcInfo.style.left = `${clampedX}px`;
        }
    }

    isCompactViewport() {
        const viewportWidth = window.innerWidth || this.canvas.offsetWidth;
        return Math.min(this.canvas.offsetWidth, viewportWidth) <= 720;
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
        this.ctx.strokeStyle = this.options.lastPriceColor;
        this.ctx.setLineDash([1, 3]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, Math.round(y) + 0.5);
        this.ctx.lineTo(chartWidth, Math.round(y) + 0.5);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.fillStyle = this.options.lastPriceColor;
        this.ctx.strokeStyle = this.options.lastPriceColor;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.roundRect(chartWidth, markerY, labelWidth, labelHeight, 3);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = this.options.axisLabelText;
        this.ctx.font = '400 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, chartWidth + 8, markerY + labelHeight / 2);
        this.ctx.restore();
    }

    getVisibleHighLowMarkers(startIndex, endIndex, chartHeight, chartWidth, candleWidth, spacing) {
        let highMarker = null;
        let lowMarker = null;
        const slotWidth = candleWidth + spacing;

        for (let index = startIndex; index < endIndex; index++) {
            const candle = this.dataManager.data[index];
            if (!candle) continue;

            if (!highMarker || candle.high > highMarker.price) {
                highMarker = { index, price: candle.high };
            }
            if (!lowMarker || candle.low < lowMarker.price) {
                lowMarker = { index, price: candle.low };
            }
        }

        return [highMarker, lowMarker].filter(Boolean).map((marker) => ({
            ...marker,
            x: marker.index * slotWidth + this.view.offsetX + candleWidth / 2,
            y: priceToY(marker.price, chartHeight, this.view, this.options.scaleType),
            label: this.formatPriceLabel(marker.price),
        })).filter(({ x, y }) => x >= 0 && x <= chartWidth && y >= 0 && y <= chartHeight);
    }

    renderHighLowMarkers(startIndex, endIndex, chartHeight, chartWidth, candleWidth, spacing) {
        const markers = this.getVisibleHighLowMarkers(startIndex, endIndex, chartHeight, chartWidth, candleWidth, spacing);
        if (!markers.length) return;

        this.ctx.save();
        this.ctx.strokeStyle = this.options.axisColor;
        this.ctx.fillStyle = this.options.axisColor;
        this.ctx.lineWidth = 1.5;
        this.ctx.font = '400 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.textBaseline = 'middle';

        markers.forEach(({ x, y, label }) => {
            const labelWidth = this.ctx.measureText(label).width;
            const gap = 6;
            const lineLength = 34;
            const canDrawLeft = x - lineLength - gap - labelWidth >= 6;
            const labelOnLeft = canDrawLeft || x + lineLength + gap + labelWidth > chartWidth - 6;
            const lineStartX = labelOnLeft ? x - lineLength : x;
            const lineEndX = labelOnLeft ? x : x + lineLength;
            const labelX = labelOnLeft ? lineStartX - gap : lineEndX + gap;

            this.ctx.beginPath();
            this.ctx.moveTo(Math.round(lineStartX) + 0.5, Math.round(y) + 0.5);
            this.ctx.lineTo(Math.round(lineEndX) + 0.5, Math.round(y) + 0.5);
            this.ctx.stroke();

            this.ctx.textAlign = labelOnLeft ? 'right' : 'left';
            this.ctx.fillText(label, labelX, y);
        });

        this.ctx.restore();
    }

    render() {
        this.saveDrawings();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = this.options.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.dataManager.data.length) {
            this.updateOhlcInfo(false);
            return;
        }

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
            if (this.options.scaleType === 'logarithmic') {
                const safeMinPrice = Math.max(minPrice, 1e-10);
                const safeMaxPrice = Math.max(maxPrice, safeMinPrice * 1.0001);
                const minLogPrice = Math.log10(safeMinPrice);
                const maxLogPrice = Math.log10(safeMaxPrice);
                const logRange = Math.max(maxLogPrice - minLogPrice, 1e-4);
                const topPadding = Math.min(logRange * 0.1, 0.12);
                const bottomPadding = Math.min(logRange * 0.22, 0.18);
                this.updateScaleRanges(
                    Math.pow(10, minLogPrice - bottomPadding),
                    Math.pow(10, maxLogPrice + topPadding)
                );
            } else {
                const range = maxPrice - minPrice;
                const topPadding = range * 0.1 || 0.01;
                const bottomPadding = range * 0.22 || 0.01;
                this.updateScaleRanges(minPrice - bottomPadding, maxPrice + topPadding);
            }
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
        this.renderHighLowMarkers(startIndex, endIndex, chartHeight, chartWidth, candleWidth, spacing);
        renderLines(this.ctx, this.lines, this.selectedLineIndex, this, width, height, candleWidth, spacing);
        renderDrawingFeedback(this.ctx, this, width, height, candleWidth, spacing);
        renderCrosshair(this.ctx, this.crosshair, this.showCrosshair, isDrawingTool, false, this.options, this.dataManager.data, this.view, width, height, candleWidth, spacing);
        this.ctx.restore();

        this.ctx.fillStyle = this.options.axisColor;
        this.ctx.font = '400 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';

        this.getDrawablePriceTicks(priceTicks, chartHeight).forEach(({ y, label }) => {
            this.ctx.fillText(label, chartWidth + 8, y);
        });

        const timeAxisCenterY = chartHeight + TIME_AXIS_HEIGHT / 2;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        timeTicks.forEach(({ x, label, emphasis }) => {
            const fontSize = this.isCompactViewport() ? 11 : 12;
            this.ctx.font = `${emphasis ? '700' : '400'} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
            this.ctx.fillText(label, x, timeAxisCenterY);
        });

        this.renderLastPriceMarker(chartWidth, chartHeight);
        renderLineAxisLabels(this.ctx, this.lines, this, width, height, candleWidth, spacing);
        renderCrosshairAxisLabels(this.ctx, this.crosshair, this.showCrosshair, isDrawingTool, false, this.options, this.dataManager.data, this.view, width, height, candleWidth, spacing, this);
        this.updateOhlcInfo(isDrawingTool);
    }
}
