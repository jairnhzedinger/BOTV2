const fs = require('fs');
const path = require('path');

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `bot_${new Date().toISOString().slice(0, 10)}.log`);
const stream = fs.createWriteStream(logFile, { flags: 'a' });

const format = (level, message, meta) => {
  const ts = new Date().toISOString();
  const metaPart = meta ? ` | ${JSON.stringify(meta)}` : '';
  return `[${ts}] [${level}] ${message}${metaPart}`;
};

const log = (level, message, meta) => {
  const line = format(level, message, meta);
  console.log(line);
  stream.write(`${line}\n`);
};

module.exports = {
  info: (message, meta) => log('INFO', message, meta),
  warn: (message, meta) => log('WARN', message, meta),
  error: (message, meta) => log('ERROR', message, meta)
};
