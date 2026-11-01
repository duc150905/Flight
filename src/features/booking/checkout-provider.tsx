import { createContext, useContext, useState, type PropsWithChildren } from 'react';
import { useStore } from 'zustand';
import { createCheckoutDraftStore } from './draft';

const CheckoutContext = createContext<ReturnType<typeof createCheckoutDraftStore> | null>(null);
/** The layout keys this provider by authenticated user ID. No personal data persists. */
export function CheckoutProvider({ children }: PropsWithChildren) {
  const [store] = useState(createCheckoutDraftStore);
  return <CheckoutContext.Provider value={store}>{children}</CheckoutContext.Provider>;
}
export function useCheckout() {
  const store = useContext(CheckoutContext);
  if (!store) throw new Error('CheckoutProvider missing');
  return useStore(store);
}
