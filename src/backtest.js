const fs = require('fs');
const config = require('./config');
const logger = require('./utils/logger');
const { isWithinTradingHours } = require('./utils/time');
const VWAP = require('./indicators/vwap');
const ATR = require('./indicators/atr');
const VwapBreakoutAtrStrategy = require('./strategy/vwapBreakoutAtr');
const { calculatePositionSize } = require('./risk/positionSizing');

const parseCSV = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.trim().split('\n');
  const rows = [];
  for (const line of lines.slice(1)) {
    const [timestamp, open, high, low, close, volume] = line.split(',');
    rows.push({
      closeTime: Number(timestamp),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume)
    });
  }
  return rows;
};

const run = () => {
  const file = process.env.BACKTEST_FILE;
  if (!file || !fs.existsSync(file)) {
    logger.error('BACKTEST_FILE not found. Provide a CSV with header timestamp,open,high,low,close,volume.');
    process.exit(1);
  }

  const equity = Number(process.env.BACKTEST_EQUITY || 10000);
  const stepSize = Number(process.env.BACKTEST_STEP_SIZE || 0.000001);
  const minQty = Number(process.env.BACKTEST_MIN_QTY || 0);
  const minNotional = Number(process.env.BACKTEST_MIN_NOTIONAL || 0);

  const vwap = new VWAP(config.tz);
  const atr = new ATR(config.atrPeriod);
  const strategy = new VwapBreakoutAtrStrategy({ nBreakout: config.nBreakout, volM: config.volM });

  let state = {
    openPosition: null,
    dailyPnL_R: 0
  };

  const candles = parseCSV(file);
  let trades = 0;

  for (const candle of candles) {
    const vwapValue = vwap.update(candle);
    const atrValue = atr.update(candle);
    strategy.update(candle);

    const breakoutHigh = strategy.getBreakoutHigh();
    const volumeAvg = strategy.getVolumeAverage();

    if (!isWithinTradingHours(candle.closeTime, config.tz, config.tradingHours.start, config.tradingHours.end)) {
      continue;
    }

    if (state.openPosition) {
      const minutesInTrade = (candle.closeTime - state.openPosition.entryTime) / 60000;
      const currentR = state.openPosition.riskUSDT
        ? ((candle.close - state.openPosition.entry) * state.openPosition.qty) / state.openPosition.riskUSDT
        : 0;

      if (config.useVwapFlipExit && vwapValue && candle.close < vwapValue) {
        const pnlUsdt = (candle.close - state.openPosition.entry) * state.openPosition.qty;
        const pnlR = pnlUsdt / state.openPosition.riskUSDT;
        state.dailyPnL_R += pnlR;
        trades += 1;
        state.openPosition = null;
      } else if (minutesInTrade >= config.timeStopMin && currentR < 0.3) {
        const pnlUsdt = (candle.close - state.openPosition.entry) * state.openPosition.qty;
        const pnlR = pnlUsdt / state.openPosition.riskUSDT;
        state.dailyPnL_R += pnlR;
        trades += 1;
        state.openPosition = null;
      } else if (candle.close <= state.openPosition.stop) {
        const pnlUsdt = (state.openPosition.stop - state.openPosition.entry) * state.openPosition.qty;
        const pnlR = pnlUsdt / state.openPosition.riskUSDT;
        state.dailyPnL_R += pnlR;
        trades += 1;
        state.openPosition = null;
      } else if (candle.close >= state.openPosition.take) {
        const pnlUsdt = (state.openPosition.take - state.openPosition.entry) * state.openPosition.qty;
        const pnlR = pnlUsdt / state.openPosition.riskUSDT;
        state.dailyPnL_R += pnlR;
        trades += 1;
        state.openPosition = null;
      }

      continue;
    }

    if (atrValue === null || breakoutHigh === null || !vwapValue) continue;

    const atrOk = atrValue >= config.minAtr;
    const volOk = volumeAvg !== null && candle.volume >= volumeAvg;
    const entrySignal = candle.close > vwapValue && candle.close > breakoutHigh;
    const volatilityOk = atrOk || volOk;

    if (!entrySignal || !volatilityOk) continue;

    const entryPrice = candle.close;
    const stopPrice = entryPrice - config.kAtr * atrValue;
    const takePrice = entryPrice + config.rMult * (entryPrice - stopPrice);

    const sizing = calculatePositionSize({
      equity,
      riskPct: config.riskPct,
      entry: entryPrice,
      stop: stopPrice,
      lotStep: stepSize,
      minQty,
      minNotional
    });

    if (sizing.qty <= 0) continue;

    state.openPosition = {
      entry: entryPrice,
      stop: stopPrice,
      take: takePrice,
      qty: sizing.qty,
      entryTime: candle.closeTime,
      riskUSDT: sizing.riskAmount
    };
  }

  logger.info('Backtest finished', { trades, dailyPnL_R: state.dailyPnL_R.toFixed(2) });
};

run();
