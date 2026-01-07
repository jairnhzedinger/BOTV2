const average = (values) => {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
};

class VwapBreakoutAtrStrategy {
  constructor({ nBreakout, volM }) {
    this.nBreakout = nBreakout;
    this.volM = volM;
    this.candles = [];
  }

  update(candle) {
    this.candles.push(candle);
    const maxStored = Math.max(this.nBreakout + 5, this.volM + 5);
    if (this.candles.length > maxStored) {
      this.candles.shift();
    }
  }

  getBreakoutHigh() {
    if (this.candles.length <= this.nBreakout) return null;
    const recent = this.candles.slice(-this.nBreakout - 1, -1);
    return Math.max(...recent.map((c) => c.high));
  }

  getVolumeAverage() {
    if (this.candles.length < this.volM) return null;
    const recent = this.candles.slice(-this.volM);
    return average(recent.map((c) => c.volume));
  }
}

module.exports = VwapBreakoutAtrStrategy;
