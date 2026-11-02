import { router } from 'expo-router';
import { CheckoutShell, CheckoutText } from '@/features/booking/ui';
export default function SeatEntry() {
  return <CheckoutShell title="Seats" step={3} back={() => router.back()}>
    <CheckoutText message="Seat choices are not held." />
  </CheckoutShell>;
}
