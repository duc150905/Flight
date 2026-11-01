import { useCheckout } from '@/features/booking/checkout-provider';
import { CheckoutShell, CheckoutText, MissingCheckout } from '@/features/booking/ui';
export default function ReviewRoute() {
  const { itinerary } = useCheckout();
  return itinerary ? <CheckoutShell title="Review details" step={2}><CheckoutText>Your details are ready for the review step.</CheckoutText></CheckoutShell> : <MissingCheckout />;
}
