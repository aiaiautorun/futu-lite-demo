// KStation Unit Tests — Node.js (no browser required)
// Tests pure logic functions extracted from index.html

const assert = require('assert');
let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; console.log(`  ✅ ${name}`); }
    catch(e) { failed++; console.log(`  ❌ ${name}: ${e.message}`); }
}

// ===== Extract functions from index.html =====

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

function getTradingDays(endDateStr, count) {
    const y = parseInt(endDateStr.substring(0, 4));
    const m = parseInt(endDateStr.substring(4, 6)) - 1;
    const d = parseInt(endDateStr.substring(6, 8));
    const dates = [];
    let dt = new Date(y, m, d);
    while (dates.length < count) {
        const dow = dt.getDay();
        if (dow !== 0 && dow !== 6) {
            const yy = dt.getFullYear();
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const dd = String(dt.getDate()).padStart(2, '0');
            dates.unshift(`${yy}${mm}${dd}`);
        }
        dt.setDate(dt.getDate() - 1);
    }
    return dates;
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

// ===== Tests =====

console.log('\n📊 KStation Unit Tests\n');

// --- apiToCandles ---
console.log('apiToCandles:');

test('empty input returns empty', () => {
    const r = apiToCandles([], '20260211');
    assert.strictEqual(r.candles.length, 0);
    assert.strictEqual(r.volumes.length, 0);
});

test('null input returns empty', () => {
    const r = apiToCandles(null, '20260211');
    assert.strictEqual(r.candles.length, 0);
});

test('single bar conversion', () => {
    const data = [{ time: 900, open: 10000, high: 10100, low: 9900, close: 10050, vol: 500 }];
    const r = apiToCandles(data, '20260211');
    assert.strictEqual(r.candles.length, 1);
    assert.strictEqual(r.candles[0].open, 100);
    assert.strictEqual(r.candles[0].high, 101);
    assert.strictEqual(r.candles[0].low, 99);
    assert.strictEqual(r.candles[0].close, 100.5);
    assert.strictEqual(r.volumes[0].value, 500);
});

test('timezone: 09:00 TW time → correct UTC timestamp', () => {
    const data = [{ time: 900, open: 10000, high: 10000, low: 10000, close: 10000, vol: 1 }];
    const r = apiToCandles(data, '20260211');
    // 2026-02-11 09:00 TW = 2026-02-11 01:00 UTC
    const expected = Math.floor(Date.UTC(2026, 1, 11, 1, 0) / 1000);
    assert.strictEqual(r.candles[0].time, expected);
});

test('up bar gets red volume color', () => {
    const data = [{ time: 900, open: 10000, high: 10200, low: 9900, close: 10100, vol: 100 }];
    const r = apiToCandles(data, '20260211');
    assert.strictEqual(r.volumes[0].color, 'rgba(239,68,68,0.5)');
});

test('down bar gets green volume color', () => {
    const data = [{ time: 900, open: 10100, high: 10200, low: 9900, close: 10000, vol: 100 }];
    const r = apiToCandles(data, '20260211');
    assert.strictEqual(r.volumes[0].color, 'rgba(34,197,94,0.5)');
});

// --- aggregateBars ---
console.log('\naggregateBars:');

test('empty input', () => {
    const r = aggregateBars([], [], 5);
    assert.strictEqual(r.candles.length, 0);
});

test('5min aggregation of 5 x 1min bars', () => {
    const base = 1739232000; // arbitrary
    const candles = [];
    const volumes = [];
    for (let i = 0; i < 5; i++) {
        candles.push({ time: base + i * 60, open: 100 + i, high: 105 + i, low: 95 + i, close: 101 + i });
        volumes.push({ time: base + i * 60, value: 10 + i });
    }
    const r = aggregateBars(candles, volumes, 5);
    assert.strictEqual(r.candles.length, 1);
    assert.strictEqual(r.candles[0].open, 100); // first bar's open
    assert.strictEqual(r.candles[0].close, 105); // last bar's close
    assert.strictEqual(r.candles[0].high, 109); // max high
    assert.strictEqual(r.candles[0].low, 95); // min low
    assert.strictEqual(r.volumes[0].value, 60); // sum of 10+11+12+13+14
});

test('15min creates correct number of bars from 30 1min bars', () => {
    const base = 1739232000;
    const candles = [], volumes = [];
    for (let i = 0; i < 30; i++) {
        candles.push({ time: base + i * 60, open: 100, high: 101, low: 99, close: 100 });
        volumes.push({ time: base + i * 60, value: 1 });
    }
    const r = aggregateBars(candles, volumes, 15);
    assert.strictEqual(r.candles.length, 2);
    assert.strictEqual(r.volumes[0].value, 15);
    assert.strictEqual(r.volumes[1].value, 15);
});

// --- getTradingDays ---
console.log('\ngetTradingDays:');

test('skips weekends', () => {
    // 2026-02-11 is Wednesday
    const days = getTradingDays('20260211', 5);
    assert.strictEqual(days.length, 5);
    // Should be Mon-Fri of that week: 0209(Mon), 0210(Tue), 0211(Wed) and prev week
    assert.strictEqual(days[days.length - 1], '20260211');
    // None should be Saturday(7) or Sunday(1)
    days.forEach(d => {
        const dt = new Date(parseInt(d.substr(0,4)), parseInt(d.substr(4,2))-1, parseInt(d.substr(6,2)));
        assert.notStrictEqual(dt.getDay(), 0, `${d} is Sunday`);
        assert.notStrictEqual(dt.getDay(), 6, `${d} is Saturday`);
    });
});

test('returns correct count', () => {
    const days = getTradingDays('20260211', 20);
    assert.strictEqual(days.length, 20);
});

test('days are in ascending order', () => {
    const days = getTradingDays('20260211', 10);
    for (let i = 1; i < days.length; i++) {
        assert.ok(days[i] > days[i-1], `${days[i]} should be after ${days[i-1]}`);
    }
});

// --- calcMA ---
console.log('\ncalcMA:');

test('MA5 with 5 bars', () => {
    const candles = [10, 20, 30, 40, 50].map((c, i) => ({ time: i, close: c }));
    const ma = calcMA(candles, 5);
    assert.strictEqual(ma.length, 1);
    assert.strictEqual(ma[0].value, 30); // (10+20+30+40+50)/5
});

test('MA returns correct count', () => {
    const candles = Array.from({length: 25}, (_, i) => ({ time: i, close: 100 + i }));
    const ma = calcMA(candles, 20);
    assert.strictEqual(ma.length, 6); // 25-20+1
});

test('MA of constant values equals that constant', () => {
    const candles = Array.from({length: 10}, (_, i) => ({ time: i, close: 42 }));
    const ma = calcMA(candles, 5);
    ma.forEach(m => assert.strictEqual(m.value, 42));
});

// --- calcBB ---
console.log('\ncalcBB:');

test('BB mid equals MA', () => {
    const candles = Array.from({length: 25}, (_, i) => ({ time: i, close: 100 + i }));
    const bb = calcBB(candles, 20, 2);
    const ma = calcMA(candles, 20);
    assert.strictEqual(bb.mid.length, ma.length);
    bb.mid.forEach((m, i) => assert.ok(Math.abs(m.value - ma[i].value) < 0.0001));
});

test('BB upper > mid > lower', () => {
    const candles = Array.from({length: 25}, (_, i) => ({ time: i, close: 100 + Math.sin(i) * 10 }));
    const bb = calcBB(candles, 20, 2);
    bb.mid.forEach((m, i) => {
        assert.ok(bb.upper[i].value >= m.value, 'upper >= mid');
        assert.ok(bb.lower[i].value <= m.value, 'lower <= mid');
    });
});

test('BB constant data → upper = mid = lower', () => {
    const candles = Array.from({length: 25}, (_, i) => ({ time: i, close: 50 }));
    const bb = calcBB(candles, 20, 2);
    bb.mid.forEach((m, i) => {
        assert.strictEqual(bb.upper[i].value, 50);
        assert.strictEqual(bb.lower[i].value, 50);
    });
});

// --- calcMACD ---
console.log('\ncalcMACD:');

test('MACD too few bars returns empty', () => {
    const candles = Array.from({length: 10}, (_, i) => ({ time: i, close: 100 }));
    const r = calcMACD(candles, 12, 26, 9);
    assert.strictEqual(r.macd.length, 0);
});

test('MACD returns correct arrays length', () => {
    const candles = Array.from({length: 60}, (_, i) => ({ time: i, close: 100 + Math.sin(i) * 5 }));
    const r = calcMACD(candles, 12, 26, 9);
    assert.strictEqual(r.macd.length, r.signal.length);
    assert.strictEqual(r.macd.length, r.histogram.length);
    // Should have (60 - 25) = 35 data points
    assert.strictEqual(r.macd.length, 35);
});

test('MACD histogram = macd - signal', () => {
    const candles = Array.from({length: 60}, (_, i) => ({ time: i, close: 100 + i * 0.5 }));
    const r = calcMACD(candles, 12, 26, 9);
    r.histogram.forEach((h, i) => {
        const expected = r.macd[i].value - r.signal[i].value;
        assert.ok(Math.abs(h.value - expected) < 0.0001, `histogram[${i}] should be macd - signal`);
    });
});

// --- daysForBars ---
console.log('\ndaysForBars:');

const TIMEFRAMES_T = [
    { key: '1m', label: '1分', minutes: 1 },
    { key: '5m', label: '5分', minutes: 5 },
    { key: '15m', label: '15分', minutes: 15 },
    { key: '30m', label: '30分', minutes: 30 },
    { key: '60m', label: '60分', minutes: 60 },
    { key: 'D', label: '日線', minutes: 0 },
];

function daysForBars(tfKey, barsPerDay) {
    const target = 999;
    if (tfKey === 'D') return 10;
    const tf = TIMEFRAMES_T.find(t => t.key === tfKey);
    if (!tf || tf.minutes === 0) return 1;
    const barsPerDayAtTF = Math.ceil(barsPerDay / tf.minutes);
    const days = Math.ceil(target / Math.max(barsPerDayAtTF, 1));
    return Math.min(days, 30);
}

test('1m with 270 bars/day needs 4 days', () => {
    assert.strictEqual(daysForBars('1m', 270), 4);
});

test('5m with 270 bars/day needs 19 days', () => {
    assert.strictEqual(daysForBars('5m', 270), 19);
});

test('15m with 270 bars/day needs 30 days (capped)', () => {
    // 270/15=18 bars/day, 999/18=56 → capped at 30
    assert.strictEqual(daysForBars('15m', 270), 30);
});

test('60m with 270 bars/day needs 30 days (capped)', () => {
    assert.strictEqual(daysForBars('60m', 270), 30);
});

test('daily always returns 10', () => {
    assert.strictEqual(daysForBars('D', 270), 10);
});

// --- calcCTS ---
console.log('\ncalcCTS:');

test('too few bars returns defaults', () => {
    const candles = Array.from({length: 10}, (_, i) => ({ time: i, close: 100 }));
    const r = calcCTS(candles);
    assert.strictEqual(r.score, 50);
    assert.strictEqual(r.momentum, 50);
});

test('score is 0-100 range', () => {
    const candles = Array.from({length: 30}, (_, i) => ({ time: i, close: 100 + i * 2 }));
    const r = calcCTS(candles);
    assert.ok(r.score >= 0 && r.score <= 100, `score ${r.score} out of range`);
    assert.ok(r.momentum >= 0 && r.momentum <= 100);
    assert.ok(r.trend >= 0 && r.trend <= 100);
});

test('uptrend gives high momentum', () => {
    // Strong uptrend: each bar higher
    const candles = Array.from({length: 30}, (_, i) => ({ time: i, close: 100 + i * 5 }));
    const r = calcCTS(candles);
    assert.ok(r.momentum >= 65, `momentum ${r.momentum} should be >= 65 for uptrend`);
    assert.ok(r.trend >= 65, `trend ${r.trend} should be >= 65 for uptrend`);
});

// ===== Summary =====
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(40)}\n`);
process.exit(failed > 0 ? 1 : 0);
