import { useCheckout } from '@/features/booking/checkout-provider';
import { CheckoutShell, CheckoutText, MissingCheckout } from '@/features/booking/ui';
export default function PassengersRoute() {
  const { itinerary } = useCheckout();
  return itinerary ? <CheckoutShell title="Traveller information" step={1}><CheckoutText>Traveller forms are being prepared.</CheckoutText></CheckoutShell> : <MissingCheckout />;
}
