import { Redirect } from 'expo-router';
/** Keep old links valid; traveller and contact now share one reference screen. */
export function ContactScreen() { return <Redirect href="/checkout/passengers" />; }
