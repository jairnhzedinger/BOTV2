const config = require('./config');
const logger = require('./utils/logger');
const { isWithinTradingHours, dateKey } = require('./utils/time');
const { loadState, saveState } = require('./state/stateStore');
const VWAP = require('./indicators/vwap');
const ATR = require('./indicators/atr');
const VwapBreakoutAtrStrategy = require('./strategy/vwapBreakoutAtr');
const { calculatePositionSize } = require('./risk/positionSizing');
const BinanceExchange = require('./exchange/binance');
const OrderManager = require('./execution/orderManager');
const { appendTrade } = require('./utils/journal');

const exchange = new BinanceExchange({
  apiKey: config.apiKey,
  apiSecret: config.apiSecret,
  paper: config.paper
});

const vwap = new VWAP(config.tz);
const atr = new ATR(config.atrPeriod);
const strategy = new VwapBreakoutAtrStrategy({
  nBreakout: config.nBreakout,
  volM: config.volM
});

const orderManager = new OrderManager({ exchange, config, stateStore: { saveState } });

const init = async () => {
  let state = loadState();
  const exchangeFilters = await exchange.getExchangeFilters(config.symbol);
  if (!exchangeFilters) {
    logger.error('Symbol not found in exchange info', { symbol: config.symbol });
    process.exit(1);
  }

  logger.info('Bot started', { symbol: config.symbol, interval: config.interval, paper: config.paper });

  const handleDailyReset = (timestamp) => {
    const today = dateKey(timestamp, config.tz);
    if (state.lastResetDate !== today) {
      state = {
        ...state,
        dailyPnL_R: 0,
        tradesToday: 0,
        lastResetDate: today,
        state: state.state === 'PAUSED' ? 'IDLE' : state.state
      };
      saveState(state);
      logger.info('Daily reset executed', { date: today });
    }
  };

  const finalizeTrade = ({ exitPrice, exitReason }) => {
    if (!state.openPosition) return;
    const pnlUsdt = (exitPrice - state.openPosition.entry) * state.openPosition.qty;
    const pnlR = state.openPosition.riskUSDT ? pnlUsdt / state.openPosition.riskUSDT : 0;
    state.dailyPnL_R += pnlR;
    state.tradesToday += 1;
    const trade = {
      timestamp: new Date().toISOString(),
      symbol: config.symbol,
      side: 'LONG',
      entry: state.openPosition.entry,
      stop: state.openPosition.stop,
      take: state.openPosition.take,
      qty: state.openPosition.qty,
      fees: 0,
      pnlUsdt: pnlUsdt.toFixed(2),
      pnlR: pnlR.toFixed(2),
      exitReason
    };
    appendTrade(trade);
    logger.info('Trade finalized', trade);
    saveState(state);
  };

  const checkDailyStops = () => {
    if (state.dailyPnL_R <= -config.dailyMaxLossR) {
      state.state = 'PAUSED';
      saveState(state);
      logger.warn('Daily max loss reached. Pausing trading.', { dailyPnL_R: state.dailyPnL_R });
    }
    if (config.dailyTargetR > 0 && state.dailyPnL_R >= config.dailyTargetR) {
      state.state = 'PAUSED';
      saveState(state);
      logger.warn('Daily target reached. Pausing trading.', { dailyPnL_R: state.dailyPnL_R });
    }
  };

  exchange.wsCandles(config.symbol, config.interval, async (candle) => {
    if (!candle.isFinal) return;

    if (state.lastCandleCloseTime === candle.closeTime) return;
    state.lastCandleCloseTime = candle.closeTime;

    handleDailyReset(candle.closeTime);

    const candleData = {
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: Number(candle.volume),
      closeTime: candle.closeTime
    };

    const vwapValue = vwap.update(candleData);
    const atrValue = atr.update(candleData);
    strategy.update(candleData);

    const breakoutHigh = strategy.getBreakoutHigh();
    const volumeAvg = strategy.getVolumeAverage();

    const atrOk = atrValue !== null && atrValue >= config.minAtr;
    const volOk = volumeAvg !== null && candleData.volume >= volumeAvg;

    logger.info('Candle closed', {
      close: candleData.close,
      vwap: vwapValue,
      atr: atrValue,
      breakoutHigh,
      atrOk,
      volOk
    });

    if (state.state === 'PAUSED') {
      checkDailyStops();
      return;
    }

    if (state.openPosition) {
      const minutesInTrade = (Date.now() - state.openPosition.entryTime) / 60000;
      const currentR = state.openPosition.riskUSDT
        ? ((candleData.close - state.openPosition.entry) * state.openPosition.qty) / state.openPosition.riskUSDT
        : 0;

      if (config.useVwapFlipExit && vwapValue && candleData.close < vwapValue) {
        logger.warn('VWAP flip exit triggered', { close: candleData.close, vwap: vwapValue });
        await orderManager.exitPosition({ state, reason: 'vwap_flip' });
        finalizeTrade({ exitPrice: candleData.close, exitReason: 'vwap_flip' });
        state.openPosition = null;
        state.state = 'IDLE';
        saveState(state);
        checkDailyStops();
        return;
      }

      if (minutesInTrade >= config.timeStopMin && currentR < 0.3) {
        logger.warn('Time stop exit triggered', { minutesInTrade, currentR });
        await orderManager.exitPosition({ state, reason: 'time_stop' });
        finalizeTrade({ exitPrice: candleData.close, exitReason: 'time_stop' });
        state.openPosition = null;
        state.state = 'IDLE';
        saveState(state);
        checkDailyStops();
        return;
      }

      if (config.paper) {
        if (candleData.close <= state.openPosition.stop) {
          logger.warn('Paper stop hit', { price: candleData.close });
          finalizeTrade({ exitPrice: state.openPosition.stop, exitReason: 'stop' });
          state.openPosition = null;
          state.state = 'IDLE';
          saveState(state);
        } else if (candleData.close >= state.openPosition.take) {
          logger.warn('Paper take profit hit', { price: candleData.close });
          finalizeTrade({ exitPrice: state.openPosition.take, exitReason: 'take_profit' });
          state.openPosition = null;
          state.state = 'IDLE';
          saveState(state);
        }
      }

      checkDailyStops();
      return;
    }

    if (!isWithinTradingHours(candle.closeTime, config.tz, config.tradingHours.start, config.tradingHours.end)) {
      logger.info('Outside trading hours');
      return;
    }

    if (atrValue === null || breakoutHigh === null) {
      logger.info('Not enough data for indicators');
      return;
    }

    const entrySignal = candleData.close > vwapValue && candleData.close > breakoutHigh;
    const volatilityOk = atrOk || volOk;

    if (!entrySignal || !volatilityOk) {
      logger.info('Entry conditions not met', { entrySignal, volatilityOk });
      return;
    }

    try {
      const ticker = await exchange.getBookTicker(config.symbol);
      const bestBid = Number(ticker.bidPrice);
      const bestAsk = Number(ticker.askPrice);
      const spreadPct = bestAsk ? (bestAsk - bestBid) / bestAsk : 0;
      if (spreadPct > config.maxSpreadPct) {
        logger.warn('Spread too wide', { spreadPct });
        return;
      }

      const equity = await exchange.getAccountBalance('USDT');
      const entryPrice = candleData.close;
      const stopPrice = entryPrice - config.kAtr * atrValue;
      const takePrice = entryPrice + config.rMult * (entryPrice - stopPrice);

      const sizing = calculatePositionSize({
        equity,
        riskPct: config.riskPct,
        entry: entryPrice,
        stop: stopPrice,
        lotStep: exchangeFilters.stepSize,
        minQty: exchangeFilters.minQty,
        minNotional: exchangeFilters.minNotional
      });

      if (sizing.qty <= 0) {
        logger.warn('Position size invalid', { reason: sizing.reason });
        return;
      }

      const nextState = await orderManager.enterPosition({
        state,
        entryPrice,
        stopPrice,
        takePrice,
        qty: sizing.qty,
        riskUSDT: sizing.riskAmount,
        reason: 'vwap_breakout'
      });

      state = nextState;
      saveState(state);
    } catch (error) {
      logger.error('Failed to process entry', { error: error.message });
    }
  });
};

init().catch((error) => {
  logger.error('Fatal error', { error: error.message });
  process.exit(1);
});
