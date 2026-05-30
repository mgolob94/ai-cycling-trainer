// Guided FTP test protocols and analysis from a power stream.

// Protocol definitions (for a guided test UI). Copy in Slovenian.
const PROTOCOLS = {
  ramp: {
    test_type: 'ramp',
    name: 'Ramp test',
    subtitle: 'Priporočeno za začetnike',
    duration_min: '20–30 min',
    formula: 'FTP = 75 % najvišje 1-minutne moči',
    structure: [
      { label: 'Ogrevanje', detail: '5 min lahkotno' },
      { label: 'Stopnje', detail: 'Začni pri 100 W, vsako minuto +20 W' },
      { label: 'Konec', detail: 'Test se konča, ko ne zmoreš več cele minute' },
    ],
  },
  '20min': {
    test_type: '20min',
    name: '20-minutni test',
    subtitle: 'Bolj natančno za izkušene',
    duration_min: '~60 min',
    formula: 'FTP = 95 % povprečne 20-minutne moči',
    structure: [
      { label: 'Ogrevanje', detail: '10 min lahkotno + 3× 1 min ostro' },
      { label: 'Premor', detail: '5 min lahkotno' },
      { label: 'Glavni del', detail: '20 min na polno' },
      { label: 'Ohlajanje', detail: '10 min lahkotno' },
    ],
  },
};

function getProtocol(testType) {
  return PROTOCOLS[testType] ?? null;
}

/** Best rolling average over `window` seconds, with its start index. */
function rollingMaxAvg(stream, window) {
  const n = stream.length;
  if (n === 0) return { maxAvg: 0, startIndex: 0, window: 0 };
  if (n < window) {
    const avg = stream.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0) / n;
    return { maxAvg: avg, startIndex: 0, window: n };
  }
  const prefix = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i += 1) prefix[i + 1] = prefix[i] + (Number.isFinite(stream[i]) ? stream[i] : 0);
  let best = -Infinity;
  let start = 0;
  for (let j = 0; j + window <= n; j += 1) {
    const avg = (prefix[j + window] - prefix[j]) / window;
    if (avg > best) {
      best = avg;
      start = j;
    }
  }
  return { maxAvg: best, startIndex: start, window };
}

/** Normalized power of a segment (30s rolling avg → 4th power → mean → 4th root). */
function segmentNormalizedPower(segment) {
  if (!segment.length) return 0;
  const w = 30;
  const rolling = [];
  let sum = 0;
  for (let i = 0; i < segment.length; i += 1) {
    sum += segment[i];
    if (i >= w) sum -= segment[i - w];
    rolling.push(sum / Math.min(i + 1, w));
  }
  const meanFourth = rolling.reduce((s, v) => s + v ** 4, 0) / rolling.length;
  return meanFourth ** 0.25;
}

/** Ramp test: FTP = 75% of the best 1-minute power. */
function analyzeRampTest(stream) {
  const best1min = rollingMaxAvg(stream, 60);
  return {
    test_type: 'ramp',
    ftp: Math.round(best1min.maxAvg * 0.75),
    max_1min_power: Math.round(best1min.maxAvg),
    test_quality: best1min.maxAvg > 0 ? 'good' : 'questionable',
  };
}

/** 20-min test: FTP = 95% of the best 20-min power; questionable if VI > 1.05. */
function analyze20MinTest(stream) {
  const best20 = rollingMaxAvg(stream, 1200);
  const seg = stream.slice(best20.startIndex, best20.startIndex + best20.window);
  const avg = seg.length ? seg.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0) / seg.length : 0;
  const np = segmentNormalizedPower(seg);
  const vi = avg ? np / avg : 1;
  return {
    test_type: '20min',
    ftp: Math.round(best20.maxAvg * 0.95),
    avg_20min_power: Math.round(best20.maxAvg),
    variability_index: Math.round(vi * 100) / 100,
    test_quality: vi > 1.05 ? 'questionable' : 'good',
  };
}

/** Analyze a test power stream with the protocol matching test_type. */
function analyze(testType, stream) {
  if (testType === 'ramp') return analyzeRampTest(stream);
  if (testType === '20min') return analyze20MinTest(stream);
  throw new Error(`Unknown test_type: ${testType}`);
}

module.exports = {
  PROTOCOLS,
  getProtocol,
  rollingMaxAvg,
  analyzeRampTest,
  analyze20MinTest,
  analyze,
};
