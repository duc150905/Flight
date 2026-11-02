export function monthGrid(year: number, month: number): (string | null)[] {
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [
    ...Array<null>(firstDay).fill(null),
    ...Array.from({ length: dayCount }, (_, index) =>
      `${year}-${String(month + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`),
  ];
}

export function monthAfter(year: number, month: number, offset: number) {
  const date = new Date(Date.UTC(year, month + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}
