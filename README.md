# BOTV2
Bot de day trade para Binance Spot (somente LONG) com VWAP intraday + breakout + ATR.

> **Aviso de risco**: este projeto é educacional. Trading envolve riscos e pode gerar perdas.

## Como rodar
```bash
npm install
cp .env.example .env
npm start
```

### Variáveis de ambiente (.env)
Principais ajustes:
- `SYMBOL` (ex.: `BTCUSDT`)
- `INTERVAL` (ex.: `1m`)
- `N_BREAKOUT`, `ATR_PERIOD`, `K_ATR`, `R_MULT`
- `RISK_PCT` (risco por trade)
- `TRADING_START` / `TRADING_END` (janela horária local)
- `TZ` (timezone usada para reset diário do VWAP e PnL)
- `PAPER=true` para simulação

Veja todos os parâmetros em `.env.example`.

## Estratégia (regras)
- **VWAP intraday**: reset diário conforme `TZ`.
- **Breakout**: rompe máxima dos últimos `N_BREAKOUT` candles fechados.
- **Entrada LONG**: fechamento do candle com `close > VWAP` e `close > breakoutHigh`.
- **ATR (Wilder)**: stop inicial `entry - K_ATR * ATR`.
- **Alvo**: `takeProfit = entry + R_MULT * (entry - stop)`.
- **Filtro de spread**: bloqueia se `spread > MAX_SPREAD_PCT`.
- **Filtro de volatilidade**: permite entrada se `ATR > MIN_ATR` **OU** volume atual acima da média dos últimos `VOL_M`.
- **Saídas defensivas**:
  - VWAP flip exit: candle fecha abaixo do VWAP.
  - Time stop: após `TIME_STOP_MIN`, se lucro < 0.3R.
- **Daily stop**: pausa quando `dailyPnL_R <= -DAILY_MAX_LOSS_R` (ou alvo diário se definido).

## Estrutura
```
src/
  index.js                // bootstrap + loop principal
  config.js               // carrega .env e valida
  exchange/binance.js     // wrapper REST/WS
  indicators/vwap.js
  indicators/atr.js
  strategy/vwapBreakoutAtr.js
  risk/positionSizing.js
  execution/orderManager.js
  state/stateStore.js
  utils/logger.js
  utils/time.js
  utils/journal.js
  backtest.js
```

## Logs e jornal de trades
- Logs em `logs/` com detalhe de cada candle e trades.
- Jornal em `trade_journal.csv`:
  ```
  timestamp,symbol,side,entry,stop,take,qty,fees,pnl_usdt,pnl_r,exit_reason
  2024-06-01T13:10:00.000Z,BTCUSDT,LONG,68000,67500,69000,0.002,0,12.50,1.00,take_profit
  ```

## Backtest básico (opcional)
1) Prepare um CSV com header:
   ```
   timestamp,open,high,low,close,volume
   ```
2) Rode:
   ```bash
   BACKTEST_FILE=./data/btc_1m.csv BACKTEST_EQUITY=10000 npm run backtest
   ```

Parâmetros opcionais:
- `BACKTEST_STEP_SIZE` (default 0.000001)
- `BACKTEST_MIN_QTY` (default 0)
- `BACKTEST_MIN_NOTIONAL` (default 0)

## Observações importantes
- OCO é criado após a compra. Se o envio do OCO falhar, o bot tenta encerrar a posição imediatamente.
- No modo `PAPER=true`, take/stop são simulados pelo fechamento do candle.
- Para produção, recomenda-se adicionar um *user data stream* para confirmar fills do OCO.

## Sem promessas
Nenhuma promessa de lucro é feita. Ajuste parâmetros com cuidado e faça backtests antes de operar.
