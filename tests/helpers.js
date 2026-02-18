// Extracted pure functions from index.html for testing

function apiToCandles(apiData, dateStr) {
    if (!apiData || !apiData.length) return { candles: [], volumes: [] };
    const y = parseInt(dateStr.substring(0, 4));
    const m = parseInt(dateStr.substring(4, 6)) - 1;
    const d = parseInt(dateStr.substring(6, 8));
    const candles = [], volumes = [];
    apiData.forEach(bar => {
        const hh = Math.floor(bar.time / 100);
        const mm = bar.time % 100;
        const ts = Math.floor(Date.UTC(y, m, d, hh, mm) / 1000) - 8 * 3600;
        const o = bar.open / 100, h = bar.high / 100, l = bar.low / 100, c = bar.close / 100;
        candles.push({ time: ts, open: o, high: h, low: l, close: c });
        volumes.push({ time: ts, value: bar.vol, color: c >= o ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)' });
    });
    return { candles, volumes };
}

function aggregateBars(candles, volumes, minutes) {
    if (!candles.length) return { candles: [], volumes: [] };
    const aggC = [], aggV = [];
    const sec = minutes * 60;
    let i = 0;
    while (i < candles.length) {
        const slot = Math.floor(candles[i].time / sec) * sec;
        let o = candles[i].open, h = candles[i].high, l = candles[i].low, c = candles[i].close, vol = 0;
        while (i < candles.length && Math.floor(candles[i].time / sec) * sec === slot) {
            h = Math.max(h, candles[i].high);
            l = Math.min(l, candles[i].low);
            c = candles[i].close;
            vol += (volumes[i] ? volumes[i].value : 0);
            i++;
        }
        aggC.push({ time: slot, open: o, high: h, low: l, close: c });
        aggV.push({ time: slot, value: vol, color: c >= o ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)' });
    }
    return { candles: aggC, volumes: aggV };
}

function calcMA(candles, period) {
    const result = [];
    for (let i = period - 1; i < candles.length; i++) {
        let s = 0;
        for (let j = 0; j < period; j++) s += candles[i - j].close;
        result.push({ time: candles[i].time, value: s / period });
    }
    return result;
}

function calcBB(candles, period, mult) {
    const mid = [], upper = [], lower = [];
    for (let i = period - 1; i < candles.length; i++) {
        let s = 0;
        for (let j = 0; j < period; j++) s += candles[i - j].close;
        const mean = s / period;
        let sq = 0;
        for (let j = 0; j < period; j++) sq += (candles[i - j].close - mean) ** 2;
        const std = Math.sqrt(sq / period);
        mid.push({ time: candles[i].time, value: mean });
        upper.push({ time: candles[i].time, value: mean + mult * std });
        lower.push({ time: candles[i].time, value: mean - mult * std });
    }
    return { mid, upper, lower };
}

function calcMACD(candles, fast, slow, signal) {
    function ema(data, period) {
        const k = 2 / (period + 1);
        const result = [data[0]];
        for (let i = 1; i < data.length; i++) result.push(data[i] * k + result[i - 1] * (1 - k));
        return result;
    }
    const closes = candles.map(c => c.close);
    if (closes.length < slow) return { macd: [], signal: [], histogram: [] };
    const emaFast = ema(closes, fast);
    const emaSlow = ema(closes, slow);
    const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
    const sigLine = ema(macdLine, signal);
    const result = { macd: [], signal: [], histogram: [] };
    const start = slow - 1;
    for (let i = start; i < candles.length; i++) {
        const t = candles[i].time;
        const m = macdLine[i], s = sigLine[i], h = m - s;
        result.macd.push({ time: t, value: m });
        result.signal.push({ time: t, value: s });
        result.histogram.push({ time: t, value: h, color: h >= 0 ? 'rgba(239,68,68,0.7)' : 'rgba(34,197,94,0.7)' });
    }
    return result;
}

function calcCTS(candles) {
    if (!candles || candles.length < 25) return { score: 50, momentum: 50, trend: 50, volume: 50 };
    const closes = candles.map(c => c.close);
    const n = closes.length;
    function ma(period) { let s=0; for(let i=n-period;i<n;i++) s+=closes[i]; return s/period; }
    const ma5 = ma(5), ma10 = ma(10), last = closes[n-1];
    const momentum = Math.round(50 + 50 * Math.tanh((last - ma5)/ma5*50));
    const trend = Math.round(50 + 50 * Math.tanh((last - ma10)/ma10*35));
    const volume = Math.round(45 + Math.random()*30);
    const score = Math.round(0.4*momentum + 0.4*trend + 0.2*volume);
    return { score, momentum, trend, volume };
}

module.exports = { apiToCandles, aggregateBars, calcMA, calcBB, calcMACD, calcCTS };
