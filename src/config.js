const dotenv = require('dotenv');

dotenv.config();

const toNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
};

const toBool = (value, fallback) => {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
};

const config = {
  apiKey: process.env.API_KEY || '',
  apiSecret: process.env.API_SECRET || '',
  symbol: process.env.SYMBOL || 'BTCUSDT',
  interval: process.env.INTERVAL || '1m',
  nBreakout: toNumber(process.env.N_BREAKOUT, 20),
  atrPeriod: toNumber(process.env.ATR_PERIOD, 14),
  kAtr: toNumber(process.env.K_ATR, 1.2),
  rMult: toNumber(process.env.R_MULT, 2.0),
  riskPct: toNumber(process.env.RISK_PCT, 0.005),
  maxSpreadPct: toNumber(process.env.MAX_SPREAD_PCT, 0.0005),
  minAtr: toNumber(process.env.MIN_ATR, 0),
  volM: toNumber(process.env.VOL_M, 20),
  timeStopMin: toNumber(process.env.TIME_STOP_MIN, 20),
  dailyMaxLossR: toNumber(process.env.DAILY_MAX_LOSS_R, 2),
  dailyTargetR: toNumber(process.env.DAILY_TARGET_R, 0),
  useMarketEntry: toBool(process.env.USE_MARKET_ENTRY, true),
  useVwapFlipExit: toBool(process.env.USE_VWAP_FLIP_EXIT, true),
  stopLimitOffset: toNumber(process.env.STOP_LIMIT_OFFSET, 0.0005),
  tz: process.env.TZ || 'America/Sao_Paulo',
  paper: toBool(process.env.PAPER, false),
  tradingHours: {
    start: process.env.TRADING_START || '09:00',
    end: process.env.TRADING_END || '20:00'
  }
};

module.exports = config;
