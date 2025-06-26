import { DataManager } from './data-manager.js';
import { initEvents } from './events.js';
import { renderGrid, renderCandles, renderCrosshair, renderLines } from './rendering.js';
import { renderIndicators } from './indicators.js';
import { priceToY, yToPrice, formatDate, AXIS_MARGIN, LABEL_MARGIN, CANDLE_SPACING, PRICE_STEPS } from './utils.js';

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
            minScale: options.minScale || 0.1, // Minimum zoom level
            maxScale: options.maxScale || 10,  // Maximum zoom level
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
        this.lineStartPoint = null;
        this.lines = [];
        this.selectedLineIndex = -1;
        this.isMovingLine = false;

        this.resize();
        initEvents(this);
        this.dataManager.setData(options.data || []);
        const width = this.canvas.offsetWidth;
        const lastIndex = this.dataManager.data.length - 1;
        this.view.offsetX = (width - AXIS_MARGIN - 20) - (lastIndex * (this.options.candleWidth * this.view.scaleX + CANDLE_SPACING));
        this.render();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.offsetWidth * dpr;
        this.canvas.height = this.canvas.offsetHeight * dpr;
        this.ctx.scale(dpr, dpr);
        const width = this.canvas.offsetWidth;
        const lastIndex = this.dataManager.data.length - 1;
        this.view.scaleX = Math.max(this.options.minScale, Math.min(this.options.maxScale, this.view.scaleX));
        this.view.offsetX = (width - AXIS_MARGIN - 20) - (lastIndex * (this.options.candleWidth * this.view.scaleX + CANDLE_SPACING));
        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = this.options.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.dataManager.data.length) return;

        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;
        const chartHeight = height - AXIS_MARGIN;
        const candleWidth = this.options.candleWidth * this.view.scaleX;
        const spacing = CANDLE_SPACING;

        const startIndex = Math.max(0, Math.floor(-this.view.offsetX / (candleWidth + spacing)));
        const endIndex = Math.min(this.dataManager.data.length, Math.ceil((width - AXIS_MARGIN - this.view.offsetX) / (candleWidth + spacing)));
        const visibleData = this.dataManager.data.slice(startIndex, endIndex);

        // Compute price range for rendering (not labels)
        let minPrice = Infinity, maxPrice = -Infinity;
        if (visibleData.length) {
            const prices = visibleData.flatMap(d => [d.high, d.low]);
            minPrice = Math.min(...prices);
            maxPrice = Math.max(...prices);
            const padding = (maxPrice - minPrice) * 0.1 || 0.01;
            this.view.minPrice = Math.max(minPrice - padding, 1e-10);
            this.view.maxPrice = maxPrice + padding;
            this.view.minLogPrice = Math.log10(this.view.minPrice);
            this.view.maxLogPrice = Math.log10(this.view.maxPrice);
        } else {
            this.view.minPrice = 0;
            this.view.maxPrice = 100;
            this.view.minLogPrice = 0;
            this.view.maxLogPrice = 2;
        }

        renderGrid(this.ctx, this.options, this.dataManager.data, this.view, width, height, candleWidth, spacing);
        renderCandles(this.ctx, this.options, this.dataManager.data, this.view, width, height, candleWidth, spacing);
        renderIndicators(this.ctx, this.movingAverages, this.dataManager.data, this.view, width, height, candleWidth, spacing, this.options.scaleType);
        renderLines(this.ctx, this.lines, this.selectedLineIndex, this, width, height, candleWidth, spacing);
        renderCrosshair(this.ctx, this.crosshair, this.showCrosshair, this.isDrawingLine, this.isDrawingInfiniteLine, this.options, this.dataManager.data, this.view, width, height, candleWidth, spacing);

        // Render price axis labels (spaced ~75px, round numbers including < 1)
        this.ctx.fillStyle = this.options.axisColor;
        this.ctx.font = '12px Arial';
        const priceRange = this.view.maxPrice - this.view.minPrice;
        const targetPixelSpacing = 75; // Desired pixel spacing between labels
        // Estimate price interval for ~75px spacing
        const testPrice = this.view.minPrice + 1; // Use 1 or a small increment
        const testY = priceToY(this.view.minPrice, chartHeight, this.view, this.options.scaleType);
        const testY2 = priceToY(testPrice, chartHeight, this.view, this.options.scaleType);
        const pixelsPerPrice = Math.abs(testY - testY2) / Math.abs(testPrice - this.view.minPrice);
        let roundInterval = targetPixelSpacing / pixelsPerPrice;
        // Round to nearest round number (including fractions)
        const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(roundInterval, 1e-10))));
        const normalized = roundInterval / magnitude;
        if (normalized > 5) roundInterval = 10 * magnitude;
        else if (normalized > 2) roundInterval = 5 * magnitude;
        else if (normalized > 1) roundInterval = 2 * magnitude;
        else roundInterval = magnitude;
        // Determine decimal places for display
        const decimals = roundInterval < 1 ? Math.max(0, -Math.floor(Math.log10(roundInterval))) : 0;
        const basePrice = Math.floor(this.view.minPrice / roundInterval) * roundInterval;
        const maxPriceBound = this.view.maxPrice + roundInterval * 2; // Extend slightly beyond maxPrice
        for (let price = basePrice; price <= maxPriceBound; price += roundInterval) {
            if (price < 0) continue;
            const y = priceToY(price, chartHeight, this.view, this.options.scaleType);
            if (y >= -20 && y <= chartHeight + 20) {
                this.ctx.fillText(price.toFixed(decimals), width - 75, y + 4);
            }
        }

        // Render time axis labels
        const labelInterval = Math.max(1, Math.floor(150 / (candleWidth + spacing)));
        this.dataManager.data.forEach((candle, i) => {
            if (i % labelInterval === 0) {
                const x = (i * (candleWidth + spacing) + this.view.offsetX);
                if (x >= 0 && x <= width - AXIS_MARGIN) {
                    this.ctx.fillText(formatDate(candle.time), x + 20, chartHeight + 10);
                }
            }
        });
    }
}