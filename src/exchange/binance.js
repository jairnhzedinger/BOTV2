const Binance = require('binance-api-node').default;

class BinanceExchange {
  constructor({ apiKey, apiSecret, paper }) {
    this.paper = paper;
    this.client = Binance({
      apiKey,
      apiSecret
    });
  }

  wsCandles(symbol, interval, callback) {
    return this.client.ws.candles(symbol, interval, callback);
  }

  async getAccountBalance(asset) {
    if (this.paper) {
      return 1000;
    }
    const account = await this.client.accountInfo();
    const balance = account.balances.find((item) => item.asset === asset);
    return balance ? Number(balance.free) : 0;
  }

  async getExchangeFilters(symbol) {
    const info = await this.client.exchangeInfo();
    const symbolInfo = info.symbols.find((item) => item.symbol === symbol);
    if (!symbolInfo) return null;
    const lot = symbolInfo.filters.find((f) => f.filterType === 'LOT_SIZE');
    const minNotionalFilter =
      symbolInfo.filters.find((f) => f.filterType === 'MIN_NOTIONAL') ||
      symbolInfo.filters.find((f) => f.filterType === 'NOTIONAL');

    return {
      minQty: lot ? Number(lot.minQty) : 0,
      stepSize: lot ? Number(lot.stepSize) : 0,
      minNotional: minNotionalFilter ? Number(minNotionalFilter.minNotional) : 0
    };
  }

  async getBookTicker(symbol) {
    if (typeof this.client.bookTicker === 'function') {
      return this.client.bookTicker({ symbol });
    }
    if (typeof this.client.allBookTickers === 'function') {
      const tickers = await this.client.allBookTickers();
      const ticker = tickers ? tickers[symbol] : null;
      if (ticker) {
        return ticker;
      }
      throw new Error(`Book ticker not available for ${symbol}`);
    }
    throw new Error('Book ticker endpoint not available on client');
  }

  async placeMarketBuy({ symbol, quantity }) {
    if (this.paper) {
      return { orderId: `paper-${Date.now()}`, fills: [], status: 'FILLED' };
    }
    return this.client.order({ symbol, side: 'BUY', type: 'MARKET', quantity });
  }

  async placeLimitBuy({ symbol, quantity, price }) {
    if (this.paper) {
      return { orderId: `paper-${Date.now()}`, fills: [], status: 'FILLED' };
    }
    return this.client.order({ symbol, side: 'BUY', type: 'LIMIT', timeInForce: 'GTC', quantity, price });
  }

  async placeOco({ symbol, quantity, price, stopPrice, stopLimitPrice }) {
    if (this.paper) {
      return { orderListId: `paper-oco-${Date.now()}` };
    }
    return this.client.orderOco({
      symbol,
      side: 'SELL',
      quantity,
      price,
      stopPrice,
      stopLimitPrice,
      stopLimitTimeInForce: 'GTC'
    });
  }

  async cancelOco(symbol, orderListId) {
    if (this.paper) return;
    await this.client.cancelOco({ symbol, orderListId });
  }

  async placeMarketSell({ symbol, quantity }) {
    if (this.paper) {
      return { orderId: `paper-sell-${Date.now()}`, status: 'FILLED' };
    }
    return this.client.order({ symbol, side: 'SELL', type: 'MARKET', quantity });
  }
}

module.exports = BinanceExchange;
