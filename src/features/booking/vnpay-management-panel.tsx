import {useState} from 'react';import {Modal,StyleSheet,Text,View} from 'react-native';
import {useLanguage} from '../i18n/provider';import {MoneyText} from '../currency/ui';
import {CheckoutButton,CheckoutCard,CheckoutText,checkoutStyles} from './ui';
import type {VnpayCheckout} from './use-vnpay-checkout';
import {cancellationStage,refundStatusCards} from './payment-presentation';
import {formatDateTime} from '../tickets/presentation';
export function VnpayManagementPanel({gateway,holdActive=true}:{gateway:VnpayCheckout;holdActive?:boolean}){
 const {t,language}=useLanguage();const [consent,setConsent]=useState<{fee:number;refund:number;stage:'paid'|'unpaid'}|null>(null);const s=gateway.state;const policy=s?.cancellation;
 const stage=cancellationStage(s,holdActive);
 const hasRefund=!!s?.refundState||!!s?.refundJobs.length;
 const refunds=s?refundStatusCards(s):[];
 if(!stage&&!hasRefund&&s?.booking.status!=='confirmed'&&s?.settlement!=='compensation')return null;
 return <CheckoutCard>
  {stage&&policy&&<>
   <CheckoutText title message={stage==='unpaid'?'payment.unpaidBooking':'payment.manageBooking'}/>
   <CheckoutText muted message={stage==='unpaid'?'payment.cancelUnpaidHint':'payment.cancelPaidHint'}/>
   {stage==='paid'&&<><CheckoutText message="payment.fee"/><MoneyText amount={policy.fee}/><CheckoutText message="payment.refundDue"/><MoneyText amount={policy.refundAmount}/></>}
   <CheckoutButton title={stage==='unpaid'?'payment.cancelUnpaid':'payment.cancel'} variant="text" tone="danger" disabled={gateway.busy||gateway.checking} onPress={()=>setConsent({fee:policy.fee,refund:policy.refundAmount,stage})}/></>}
  {s?.booking.status==='confirmed'&&!policy?.allowed&&<CheckoutText muted message={`mock.policy.${policy?.reason??'state'}`}/>}
  {refunds.map(refund=>{
   const tone=refundTones[refund.tone as keyof typeof refundTones];
   return <View key={refund.id} style={[styles.refundCard,{borderColor:tone.border}]}>
    <View style={styles.heading}>
     <CheckoutText title message="refund.title"/>
     <View style={[styles.badge,{backgroundColor:tone.background}]} accessibilityLiveRegion="polite">
      <Text style={[styles.badgeText,{color:tone.text}]}>{t(refund.titleKey)}</Text>
     </View>
    </View>
    <View style={styles.amount}>
     <CheckoutText muted message={refund.amountKey}/>
     <MoneyText amount={refund.amount} style={[styles.amountText,{color:tone.text}]}/>
    </View>
    {refunds.length===1&&s?.booking.status==='cancelled'&&s.settlement!=='compensation'&&policy&&<View style={styles.breakdown}>
     <View style={styles.row}><CheckoutText muted message="refund.originalPayment"/><MoneyText amount={s.booking.total}/></View>
     <View style={styles.row}><CheckoutText muted message="payment.fee"/><MoneyText amount={policy.fee}/></View>
    </View>}
    {refund.completedAt&&<View style={styles.completed}>
     <CheckoutText muted message="refund.completedAt"/>
     <CheckoutText>{formatDateTime(refund.completedAt,'Asia/Ho_Chi_Minh',language)}</CheckoutText>
    </View>}
    <CheckoutText muted message={refund.hintKey}/>
   </View>;
  })}
  {!refunds.length&&s?.refundState&&<View style={styles.amount}><CheckoutText title message={`refund.status.${s.refundState}`}/><CheckoutText muted message={`refund.hint.${s.refundState}`}/></View>}
  {s?.refundState==='ready'&&<CheckoutButton title="payment.refund" disabled={gateway.busy} onPress={()=>{void gateway.refund();}}/>}
  {s?.settlement==='compensation'&&<CheckoutText message="payment.compensation"/>}
  <Modal visible={!!consent} transparent onRequestClose={()=>setConsent(null)}><View style={checkoutStyles.scrim}><View accessibilityViewIsModal style={checkoutStyles.dialog}>
   <CheckoutText title message={consent?.stage==='unpaid'?'payment.cancelUnpaidWarning':'payment.cancelWarning'}/>
   {consent?.stage==='unpaid'?<CheckoutText muted message="payment.cancelUnpaidConfirmHint"/>:<><CheckoutText message="payment.fee"/><MoneyText amount={consent?.fee??0}/><CheckoutText message="payment.refundDue"/><MoneyText amount={consent?.refund??0}/></>}
   <CheckoutButton title="payment.keep" onPress={()=>setConsent(null)}/><CheckoutButton title="payment.cancelConfirm" tone="danger" disabled={gateway.busy} onPress={()=>{if(consent){const fee=consent.fee;setConsent(null);void gateway.cancel(fee);}}}/>
  </View></View></Modal>
 </CheckoutCard>;
}
const refundTones={
 success:{text:'#166534',background:'#DCFCE7',border:'#BBE1C7'},
 attention:{text:'#854D0E',background:'#FEF3C7',border:'#E9D7AD'},
 waiting:{text:'#006D7D',background:'#E4F8FB',border:'#BCE4EA'},
};
const styles=StyleSheet.create({
 refundCard:{borderWidth:1,borderRadius:16,padding:20,gap:18,backgroundColor:'#FFFFFF'},
 heading:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:12},
 badge:{borderRadius:20,paddingHorizontal:12,paddingVertical:6},badgeText:{fontSize:13,lineHeight:20,fontWeight:'600'},
 amount:{gap:6},amountText:{fontSize:28,lineHeight:36,fontWeight:'700'},
 breakdown:{borderTopWidth:1,borderTopColor:'#EFF0F2',paddingTop:16,gap:12},
 row:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:8},completed:{gap:4},
});
