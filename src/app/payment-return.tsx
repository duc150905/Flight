import { useEffect } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { paymentReturnId } from '../features/booking/vnpay-payment';

export default function PaymentReturn() {
  const { bookingId } = useLocalSearchParams();
  const id = paymentReturnId(bookingId);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    void WebBrowser.dismissBrowser();
  }, []);

  return id ? (
    <Redirect href={{ pathname: '/pending/[id]', params: { id } }} />
  ) : (
    <Redirect href="/tickets" />
  );
}
