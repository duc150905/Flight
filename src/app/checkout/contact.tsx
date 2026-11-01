import { useCheckout } from '@/features/booking/checkout-provider';
import { CheckoutShell, CheckoutText, MissingCheckout } from '@/features/booking/ui';
export default function ContactRoute() {
  const { itinerary } = useCheckout();
  return itinerary ? <CheckoutShell title="Contact details" step={0}><CheckoutText>Contact form is being prepared.</CheckoutText></CheckoutShell> : <MissingCheckout />;
}
