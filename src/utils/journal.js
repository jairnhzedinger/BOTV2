const fs = require('fs');
const path = require('path');

const journalPath = path.join(process.cwd(), 'trade_journal.csv');
const header = 'timestamp,symbol,side,entry,stop,take,qty,fees,pnl_usdt,pnl_r,exit_reason\n';

const ensureJournal = () => {
  if (!fs.existsSync(journalPath)) {
    fs.writeFileSync(journalPath, header);
  }
};

const appendTrade = (trade) => {
  ensureJournal();
  const line = [
    trade.timestamp,
    trade.symbol,
    trade.side,
    trade.entry,
    trade.stop,
    trade.take,
    trade.qty,
    trade.fees,
    trade.pnlUsdt,
    trade.pnlR,
    trade.exitReason
  ].join(',');
  fs.appendFileSync(journalPath, `${line}\n`);
};

module.exports = {
  appendTrade
};
