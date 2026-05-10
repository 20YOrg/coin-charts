import { readFile, writeFile } from 'node:fs/promises';

const DATA_FILE = new URL('../src/data/btc-usd.js', import.meta.url);
const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD';
const START_UNIX_SECONDS = Math.floor(Date.UTC(2010, 6, 14) / 1000);
const END_UNIX_SECONDS = Math.floor(Date.now() / 1000);

function toISODate(timestampSeconds) {
    return new Date(timestampSeconds * 1000).toISOString().split('T')[0];
}

function parseExistingData(source) {
    const candlePattern = /\{\s*time:\s*"([^"]+)",\s*open:\s*([-0-9.]+),\s*high:\s*([-0-9.]+),\s*low:\s*([-0-9.]+),\s*close:\s*([-0-9.]+)\s*\}/g;
    const candles = [];
    let match;

    while ((match = candlePattern.exec(source)) !== null) {
        candles.push({
            time: match[1],
            open: Number(match[2]),
            high: Number(match[3]),
            low: Number(match[4]),
            close: Number(match[5]),
        });
    }

    return candles;
}

function formatNumber(value) {
    return Number(value).toFixed(2);
}

function formatDataModule(candles) {
    const lines = candles.map((candle) => (
        `    { time: "${candle.time}", open: ${formatNumber(candle.open)}, high: ${formatNumber(candle.high)}, low: ${formatNumber(candle.low)}, close: ${formatNumber(candle.close)} }`
    ));

    return `export const btcUsdData = [\n${lines.join(',\n')}\n];\n`;
}

async function fetchYahooDailyCandles() {
    const url = new URL(YAHOO_CHART_URL);
    url.searchParams.set('period1', String(START_UNIX_SECONDS));
    url.searchParams.set('period2', String(END_UNIX_SECONDS));
    url.searchParams.set('interval', '1d');
    url.searchParams.set('events', 'history');
    url.searchParams.set('includeAdjustedClose', 'true');

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0',
        },
    });

    if (!response.ok) {
        throw new Error(`Yahoo Finance request failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const result = payload?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const quote = result?.indicators?.quote?.[0] || {};

    return timestamps.map((timestamp, index) => ({
        time: toISODate(timestamp),
        open: quote.open?.[index],
        high: quote.high?.[index],
        low: quote.low?.[index],
        close: quote.close?.[index],
    })).filter((candle) => (
        candle.time
        && Number.isFinite(candle.open)
        && Number.isFinite(candle.high)
        && Number.isFinite(candle.low)
        && Number.isFinite(candle.close)
    ));
}

const existingSource = await readFile(DATA_FILE, 'utf8');
const existingCandles = parseExistingData(existingSource);
const fetchedCandles = await fetchYahooDailyCandles();
const mergedByDate = new Map();

existingCandles.forEach((candle) => mergedByDate.set(candle.time, candle));
fetchedCandles.forEach((candle) => mergedByDate.set(candle.time, candle));

const mergedCandles = Array.from(mergedByDate.values())
    .sort((a, b) => a.time.localeCompare(b.time));

await writeFile(DATA_FILE, formatDataModule(mergedCandles));

const first = mergedCandles[0]?.time || 'n/a';
const last = mergedCandles[mergedCandles.length - 1]?.time || 'n/a';
console.log(`Updated ${mergedCandles.length} BTC-USD daily candles (${first} to ${last}).`);
