const assert = require('assert');
const { apiToCandles, aggregateBars, calcMA, calcBB, calcMACD, calcCTS } = require('./helpers');

let passed = 0, failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        failed++;
        console.log(`  ❌ ${name}: ${e.message}`);
    }
}

// Helper: generate candles with known closes
function makeCandles(closes, startTime = 1000) {
    return closes.map((c, i) => ({ time: startTime + i * 60, open: c, high: c + 1, low: c - 1, close: c }));
}

function makeVolumes(count, startTime = 1000) {
    return Array.from({ length: count }, (_, i) => ({ time: startTime + i * 60, value: 100, color: 'green' }));
}

// ===== calcMA =====
console.log('\n📊 calcMA');

test('MA5 with 5 candles returns 1 point', () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const ma = calcMA(candles, 5);
    assert.strictEqual(ma.length, 1);
    assert.strictEqual(ma[0].value, 30); // (10+20+30+40+50)/5
});

test('MA5 with 10 candles returns 6 points', () => {
    const candles = makeCandles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const ma = calcMA(candles, 5);
    assert.strictEqual(ma.length, 6);
    assert.strictEqual(ma[0].value, 3);  // (1+2+3+4+5)/5
    assert.strictEqual(ma[5].value, 8);  // (6+7+8+9+10)/5
});

test('MA10 needs at least 10 candles', () => {
    const candles = makeCandles([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.strictEqual(calcMA(candles, 10).length, 0);
    const candles10 = makeCandles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.strictEqual(calcMA(candles10, 10).length, 1);
    assert.strictEqual(calcMA(candles10, 10)[0].value, 5.5);
});

test('MA20 with 20 identical values', () => {
    const candles = makeCandles(Array(20).fill(100));
    const ma = calcMA(candles, 20);
    assert.strictEqual(ma.length, 1);
    assert.strictEqual(ma[0].value, 100);
});

// ===== calcBB =====
console.log('\n📊 calcBB');

test('BB mid equals MA', () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const bb = calcBB(candles, 5, 2);
    assert.strictEqual(bb.mid.length, 1);
    assert.strictEqual(bb.mid[0].value, 30);
});

test('BB upper > mid > lower', () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const bb = calcBB(candles, 5, 2);
    assert(bb.upper[0].value > bb.mid[0].value);
    assert(bb.lower[0].value < bb.mid[0].value);
});

test('BB with identical values has zero std', () => {
    const candles = makeCandles(Array(5).fill(100));
    const bb = calcBB(candles, 5, 2);
    assert.strictEqual(bb.upper[0].value, 100);
    assert.strictEqual(bb.lower[0].value, 100);
});

test('BB std calculation', () => {
    // [10,20,30,40,50] mean=30, variance=(400+100+0+100+400)/5=200, std=sqrt(200)≈14.142
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const bb = calcBB(candles, 5, 2);
    const std = Math.sqrt(200);
    assert(Math.abs(bb.upper[0].value - (30 + 2 * std)) < 0.001);
    assert(Math.abs(bb.lower[0].value - (30 - 2 * std)) < 0.001);
});

// ===== calcMACD =====
console.log('\n📊 calcMACD');

test('MACD returns empty when not enough data', () => {
    const candles = makeCandles([1, 2, 3]);
    const r = calcMACD(candles, 12, 26, 9);
    assert.strictEqual(r.macd.length, 0);
});

test('MACD returns data with enough candles', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const candles = makeCandles(closes);
    const r = calcMACD(candles, 12, 26, 9);
    assert(r.macd.length > 0);
    assert(r.signal.length > 0);
    assert(r.histogram.length > 0);
    assert.strictEqual(r.macd.length, r.signal.length);
    assert.strictEqual(r.macd.length, r.histogram.length);
});

test('MACD histogram = macd - signal', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const candles = makeCandles(closes);
    const r = calcMACD(candles, 12, 26, 9);
    r.histogram.forEach((h, i) => {
        assert(Math.abs(h.value - (r.macd[i].value - r.signal[i].value)) < 1e-10);
    });
});

test('MACD output starts at index slow-1', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const candles = makeCandles(closes);
    const r = calcMACD(candles, 12, 26, 9);
    // Should have 30 - 25 = 5 points (indices 25..29)
    assert.strictEqual(r.macd.length, 5);
});

// ===== aggregateBars =====
console.log('\n📊 aggregateBars');

test('1m→5m aggregation', () => {
    // 10 one-minute bars starting at time 0
    const baseTime = 300; // starts at a 5-min boundary
    const candles = [];
    const volumes = [];
    for (let i = 0; i < 10; i++) {
        candles.push({ time: baseTime + i * 60, open: 100 + i, high: 110 + i, low: 90 + i, close: 105 + i });
        volumes.push({ time: baseTime + i * 60, value: 100, color: 'green' });
    }
    const r = aggregateBars(candles, volumes, 5);
    assert.strictEqual(r.candles.length, 2);
    // First 5-min bar
    assert.strictEqual(r.candles[0].open, 100);  // first bar's open
    assert.strictEqual(r.candles[0].close, 109);  // last bar's close in slot
    assert.strictEqual(r.candles[0].high, 114);   // max high
    assert.strictEqual(r.candles[0].low, 90);     // min low
    assert.strictEqual(r.volumes[0].value, 500);
});

test('1m→60m aggregation', () => {
    const baseTime = 3600; // starts at hour boundary
    const candles = [];
    const volumes = [];
    for (let i = 0; i < 60; i++) {
        candles.push({ time: baseTime + i * 60, open: 100, high: 100 + i, low: 50, close: 100 });
        volumes.push({ time: baseTime + i * 60, value: 10, color: 'green' });
    }
    const r = aggregateBars(candles, volumes, 60);
    assert.strictEqual(r.candles.length, 1);
    assert.strictEqual(r.volumes[0].value, 600);
    assert.strictEqual(r.candles[0].high, 159); // max of 100+0..100+59
    assert.strictEqual(r.candles[0].low, 50);
});

test('empty input returns empty', () => {
    const r = aggregateBars([], [], 5);
    assert.strictEqual(r.candles.length, 0);
});

// ===== apiToCandles =====
console.log('\n📊 apiToCandles');

test('empty input', () => {
    const r = apiToCandles([], '20260101');
    assert.strictEqual(r.candles.length, 0);
});

test('timestamp conversion UTC+8→UTC', () => {
    const apiData = [{ time: 900, open: 10000, high: 10100, low: 9900, close: 10050, vol: 500 }];
    const r = apiToCandles(apiData, '20260218');
    // time 900 = 09:00, UTC+8 → UTC = 01:00
    // Date.UTC(2026, 1, 18, 9, 0) / 1000 - 8*3600
    const expectedTs = Math.floor(Date.UTC(2026, 1, 18, 9, 0) / 1000) - 8 * 3600;
    assert.strictEqual(r.candles[0].time, expectedTs);
    // Verify it's 01:00 UTC
    const d = new Date(expectedTs * 1000);
    assert.strictEqual(d.getUTCHours(), 1);
    assert.strictEqual(d.getUTCMinutes(), 0);
});

test('price division by 100', () => {
    const apiData = [{ time: 900, open: 10000, high: 10100, low: 9900, close: 10050, vol: 500 }];
    const r = apiToCandles(apiData, '20260218');
    assert.strictEqual(r.candles[0].open, 100);
    assert.strictEqual(r.candles[0].high, 101);
    assert.strictEqual(r.candles[0].close, 100.5);
});

test('volume colors', () => {
    const up = [{ time: 900, open: 10000, high: 10100, low: 9900, close: 10100, vol: 100 }];
    const down = [{ time: 900, open: 10100, high: 10100, low: 9900, close: 10000, vol: 100 }];
    const rUp = apiToCandles(up, '20260218');
    const rDown = apiToCandles(down, '20260218');
    assert(rUp.volumes[0].color.includes('239,68,68'));   // red for up
    assert(rDown.volumes[0].color.includes('34,197,94')); // green for down
});

// ===== calcCTS =====
console.log('\n📊 calcCTS');

test('returns default for < 25 candles', () => {
    const r = calcCTS(makeCandles(Array(10).fill(100)));
    assert.strictEqual(r.score, 50);
    assert.strictEqual(r.momentum, 50);
});

test('score is in 0-100 range', () => {
    // Strong uptrend
    const up = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i * 2));
    const rUp = calcCTS(up);
    assert(rUp.score >= 0 && rUp.score <= 100);
    assert(rUp.momentum >= 0 && rUp.momentum <= 100);
    assert(rUp.trend >= 0 && rUp.trend <= 100);
});

test('uptrend has higher momentum/trend than downtrend', () => {
    const up = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i * 2));
    const down = makeCandles(Array.from({ length: 30 }, (_, i) => 200 - i * 2));
    const rUp = calcCTS(up);
    const rDown = calcCTS(down);
    assert(rUp.momentum > rDown.momentum, `up momentum ${rUp.momentum} should > down ${rDown.momentum}`);
    assert(rUp.trend > rDown.trend, `up trend ${rUp.trend} should > down ${rDown.trend}`);
});

test('flat market near 50', () => {
    const flat = makeCandles(Array(30).fill(100));
    const r = calcCTS(flat);
    // momentum and trend should be around 50 for flat
    assert(r.momentum === 50);
    assert(r.trend === 50);
});

// ===== Summary =====
console.log(`\n${'='.repeat(40)}`);
console.log(`Total: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
if (failed > 0) process.exit(1);
console.log('All tests passed! 🎉\n');
