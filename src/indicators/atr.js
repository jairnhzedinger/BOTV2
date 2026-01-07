class ATR {
  constructor(period) {
    this.period = period;
    this.trValues = [];
    this.prevClose = null;
    this.atr = null;
  }

  update(candle) {
    const { high, low, close } = candle;
    if (this.prevClose === null) {
      this.prevClose = close;
      return this.atr;
    }

    const tr = Math.max(
      high - low,
      Math.abs(high - this.prevClose),
      Math.abs(low - this.prevClose)
    );

    if (this.trValues.length < this.period) {
      this.trValues.push(tr);
      if (this.trValues.length === this.period) {
        const sum = this.trValues.reduce((acc, value) => acc + value, 0);
        this.atr = sum / this.period;
      }
    } else if (this.atr !== null) {
      this.atr = (this.atr * (this.period - 1) + tr) / this.period;
    }

    this.prevClose = close;
    return this.atr;
  }
}

module.exports = ATR;
