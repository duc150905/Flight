import { CheckoutProvider } from '@/features/booking/checkout-provider';
import { PendingBookingScreen } from '@/features/booking/pending-screen';
export default function PendingBookingRoute() {
  return <CheckoutProvider><PendingBookingScreen /></CheckoutProvider>;
}
