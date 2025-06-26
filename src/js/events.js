import { openMAModal } from './modal.js';
import { getLinePoints, distanceToLineSegment, priceToY, yToPrice, AXIS_MARGIN, CANDLE_SPACING } from './utils.js';

export function initEvents(chart) {
    const { canvas, options, view, dataManager, lines } = chart;

    console.log('Initializing chart events');

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        const chartHeight = height - AXIS_MARGIN;

        if (mouseX <= width - AXIS_MARGIN && mouseY <= chartHeight) {
            const deltaX = -e.deltaY * 0.5;
            const zoomFactor = 1 - deltaX * 0.002;
            const oldScaleX = view.scaleX;
            const oldCandleWidth = options.candleWidth * oldScaleX;
            const oldSpacing = CANDLE_SPACING;
            const lastIndex = dataManager.data.length - 1;
            const currentX = (lastIndex * (oldCandleWidth + oldSpacing) + view.offsetX) + oldCandleWidth / 2;

            view.scaleX *= zoomFactor;
            view.scaleX = Math.max(options.minScale, Math.min(options.maxScale, view.scaleX));
            const newCandleWidth = options.candleWidth * view.scaleX;
            const newSpacing = CANDLE_SPACING;
            view.offsetX = currentX - newCandleWidth / 2 - lastIndex * (newCandleWidth + newSpacing);

            chart.render();
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        console.log('Mouse down event', { isDrawingLine: chart.isDrawingLine, isDrawingInfiniteLine: chart.isDrawingInfiniteLine });
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight - AXIS_MARGIN;

        if (mouseX > width - AXIS_MARGIN) {
            chart.isResizingY = true;
            chart.lastMouseY = mouseY;
            canvas.style.cursor = 'ns-resize';
            console.log('Resizing Y axis');
            return;
        } else if (mouseY > height) {
            chart.isResizingX = true;
            chart.lastMouseX = mouseX;
            canvas.style.cursor = 'ew-resize';
            console.log('Resizing X axis');
            return;
        }

        if (mouseX <= width - AXIS_MARGIN && mouseY <= height) {
            const candleWidth = options.candleWidth * view.scaleX;
            const spacing = CANDLE_SPACING;
            let minDistance = Infinity;
            let closestLineIndex = -1;
            lines.forEach((line, index) => {
                if (!line || (!line.start && !line.point1)) return;
                const points = getLinePoints(chart, line, width, height, candleWidth, spacing, 50);
                for (let i = 0; i < points.length - 1; i++) {
                    const x1 = points[i].x;
                    const y1 = points[i].y;
                    const x2 = points[i + 1].x;
                    const y2 = points[i + 1].y;
                    const distance = distanceToLineSegment(mouseX, mouseY, x1, y1, x2, y2);
                    if (distance < minDistance && distance < 5) {
                        minDistance = distance;
                        closestLineIndex = index;
                    }
                }
            });

            if (closestLineIndex !== -1 && !chart.isDrawingLine && !chart.isDrawingInfiniteLine) {
                chart.selectedLineIndex = closestLineIndex;
                chart.isMovingLine = true;
                chart.lastMouseX = mouseX;
                chart.lastMouseY = mouseY;
                canvas.style.cursor = 'pointer';
                console.log('Selected line:', lines[closestLineIndex], 'Index:', closestLineIndex);
                chart.render();
                return;
            }

            if (chart.isDrawingLine || chart.isDrawingInfiniteLine) {
                const chartX = (mouseX - view.offsetX) / (options.candleWidth * view.scaleX + CANDLE_SPACING);
                const chartY = yToPrice(mouseY, height, view, options.scaleType);
                if (chart.lineStartPoint === null) {
                    chart.lineStartPoint = { x: chartX, y: chartY };
                    console.log('Set line start point:', chart.lineStartPoint);
                } else {
                    const newLine = {
                        type: chart.isDrawingLine ? 'finite' : 'infinite',
                        start: chart.isDrawingLine ? { ...chart.lineStartPoint } : undefined,
                        end: chart.isDrawingLine ? { x: chartX, y: chartY } : undefined,
                        point1: chart.isDrawingInfiniteLine ? { ...chart.lineStartPoint } : undefined,
                        point2: chart.isDrawingInfiniteLine ? { x: chartX, y: chartY } : undefined,
                        scaleType: options.scaleType
                    };
                    if ((newLine.start || newLine.point1) && (newLine.end || newLine.point2)) {
                        lines.push(newLine);
                        console.log(`Added ${newLine.type} line:`, newLine, 'Total lines:', lines.length);
                        chart.lineStartPoint = null;
                        chart.render();
                    } else {
                        console.warn('Invalid line created:', newLine);
                    }
                }
            } else {
                chart.selectedLineIndex = -1;
                chart.isDragging = true;
                chart.lastMouseX = e.clientX;
                chart.lastMouseY = e.clientY;
                console.log('Starting drag');
                chart.render();
            }
        } else {
            chart.selectedLineIndex = -1;
            chart.isDragging = true;
            chart.lastMouseX = e.clientX;
            chart.lastMouseY = e.clientY;
            console.log('Starting drag outside chart area');
            chart.render();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        const chartHeight = height - AXIS_MARGIN;

        if (chart.isResizingY) {
            const dy = mouseY - chart.lastMouseY;
            const zoomFactor = 1 - dy * 0.002;
            view.scaleY *= zoomFactor;
            view.scaleY = Math.max(options.minScale, Math.min(options.maxScale, view.scaleY));
            chart.lastMouseY = mouseY;
            canvas.style.cursor = 'ns-resize';
            chart.render();
        } else if (chart.isResizingX) {
            const dx = mouseX - chart.lastMouseX;
            const zoomFactor = 1 - dx * 0.002;
            const oldScaleX = view.scaleX;
            const oldCandleWidth = options.candleWidth * oldScaleX;
            const oldSpacing = CANDLE_SPACING;
            const lastIndex = dataManager.data.length - 1;
            const currentX = (lastIndex * (oldCandleWidth + oldSpacing) + view.offsetX) + oldCandleWidth / 2;

            view.scaleX *= zoomFactor;
            view.scaleX = Math.max(options.minScale, Math.min(options.maxScale, view.scaleX));
            const newCandleWidth = options.candleWidth * view.scaleX;
            const newSpacing = CANDLE_SPACING;
            view.offsetX = currentX - newCandleWidth / 2 - lastIndex * (newCandleWidth + newSpacing);
            chart.lastMouseX = mouseX;
            canvas.style.cursor = 'ew-resize';
            chart.render();
        } else if (chart.isDragging) {
            const dx = e.clientX - chart.lastMouseX;
            const dy = e.clientY - chart.lastMouseY;
            const pixelPerCandle = Math.max(0.0001, options.candleWidth * view.scaleX + CANDLE_SPACING);
            const sensitivityX = 10;
            view.offsetX += (dx / pixelPerCandle) * sensitivityX;
            view.offsetY += dy;
            chart.lastMouseX = e.clientX;
            chart.lastMouseY = e.clientY;
            canvas.style.cursor = 'move';
            chart.render();
        } else if (chart.isMovingLine && chart.selectedLineIndex !== -1) {
            const candleWidth = options.candleWidth * view.scaleX;
            const spacing = CANDLE_SPACING;
            const dx = (mouseX - chart.lastMouseX) / (candleWidth + spacing);
            const dy = yToPrice(mouseY, chartHeight, view, options.scaleType) - yToPrice(chart.lastMouseY, chartHeight, view, options.scaleType);
            const line = lines[chart.selectedLineIndex];
            if (line.type === 'finite' && line.start && line.end) {
                line.start.x += dx;
                line.start.y += dy;
                line.end.x += dx;
                line.end.y += dy;
            } else if (line.type === 'infinite' && line.point1 && line.point2) {
                line.point1.x += dx;
                line.point1.y += dy;
                line.point2.x += dx;
                line.point2.y += dy;
            }
            chart.lastMouseX = mouseX;
            chart.lastMouseY = mouseY;
            canvas.style.cursor = 'pointer';
            console.log('Moved line:', line);
            chart.render();
        } else if (chart.showCrosshair && !chart.isDrawingLine && !chart.isDrawingInfiniteLine) {
            if (mouseX > width - AXIS_MARGIN) {
                chart.crosshair = null;
                canvas.style.cursor = 'ns-resize';
            } else if (mouseY > chartHeight) {
                chart.crosshair = null;
                canvas.style.cursor = 'ew-resize';
            } else {
                chart.crosshair = { x: mouseX, y: mouseY };
                const candleWidth = options.candleWidth * view.scaleX;
                const spacing = CANDLE_SPACING;
                let isNearLine = false;
                for (let line of lines) {
                    if (!line || (!line.start && !line.point1)) continue;
                    const points = getLinePoints(chart, line, width, height, candleWidth, spacing, 50);
                    for (let i = 0; i < points.length - 1; i++) {
                        const x1 = points[i].x;
                        const y1 = points[i].y;
                        const x2 = points[i + 1].x;
                        const y2 = points[i + 1].y;
                        const distance = distanceToLineSegment(mouseX, mouseY, x1, y1, x2, y2);
                        if (distance < 5) {
                            isNearLine = true;
                            break;
                        }
                    }
                    if (isNearLine) break;
                }
                canvas.style.cursor = isNearLine ? 'pointer' : 'default';
            }
            chart.render();
        } else {
            canvas.style.cursor = 'default';
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            chart.isDragging = false;
            chart.isMovingLine = false;
            chart.isResizingY = false;
            chart.isResizingX = false;
            canvas.style.cursor = 'default';
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (chart.isDragging || chart.isResizingY || chart.isResizingX || chart.isMovingLine) {
            chart.isDragging = false;
            chart.isMovingLine = false;
            chart.isResizingY = false;
            chart.isResizingX = false;
            canvas.style.cursor = 'default';
            chart.render();
        }
    });

    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && chart.selectedLineIndex !== -1) {
            console.log('Deleting line:', lines[chart.selectedLineIndex]);
            lines.splice(chart.selectedLineIndex, 1);
            chart.selectedLineIndex = -1;
            chart.render();
        }
    });

    const scaleSelect = document.getElementById('scale-select');
    if (scaleSelect) {
        scaleSelect.addEventListener('change', (e) => {
            console.log('Scale changed to:', e.target.value);
            options.scaleType = e.target.value;
            chart.render();
        });
    } else {
        console.error('scale-select element not found');
    }

    const crosshairButton = document.getElementById('tool-crosshair');
    if (crosshairButton) {
        crosshairButton.classList.add('active');
        crosshairButton.addEventListener('click', () => {
            chart.showCrosshair = !chart.showCrosshair;
            chart.isDrawingLine = false;
            chart.isDrawingInfiniteLine = false;
            chart.lineStartPoint = null;
            chart.selectedLineIndex = -1;
            crosshairButton.classList.toggle('active');
            document.getElementById('tool-line')?.classList.remove('active');
            document.getElementById('tool-infinite-line')?.classList.remove('active');
            console.log('Crosshair mode:', chart.showCrosshair);
            chart.render();
        });
    } else {
        console.error('tool-crosshair element not found');
    }

    const maButton = document.getElementById('tool-ma');
    if (maButton) {
        maButton.addEventListener('click', () => {
            console.log('Opening MA modal');
            openMAModal(chart);
        });
    } else {
        console.error('tool-ma element not found');
    }

    const lineButton = document.getElementById('tool-line');
    if (lineButton) {
        lineButton.addEventListener('click', () => {
            chart.isDrawingLine = !chart.isDrawingLine;
            chart.isDrawingInfiniteLine = false;
            chart.showCrosshair = !chart.isDrawingLine;
            chart.lineStartPoint = null;
            chart.selectedLineIndex = -1;
            lineButton.classList.toggle('active');
            crosshairButton?.classList.toggle('active', !chart.isDrawingLine);
            document.getElementById('tool-infinite-line')?.classList.remove('active');
            console.log('Finite line mode:', chart.isDrawingLine);
            chart.render();
        });
    } else {
        console.error('tool-line element not found');
    }

    const infiniteLineButton = document.getElementById('tool-infinite-line');
    if (infiniteLineButton) {
        infiniteLineButton.addEventListener('click', () => {
            chart.isDrawingInfiniteLine = !chart.isDrawingInfiniteLine;
            chart.isDrawingLine = false;
            chart.showCrosshair = !chart.isDrawingInfiniteLine;
            chart.lineStartPoint = null;
            chart.selectedLineIndex = -1;
            infiniteLineButton.classList.toggle('active');
            crosshairButton?.classList.toggle('active', !chart.isDrawingInfiniteLine);
            lineButton?.classList.remove('active');
            console.log('Infinite line mode:', chart.isDrawingInfiniteLine);
            chart.render();
        });
    } else {
        console.error('tool-infinite-line element not found');
    }

    const resetButton = document.getElementById('tool-reset');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            console.log('Resetting chart');
            view.offsetX = (canvas.offsetWidth - AXIS_MARGIN - 20) - ((dataManager.data.length - 1) * (options.candleWidth * 1 + CANDLE_SPACING));
            view.offsetY = 0;
            view.scaleX = 1;
            view.scaleY = 1;
            lines.length = 0;
            chart.selectedLineIndex = -1;
            chart.isDrawingLine = false;
            chart.isDrawingInfiniteLine = false;
            chart.lineStartPoint = null;
            chart.render();
        });
    } else {
        console.error('tool-reset element not found');
    }

    window.addEventListener('resize', () => chart.resize());
}