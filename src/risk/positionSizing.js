const getPrecision = (stepSize) => Math.max(0, (stepSize.toString().split('.')[1] || '').length);

const normalizeToPrecision = (value, precision) => Number(Number(value).toFixed(precision));

const floorToStep = (value, stepSize) => {
  if (!stepSize) return value;
  const precision = getPrecision(stepSize);
  const steps = Math.floor((value + Number.EPSILON) / stepSize);
  const floored = steps * stepSize;
  return normalizeToPrecision(floored, precision);
};

const calculatePositionSize = ({
  equity,
  riskPct,
  entry,
  stop,
  lotStep,
  minQty,
  minNotional
}) => {
  const stopDistance = entry - stop;
  if (stopDistance <= 0) return { qty: 0, reason: 'invalid_stop_distance' };
  const riskAmount = equity * riskPct;
  const rawQty = riskAmount / stopDistance;
  const flooredQty = floorToStep(rawQty, lotStep);

  if (flooredQty < minQty) return { qty: 0, reason: 'min_qty' };
  if (flooredQty * entry < minNotional) return { qty: 0, reason: 'min_notional' };

  return { qty: flooredQty, reason: 'ok', stopDistance, riskAmount };
};

module.exports = {
  calculatePositionSize,
  floorToStep
};
