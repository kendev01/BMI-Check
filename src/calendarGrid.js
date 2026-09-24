const { toISODate } = require('./goals');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function isValidMonth(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''));
}

function shiftMonth(monthISO, delta) {
  const [year, month] = monthISO.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Builds a Monday-first month grid. Each cell carries the day's logged total
 * and how it compares to the target, so the view stays free of date maths.
 */
function buildMonth(monthISO, totals, { target, today } = {}) {
  const [year, month] = monthISO.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  // getDay() is Sunday-first; shift so Monday is column 0.
  const leading = (first.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < leading; i += 1) cells.push(null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${monthISO}-${String(day).padStart(2, '0')}`;
    const row = totals[date];
    const total = row ? row.total : 0;

    let status = 'empty';
    if (row) status = target ? (total > target ? 'over' : 'under') : 'logged';

    cells.push({
      day,
      date,
      total,
      items: row ? row.items : 0,
      status,
      isToday: date === today,
      isFuture: today ? date > today : false,
    });
  }

  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const logged = Object.values(totals);
  const loggedInMonth = logged.length;
  const monthTotal = logged.reduce((sum, r) => sum + r.total, 0);

  return {
    monthISO,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
    weekdayLabels: WEEKDAY_LABELS,
    weeks,
    prevMonth: shiftMonth(monthISO, -1),
    nextMonth: shiftMonth(monthISO, 1),
    loggedDays: loggedInMonth,
    daysInMonth,
    averagePerLoggedDay: loggedInMonth ? Math.round(monthTotal / loggedInMonth) : 0,
    daysOnTarget: target ? logged.filter((r) => r.total <= target).length : null,
  };
}

function currentMonth() {
  return toISODate(new Date()).slice(0, 7);
}

module.exports = { buildMonth, isValidMonth, shiftMonth, currentMonth };
