type CancellationState = {
  booking: { status: string };
  cancellation: { allowed: boolean };
};

/** Presentation follows the server policy; an expired countdown cannot offer a stale hold action. */
export function cancellationStage(state?: CancellationState, holdActive = true): 'unpaid' | 'paid' | null {
  if (!state?.cancellation.allowed) return null;
  if (state.booking.status === 'confirmed') return 'paid';
  if (state.booking.status === 'pending_payment' && holdActive) return 'unpaid';
  return null;
}

type RefreshState = {
  provider?: string | null;
  payments: { status: string }[];
  refundState?: string | null;
  refundJobs?: { state: string }[];
};
const activeRefundStates = ['ready', 'submitted', 'unknown', 'processing'];
export function paymentNeedsRefresh(state?: RefreshState): boolean {
  return state?.provider === 'vnpay_sandbox' && (state.payments.some(payment => payment.status === 'pending')
    || activeRefundStates.includes(state.refundState ?? '')
    || !!state.refundJobs?.some(job => activeRefundStates.includes(job.state)));
}
export function paymentRefreshInterval(state: RefreshState | undefined, visible: boolean, until: number, now = Date.now()): number | false {
  return visible && now < until && paymentNeedsRefresh(state) ? 10_000 : false;
}
export function paymentWatchExpired(state: RefreshState | undefined, until: number, now: number): boolean {
  return now >= until && paymentNeedsRefresh(state);
}
type ReceiptStatus = { ownerId?: string; bookingId: string; status: string };
export function bookingDetailsChanged(previous: ReceiptStatus | undefined, next: ReceiptStatus): boolean {
  if (!previous || previous.ownerId !== next.ownerId || previous.bookingId !== next.bookingId) return next.status !== 'pending_payment';
  return previous.status !== next.status;
}
export async function refreshPaymentRead(read: () => Promise<unknown>, current: () => boolean, changed: () => void) {
  if (!current()) return;
  await read();
  if (current()) changed();
}

type RefundState = 'ready' | 'submitted' | 'unknown' | 'processing' | 'succeeded' | 'failed' | 'review';
type RefundRecord = { id: string; amount: number; status: string; completedAt: string | null };
type RefundDisplayState = {
  refundState?: RefundState | null;
  refundJobs: { id: string; amount: number; state: RefundState }[];
  refunds: RefundRecord[];
};
/** Per-job state takes priority; an aggregate status is never a second refund. */
export function refundStatusCards(state: RefundDisplayState) {
  const jobs = state.refundJobs.length ? state.refundJobs : state.refunds.map(refund => ({
    id: refund.id, amount: refund.amount,
    state: state.refundState ?? (refund.status === 'succeeded' ? 'succeeded' : refund.status === 'failed' ? 'failed' : 'submitted'),
  }));
  return jobs.map(job => ({
    ...job,
    titleKey: `refund.status.${job.state}`,
    hintKey: `refund.hint.${job.state}`,
    amountKey: job.state === 'succeeded' ? 'refund.amountCompleted' : 'payment.refundDue',
    tone: job.state === 'succeeded' ? 'success' : ['unknown', 'failed', 'review'].includes(job.state) ? 'attention' : 'waiting',
    completedAt: job.state === 'succeeded' ? state.refunds.find(refund => refund.id === job.id)?.completedAt ?? null : null,
  }));
}
