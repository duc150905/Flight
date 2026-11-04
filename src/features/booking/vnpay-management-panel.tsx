import {useState} from 'react';import {Modal,View} from 'react-native';
import {useLanguage} from '../i18n/provider';import {MoneyText} from '../currency/ui';
import {CheckoutButton,CheckoutCard,CheckoutText,CheckoutError,checkoutStyles} from './ui';
import type {VnpayCheckout} from './use-vnpay-checkout';
export function VnpayManagementPanel({gateway}:{gateway:VnpayCheckout}){
 const {t}=useLanguage();const [consent,setConsent]=useState<{fee:number;refund:number}|null>(null);const s=gateway.state;const policy=s?.cancellation;
 return <CheckoutCard><CheckoutError message={gateway.error}/>
  {policy?.allowed&&<><CheckoutText title message="payment.cancel"/><CheckoutText message="payment.fee"/><MoneyText amount={policy.fee}/><CheckoutText message="payment.refundDue"/><MoneyText amount={policy.refundAmount}/>
   <CheckoutButton title="payment.cancel" secondary disabled={gateway.busy} onPress={()=>setConsent({fee:policy.fee,refund:policy.refundAmount})}/></>}
  {s?.booking.status==='confirmed'&&!policy?.allowed&&<CheckoutText muted message={`mock.policy.${policy?.reason??'state'}`}/>}
  {s?.refundState&&<CheckoutText>{t('payment.refundState')}: {t(`payment.refund.${s.refundState}`)}</CheckoutText>}
  {s?.refundJobs.map(job=><View key={job.id}><MoneyText amount={job.amount}/><CheckoutText message={`payment.refund.${job.state}`}/></View>)}
  {s?.refundState==='ready'&&<CheckoutButton title="payment.refund" disabled={gateway.busy} onPress={()=>{void gateway.refund();}}/>}
  {s?.settlement==='compensation'&&<CheckoutText message="payment.compensation"/>}
  <CheckoutButton title="payment.refresh" secondary disabled={gateway.busy} onPress={()=>{void gateway.reconcile();}}/>
  <Modal visible={!!consent} transparent onRequestClose={()=>setConsent(null)}><View style={checkoutStyles.scrim}><View accessibilityViewIsModal style={checkoutStyles.dialog}>
   <CheckoutText title message="payment.cancelWarning"/><CheckoutText message="payment.fee"/><MoneyText amount={consent?.fee??0}/><CheckoutText message="payment.refundDue"/><MoneyText amount={consent?.refund??0}/>
   <CheckoutButton title="payment.keep" onPress={()=>setConsent(null)}/><CheckoutButton title="payment.cancelConfirm" disabled={gateway.busy} onPress={()=>{if(consent){const fee=consent.fee;setConsent(null);void gateway.cancel(fee);}}}/>
  </View></View></Modal>
 </CheckoutCard>;
}
