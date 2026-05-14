import { openMAModal } from './modal.js';
import { getLinePoints, getDrawingPointX, distanceToLineSegment, priceToY, yToPrice, toISODate, AXIS_MARGIN, TIME_AXIS_HEIGHT } from './utils.js';

function normalizeWheelDelta(delta) {
    return Math.sign(delta) * Math.min(160, Math.abs(delta));
}

function getLineHitRadius(chart) {
    return Math.max(7, Math.min(12, chart.getSlotWidth() * 0.45));
}

function getLineHandleRadius(chart) {
    const isTouch = window.matchMedia?.('(pointer: coarse)')?.matches;
    if (isTouch) return 26;
    return Math.max(8, Math.min(12, chart.getSlotWidth() * 0.55));
}

function stopInertia(chart) {
    if (chart.inertiaFrame) {
        cancelAnimationFrame(chart.inertiaFrame);
        chart.inertiaFrame = null;
    }
    chart.dragVelocityX = 0;
    chart.dragVelocityY = 0;
}

function startPanInertia(chart, chartHeight) {
    const minVelocity = 0.04;
    const maxVelocity = 1.1;
    let velocityX = Math.sign(chart.dragVelocityX) * Math.min(maxVelocity, Math.abs(chart.dragVelocityX));
    let velocityY = Math.sign(chart.dragVelocityY) * Math.min(maxVelocity, Math.abs(chart.dragVelocityY));
    let lastTime = performance.now();

    if (Math.hypot(velocityX, velocityY) < minVelocity) return;

    const step = (now) => {
        const dt = Math.min(32, now - lastTime);
        lastTime = now;
        chart.view.offsetX += velocityX * dt;
        chart.panPriceByPixels(velocityY * dt, chartHeight);
        chart.clearTimeRange();
        chart.requestRender();

        const decay = Math.pow(0.92, dt / 16);
        velocityX *= decay;
        velocityY *= decay;

        if (Math.hypot(velocityX, velocityY) < minVelocity) {
            chart.inertiaFrame = null;
            return;
        }

        chart.inertiaFrame = requestAnimationFrame(step);
    };

    chart.inertiaFrame = requestAnimationFrame(step);
}

function getSnappedDrawingPoint(chart, mouseX, mouseY, chartHeight) {
    const slotWidth = chart.getSlotWidth();
    const candleWidth = chart.getCandleWidth();
    const rawIndex = (mouseX - chart.view.offsetX - candleWidth / 2) / slotWidth;
    const candleIndex = Math.round(rawIndex);
    const x = candleIndex + candleWidth / 2 / slotWidth;
    const date = chart.getDateForIndex?.(candleIndex);
    let price = yToPrice(mouseY, chartHeight, chart.view, chart.options.scaleType);
    let source = 'time';

    const candle = chart.dataManager.data[candleIndex];
    if (candle) {
        const snapCandidates = [candle.open, candle.high, candle.low, candle.close];
        let closestPrice = price;
        let closestDistance = Infinity;
        snapCandidates.forEach((candidate) => {
            const candidateY = priceToY(candidate, chartHeight, chart.view, chart.options.scaleType);
            const distance = Math.abs(candidateY - mouseY);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPrice = candidate;
            }
        });

        if (closestDistance <= 10) {
            price = closestPrice;
            source = 'ohlc';
        }
    }

    return { x, y: price, time: date ? toISODate(date) : undefined, source };
}

function getLineHandles(chart, line, chartHeight) {
    const slotWidth = chart.getSlotWidth();
    const handles = (line.type === 'fibonacci' || line.type === 'measure')
        ? [
            { key: 'point1', point: line.point1 },
            { key: 'point2', point: line.point2 },
        ]
        : (line.type === 'horizontal' || line.type === 'vertical')
        ? [
            { key: 'point1', point: line.point1 },
        ]
        : line.type === 'finite'
        ? [
            { key: 'start', point: line.start },
            { key: 'end', point: line.end },
        ]
        : [
            { key: 'point1', point: line.point1 },
            { key: 'point2', point: line.point2 },
        ];

    return handles
        .filter(({ point }) => point)
        .map(({ key, point }) => ({
            key,
            x: getDrawingPointX(chart, point) * slotWidth + chart.view.offsetX,
            y: priceToY(point.y, chartHeight, chart.view, chart.options.scaleType),
        }));
}

function findLineHandleAt(chart, mouseX, mouseY, chartHeight) {
    const radius = getLineHandleRadius(chart);
    let best = null;
    let bestDistance = Infinity;

    const selectedFirst = chart.selectedLineIndex >= 0
        ? [chart.selectedLineIndex, ...chart.lines.map((_, index) => index).filter(index => index !== chart.selectedLineIndex)]
        : chart.lines.map((_, index) => index);

    selectedFirst.forEach((lineIndex) => {
        const line = chart.lines[lineIndex];
        getLineHandles(chart, line, chartHeight).forEach((handle) => {
            const distance = Math.hypot(mouseX - handle.x, mouseY - handle.y);
            if (distance < radius && distance < bestDistance) {
                best = { lineIndex, key: handle.key };
                bestDistance = distance;
            }
        });
    });

    return best;
}

function selectedLine(chart) {
    return chart.selectedLineIndex >= 0 ? chart.lines[chart.selectedLineIndex] : null;
}

function cloneDrawingList(lines) {
    return lines.map(cloneDrawing);
}

function captureDrawingState(chart) {
    return {
        lines: cloneDrawingList(chart.lines),
        selectedLineIndex: chart.selectedLineIndex,
    };
}

function serializeDrawingState(state) {
    return JSON.stringify(state.lines);
}

function updateUndoButton(chart) {
    const undoButton = document.getElementById('tool-undo');
    if (undoButton) undoButton.disabled = !(chart.drawingHistory && chart.drawingHistory.length);
}

function pushDrawingHistory(chart, state = captureDrawingState(chart)) {
    const current = captureDrawingState(chart);
    if (serializeDrawingState(state) === serializeDrawingState(current)) return;
    chart.drawingHistory.push(state);
    if (chart.drawingHistory.length > 80) chart.drawingHistory.shift();
    updateUndoButton(chart);
}

function undoDrawingChange(chart) {
    const previous = chart.drawingHistory?.pop();
    if (!previous) return false;
    chart.lines.length = 0;
    previous.lines.forEach(line => chart.lines.push(cloneDrawing(line)));
    chart.selectedLineIndex = Math.min(previous.selectedLineIndex, chart.lines.length - 1);
    chart.hoveredLineIndex = -1;
    chart.activeLineHandle = null;
    chart.isMovingLine = false;
    chart.lineStartPoint = null;
    chart.snapPoint = null;
    syncLineToolbar(chart);
    updateUndoButton(chart);
    chart.render();
    return true;
}

function beginDrawingDragHistory(chart) {
    chart.drawingDragSnapshot = captureDrawingState(chart);
    chart.drawingDragChanged = false;
}

function markDrawingDragChanged(chart) {
    chart.drawingDragChanged = true;
}

function finishDrawingDragHistory(chart) {
    if (chart.drawingDragSnapshot && chart.drawingDragChanged) {
        pushDrawingHistory(chart, chart.drawingDragSnapshot);
    }
    chart.drawingDragSnapshot = null;
    chart.drawingDragChanged = false;
}

function syncLineToolbar(chart) {
    const toolbar = document.getElementById('line-toolbar');
    if (!toolbar) return;
    const line = selectedLine(chart);
    toolbar.hidden = !line;
    if (!line) return;

    document.getElementById('line-color').value = line.color || '#2962ff';
    document.getElementById('line-text-color').value = line.textColor || '#131722';
    document.getElementById('line-color-swatch')?.style.setProperty('background', line.color || '#2962ff');
    document.getElementById('line-text-color-swatch')?.style.setProperty('background', line.textColor || '#131722');
    document.getElementById('line-width-label')?.replaceChildren(document.createTextNode(`${line.width || 2}px`));
    document.querySelectorAll('#line-width-menu button').forEach((button) => {
        button.classList.toggle('active', Number.parseInt(button.dataset.value, 10) === (line.width || 2));
    });
    document.getElementById('line-text-size-label')?.replaceChildren(document.createTextNode(String(line.textSize || 12)));
    document.querySelectorAll('#line-text-size-menu button').forEach((button) => {
        button.classList.toggle('active', Number.parseInt(button.dataset.value, 10) === (line.textSize || 12));
    });
    document.getElementById('line-style-button')?.setAttribute('data-style', line.style || 'solid');
    document.querySelectorAll('#line-style-menu button').forEach((button) => {
        button.classList.toggle('active', button.dataset.style === (line.style || 'solid'));
    });
    document.getElementById('line-text-bold')?.classList.toggle('active', !!line.textBold);
    document.getElementById('line-lock')?.classList.toggle('active', !!line.locked);
    document.getElementById('line-more-lock')?.classList.toggle('active', !!line.locked);
    const pasteButton = document.getElementById('line-paste');
    if (pasteButton) pasteButton.disabled = !chart.copiedDrawing;
    const morePasteButton = document.getElementById('line-more-paste');
    if (morePasteButton) morePasteButton.disabled = !chart.copiedDrawing;
}

function mutateSelectedLine(chart, updater) {
    const line = selectedLine(chart);
    if (!line) return;
    const before = captureDrawingState(chart);
    updater(line);
    pushDrawingHistory(chart, before);
    syncLineToolbar(chart);
    chart.render();
}

function deleteSelectedLine(chart) {
    if (chart.selectedLineIndex === -1) return;
    const before = captureDrawingState(chart);
    chart.lines.splice(chart.selectedLineIndex, 1);
    pushDrawingHistory(chart, before);
    chart.selectedLineIndex = -1;
    chart.activeLineHandle = null;
    syncLineToolbar(chart);
    chart.render();
}

function cloneDrawing(line) {
    return JSON.parse(JSON.stringify(line));
}

function isEditableTarget(target) {
    if (!target) return false;
    const tagName = target.tagName?.toLowerCase();
    return tagName === 'input'
        || tagName === 'textarea'
        || tagName === 'select'
        || target.isContentEditable;
}

function getLineTextPlacement(chart, line, width, chartHeight, text = '') {
    if (!line || (!line.start && !line.point1)) return null;
    if (line.type === 'fibonacci' || line.type === 'measure') return null;
    const label = text || line.text || '+ Add text';
    const textSize = line.textSize || 12;

    if (line.type === 'horizontal') {
        const y = priceToY(line.point1.y, chartHeight, chart.view, chart.options.scaleType);
        if (!Number.isFinite(y)) return null;
        const x = Math.max(64, Math.min(width - AXIS_MARGIN - 64, getDrawingPointX(chart, line.point1) * chart.getSlotWidth() + chart.view.offsetX));
        return {
            x: x + (line.textOffsetX || 0),
            y: y - Math.max(8, textSize * 0.65) + (line.textOffsetY || 0),
            angle: 0,
            width: Math.max(56, label.length * textSize * 0.58),
            height: textSize + 6,
        };
    }

    if (line.type === 'vertical') {
        const x = getDrawingPointX(chart, line.point1) * chart.getSlotWidth() + chart.view.offsetX;
        if (!Number.isFinite(x)) return null;
        const y = Math.max(64, Math.min(chartHeight - 64, priceToY(line.point1.y, chartHeight, chart.view, chart.options.scaleType)));
        return {
            x: x + (line.textOffsetX || 0),
            y: y + (line.textOffsetY || 0),
            angle: -Math.PI / 2,
            width: Math.max(56, label.length * textSize * 0.58),
            height: textSize + 6,
        };
    }

    const candleWidth = chart.getCandleWidth();
    const spacing = chart.getBarSpacing();
    const points = getLinePoints(chart, line, width, chartHeight, candleWidth, spacing, 50);
    if (!points || points.length < 2) return null;

    const midIndex = Math.floor(points.length / 2);
    const midPoint = points[midIndex];
    const prevPoint = points[Math.max(0, midIndex - 1)];
    const nextPoint = points[Math.min(points.length - 1, midIndex + 1)];
    let angle = Math.atan2(nextPoint.y - prevPoint.y, nextPoint.x - prevPoint.x);
    if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;

    return {
        x: midPoint.x + (line.textOffsetX || 0),
        y: midPoint.y - Math.max(8, textSize * 0.65) + (line.textOffsetY || 0),
        angle,
        width: Math.max(56, label.length * textSize * 0.58),
        height: textSize + 6,
    };
}

function pointInRotatedLabel(mouseX, mouseY, placement) {
    if (!placement) return false;
    const dx = mouseX - placement.x;
    const dy = mouseY - placement.y;
    const cos = Math.cos(-placement.angle);
    const sin = Math.sin(-placement.angle);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    return Math.abs(localX) <= placement.width / 2 + 8 && localY <= 4 && localY >= -placement.height - 8;
}

function findLineTextAt(chart, mouseX, mouseY, width, chartHeight) {
    let best = null;
    chart.lines.forEach((line, lineIndex) => {
        const canAddText = lineIndex === chart.hoveredLineIndex;
        if (!line || (!line.text && !canAddText)) return;
        const placement = getLineTextPlacement(chart, line, width, chartHeight);
        if (pointInRotatedLabel(mouseX, mouseY, placement)) {
            best = { lineIndex, placement };
        }
    });
    return best;
}

export function initEvents(chart) {
    const { canvas, options, view, dataManager, lines } = chart;
    const lineTextEditor = document.getElementById('line-text-editor');
    const drawingColors = ['#2962ff', '#089981', '#f23645', '#ff9800', '#ab47bc', '#131722', '#787b86', '#26c6da', '#00c853', '#ff5252', '#ffffff', '#000000'];
    updateUndoButton(chart);

    function closeLineTextEditor(commit = true) {
        if (!lineTextEditor || lineTextEditor.hidden) return;
        const lineIndex = Number.parseInt(lineTextEditor.dataset.lineIndex || '-1', 10);
        const line = lines[lineIndex];
        if (commit && line) {
            line.text = lineTextEditor.value.trim();
            if (chart.lineTextEditSnapshot) pushDrawingHistory(chart, chart.lineTextEditSnapshot);
        } else if (!commit && chart.lineTextEditSnapshot) {
            lines.length = 0;
            chart.lineTextEditSnapshot.lines.forEach(savedLine => lines.push(cloneDrawing(savedLine)));
            chart.selectedLineIndex = chart.lineTextEditSnapshot.selectedLineIndex;
        }
        lineTextEditor.hidden = true;
        if (chart.lineTextCaretTimer) {
            clearInterval(chart.lineTextCaretTimer);
            chart.lineTextCaretTimer = null;
        }
        chart.editingLineTextIndex = -1;
        chart.lineTextEditSnapshot = null;
        delete lineTextEditor.dataset.lineIndex;
        syncLineToolbar(chart);
        chart.render();
    }

    function openLineTextEditor(lineIndex) {
        if (!lineTextEditor || lineIndex < 0 || !lines[lineIndex]) return;
        const width = canvas.offsetWidth;
        const chartHeight = canvas.offsetHeight - TIME_AXIS_HEIGHT;
        const placement = getLineTextPlacement(chart, lines[lineIndex], width, chartHeight);
        if (!placement) return;

        chart.selectedLineIndex = lineIndex;
        chart.editingLineTextIndex = lineIndex;
        chart.lineTextEditSnapshot = captureDrawingState(chart);
        syncLineToolbar(chart);

        const textSize = lines[lineIndex].textSize || 12;
        const isCompactTouch = window.matchMedia?.('(max-width: 720px), (pointer: coarse)')?.matches;
        const editorFontSize = isCompactTouch ? Math.max(16, textSize) : textSize;
        const editorWidth = Math.max(36, Math.min(240, placement.width + 22));
        const editorHeight = Math.max(textSize, editorFontSize) + 8;
        const left = Math.max(4, Math.min(width - AXIS_MARGIN - editorWidth - 6, placement.x - editorWidth / 2));
        const top = Math.max(4, Math.min(chartHeight - editorHeight - 4, placement.y - editorHeight));
        lineTextEditor.dataset.lineIndex = String(lineIndex);
        lineTextEditor.value = lines[lineIndex].text || '';
        lineTextEditor.placeholder = '+ Add text';
        lineTextEditor.style.width = '1px';
        lineTextEditor.style.left = `${Math.max(4, Math.min(width - AXIS_MARGIN - 8, placement.x))}px`;
        lineTextEditor.style.top = `${Math.max(4, Math.min(chartHeight - 24, placement.y - 18))}px`;
        lineTextEditor.style.color = 'transparent';
        lineTextEditor.style.caretColor = 'transparent';
        lineTextEditor.style.fontWeight = lines[lineIndex].textBold ? '700' : '400';
        lineTextEditor.style.fontSize = `${editorFontSize}px`;
        lineTextEditor.style.height = '20px';
        lineTextEditor.style.lineHeight = `${Math.max(18, editorFontSize)}px`;
        lineTextEditor.style.transform = 'none';
        lineTextEditor.style.transformOrigin = 'left top';
        lineTextEditor.hidden = false;
        lineTextEditor.focus();
        const caretIndex = lineTextEditor.value.length;
        lineTextEditor.setSelectionRange(caretIndex, caretIndex);
        if (chart.lineTextCaretTimer) clearInterval(chart.lineTextCaretTimer);
        chart.lineTextCaretTimer = setInterval(() => {
            if (!lineTextEditor || lineTextEditor.hidden) {
                clearInterval(chart.lineTextCaretTimer);
                chart.lineTextCaretTimer = null;
                return;
            }
            chart.requestRender();
        }, 260);
    }

    if (lineTextEditor) {
        lineTextEditor.addEventListener('input', () => {
            const lineIndex = Number.parseInt(lineTextEditor.dataset.lineIndex || '-1', 10);
            const line = lines[lineIndex];
            if (line) line.text = lineTextEditor.value;
            chart.render();
        });
        lineTextEditor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                closeLineTextEditor(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeLineTextEditor(false);
            }
        });
        lineTextEditor.addEventListener('blur', () => closeLineTextEditor(true));
    }

    function closeLineMenus(except = null) {
        ['line-color-menu', 'line-text-color-menu', 'line-style-menu', 'line-width-menu', 'line-text-size-menu', 'line-more-menu'].forEach((id) => {
            const menu = document.getElementById(id);
            if (menu && menu !== except) menu.hidden = true;
        });
    }

    function isMobileToolbarLayout() {
        return window.matchMedia?.('(max-width: 720px), (pointer: coarse)')?.matches;
    }

    function positionToolbarMenu(menu, button) {
        if (!menu || !button || !isMobileToolbarLayout()) {
            menu?.style.removeProperty('left');
            menu?.style.removeProperty('top');
            return;
        }

        const buttonRect = button.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const menuWidth = menuRect.width || Number.parseFloat(getComputedStyle(menu).width) || 160;
        const menuHeight = menuRect.height || Number.parseFloat(getComputedStyle(menu).height) || 140;
        const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, buttonRect.left));
        const preferredTop = buttonRect.bottom + 6;
        const top = preferredTop + menuHeight > window.innerHeight - 8
            ? Math.max(8, buttonRect.top - menuHeight - 6)
            : preferredTop;

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    function setupColorMenu({ buttonId, menuId, inputId, swatchId, field, fallback }) {
        const button = document.getElementById(buttonId);
        const menu = document.getElementById(menuId);
        const input = document.getElementById(inputId);
        const swatch = document.getElementById(swatchId);
        if (!button || !menu || !input || !swatch) return;
        let lastColorPointerTime = 0;
        let ignoreNextColorClick = false;

        function selectColor(color) {
            input.value = color;
            swatch.style.background = color;
            mutateSelectedLine(chart, line => { line[field] = color; });
            closeLineMenus();
        }

        function toggleMenu(e) {
            e.preventDefault();
            e.stopPropagation();
            const willOpen = menu.hidden;
            closeLineMenus(menu);
            menu.hidden = !willOpen;
            if (willOpen) positionToolbarMenu(menu, button);
            const currentColor = input.value || fallback;
            Array.from(menu.children).forEach((item) => {
                item.classList.toggle('active', item.title.toLowerCase() === currentColor.toLowerCase());
            });
        }

        menu.replaceChildren();
        drawingColors.forEach((color) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.title = color;
            item.style.setProperty('--color-value', color);
            item.addEventListener('pointerup', (e) => {
                e.preventDefault();
                e.stopPropagation();
                lastColorPointerTime = performance.now();
                selectColor(color);
            });
            item.addEventListener('click', (e) => {
                if (performance.now() - lastColorPointerTime < 500) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                e.stopPropagation();
                selectColor(color);
            });
            menu.appendChild(item);
        });

        button.addEventListener('pointerup', (e) => {
            lastColorPointerTime = performance.now();
            ignoreNextColorClick = true;
            toggleMenu(e);
        });
        button.addEventListener('click', (e) => {
            if (ignoreNextColorClick || e.pointerType || performance.now() - lastColorPointerTime < 500) {
                ignoreNextColorClick = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            toggleMenu(e);
        });
    }

    function setupLineStyleMenu() {
        const button = document.getElementById('line-style-button');
        const menu = document.getElementById('line-style-menu');
        if (!button || !menu) return;
        let lastStylePointerTime = 0;
        let ignoreNextStyleClick = false;

        function toggleStyleMenu(e) {
            e.preventDefault();
            e.stopPropagation();
            const willOpen = menu.hidden;
            closeLineMenus(menu);
            menu.hidden = !willOpen;
            if (willOpen) positionToolbarMenu(menu, button);
            const line = selectedLine(chart);
            const style = line?.style || 'solid';
            menu.querySelectorAll('button').forEach((item) => {
                item.classList.toggle('active', item.dataset.style === style);
            });
        }

        button.addEventListener('pointerup', (e) => {
            lastStylePointerTime = performance.now();
            ignoreNextStyleClick = true;
            toggleStyleMenu(e);
        });
        button.addEventListener('click', (e) => {
            if (ignoreNextStyleClick || e.pointerType || performance.now() - lastStylePointerTime < 500) {
                ignoreNextStyleClick = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            toggleStyleMenu(e);
        });

        menu.querySelectorAll('button').forEach((item) => {
            item.addEventListener('pointerup', (e) => {
                e.preventDefault();
                e.stopPropagation();
                lastStylePointerTime = performance.now();
                const style = item.dataset.style || 'solid';
                mutateSelectedLine(chart, line => { line.style = style; });
                closeLineMenus();
            });
            item.addEventListener('click', (e) => {
                if (performance.now() - lastStylePointerTime < 500) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                e.stopPropagation();
                const style = item.dataset.style || 'solid';
                mutateSelectedLine(chart, line => { line.style = style; });
                closeLineMenus();
            });
        });
    }

    function setupChoiceMenu({ buttonId, menuId, onSelect }) {
        const button = document.getElementById(buttonId);
        const menu = document.getElementById(menuId);
        if (!button || !menu) return;
        let lastChoicePointerTime = 0;
        let ignoreNextChoiceClick = false;

        function toggleChoiceMenu(e) {
            e.preventDefault();
            e.stopPropagation();
            const willOpen = menu.hidden;
            closeLineMenus(menu);
            menu.hidden = !willOpen;
            if (willOpen) positionToolbarMenu(menu, button);
            syncLineToolbar(chart);
        }

        button.addEventListener('pointerup', (e) => {
            lastChoicePointerTime = performance.now();
            ignoreNextChoiceClick = true;
            toggleChoiceMenu(e);
        });
        button.addEventListener('click', (e) => {
            if (ignoreNextChoiceClick || e.pointerType || performance.now() - lastChoicePointerTime < 500) {
                ignoreNextChoiceClick = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            toggleChoiceMenu(e);
        });

        menu.querySelectorAll('button').forEach((item) => {
            item.addEventListener('pointerup', (e) => {
                e.preventDefault();
                e.stopPropagation();
                lastChoicePointerTime = performance.now();
                const value = Number.parseInt(item.dataset.value, 10);
                if (Number.isFinite(value)) onSelect(value);
                closeLineMenus();
            });
            item.addEventListener('click', (e) => {
                if (performance.now() - lastChoicePointerTime < 500) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                e.stopPropagation();
                const value = Number.parseInt(item.dataset.value, 10);
                if (Number.isFinite(value)) onSelect(value);
                closeLineMenus();
            });
        });
    }

    function setupMoreMenu() {
        const button = document.getElementById('line-more-button');
        const menu = document.getElementById('line-more-menu');
        if (!button || !menu) return;
        let lastMorePointerTime = 0;
        let ignoreNextMoreClick = false;

        function toggleMoreMenu(e) {
            e.preventDefault();
            e.stopPropagation();
            const willOpen = menu.hidden;
            closeLineMenus(menu);
            menu.hidden = !willOpen;
            if (willOpen) positionToolbarMenu(menu, button);
            syncLineToolbar(chart);
        }

        button.addEventListener('pointerup', (e) => {
            lastMorePointerTime = performance.now();
            ignoreNextMoreClick = true;
            toggleMoreMenu(e);
        });
        button.addEventListener('click', (e) => {
            if (ignoreNextMoreClick || e.pointerType || performance.now() - lastMorePointerTime < 500) {
                ignoreNextMoreClick = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            toggleMoreMenu(e);
        });
    }

    function isDrawingAnyTool() {
        return chart.isDrawingLine || chart.isDrawingInfiniteLine || chart.isDrawingHorizontalLine || chart.isDrawingVerticalLine || chart.isDrawingFibonacci || chart.isDrawingMeasure;
    }

    function deactivateDrawingButtons() {
        document.getElementById('tool-line')?.classList.remove('active');
        document.getElementById('tool-infinite-line')?.classList.remove('active');
        document.getElementById('tool-horizontal-line')?.classList.remove('active');
        document.getElementById('tool-vertical-line')?.classList.remove('active');
        document.getElementById('tool-fibonacci')?.classList.remove('active');
        document.getElementById('tool-measure')?.classList.remove('active');
    }

    function getAxisLineHit(chart, line, mouseX, mouseY, chartHeight) {
        if (!line || !line.point1) return Infinity;
        if (line.type === 'horizontal') {
            const y = priceToY(line.point1.y, chartHeight, chart.view, chart.options.scaleType);
            return Math.abs(mouseY - y);
        }
        if (line.type === 'vertical') {
            const x = getDrawingPointX(chart, line.point1) * chart.getSlotWidth() + chart.view.offsetX;
            return Math.abs(mouseX - x);
        }
        return Infinity;
    }

    function getFibonacciHit(chart, line, mouseX, mouseY, width, chartHeight) {
        if (!line || line.type !== 'fibonacci' || !line.point1 || !line.point2) return Infinity;
        const slotWidth = chart.getSlotWidth();
        const chartWidth = width - AXIS_MARGIN;
        const x1 = getDrawingPointX(chart, line.point1) * slotWidth + chart.view.offsetX;
        const x2 = getDrawingPointX(chart, line.point2) * slotWidth + chart.view.offsetX;
        const startX = Math.max(0, Math.min(x1, x2));
        const endX = chartWidth;
        if (mouseX < startX - 8 || mouseX > endX + 8) return Infinity;

        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        let minDistance = Infinity;
        levels.forEach((level) => {
            const price = line.point1.y + (line.point2.y - line.point1.y) * level;
            const y = priceToY(price, chartHeight, chart.view, chart.options.scaleType);
            minDistance = Math.min(minDistance, Math.abs(mouseY - y));
        });
        return minDistance;
    }

    function getMeasureHit(chart, line, mouseX, mouseY, chartHeight) {
        if (!line || line.type !== 'measure' || !line.point1 || !line.point2) return Infinity;
        const slotWidth = chart.getSlotWidth();
        const x1 = getDrawingPointX(chart, line.point1) * slotWidth + chart.view.offsetX;
        const x2 = getDrawingPointX(chart, line.point2) * slotWidth + chart.view.offsetX;
        const y1 = priceToY(line.point1.y, chartHeight, chart.view, chart.options.scaleType);
        const y2 = priceToY(line.point2.y, chartHeight, chart.view, chart.options.scaleType);
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);
        if (mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom) return 0;
        if (mouseX < left - 8 || mouseX > right + 8 || mouseY < top - 8 || mouseY > bottom + 8) return Infinity;
        const edgeDistance = Math.min(Math.abs(mouseX - left), Math.abs(mouseX - right), Math.abs(mouseY - top), Math.abs(mouseY - bottom));
        return Math.min(edgeDistance, distanceToLineSegment(mouseX, mouseY, x1, y1, x2, y2));
    }

    function findDrawingAt(mouseX, mouseY, width, chartHeight, hitRadius = getLineHitRadius(chart)) {
        const candleWidth = chart.getCandleWidth();
        const spacing = chart.getBarSpacing();
        let minDistance = Infinity;
        let closestLineIndex = -1;

        lines.forEach((line, index) => {
            if (!line || (!line.start && !line.point1)) return;
            let distance = Infinity;
            if (line.type === 'fibonacci') {
                distance = getFibonacciHit(chart, line, mouseX, mouseY, width, chartHeight);
            } else if (line.type === 'measure') {
                distance = getMeasureHit(chart, line, mouseX, mouseY, chartHeight);
            } else if (line.type === 'horizontal' || line.type === 'vertical') {
                distance = getAxisLineHit(chart, line, mouseX, mouseY, chartHeight);
            } else {
                const points = getLinePoints(chart, line, width, chartHeight, candleWidth, spacing, 50);
                for (let i = 0; i < points.length - 1; i++) {
                    distance = Math.min(distance, distanceToLineSegment(mouseX, mouseY, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y));
                }
            }
            if (distance < minDistance && distance < hitRadius) {
                minDistance = distance;
                closestLineIndex = index;
            }
        });

        return closestLineIndex;
    }

    function updatePointTimeFromX(point) {
        if (!point) return;
        const slotWidth = chart.getSlotWidth();
        const centerOffset = slotWidth > 0 ? chart.getCandleWidth() / 2 / slotWidth : 0;
        const date = chart.getDateForIndex?.(Math.round(point.x - centerOffset));
        if (date) point.time = toISODate(date);
    }

    function updateDrawingTimes(line) {
        if (!line) return;
        if (line.type === 'finite') {
            updatePointTimeFromX(line.start);
            updatePointTimeFromX(line.end);
        } else if (line.type === 'horizontal' || line.type === 'vertical') {
            updatePointTimeFromX(line.point1);
        } else {
            updatePointTimeFromX(line.point1);
            updatePointTimeFromX(line.point2);
        }
    }

    function finalizeSelectedDrawingTimes() {
        const line = lines[chart.selectedLineIndex];
        if (line) updateDrawingTimes(line);
    }

    function offsetDrawingPoint(point, chartHeight) {
        if (!point) return;
        const priceTop = yToPrice(0, chartHeight, chart.view, chart.options.scaleType);
        const priceOffset = yToPrice(28, chartHeight, chart.view, chart.options.scaleType);
        if (chart.options.scaleType === 'logarithmic') {
            const ratio = priceTop / Math.max(priceOffset, 1e-10);
            point.y *= Number.isFinite(ratio) && ratio > 0 ? ratio : 1.04;
        } else {
            point.y += priceTop - priceOffset;
        }
    }

    function offsetDrawingObject(line, chartHeight) {
        if (!line) return;
        if (line.type === 'finite') {
            offsetDrawingPoint(line.start, chartHeight);
            offsetDrawingPoint(line.end, chartHeight);
        } else {
            offsetDrawingPoint(line.point1, chartHeight);
            offsetDrawingPoint(line.point2, chartHeight);
        }
    }

    function pasteCopiedDrawing() {
        if (!chart.copiedDrawing) return;
        const before = captureDrawingState(chart);
        const pastedLine = cloneDrawing(chart.copiedDrawing);
        offsetDrawingObject(pastedLine, canvas.offsetHeight - TIME_AXIS_HEIGHT);
        lines.push(pastedLine);
        pushDrawingHistory(chart, before);
        chart.selectedLineIndex = lines.length - 1;
        chart.hoveredLineIndex = -1;
        chart.activeLineHandle = null;
        chart.isMovingLine = false;
        chart.copiedDrawing = cloneDrawing(pastedLine);
        syncLineToolbar(chart);
        chart.render();
    }

    function copySelectedDrawing() {
        if (chart.selectedLineIndex === -1 || !lines[chart.selectedLineIndex]) return;
        chart.copiedDrawing = cloneDrawing(lines[chart.selectedLineIndex]);
        syncLineToolbar(chart);
    }

    function getTouchPoint(touch, rect) {
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top,
        };
    }

    function getTouchCenter(touches, rect) {
        const first = getTouchPoint(touches[0], rect);
        const second = getTouchPoint(touches[1], rect);
        return {
            x: (first.x + second.x) / 2,
            y: (first.y + second.y) / 2,
        };
    }

    function getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.hypot(dx, dy);
    }

    function clearTouchHold() {
        if (chart.touchHoldTimer) {
            clearTimeout(chart.touchHoldTimer);
            chart.touchHoldTimer = null;
        }
        chart.touchHoldTarget = null;
    }

    function moveActiveDrawingHandle(mouseX, mouseY, chartHeight) {
        const line = lines[chart.selectedLineIndex];
        if (!line || line.locked || !chart.activeLineHandle || !line[chart.activeLineHandle]) return;

        const width = canvas.offsetWidth;
        const clampedX = Math.max(0, Math.min(width - AXIS_MARGIN, mouseX));
        const clampedY = Math.max(0, Math.min(chartHeight, mouseY));
        const point = getSnappedDrawingPoint(chart, clampedX, clampedY, chartHeight);

        line[chart.activeLineHandle] = { x: point.x, y: point.y };
        if (point.time) line[chart.activeLineHandle].time = point.time;
        chart.snapPoint = point;
        markDrawingDragChanged(chart);
    }

    function moveSelectedDrawing(mouseX, mouseY, chartHeight) {
        const line = lines[chart.selectedLineIndex];
        if (!line || line.locked) {
            chart.isMovingLine = false;
            return;
        }

        const candleWidth = chart.getCandleWidth();
        const spacing = chart.getBarSpacing();
        const dx = (mouseX - chart.lastMouseX) / (candleWidth + spacing);
        const previousPrice = yToPrice(chart.lastMouseY, chartHeight, view, options.scaleType);
        const currentPrice = yToPrice(mouseY, chartHeight, view, options.scaleType);
        const dy = currentPrice - previousPrice;
        const logMoveRatio = currentPrice / Math.max(previousPrice, 1e-10);

        if (line.type === 'finite' && line.start && line.end) {
            line.start.x = getDrawingPointX(chart, line.start) + dx;
            line.start.y = options.scaleType === 'logarithmic' ? line.start.y * logMoveRatio : line.start.y + dy;
            line.end.x = getDrawingPointX(chart, line.end) + dx;
            line.end.y = options.scaleType === 'logarithmic' ? line.end.y * logMoveRatio : line.end.y + dy;
            updatePointTimeFromX(line.start);
            updatePointTimeFromX(line.end);
            markDrawingDragChanged(chart);
        } else if (line.type === 'horizontal' && line.point1) {
            line.point1.y = options.scaleType === 'logarithmic' ? line.point1.y * logMoveRatio : line.point1.y + dy;
            markDrawingDragChanged(chart);
        } else if (line.type === 'vertical' && line.point1) {
            line.point1.x = getDrawingPointX(chart, line.point1) + dx;
            delete line.point1.time;
            markDrawingDragChanged(chart);
        } else if ((line.type === 'infinite' || line.type === 'fibonacci' || line.type === 'measure') && line.point1 && line.point2) {
            line.point1.x = getDrawingPointX(chart, line.point1) + dx;
            line.point1.y = options.scaleType === 'logarithmic' ? line.point1.y * logMoveRatio : line.point1.y + dy;
            line.point2.x = getDrawingPointX(chart, line.point2) + dx;
            line.point2.y = options.scaleType === 'logarithmic' ? line.point2.y * logMoveRatio : line.point2.y + dy;
            if (line.type === 'measure') {
                delete line.point1.time;
                delete line.point2.time;
            } else {
                updatePointTimeFromX(line.point1);
                updatePointTimeFromX(line.point2);
            }
            markDrawingDragChanged(chart);
        }

        chart.lastMouseX = mouseX;
        chart.lastMouseY = mouseY;
    }

    function beginTouchDrawingDrag(target) {
        chart.touchHoldTimer = null;
        chart.touchHoldTarget = null;
        chart.touchMode = 'line-drag';
        chart.touchMoved = true;
        chart.selectedLineIndex = target.lineIndex;
        chart.hoveredLineIndex = target.lineIndex;
        chart.activeLineHandle = null;
        chart.isMovingLine = false;

        const line = lines[target.lineIndex];
        if (!line) return;
        if (!line.locked) {
            if (target.kind === 'handle') {
                chart.activeLineHandle = target.key;
            } else {
                chart.isMovingLine = true;
            }
            chart.touchDragFeedbackUntil = performance.now() + 260;
            navigator.vibrate?.(8);
            beginDrawingDragHistory(chart);
        }

        syncLineToolbar(chart);
        chart.render();
    }

    function scheduleTouchDrawingHold(target) {
        clearTouchHold();
        chart.touchHoldTarget = target;
        chart.touchHoldTimer = setTimeout(() => beginTouchDrawingDrag(target), 320);
    }

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        closeLineTextEditor(true);
        closeLineMenus();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        const chartHeight = height - TIME_AXIS_HEIGHT;
        const timeScaleAnchorX = width - AXIS_MARGIN;
        const wheelX = normalizeWheelDelta(e.deltaX);
        const wheelY = normalizeWheelDelta(e.deltaY);

        if (mouseX <= width - AXIS_MARGIN && mouseY <= chartHeight) {
            if (Math.abs(wheelX) > Math.abs(wheelY)) {
                stopInertia(chart);
                view.offsetX -= wheelX * 0.68;
                chart.clearTimeRange();
            } else {
                stopInertia(chart);
                chart.zoomTimeAt(timeScaleAnchorX, Math.exp(-wheelY * 0.00095));
            }
            chart.requestRender();
        } else if (mouseX > width - AXIS_MARGIN && mouseY <= chartHeight) {
            chart.zoomPriceAt(mouseY, chartHeight, Math.exp(-wheelY * 0.00045));
            chart.requestRender();
        }
    }, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
        if (!e.touches.length) return;
        e.preventDefault();
        stopInertia(chart);
        closeLineTextEditor(true);
        closeLineMenus();
        clearTouchHold();

        const rect = canvas.getBoundingClientRect();
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight - TIME_AXIS_HEIGHT;

        chart.touchMoved = false;
        chart.touchLastTime = performance.now();

        if (e.touches.length >= 2) {
            chart.touchMode = 'pinch';
            chart.lastTouchDistance = getTouchDistance(e.touches);
            chart.lastTouchCenter = getTouchCenter(e.touches, rect);
            chart.crosshair = null;
            return;
        }

        const point = getTouchPoint(e.touches[0], rect);
        chart.lastMouseX = point.x;
        chart.lastMouseY = point.y;
        chart.touchStartX = point.x;
        chart.touchStartY = point.y;
        chart.lastDragTime = performance.now();

        if (point.x > width - AXIS_MARGIN && point.y <= height) {
            chart.touchMode = 'price-axis';
            chart.view.offsetY = 0;
            chart.crosshair = null;
            return;
        }

        if (point.y > height) {
            chart.touchMode = 'time-axis';
            chart.crosshair = null;
            return;
        }

        if (isDrawingAnyTool() && point.x <= canvas.offsetWidth - AXIS_MARGIN && point.y <= height) {
            chart.touchMode = 'draw';
            chart.snapPoint = getSnappedDrawingPoint(chart, point.x, point.y, height);
            chart.requestRender();
            return;
        }

        if (point.x <= width - AXIS_MARGIN && point.y <= height) {
            const lineHandle = findLineHandleAt(chart, point.x, point.y, height);
            if (lineHandle) {
                scheduleTouchDrawingHold({ kind: 'handle', lineIndex: lineHandle.lineIndex, key: lineHandle.key });
            } else {
                const closestLineIndex = findDrawingAt(point.x, point.y, width, height, getLineHitRadius(chart) + 10);
                if (closestLineIndex !== -1) {
                    scheduleTouchDrawingHold({ kind: 'line', lineIndex: closestLineIndex });
                }
            }
        }

        chart.touchMode = 'pan';
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!chart.touchMode || !e.touches.length) return;
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const width = canvas.offsetWidth;
        const chartHeight = canvas.offsetHeight - TIME_AXIS_HEIGHT;

        if (chart.touchMode === 'pinch' && e.touches.length >= 2) {
            const distance = getTouchDistance(e.touches);
            const center = getTouchCenter(e.touches, rect);
            const factor = Math.max(0.92, Math.min(1.08, distance / Math.max(1, chart.lastTouchDistance || distance)));
            chart.zoomTimeAt(Math.min(width - AXIS_MARGIN, Math.max(0, center.x)), factor);
            chart.lastTouchDistance = distance;
            chart.lastTouchCenter = center;
            chart.touchMoved = true;
            chart.requestRender();
            return;
        }

        const point = getTouchPoint(e.touches[0], rect);
        const dx = point.x - chart.lastMouseX;
        const dy = point.y - chart.lastMouseY;
        if (Math.hypot(dx, dy) > 3) chart.touchMoved = true;
        if (chart.touchHoldTimer && Math.hypot(point.x - chart.touchStartX, point.y - chart.touchStartY) > 9) {
            if (chart.touchHoldTarget?.lineIndex === chart.selectedLineIndex && Math.hypot(point.x - chart.touchStartX, point.y - chart.touchStartY) <= 16) {
                chart.lastMouseX = point.x;
                chart.lastMouseY = point.y;
                return;
            }
            clearTouchHold();
        }

        if (chart.touchMode === 'line-drag') {
            if (chart.activeLineHandle && chart.selectedLineIndex !== -1) {
                moveActiveDrawingHandle(point.x, point.y, chartHeight);
                chart.lastMouseX = point.x;
                chart.lastMouseY = point.y;
                chart.requestRender();
            } else if (chart.isMovingLine && chart.selectedLineIndex !== -1) {
                moveSelectedDrawing(point.x, point.y, chartHeight);
                chart.requestRender();
            }
            return;
        }

        if (chart.touchMode === 'draw') {
            if (point.x <= width - AXIS_MARGIN && point.y <= chartHeight) {
                chart.snapPoint = getSnappedDrawingPoint(chart, point.x, point.y, chartHeight);
            }
            chart.requestRender();
        } else if (chart.touchMode === 'price-axis') {
            const clampedDy = Math.sign(dy) * Math.min(36, Math.abs(dy));
            chart.view.offsetY = 0;
            chart.zoomPriceAt(chartHeight / 2, chartHeight, Math.exp(-clampedDy * 0.0018));
            chart.requestRender();
        } else if (chart.touchMode === 'time-axis') {
            const clampedDx = Math.sign(dx) * Math.min(36, Math.abs(dx));
            chart.zoomTimeAt(width - AXIS_MARGIN, Math.exp(-clampedDx * 0.0032));
            chart.requestRender();
        } else {
            const panX = dx * 0.72;
            view.offsetX += panX;
            chart.panPriceByPixels(dy, chartHeight);
            chart.clearTimeRange();

            const now = performance.now();
            const dt = Math.max(1, now - (chart.touchLastTime || now));
            chart.dragVelocityX = panX / dt;
            chart.dragVelocityY = dy / dt;
            chart.touchLastTime = now;
            chart.requestRender();
        }

        chart.lastMouseX = point.x;
        chart.lastMouseY = point.y;
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (!chart.touchMode) return;
        e.preventDefault();
        clearTouchHold();

        const chartHeight = canvas.offsetHeight - TIME_AXIS_HEIGHT;
        if (chart.touchMode === 'line-drag') {
            finalizeSelectedDrawingTimes();
            finishDrawingDragHistory(chart);
            chart.isMovingLine = false;
            chart.activeLineHandle = null;
            chart.snapPoint = null;
            syncLineToolbar(chart);
            chart.render();
        } else if (chart.touchMode === 'draw' && chart.snapPoint) {
            if (chart.isDrawingHorizontalLine || chart.isDrawingVerticalLine) {
                const before = captureDrawingState(chart);
                const newLine = {
                    type: chart.isDrawingHorizontalLine ? 'horizontal' : 'vertical',
                    scaleType: options.scaleType,
                    color: '#2962ff',
                    width: 2,
                    style: 'solid',
                    text: '',
                    textColor: '#131722',
                    textBold: false,
                    textSize: 12,
                    locked: false,
                    point1: { x: chart.snapPoint.x, y: chart.snapPoint.y, time: chart.snapPoint.time },
                };
                lines.push(newLine);
                pushDrawingHistory(chart, before);
                chart.selectedLineIndex = lines.length - 1;
                chart.lineStartPoint = null;
                chart.snapPoint = null;
                chart.isDrawingHorizontalLine = false;
                chart.isDrawingVerticalLine = false;
                chart.showCrosshair = true;
                deactivateDrawingButtons();
                document.getElementById('tool-crosshair')?.classList.add('active');
                syncLineToolbar(chart);
                chart.render();
            } else if (chart.lineStartPoint === null) {
                chart.lineStartPoint = chart.snapPoint;
            } else {
                const lineEndPoint = { x: chart.snapPoint.x, y: chart.snapPoint.y, time: chart.snapPoint.time };
                const newLine = {
                    type: chart.isDrawingFibonacci ? 'fibonacci' : chart.isDrawingMeasure ? 'measure' : chart.isDrawingLine ? 'finite' : 'infinite',
                    scaleType: options.scaleType,
                    color: '#2962ff',
                    width: 2,
                    style: 'solid',
                    text: '',
                    textColor: '#131722',
                    textBold: false,
                    textSize: 12,
                    locked: false,
                    start: chart.isDrawingLine ? { ...chart.lineStartPoint } : undefined,
                    end: chart.isDrawingLine ? lineEndPoint : undefined,
                    point1: (chart.isDrawingInfiniteLine || chart.isDrawingFibonacci || chart.isDrawingMeasure) ? { ...chart.lineStartPoint } : undefined,
                    point2: (chart.isDrawingInfiniteLine || chart.isDrawingFibonacci || chart.isDrawingMeasure) ? lineEndPoint : undefined,
                };
                const before = captureDrawingState(chart);
                lines.push(newLine);
                pushDrawingHistory(chart, before);
                chart.selectedLineIndex = lines.length - 1;
                chart.lineStartPoint = null;
                chart.snapPoint = null;
                chart.isDrawingLine = false;
                chart.isDrawingInfiniteLine = false;
                chart.isDrawingHorizontalLine = false;
                chart.isDrawingVerticalLine = false;
                chart.isDrawingFibonacci = false;
                chart.isDrawingMeasure = false;
                chart.showCrosshair = true;
                deactivateDrawingButtons();
                document.getElementById('tool-crosshair')?.classList.add('active');
                syncLineToolbar(chart);
            }
            chart.render();
        } else if (chart.touchMode === 'pan') {
            if (chart.touchMoved) {
                startPanInertia(chart, chartHeight);
            } else {
                const width = canvas.offsetWidth;
                const textHit = findLineTextAt(chart, chart.lastMouseX, chart.lastMouseY, width, chartHeight);
                if (textHit) {
                    openLineTextEditor(textHit.lineIndex);
                    chart.touchMode = null;
                    chart.lastTouchDistance = 0;
                    chart.lastTouchCenter = null;
                    chart.touchMoved = false;
                    return;
                }
                const closestLineIndex = findDrawingAt(chart.lastMouseX, chart.lastMouseY, width, chartHeight, getLineHitRadius(chart) + 8);
                chart.selectedLineIndex = closestLineIndex;
                chart.hoveredLineIndex = closestLineIndex;
                chart.activeLineHandle = null;
                chart.isMovingLine = false;
                syncLineToolbar(chart);
                chart.render();
            }
        }

        chart.touchMode = null;
        chart.lastTouchDistance = 0;
        chart.lastTouchCenter = null;
        chart.touchMoved = false;
    }, { passive: false });

    canvas.addEventListener('touchcancel', () => {
        clearTouchHold();
        if (chart.touchMode === 'line-drag') {
            finalizeSelectedDrawingTimes();
            finishDrawingDragHistory(chart);
        }
        chart.isMovingLine = false;
        chart.activeLineHandle = null;
        chart.touchMode = null;
        chart.lastTouchDistance = 0;
        chart.lastTouchCenter = null;
        chart.touchMoved = false;
    }, { passive: false });

    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        stopInertia(chart);
        closeLineMenus();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight - TIME_AXIS_HEIGHT;

        const textHit = mouseX <= width - AXIS_MARGIN && mouseY <= height
            ? findLineTextAt(chart, mouseX, mouseY, width, height)
            : null;
        if (textHit && !isDrawingAnyTool()) {
            e.preventDefault();
            openLineTextEditor(textHit.lineIndex);
            chart.render();
            return;
        }

        closeLineTextEditor(true);

        if (mouseX > width - AXIS_MARGIN) {
            chart.isResizingY = true;
            chart.view.offsetY = 0;
            chart.lastMouseY = mouseY;
            canvas.style.cursor = 'ns-resize';
            return;
        } else if (mouseY > height) {
            chart.isResizingX = true;
            chart.lastMouseX = mouseX;
            canvas.style.cursor = 'ew-resize';
            return;
        }

        if (mouseX <= width - AXIS_MARGIN && mouseY <= height) {
            const candleWidth = chart.getCandleWidth();
            const spacing = chart.getBarSpacing();
            const lineHandle = findLineHandleAt(chart, mouseX, mouseY, height);
            if (lineHandle && !isDrawingAnyTool()) {
                chart.selectedLineIndex = lineHandle.lineIndex;
                chart.activeLineHandle = lines[lineHandle.lineIndex]?.locked ? null : lineHandle.key;
                if (chart.activeLineHandle) beginDrawingDragHistory(chart);
                syncLineToolbar(chart);
                chart.lastMouseX = mouseX;
                chart.lastMouseY = mouseY;
                canvas.style.cursor = 'grab';
                chart.render();
                return;
            }

            const closestLineIndex = findDrawingAt(mouseX, mouseY, width, height);

            if (closestLineIndex !== -1 && !isDrawingAnyTool()) {
                chart.selectedLineIndex = closestLineIndex;
                chart.isMovingLine = !lines[closestLineIndex]?.locked;
                if (chart.isMovingLine) beginDrawingDragHistory(chart);
                syncLineToolbar(chart);
                chart.lastMouseX = mouseX;
                chart.lastMouseY = mouseY;
                canvas.style.cursor = chart.isMovingLine ? 'grab' : 'default';
                chart.render();
                return;
            }

            if (isDrawingAnyTool()) {
                const point = getSnappedDrawingPoint(chart, mouseX, mouseY, height);
                chart.snapPoint = point;
                if (chart.isDrawingHorizontalLine || chart.isDrawingVerticalLine) {
                    const before = captureDrawingState(chart);
                    const newLine = {
                        type: chart.isDrawingHorizontalLine ? 'horizontal' : 'vertical',
                        scaleType: options.scaleType,
                        color: '#2962ff',
                        width: 2,
                        style: 'solid',
                        text: '',
                        textColor: '#131722',
                        textBold: false,
                        textSize: 12,
                        locked: false,
                        point1: { x: point.x, y: point.y, time: point.time },
                    };
                    lines.push(newLine);
                    pushDrawingHistory(chart, before);
                    chart.selectedLineIndex = lines.length - 1;
                    chart.lineStartPoint = null;
                    chart.snapPoint = null;
                    chart.isDrawingHorizontalLine = false;
                    chart.isDrawingVerticalLine = false;
                    chart.showCrosshair = true;
                    deactivateDrawingButtons();
                    document.getElementById('tool-crosshair')?.classList.add('active');
                    document.activeElement?.blur?.();
                    syncLineToolbar(chart);
                    chart.render();
                    return;
                }
                if (chart.lineStartPoint === null) {
                    chart.lineStartPoint = point;
                } else {
                    const lineEndPoint = { x: point.x, y: point.y, time: point.time };
                    const newLine = {
                        type: chart.isDrawingFibonacci ? 'fibonacci' : chart.isDrawingMeasure ? 'measure' : chart.isDrawingLine ? 'finite' : 'infinite',
                        scaleType: options.scaleType,
                        color: '#2962ff',
                        width: 2,
                        style: 'solid',
                        text: '',
                        textColor: '#131722',
                        textBold: false,
                        textSize: 12,
                        locked: false,
                        start: chart.isDrawingLine ? { ...chart.lineStartPoint } : undefined,
                        end: chart.isDrawingLine ? lineEndPoint : undefined,
                        point1: (chart.isDrawingInfiniteLine || chart.isDrawingFibonacci || chart.isDrawingMeasure) ? { ...chart.lineStartPoint } : undefined,
                        point2: (chart.isDrawingInfiniteLine || chart.isDrawingFibonacci || chart.isDrawingMeasure) ? lineEndPoint : undefined,
                    };
                    if ((newLine.start || newLine.point1) && (newLine.end || newLine.point2)) {
                        const before = captureDrawingState(chart);
                        lines.push(newLine);
                        pushDrawingHistory(chart, before);
                        chart.selectedLineIndex = lines.length - 1;
                        chart.lineStartPoint = null;
                        chart.snapPoint = null;
                        chart.isDrawingLine = false;
                        chart.isDrawingInfiniteLine = false;
                        chart.isDrawingHorizontalLine = false;
                        chart.isDrawingVerticalLine = false;
                        chart.isDrawingFibonacci = false;
                        chart.isDrawingMeasure = false;
                        chart.showCrosshair = true;
                        deactivateDrawingButtons();
                        document.getElementById('tool-crosshair')?.classList.add('active');
                        document.activeElement?.blur?.();
                        syncLineToolbar(chart);
                        chart.render();
                    } else {
                        console.warn('Invalid line created:', newLine);
                    }
                }
            } else {
                chart.selectedLineIndex = -1;
                syncLineToolbar(chart);
                chart.isDragging = true;
                chart.snapPoint = null;
                chart.lastMouseX = mouseX;
                chart.lastMouseY = mouseY;
                chart.lastDragTime = performance.now();
                chart.render();
            }
        } else {
            chart.selectedLineIndex = -1;
            syncLineToolbar(chart);
            chart.isDragging = true;
            chart.snapPoint = null;
            chart.lastMouseX = mouseX;
            chart.lastMouseY = mouseY;
            chart.lastDragTime = performance.now();
            chart.render();
        }
    });

    canvas.addEventListener('dblclick', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const width = canvas.offsetWidth;
        const chartHeight = canvas.offsetHeight - TIME_AXIS_HEIGHT;

        const textHit = mouseX <= width - AXIS_MARGIN && mouseY <= chartHeight
            ? findLineTextAt(chart, mouseX, mouseY, width, chartHeight)
            : null;
        if (textHit) {
            openLineTextEditor(textHit.lineIndex);
            return;
        }

        if (mouseX > width - AXIS_MARGIN && mouseY <= chartHeight) {
            chart.setAutoScaleY(true);
            chart.render();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        const chartHeight = height - TIME_AXIS_HEIGHT;

        if (chart.isResizingY) {
            const dy = mouseY - chart.lastMouseY;
            const clampedDy = Math.sign(dy) * Math.min(40, Math.abs(dy));
            chart.view.offsetY = 0;
            chart.zoomPriceAt(chartHeight / 2, chartHeight, Math.exp(-clampedDy * 0.0018));
            chart.lastMouseY = mouseY;
            canvas.style.cursor = 'ns-resize';
            chart.requestRender();
        } else if (chart.isResizingX) {
            const dx = mouseX - chart.lastMouseX;
            const clampedDx = Math.sign(dx) * Math.min(40, Math.abs(dx));
            chart.zoomTimeAt(width - AXIS_MARGIN, Math.exp(-clampedDx * 0.0032));
            chart.lastMouseX = mouseX;
            canvas.style.cursor = 'ew-resize';
            chart.requestRender();
        } else if (chart.isDragging) {
            const dx = mouseX - chart.lastMouseX;
            const dy = mouseY - chart.lastMouseY;
            const panX = dx * 0.62;
            view.offsetX += panX;
            chart.panPriceByPixels(dy, chartHeight);
            chart.clearTimeRange();
            const now = performance.now();
            const dt = Math.max(1, now - (chart.lastDragTime || now));
            chart.dragVelocityX = panX / dt;
            chart.dragVelocityY = dy / dt;
            chart.lastDragTime = now;
            chart.lastMouseX = mouseX;
            chart.lastMouseY = mouseY;
            canvas.style.cursor = 'move';
            chart.requestRender();
        } else if (chart.activeLineHandle && chart.selectedLineIndex !== -1) {
            if (mouseX > width - AXIS_MARGIN || mouseY > chartHeight) {
                canvas.style.cursor = 'grabbing';
                return;
            }
            const line = lines[chart.selectedLineIndex];
            const point = getSnappedDrawingPoint(chart, mouseX, mouseY, chartHeight);
            if (line && line[chart.activeLineHandle]) {
                line[chart.activeLineHandle] = { x: point.x, y: point.y };
                if (point.time) line[chart.activeLineHandle].time = point.time;
                chart.snapPoint = point;
                markDrawingDragChanged(chart);
            }
            canvas.style.cursor = 'grabbing';
            chart.requestRender();
        } else if (chart.isMovingLine && chart.selectedLineIndex !== -1) {
            const candleWidth = chart.getCandleWidth();
            const spacing = chart.getBarSpacing();
            const dx = (mouseX - chart.lastMouseX) / (candleWidth + spacing);
            const previousPrice = yToPrice(chart.lastMouseY, chartHeight, view, options.scaleType);
            const currentPrice = yToPrice(mouseY, chartHeight, view, options.scaleType);
            const dy = currentPrice - previousPrice;
            const logMoveRatio = currentPrice / Math.max(previousPrice, 1e-10);
            const line = lines[chart.selectedLineIndex];
            if (line.locked) {
                chart.isMovingLine = false;
                canvas.style.cursor = 'default';
                return;
            }
            if (line.type === 'finite' && line.start && line.end) {
                line.start.x = getDrawingPointX(chart, line.start) + dx;
                line.start.y = options.scaleType === 'logarithmic' ? line.start.y * logMoveRatio : line.start.y + dy;
                line.end.x = getDrawingPointX(chart, line.end) + dx;
                line.end.y = options.scaleType === 'logarithmic' ? line.end.y * logMoveRatio : line.end.y + dy;
                updatePointTimeFromX(line.start);
                updatePointTimeFromX(line.end);
                markDrawingDragChanged(chart);
            } else if (line.type === 'horizontal' && line.point1) {
                line.point1.y = options.scaleType === 'logarithmic' ? line.point1.y * logMoveRatio : line.point1.y + dy;
                markDrawingDragChanged(chart);
            } else if (line.type === 'vertical' && line.point1) {
                line.point1.x = getDrawingPointX(chart, line.point1) + dx;
                delete line.point1.time;
                markDrawingDragChanged(chart);
            } else if ((line.type === 'infinite' || line.type === 'fibonacci' || line.type === 'measure') && line.point1 && line.point2) {
                line.point1.x = getDrawingPointX(chart, line.point1) + dx;
                line.point1.y = options.scaleType === 'logarithmic' ? line.point1.y * logMoveRatio : line.point1.y + dy;
                line.point2.x = getDrawingPointX(chart, line.point2) + dx;
                line.point2.y = options.scaleType === 'logarithmic' ? line.point2.y * logMoveRatio : line.point2.y + dy;
                if (line.type === 'measure') {
                    delete line.point1.time;
                    delete line.point2.time;
                } else {
                    updatePointTimeFromX(line.point1);
                    updatePointTimeFromX(line.point2);
                }
                markDrawingDragChanged(chart);
            }
            chart.lastMouseX = mouseX;
            chart.lastMouseY = mouseY;
            canvas.style.cursor = 'grabbing';
            chart.requestRender();
        } else if (isDrawingAnyTool()) {
            chart.hoveredLineIndex = -1;
            if (mouseX > width - AXIS_MARGIN || mouseY > chartHeight) {
                chart.snapPoint = null;
                canvas.style.cursor = 'crosshair';
            } else {
                chart.snapPoint = getSnappedDrawingPoint(chart, mouseX, mouseY, chartHeight);
                canvas.style.cursor = 'crosshair';
            }
            chart.requestRender();
        } else if (chart.showCrosshair && !isDrawingAnyTool()) {
            if (mouseX > width - AXIS_MARGIN) {
                chart.crosshair = null;
                canvas.style.cursor = 'ns-resize';
            } else if (mouseY > chartHeight) {
                chart.crosshair = null;
                canvas.style.cursor = 'ew-resize';
            } else {
                const candleWidth = chart.getCandleWidth();
                const spacing = chart.getBarSpacing();
                const slotWidth = candleWidth + spacing;
                const candleIndex = Math.max(0, Math.round((mouseX - view.offsetX - candleWidth / 2) / slotWidth));
                const snappedX = candleIndex * slotWidth + view.offsetX + candleWidth / 2;
                chart.crosshair = { x: snappedX, y: mouseY, candleIndex };
                const lineHandle = findLineHandleAt(chart, mouseX, mouseY, chartHeight);
                const textHitBeforeLineCheck = findLineTextAt(chart, mouseX, mouseY, width, chartHeight);
                let isNearLine = false;
                let hoveredLineIndex = -1;
                const hitRadius = getLineHitRadius(chart);
                if (!lineHandle && lines.length) {
                    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                        const line = lines[lineIndex];
                        if (!line || (!line.start && !line.point1)) continue;
                        if (line.type === 'fibonacci') {
                            const distance = getFibonacciHit(chart, line, mouseX, mouseY, width, chartHeight);
                            if (distance < hitRadius) {
                                isNearLine = true;
                                hoveredLineIndex = lineIndex;
                            }
                        } else if (line.type === 'measure') {
                            const distance = getMeasureHit(chart, line, mouseX, mouseY, chartHeight);
                            if (distance < hitRadius) {
                                isNearLine = true;
                                hoveredLineIndex = lineIndex;
                            }
                        } else {
                            const points = getLinePoints(chart, line, width, chartHeight, candleWidth, spacing, 32);
                            for (let i = 0; i < points.length - 1; i++) {
                                const x1 = points[i].x;
                                const y1 = points[i].y;
                                const x2 = points[i + 1].x;
                                const y2 = points[i + 1].y;
                                const distance = distanceToLineSegment(mouseX, mouseY, x1, y1, x2, y2);
                                if (distance < hitRadius) {
                                    isNearLine = true;
                                    hoveredLineIndex = lineIndex;
                                    break;
                                }
                            }
                        }
                        if (isNearLine) break;
                    }
                }
                chart.hoveredLineIndex = lineHandle
                    ? lineHandle.lineIndex
                    : textHitBeforeLineCheck
                        ? textHitBeforeLineCheck.lineIndex
                        : hoveredLineIndex;
                const textHit = findLineTextAt(chart, mouseX, mouseY, width, chartHeight);
            canvas.style.cursor = textHit ? 'text' : lineHandle ? 'grab' : isNearLine ? 'pointer' : 'default';
            }
            chart.requestRender();
        } else {
            chart.hoveredLineIndex = -1;
            canvas.style.cursor = 'default';
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            const shouldInertia = chart.isDragging && !chart.isMovingLine && !chart.activeLineHandle && !chart.isResizingX && !chart.isResizingY;
            const chartHeight = canvas.offsetHeight - TIME_AXIS_HEIGHT;
            finalizeSelectedDrawingTimes();
            finishDrawingDragHistory(chart);
            chart.isDragging = false;
            chart.isMovingLine = false;
            chart.activeLineHandle = null;
            chart.hoveredLineIndex = -1;
            chart.isResizingY = false;
            chart.isResizingX = false;
            if (!isDrawingAnyTool()) {
                chart.snapPoint = null;
            }
            canvas.style.cursor = 'default';
            if (shouldInertia) {
                startPanInertia(chart, chartHeight);
            }
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (chart.isDragging || chart.isResizingY || chart.isResizingX || chart.isMovingLine || chart.activeLineHandle) {
            const shouldInertia = chart.isDragging && !chart.isMovingLine && !chart.activeLineHandle && !chart.isResizingX && !chart.isResizingY;
            const chartHeight = canvas.offsetHeight - TIME_AXIS_HEIGHT;
            finalizeSelectedDrawingTimes();
            finishDrawingDragHistory(chart);
            chart.isDragging = false;
            chart.isMovingLine = false;
            chart.activeLineHandle = null;
            chart.hoveredLineIndex = -1;
            chart.isResizingY = false;
            chart.isResizingX = false;
            if (!isDrawingAnyTool()) {
                chart.snapPoint = null;
            }
            canvas.style.cursor = 'default';
            if (shouldInertia) {
                startPanInertia(chart, chartHeight);
            } else {
                chart.render();
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (lineTextEditor && !lineTextEditor.hidden) return;
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && !isEditableTarget(e.target)) {
            const key = e.key.toLowerCase();
            if (key === 'z') {
                if (undoDrawingChange(chart)) e.preventDefault();
                return;
            }
            if (key === 'c' && chart.selectedLineIndex !== -1) {
                copySelectedDrawing();
                e.preventDefault();
                return;
            }
            if (key === 'v' && chart.copiedDrawing) {
                pasteCopiedDrawing();
                e.preventDefault();
                return;
            }
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && chart.selectedLineIndex !== -1) {
            deleteSelectedLine(chart);
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target?.closest?.('#line-toolbar')) return;
        closeLineMenus();
    });

    const scaleSelect = document.getElementById('scale-select');
    if (scaleSelect) {
        scaleSelect.addEventListener('change', (e) => {
            lines.forEach((line) => {
                if (line && !line.scaleType) line.scaleType = options.scaleType;
            });
            options.scaleType = e.target.value;
            chart.setAutoScaleY(true);
            view.priceStep = null;
            chart.render();
        });
    } else {
        console.error('scale-select element not found');
    }

    document.getElementById('tool-undo')?.addEventListener('click', () => {
        closeLineTextEditor(true);
        undoDrawingChange(chart);
    });

    setupColorMenu({
        buttonId: 'line-color-button',
        menuId: 'line-color-menu',
        inputId: 'line-color',
        swatchId: 'line-color-swatch',
        field: 'color',
        fallback: '#2962ff',
    });
    setupChoiceMenu({
        buttonId: 'line-width-button',
        menuId: 'line-width-menu',
        onSelect: (value) => mutateSelectedLine(chart, line => { line.width = value || 2; }),
    });
    setupColorMenu({
        buttonId: 'line-text-color-button',
        menuId: 'line-text-color-menu',
        inputId: 'line-text-color',
        swatchId: 'line-text-color-swatch',
        field: 'textColor',
        fallback: '#131722',
    });
    setupLineStyleMenu();
    setupChoiceMenu({
        buttonId: 'line-text-size-button',
        menuId: 'line-text-size-menu',
        onSelect: (value) => mutateSelectedLine(chart, line => { line.textSize = value || 12; }),
    });
    setupMoreMenu();

    const lineToolbarElement = document.getElementById('line-toolbar');
    let toolbarMenuPointerHandled = false;
    const toolbarMenuButtons = {
        'line-color-button': 'line-color-menu',
        'line-style-button': 'line-style-menu',
        'line-width-button': 'line-width-menu',
        'line-text-color-button': 'line-text-color-menu',
        'line-text-size-button': 'line-text-size-menu',
        'line-more-button': 'line-more-menu',
    };
    function handleToolbarMenuToggle(e) {
        const button = e.target?.closest?.(Object.keys(toolbarMenuButtons).map(id => `#${id}`).join(','));
        if (!button) return;
        if (e.type === 'click' && toolbarMenuPointerHandled) {
            toolbarMenuPointerHandled = false;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation?.();
            return;
        }

        const menu = document.getElementById(toolbarMenuButtons[button.id]);
        if (!menu) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        if (e.type === 'pointerup') toolbarMenuPointerHandled = true;

        const willOpen = menu.hidden;
        closeLineMenus(menu);
        menu.hidden = !willOpen;
        if (willOpen) positionToolbarMenu(menu, button);
        syncLineToolbar(chart);
    }
    lineToolbarElement?.addEventListener('pointerup', handleToolbarMenuToggle, true);
    lineToolbarElement?.addEventListener('click', handleToolbarMenuToggle, true);

    function setupMobileCopyPasteButton(buttonId, action) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        let lastPointerTime = 0;
        button.addEventListener('pointerup', (e) => {
            if (button.disabled) return;
            e.preventDefault();
            e.stopPropagation();
            lastPointerTime = performance.now();
            closeLineMenus();
            action();
        });
        button.addEventListener('click', (e) => {
            if (button.disabled || performance.now() - lastPointerTime < 500) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            e.stopPropagation();
            closeLineMenus();
            action();
        });
    }
    function setupPointerButton(buttonId, action) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        let lastPointerTime = 0;
        button.addEventListener('pointerup', (e) => {
            if (button.disabled) return;
            e.preventDefault();
            e.stopPropagation();
            lastPointerTime = performance.now();
            closeLineMenus();
            action();
        });
        button.addEventListener('click', (e) => {
            if (button.disabled || performance.now() - lastPointerTime < 500) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            e.stopPropagation();
            closeLineMenus();
            action();
        });
    }
    setupMobileCopyPasteButton('line-copy', copySelectedDrawing);
    setupMobileCopyPasteButton('line-paste', pasteCopiedDrawing);
    setupMobileCopyPasteButton('line-more-copy', copySelectedDrawing);
    setupMobileCopyPasteButton('line-more-paste', pasteCopiedDrawing);
    setupMobileCopyPasteButton('line-more-lock', () => {
        mutateSelectedLine(chart, line => { line.locked = !line.locked; });
    });
    setupMobileCopyPasteButton('line-more-delete', () => {
        deleteSelectedLine(chart);
    });
    setupPointerButton('line-text-bold', () => {
        mutateSelectedLine(chart, line => { line.textBold = !line.textBold; });
    });
    setupPointerButton('line-lock', () => {
        mutateSelectedLine(chart, line => { line.locked = !line.locked; });
    });
    setupPointerButton('line-delete', () => {
        deleteSelectedLine(chart);
    });

    const intervalSelect = document.getElementById('interval-select');
    if (intervalSelect) {
        intervalSelect.addEventListener('change', (e) => {
            chart.setCandleInterval(e.target.value);
        });
    } else {
        console.error('interval-select element not found');
    }

    const customIntervalValue = document.getElementById('custom-interval-value');
    const customIntervalUnit = document.getElementById('custom-interval-unit');
    const customIntervalApply = document.getElementById('custom-interval-apply');
    if (customIntervalValue && customIntervalUnit && customIntervalApply && intervalSelect) {
        customIntervalApply.addEventListener('click', () => {
            const amount = Number.parseInt(customIntervalValue.value, 10);
            if (!Number.isFinite(amount) || amount < 1) return;

            const interval = `${amount}${customIntervalUnit.value}`;
            if (!Array.from(intervalSelect.options).some(option => option.value === interval)) {
                intervalSelect.add(new Option(interval, interval));
            }
            intervalSelect.value = interval;
            chart.setCandleInterval(interval);
        });
    }

    const crosshairButton = document.getElementById('tool-crosshair');
    if (crosshairButton) {
        crosshairButton.classList.add('active');
        crosshairButton.addEventListener('click', () => {
            chart.showCrosshair = !chart.showCrosshair;
            chart.isDrawingLine = false;
            chart.isDrawingInfiniteLine = false;
            chart.isDrawingHorizontalLine = false;
            chart.isDrawingVerticalLine = false;
            chart.isDrawingFibonacci = false;
            chart.isDrawingMeasure = false;
            chart.lineStartPoint = null;
            chart.snapPoint = null;
            chart.activeLineHandle = null;
            chart.selectedLineIndex = -1;
            syncLineToolbar(chart);
            crosshairButton.classList.toggle('active');
            deactivateDrawingButtons();
            chart.render();
        });
    } else {
        console.error('tool-crosshair element not found');
    }

    const maButton = document.getElementById('tool-ma');
    if (maButton) {
        maButton.addEventListener('click', () => {
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
            chart.isDrawingHorizontalLine = false;
            chart.isDrawingVerticalLine = false;
            chart.isDrawingFibonacci = false;
            chart.isDrawingMeasure = false;
            chart.showCrosshair = !chart.isDrawingLine;
            chart.lineStartPoint = null;
            chart.snapPoint = null;
            chart.activeLineHandle = null;
            chart.selectedLineIndex = -1;
            syncLineToolbar(chart);
            lineButton.classList.toggle('active');
            crosshairButton?.classList.toggle('active', !chart.isDrawingLine);
            document.getElementById('tool-infinite-line')?.classList.remove('active');
            document.getElementById('tool-horizontal-line')?.classList.remove('active');
            document.getElementById('tool-vertical-line')?.classList.remove('active');
            document.getElementById('tool-fibonacci')?.classList.remove('active');
            document.getElementById('tool-measure')?.classList.remove('active');
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
            chart.isDrawingHorizontalLine = false;
            chart.isDrawingVerticalLine = false;
            chart.isDrawingFibonacci = false;
            chart.isDrawingMeasure = false;
            chart.showCrosshair = !chart.isDrawingInfiniteLine;
            chart.lineStartPoint = null;
            chart.snapPoint = null;
            chart.activeLineHandle = null;
            chart.selectedLineIndex = -1;
            syncLineToolbar(chart);
            infiniteLineButton.classList.toggle('active');
            crosshairButton?.classList.toggle('active', !chart.isDrawingInfiniteLine);
            lineButton?.classList.remove('active');
            document.getElementById('tool-horizontal-line')?.classList.remove('active');
            document.getElementById('tool-vertical-line')?.classList.remove('active');
            document.getElementById('tool-fibonacci')?.classList.remove('active');
            document.getElementById('tool-measure')?.classList.remove('active');
            chart.render();
        });
    } else {
        console.error('tool-infinite-line element not found');
    }

    const horizontalLineButton = document.getElementById('tool-horizontal-line');
    if (horizontalLineButton) {
        horizontalLineButton.addEventListener('click', () => {
            chart.isDrawingHorizontalLine = !chart.isDrawingHorizontalLine;
            chart.isDrawingLine = false;
            chart.isDrawingInfiniteLine = false;
            chart.isDrawingVerticalLine = false;
            chart.isDrawingFibonacci = false;
            chart.isDrawingMeasure = false;
            chart.showCrosshair = !chart.isDrawingHorizontalLine;
            chart.lineStartPoint = null;
            chart.snapPoint = null;
            chart.activeLineHandle = null;
            chart.selectedLineIndex = -1;
            syncLineToolbar(chart);
            horizontalLineButton.classList.toggle('active');
            crosshairButton?.classList.toggle('active', !chart.isDrawingHorizontalLine);
            lineButton?.classList.remove('active');
            infiniteLineButton?.classList.remove('active');
            document.getElementById('tool-vertical-line')?.classList.remove('active');
            fibonacciButton?.classList.remove('active');
            measureButton?.classList.remove('active');
            chart.render();
        });
    } else {
        console.error('tool-horizontal-line element not found');
    }

    const verticalLineButton = document.getElementById('tool-vertical-line');
    if (verticalLineButton) {
        verticalLineButton.addEventListener('click', () => {
            chart.isDrawingVerticalLine = !chart.isDrawingVerticalLine;
            chart.isDrawingLine = false;
            chart.isDrawingInfiniteLine = false;
            chart.isDrawingHorizontalLine = false;
            chart.isDrawingFibonacci = false;
            chart.isDrawingMeasure = false;
            chart.showCrosshair = !chart.isDrawingVerticalLine;
            chart.lineStartPoint = null;
            chart.snapPoint = null;
            chart.activeLineHandle = null;
            chart.selectedLineIndex = -1;
            syncLineToolbar(chart);
            verticalLineButton.classList.toggle('active');
            crosshairButton?.classList.toggle('active', !chart.isDrawingVerticalLine);
            lineButton?.classList.remove('active');
            infiniteLineButton?.classList.remove('active');
            horizontalLineButton?.classList.remove('active');
            fibonacciButton?.classList.remove('active');
            measureButton?.classList.remove('active');
            chart.render();
        });
    } else {
        console.error('tool-vertical-line element not found');
    }

    const fibonacciButton = document.getElementById('tool-fibonacci');
    if (fibonacciButton) {
        fibonacciButton.addEventListener('click', () => {
            chart.isDrawingFibonacci = !chart.isDrawingFibonacci;
            chart.isDrawingLine = false;
            chart.isDrawingInfiniteLine = false;
            chart.isDrawingHorizontalLine = false;
            chart.isDrawingVerticalLine = false;
            chart.isDrawingMeasure = false;
            chart.showCrosshair = !chart.isDrawingFibonacci;
            chart.lineStartPoint = null;
            chart.snapPoint = null;
            chart.activeLineHandle = null;
            chart.selectedLineIndex = -1;
            syncLineToolbar(chart);
            fibonacciButton.classList.toggle('active');
            crosshairButton?.classList.toggle('active', !chart.isDrawingFibonacci);
            lineButton?.classList.remove('active');
            infiniteLineButton?.classList.remove('active');
            horizontalLineButton?.classList.remove('active');
            verticalLineButton?.classList.remove('active');
            document.getElementById('tool-measure')?.classList.remove('active');
            chart.render();
        });
    } else {
        console.error('tool-fibonacci element not found');
    }

    const measureButton = document.getElementById('tool-measure');
    if (measureButton) {
        measureButton.addEventListener('click', () => {
            chart.isDrawingMeasure = !chart.isDrawingMeasure;
            chart.isDrawingLine = false;
            chart.isDrawingInfiniteLine = false;
            chart.isDrawingHorizontalLine = false;
            chart.isDrawingVerticalLine = false;
            chart.isDrawingFibonacci = false;
            chart.showCrosshair = !chart.isDrawingMeasure;
            chart.lineStartPoint = null;
            chart.snapPoint = null;
            chart.activeLineHandle = null;
            chart.selectedLineIndex = -1;
            syncLineToolbar(chart);
            measureButton.classList.toggle('active');
            crosshairButton?.classList.toggle('active', !chart.isDrawingMeasure);
            lineButton?.classList.remove('active');
            infiniteLineButton?.classList.remove('active');
            horizontalLineButton?.classList.remove('active');
            verticalLineButton?.classList.remove('active');
            fibonacciButton?.classList.remove('active');
            chart.render();
        });
    } else {
        console.error('tool-measure element not found');
    }

    const resetButton = document.getElementById('tool-reset');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            const beforeDrawingsReset = lines.length ? captureDrawingState(chart) : null;
            view.offsetY = 0;
            view.scaleX = 1;
            view.scaleY = 1;
            view.offsetX = (canvas.offsetWidth - AXIS_MARGIN) - ((dataManager.data.length - 1) * chart.getSlotWidth()) - chart.getCandleWidth();
            chart.setAutoScaleY(true);
            chart.clearTimeRange();
            chart.clampOffsetX();
            lines.length = 0;
            if (beforeDrawingsReset) pushDrawingHistory(chart, beforeDrawingsReset);
            chart.selectedLineIndex = -1;
            chart.isDrawingLine = false;
            chart.isDrawingInfiniteLine = false;
            chart.isDrawingHorizontalLine = false;
            chart.isDrawingVerticalLine = false;
            chart.isDrawingFibonacci = false;
            chart.isDrawingMeasure = false;
            chart.lineStartPoint = null;
            chart.snapPoint = null;
            chart.activeLineHandle = null;
            deactivateDrawingButtons();
            syncLineToolbar(chart);
            chart.render();
        });
    } else {
        console.error('tool-reset element not found');
    }

    const rangeButtons = Array.from(document.querySelectorAll('.range-button'));
    const rangeStatus = document.getElementById('range-status');
    if (rangeButtons.length) {
        rangeButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const range = button.dataset.range;
                const applied = chart.setQuickRange(range);
                if (applied) {
                    rangeButtons.forEach(item => item.classList.toggle('active', item === button));
                }
                if (rangeStatus) {
                    rangeStatus.textContent = applied && chart.view.timeRange
                        ? `${chart.view.timeRange.startDate} to ${chart.view.timeRange.endDate}`
                        : range === 'ALL' && applied
                            ? 'All data'
                            : 'No data in range';
                }
            });
        });
    }

    window.addEventListener('resize', () => chart.resize());
}
