const { DateTime } = require('luxon');

const parseTime = (timeStr) => {
  const [hour, minute] = timeStr.split(':').map((value) => Number(value));
  return { hour, minute };
};

const isWithinTradingHours = (timestampMs, tz, startStr, endStr) => {
  const dt = DateTime.fromMillis(timestampMs, { zone: tz });
  const { hour: sh, minute: sm } = parseTime(startStr);
  const { hour: eh, minute: em } = parseTime(endStr);

  const start = dt.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
  const end = dt.set({ hour: eh, minute: em, second: 0, millisecond: 0 });

  if (end < start) {
    return dt >= start || dt <= end;
  }

  return dt >= start && dt <= end;
};

const dateKey = (timestampMs, tz) => {
  return DateTime.fromMillis(timestampMs, { zone: tz }).toISODate();
};

module.exports = {
  isWithinTradingHours,
  dateKey
};
