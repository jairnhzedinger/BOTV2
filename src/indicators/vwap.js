const { dateKey } = require('../utils/time');

class VWAP {
  constructor(tz) {
    this.tz = tz;
    this.currentDate = null;
    this.cumulativeTPV = 0;
    this.cumulativeVolume = 0;
    this.value = null;
  }

  update(candle) {
    const candleDate = dateKey(candle.closeTime, this.tz);
    if (this.currentDate !== candleDate) {
      this.currentDate = candleDate;
      this.cumulativeTPV = 0;
      this.cumulativeVolume = 0;
    }

    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    this.cumulativeTPV += typicalPrice * candle.volume;
    this.cumulativeVolume += candle.volume;
    this.value = this.cumulativeVolume ? this.cumulativeTPV / this.cumulativeVolume : null;
    return this.value;
  }
}

module.exports = VWAP;
