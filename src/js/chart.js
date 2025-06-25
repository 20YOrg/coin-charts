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
        };
        this.view = {
            offsetX: 0,
            scaleX: 1,
            scaleY: 1,
            offsetY: 0,
            minPrice: 0,
            maxPrice: 100,
            minLogPrice: 0,
            maxLogPrice: 0,
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
        this.view.offsetX = (width - AXIS_MARGIN - 20) - (lastIndex * (this.options.candleWidth * this.view.scaleX + CANDLE_SPACING));
        this.render();
    }

    calculatePriceRange() {
        if (!this.dataManager.data.length) return;
        const prices = this.dataManager.data.flatMap(d => [d.high, d.low]);
        const dataMinPrice = Math.min(...prices);
        const dataMaxPrice = Math.max(...prices);
        const padding = (dataMaxPrice - dataMinPrice) * 0.1;
        if (this.view.minPrice === 0 && this.view.maxPrice === 100) {
            this.view.minPrice = Math.max(dataMinPrice - padding, 0.01);
            this.view.maxPrice = dataMaxPrice + padding;
            this.view.minLogPrice = Math.log10(this.view.minPrice);
            this.view.maxLogPrice = Math.log10(this.view.maxPrice);
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = this.options.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.dataManager.data.length) return;

        this.calculatePriceRange();
        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;
        const chartHeight = height - AXIS_MARGIN;
        const candleWidth = this.options.candleWidth * this.view.scaleX;
        const spacing = CANDLE_SPACING;

        renderGrid(this.ctx, this.options, this.dataManager.data, this.view, width, height, candleWidth, spacing);
        renderCandles(this.ctx, this.options, this.dataManager.data, this.view, width, height, candleWidth, spacing);
        renderIndicators(this.ctx, this.movingAverages, this.dataManager.data, this.view, width, height, candleWidth, spacing, this.options.scaleType);
        renderLines(this.ctx, this.lines, this.selectedLineIndex, this, width, height, candleWidth, spacing);
        renderCrosshair(this.ctx, this.crosshair, this.showCrosshair, this.isDrawingLine, this.isDrawingInfiniteLine, this.options, this.dataManager.data, this.view, width, height, candleWidth, spacing);

        // Render axis labels
        this.ctx.fillStyle = this.options.axisColor;
        this.ctx.font = '12px Arial';
        for (let i = 0; i <= PRICE_STEPS; i++) {
            const y = LABEL_MARGIN + ((chartHeight - 2 * LABEL_MARGIN) * i) / PRICE_STEPS;
            const price = this.view.minPrice + (i / PRICE_STEPS) * (this.view.maxPrice - this.view.minPrice);
            this.ctx.fillText(price.toFixed(2), width - 75, chartHeight - y + 4);
        }

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