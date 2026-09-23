// all report windows are UTC calendar days - seed data uses midnight UTC timestamps,
// and building dates from local time would shift the window by a day on IST machines

export function utcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function yesterday(from = new Date()) {
  const day = utcDay(from);
  day.setUTCDate(day.getUTCDate() - 1);
  return day;
}

// end is exclusive, so the pipeline uses $gte start and $lt end
export function dayRange(date) {
  const start = utcDay(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function formatDate(date) {
  return utcDay(date).toISOString().slice(0, 10);
}
