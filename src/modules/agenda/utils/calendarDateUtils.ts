export const toDateInputValue = (date: Date) => {
  return date.toISOString().slice(0, 10);
};

export const fromDateInputValue = (value: string) => {
  return new Date(`${value}T12:00:00`);
};

export const addDays = (dateValue: string, amount: number) => {
  const date = fromDateInputValue(dateValue);
  date.setDate(date.getDate() + amount);

  return toDateInputValue(date);
};

export const addMonths = (dateValue: string, amount: number) => {
  const date = fromDateInputValue(dateValue);
  date.setMonth(date.getMonth() + amount);

  return toDateInputValue(date);
};

export const getStartOfWeek = (dateValue: string) => {
  const date = fromDateInputValue(dateValue);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + mondayOffset);

  return toDateInputValue(date);
};

export const getWeekDays = (dateValue: string) => {
  const start = getStartOfWeek(dateValue);

  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
};

export const getMonthGridDays = (dateValue: string) => {
  const date = fromDateInputValue(dateValue);
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDayOfMonth = new Date(year, month, 1, 12);
  const lastDayOfMonth = new Date(year, month + 1, 0, 12);

  const firstDay = firstDayOfMonth.getDay();
  const mondayOffset = firstDay === 0 ? -6 : 1 - firstDay;

  const gridStart = new Date(firstDayOfMonth);
  gridStart.setDate(firstDayOfMonth.getDate() + mondayOffset);

  const days: string[] = [];

  for (let index = 0; index < 42; index += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + index);

    days.push(toDateInputValue(current));
  }

  return {
    days,
    month,
    year,
    firstDayOfMonth: toDateInputValue(firstDayOfMonth),
    lastDayOfMonth: toDateInputValue(lastDayOfMonth),
  };
};

export const formatLongDate = (dateValue: string) => {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fromDateInputValue(dateValue));
};

export const formatMonthTitle = (dateValue: string) => {
  return new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
  }).format(fromDateInputValue(dateValue));
};

export const formatShortDay = (dateValue: string) => {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
  }).format(fromDateInputValue(dateValue));
};