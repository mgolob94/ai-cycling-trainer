// W' (W-prime) — anaerobic work capacity above FTP. Depletes when power > FTP,
// recovers when power < FTP. Implements the Skiba differential balance model.

const DEFAULT_W_PRIME = 20000; // joules

/**
 * Compute the W' balance over a power stream.
 *
 * @param {number[]} powerStream 1-second power values (watts)
 * @param {number} ftp           user FTP (watts)
 * @param {number} wPrimeTotal   user's W' capacity (joules)
 * @returns {{
 *   w_prime_balance_stream: number[],
 *   min_w_prime_balance: number,
 *   w_prime_depletion_percent: number,
 *   match_count: number,
 * }}
 */
function computeWPrimeBalance(powerStream, ftp, wPrimeTotal = DEFAULT_W_PRIME) {
  const stream = [];
  let wBal = wPrimeTotal;
  let minBal = wPrimeTotal;

  // A "match" is an excursion below 50% of W'. Count each distinct dip.
  const matchThreshold = wPrimeTotal * 0.5;
  let belowThreshold = false;
  let matchCount = 0;

  for (let i = 0; i < powerStream.length; i += 1) {
    const power = Number.isFinite(powerStream[i]) ? powerStream[i] : 0;

    if (power > ftp) {
      // Deplete: spend (power - FTP) joules this second.
      wBal -= power - ftp;
    } else if (power < ftp) {
      // Recover toward W'total; tau (recovery time constant) depends on how far
      // below FTP the rider is (DCP = FTP - power).
      const dcp = ftp - power;
      const tau = 546 * Math.exp(-0.01 * dcp) + 316;
      wBal = wPrimeTotal - (wPrimeTotal - wBal) * Math.exp(-dcp / tau);
    }
    // power === ftp: no change.

    stream.push(Math.round(wBal));
    if (wBal < minBal) minBal = wBal;

    if (wBal < matchThreshold && !belowThreshold) {
      matchCount += 1;
      belowThreshold = true;
    } else if (wBal >= matchThreshold) {
      belowThreshold = false;
    }
  }

  const depletion = wPrimeTotal - minBal;

  return {
    w_prime_balance_stream: stream,
    min_w_prime_balance: Math.round(minBal),
    w_prime_depletion_percent: Math.round((depletion / wPrimeTotal) * 1000) / 10,
    match_count: matchCount,
  };
}

module.exports = { computeWPrimeBalance, DEFAULT_W_PRIME };
