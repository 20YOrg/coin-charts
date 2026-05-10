import { Chart } from './chart.js';
import { btcUsdData } from '../data/btc-usd.js';
import { openMAModal } from './modal.js';

if (typeof btcUsdData !== 'undefined') {
    const canvas = document.getElementById('chart');
    const chart = new Chart(canvas, {
        data: btcUsdData,
        candleWidth: 10,
        upColor: '#089981',
        downColor: '#F23645',
        background: '#FFFFFF',
        axisColor: '#131722',
        scaleType: 'linear',
    });

    // Attach modal event listener
    document.getElementById('tool-ma').addEventListener('click', () => openMAModal(chart));
} else {
    console.error('BTC/USD data not loaded');
}
