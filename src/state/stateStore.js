const fs = require('fs');
const path = require('path');

const statePath = path.join(process.cwd(), 'state.json');

const defaultState = () => ({
  state: 'IDLE',
  openPosition: null,
  dailyPnL_R: 0,
  tradesToday: 0,
  lastResetDate: null,
  lastCandleCloseTime: null
});

const loadState = () => {
  if (!fs.existsSync(statePath)) {
    return defaultState();
  }

  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch (error) {
    return defaultState();
  }
};

const saveState = (state) => {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
};

module.exports = {
  loadState,
  saveState
};
