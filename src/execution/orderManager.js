const logger = require('../utils/logger');

class OrderManager {
  constructor({ exchange, config, stateStore }) {
    this.exchange = exchange;
    this.config = config;
    this.stateStore = stateStore;
  }

  async enterPosition({ state, entryPrice, stopPrice, takePrice, qty, riskUSDT, reason }) {
    const updated = { ...state, state: 'ENTERING' };
    this.stateStore.saveState(updated);
    logger.info('Entering position', { entryPrice, stopPrice, takePrice, qty, reason });

    try {
      const entryOrder = this.config.useMarketEntry
        ? await this.exchange.placeMarketBuy({ symbol: this.config.symbol, quantity: qty })
        : await this.exchange.placeLimitBuy({ symbol: this.config.symbol, quantity: qty, price: entryPrice });

      const ocoOrder = await this.exchange.placeOco({
        symbol: this.config.symbol,
        quantity: qty,
        price: takePrice,
        stopPrice,
        stopLimitPrice: stopPrice * (1 - this.config.stopLimitOffset)
      });

      const openPosition = {
        entry: entryPrice,
        qty,
        stop: stopPrice,
        take: takePrice,
        entryTime: Date.now(),
        entryOrderId: entryOrder.orderId,
        ocoOrderListId: ocoOrder.orderListId,
        riskUSDT,
        reason
      };

      const next = { ...state, state: 'IN_POSITION', openPosition };
      this.stateStore.saveState(next);
      logger.info('Position opened with OCO', openPosition);
      return next;
    } catch (error) {
      logger.error('Failed to open position', { error: error.message });
      const fallback = { ...state, state: 'IDLE', openPosition: null };
      this.stateStore.saveState(fallback);
      return fallback;
    }
  }

  async exitPosition({ state, reason }) {
    if (!state.openPosition) return state;
    const updated = { ...state, state: 'EXITING' };
    this.stateStore.saveState(updated);

    try {
      if (state.openPosition.ocoOrderListId) {
        await this.exchange.cancelOco(this.config.symbol, state.openPosition.ocoOrderListId);
      }
      await this.exchange.placeMarketSell({ symbol: this.config.symbol, quantity: state.openPosition.qty });
    } catch (error) {
      logger.error('Failed to exit position', { error: error.message });
    }

    const next = { ...state, state: 'IDLE', openPosition: null };
    this.stateStore.saveState(next);
    logger.info('Position closed', { reason });
    return next;
  }
}

module.exports = OrderManager;
