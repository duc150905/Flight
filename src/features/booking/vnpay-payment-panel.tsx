import {CheckoutButton,CheckoutError,CheckoutText} from './ui';
import type {VnpayCheckout} from './use-vnpay-checkout';
export function VnpayPaymentPanel({gateway}:{gateway:VnpayCheckout}){
 return <><CheckoutText title message="payment.vnpay"/><CheckoutText muted message="payment.sandbox"/>
  <CheckoutText muted message="payment.hosted"/><CheckoutError message={gateway.error}/>
  {gateway.state?.payments[0]&&<CheckoutText message={`payment.status.${gateway.state.payments[0].status}`}/>}
  {gateway.state?.settlement==='compensation'&&<CheckoutText message="payment.compensation"/>}
  <CheckoutButton title="payment.refresh" secondary disabled={gateway.busy} onPress={()=>{void gateway.reconcile();}}/>
 </>;
}
