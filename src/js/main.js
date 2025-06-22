import { Chart } from './chart.js';
import { btcUsdData } from '../data/btc-usd.js';
import { openMAModal } from './modal.js';

if (typeof btcUsdData !== 'undefined') {
    const canvas = document.getElementById('chart');
    const chart = new Chart(canvas, {
        data: btcUsdData,
        candleWidth: 10,
        upColor: '#F08852',
        downColor: '#6D96E7',
        background: '#FFFFFF',
        axisColor: '#333333',
        scaleType: 'linear',
    });

    // Attach modal event listener
    document.getElementById('tool-ma').addEventListener('click', () => openMAModal(chart));
} else {
    console.error('BTC/USD data not loaded');
}