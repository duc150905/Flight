type ChartBooking = { created_at: string; status: string; total_amount: number };
const DAY = 86_400_000;
function localDay(instant: number) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const part = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day'));
}
/** Seven chronological buckets, using actual creation dates and confirmed gross VND. */
export function adminChartSeries(bookings: readonly ChartBooking[], now = Date.now(), days = 30) {
  const end = localDay(now); const start = end - (days - 1) * DAY;
  const points = Array.from({ length: 7 }, (_, i) => ({ day: new Date(start + Math.ceil(i * days / 7) * DAY).toISOString().slice(5, 10), bookings: 0, revenue: 0 }));
  for (const booking of bookings) {
    const time = Date.parse(booking.created_at);
    if (!Number.isFinite(time) || time > now) continue;
    const date = localDay(time);
    if (date < start || date > end) continue;
    const point = points[Math.min(6, Math.floor((date - start) / DAY * 7 / days))];
    point.bookings++;
    if (booking.status === 'confirmed' && Number.isSafeInteger(booking.total_amount) && booking.total_amount >= 0) point.revenue += booking.total_amount;
  }
  const maxBookings = Math.max(0, ...points.map(p => p.bookings)); const maxRevenue = Math.max(0, ...points.map(p => p.revenue));
  return points.map(p => ({ ...p, bookingPct: maxBookings ? p.bookings / maxBookings * 100 : 0, revPct: maxRevenue ? p.revenue / maxRevenue * 100 : 0 }));
}
