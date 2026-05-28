import { Chart } from './chart.js';
import { btcUsdData } from '../data/btc-usd.js';
import { openMAModal } from './modal.js';

if (typeof btcUsdData !== 'undefined') {
    const canvas = document.getElementById('chart');
    const storedTheme = localStorage.getItem('coin-charts:theme');
    const savedTheme = storedTheme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = savedTheme;
    const chart = new Chart(canvas, {
        data: btcUsdData,
        candleWidth: 10,
        theme: savedTheme,
        scaleType: 'linear',
    });

    // Attach modal event listener
    document.getElementById('tool-ma').addEventListener('click', () => openMAModal(chart));

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const syncThemeToggle = () => {
            const isDark = chart.options.theme === 'dark';
            themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
            themeToggle.setAttribute('aria-pressed', String(isDark));
            themeToggle.dataset.theme = chart.options.theme;
        };
        syncThemeToggle();
        themeToggle.addEventListener('click', () => {
            const nextTheme = chart.options.theme === 'dark' ? 'light' : 'dark';
            chart.setTheme(nextTheme);
            document.documentElement.dataset.theme = nextTheme;
            localStorage.setItem('coin-charts:theme', nextTheme);
            syncThemeToggle();
        });
    }
} else {
    console.error('BTC/USD data not loaded');
}
