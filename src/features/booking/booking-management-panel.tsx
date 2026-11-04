import {useState} from 'react';
import {Modal,View} from 'react-native';
import {useLanguage} from '../i18n/provider';
import {MoneyText} from '../currency/ui';
import type {MockCheckout} from './use-mock-checkout';
import {CheckoutButton,CheckoutCard,CheckoutError,CheckoutText,checkoutStyles} from './ui';
import {Option} from './options-ui';
import {cancellationStage} from './payment-presentation';
export function BookingManagementPanel({mock,holdActive=true}:{mock:MockCheckout;holdActive?:boolean}){
 const {t}=useLanguage();const [confirmation,setConfirmation]=useState<{fee:number;refund:number;stage:'paid'|'unpaid'}|null>(null);
 const policy=mock.state?.cancellation;const status=mock.state?.booking.status;
 const stage=cancellationStage(mock.state,holdActive);
 return <CheckoutCard>
  <CheckoutError message={mock.error}/>
  {!!mock.error&&<CheckoutButton title="mock.recover" secondary disabled={mock.busy} onPress={()=>{void mock.recover();}}/>}
  {stage&&policy?<>
   <CheckoutText title message={stage==='unpaid'?'payment.unpaidBooking':'payment.manageBooking'}/><CheckoutText muted message={stage==='unpaid'?'payment.cancelUnpaidHint':'mock.cancelWarning'}/>
   {stage==='paid'&&<><CheckoutText message="mock.cancelFee"/><MoneyText amount={policy.fee}/>
   <CheckoutText message="mock.refundDue"/><MoneyText amount={policy.refundAmount}/></>}
   {status==='confirmed'&&<CheckoutText muted message="mock.cancelPolicy"/>}
   <CheckoutButton title={stage==='unpaid'?'payment.cancelUnpaid':'mock.cancel'} variant="text" tone="danger" disabled={mock.busy} onPress={()=>setConfirmation({fee:policy.fee,refund:policy.refundAmount,stage})}/>
  </>:status==='confirmed'&&policy&&<CheckoutText muted message={`mock.policy.${policy.reason}`}/>}
  {status==='cancelled'&&<>
   <CheckoutText title message="mock.cancelled"/><CheckoutText message="mock.refundDue"/><MoneyText amount={policy?.refundAmount??0}/>
   {mock.state?.refunds[0]&&<CheckoutText>{t('mock.refundStatus')}: {t(`mock.outcome.${mock.state.refunds[0].status}`)}</CheckoutText>}
   {(policy?.refundAmount??0)>0&&mock.state?.refunds[0]?.status!=='succeeded'&&<>
    <CheckoutText title message="mock.refundScenario"/>
    {(['succeeded','failed','pending'] as const).map(value=><Option key={value} title={t(`mock.outcome.${value}`)} selected={mock.refundOutcome===value} disabled={mock.busy} onPress={()=>mock.setRefundOutcome(value)}/>)}
    <CheckoutButton title={mock.state?.refunds[0]?'mock.refundRetry':'mock.refund'} disabled={mock.busy} onPress={()=>{void mock.refund();}}/>
   </>}
   <CheckoutText muted message="mock.noMoney"/>
  </>}
  <Modal visible={!!confirmation} transparent animationType="none" onRequestClose={()=>setConfirmation(null)}>
   <View style={checkoutStyles.scrim}><View accessibilityViewIsModal style={checkoutStyles.dialog}>
    <CheckoutText title message={confirmation?.stage==='unpaid'?'payment.cancelUnpaidWarning':'mock.cancelWarning'}/>
    {confirmation?.stage==='unpaid'?<CheckoutText muted message="payment.cancelUnpaidConfirmHint"/>:<>
     <CheckoutText>{t('mock.cancelFee')}</CheckoutText><MoneyText amount={confirmation?.fee??0}/>
     <CheckoutText>{t('mock.refundDue')}</CheckoutText><MoneyText amount={confirmation?.refund??0}/></>}
    <CheckoutButton title="mock.keep" onPress={()=>setConfirmation(null)}/>
    <CheckoutButton title="mock.cancelConfirm" tone="danger" disabled={mock.busy} onPress={()=>{if(confirmation){const fee=confirmation.fee;setConfirmation(null);void mock.cancel(fee);}}}/>
   </View></View>
  </Modal>
 </CheckoutCard>;
}
