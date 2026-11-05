/** Cash events are independent of the booking's current status or creation date. */
type Booking = { id: string; status: string; total_amount: number; created_at: string; confirmed_at: string | null };
type Payment = { id: string; status: string; amount: number; created_at: string; provider?: string; paid_at?: string | null; captured?: boolean; captured_at?: string | null };
type Refund = { id: string; status: string; amount: number; created_at: string; completed_at?: string | null };
export type BookingMetricsSummary = {
  totalBookings: number; confirmedCount: number; pendingCount: number; cancelledCount: number; expiredCount: number;
  confirmedGrossAmount: number; successfulReceiptAmount: number; completedRefundAmount: number; netCashAmount: number;
  /** Compatibility alias; use netCashAmount in presentation. */ simulatedNetAmount: number;
  totalCustomers: number; newCustomersInWindow: number; succeededPaymentsCount: number; failedPaymentsCount: number;
};
export function summarizeAdminBookingsAndRevenue(input: {
  bookings: readonly Booking[]; payments?: readonly Payment[]; refunds?: readonly Refund[];
  profiles?: readonly { id: string; created_at: string }[]; nowMs?: number; daysWindow?: number;
}): BookingMetricsSummary {
  const now = input.nowMs ?? Date.now();
  const cutoff = now - Math.max(1, input.daysWindow ?? 30) * 86_400_000;
  const inWindow = (date: string | null | undefined) => {
    const time = date ? Date.parse(date) : NaN;
    return Number.isFinite(time) && time >= cutoff && time <= now;
  };
  const amount = (value: number) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const unique = <T extends { id: string }>(rows: readonly T[]) => [...new Map(rows.map(row => [row.id, row])).values()];
  const bookings = unique(input.bookings).filter(row => inWindow(row.created_at));
  const payments = unique(input.payments ?? []);
  const refunds = unique(input.refunds ?? []);
  const successfulPayments = payments.filter(row => (row.captured === undefined ? (!row.provider || row.provider === 'mock') && row.status === 'succeeded' && inWindow(row.paid_at) : row.captured && inWindow(row.captured_at)));
  const successfulReceiptAmount = successfulPayments.reduce((sum, row) => sum + amount(row.amount), 0);
  const completedRefundAmount = refunds.filter(row => (row.status === 'succeeded' || row.status === 'completed') && inWindow(row.completed_at)).reduce((sum, row) => sum + amount(row.amount), 0);
  const netCashAmount = successfulReceiptAmount - completedRefundAmount;
  const profiles = unique(input.profiles ?? []);
  return {
    totalBookings: bookings.length,
    confirmedCount: bookings.filter(row => row.status === 'confirmed').length,
    pendingCount: bookings.filter(row => row.status === 'pending_payment').length,
    cancelledCount: bookings.filter(row => row.status === 'cancelled').length,
    expiredCount: bookings.filter(row => row.status === 'expired').length,
    confirmedGrossAmount: bookings.filter(row => row.status === 'confirmed').reduce((sum, row) => sum + amount(row.total_amount), 0),
    successfulReceiptAmount, completedRefundAmount, netCashAmount, simulatedNetAmount: netCashAmount,
    totalCustomers: profiles.length, newCustomersInWindow: profiles.filter(row => inWindow(row.created_at)).length,
    succeededPaymentsCount: successfulPayments.length,
    failedPaymentsCount: payments.filter(row => row.status === 'failed' && inWindow(row.created_at)).length,
  };
}
