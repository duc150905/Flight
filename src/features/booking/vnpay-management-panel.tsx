import {useState} from 'react';import {Modal,View} from 'react-native';
import {useLanguage} from '../i18n/provider';import {MoneyText} from '../currency/ui';
import {CheckoutButton,CheckoutCard,CheckoutText,checkoutStyles} from './ui';
import type {VnpayCheckout} from './use-vnpay-checkout';
import {cancellationStage} from './payment-presentation';
export function VnpayManagementPanel({gateway,holdActive=true}:{gateway:VnpayCheckout;holdActive?:boolean}){
 const {t}=useLanguage();const [consent,setConsent]=useState<{fee:number;refund:number;stage:'paid'|'unpaid'}|null>(null);const s=gateway.state;const policy=s?.cancellation;
 const stage=cancellationStage(s,holdActive);
 const hasRefund=!!s?.refundState||!!s?.refundJobs.length;
 if(!stage&&!hasRefund&&s?.booking.status!=='confirmed'&&s?.settlement!=='compensation')return null;
 return <CheckoutCard>
  {stage&&policy&&<>
   <CheckoutText title message={stage==='unpaid'?'payment.unpaidBooking':'payment.manageBooking'}/>
   <CheckoutText muted message={stage==='unpaid'?'payment.cancelUnpaidHint':'payment.cancelPaidHint'}/>
   {stage==='paid'&&<><CheckoutText message="payment.fee"/><MoneyText amount={policy.fee}/><CheckoutText message="payment.refundDue"/><MoneyText amount={policy.refundAmount}/></>}
   <CheckoutButton title={stage==='unpaid'?'payment.cancelUnpaid':'payment.cancel'} variant="text" tone="danger" disabled={gateway.busy||gateway.checking} onPress={()=>setConsent({fee:policy.fee,refund:policy.refundAmount,stage})}/></>}
  {s?.booking.status==='confirmed'&&!policy?.allowed&&<CheckoutText muted message={`mock.policy.${policy?.reason??'state'}`}/>}
  {s?.refundState&&<CheckoutText>{t('payment.refundState')}: {t(`payment.refund.${s.refundState}`)}</CheckoutText>}
  {s?.refundJobs.map(job=><View key={job.id}><MoneyText amount={job.amount}/><CheckoutText message={`payment.refund.${job.state}`}/></View>)}
  {s?.refundState==='ready'&&<CheckoutButton title="payment.refund" disabled={gateway.busy} onPress={()=>{void gateway.refund();}}/>}
  {s?.settlement==='compensation'&&<CheckoutText message="payment.compensation"/>}
  <Modal visible={!!consent} transparent onRequestClose={()=>setConsent(null)}><View style={checkoutStyles.scrim}><View accessibilityViewIsModal style={checkoutStyles.dialog}>
   <CheckoutText title message={consent?.stage==='unpaid'?'payment.cancelUnpaidWarning':'payment.cancelWarning'}/>
   {consent?.stage==='unpaid'?<CheckoutText muted message="payment.cancelUnpaidConfirmHint"/>:<><CheckoutText message="payment.fee"/><MoneyText amount={consent?.fee??0}/><CheckoutText message="payment.refundDue"/><MoneyText amount={consent?.refund??0}/></>}
   <CheckoutButton title="payment.keep" onPress={()=>setConsent(null)}/><CheckoutButton title="payment.cancelConfirm" tone="danger" disabled={gateway.busy} onPress={()=>{if(consent){const fee=consent.fee;setConsent(null);void gateway.cancel(fee);}}}/>
  </View></View></Modal>
 </CheckoutCard>;
}
