import {View} from 'react-native';
import {SymbolView} from 'expo-symbols';
import {useLanguage} from '../i18n/provider';
import {mockOutcomes} from './mock-payment';
import type {MockCheckout} from './use-mock-checkout';
import {Option} from './options-ui';
import {CheckoutText,CheckoutButton,CheckoutError,useCheckoutColors} from './ui';
export function MockPaymentPanel({mock}:{mock:MockCheckout}){
 const {t}=useLanguage();const c=useCheckoutColors();const current=mock.state?.payments[0];
 return <View style={{gap:16}}>
  <View style={{flexDirection:'row',gap:16,alignItems:'center',padding:16,borderWidth:1,borderColor:c.border,borderRadius:12}}>
   <SymbolView name={{ios:'creditcard',android:'credit_card',web:'credit_card'}} size={30} tintColor={c.muted}/>
   <View style={{flex:1,gap:6}}><CheckoutText message="mock.card"/><CheckoutText muted message="mock.noMoney"/></View>
  </View>
  {mock.state?.booking.status==='pending_payment'&&<><CheckoutText title message="mock.scenario"/>
   {mockOutcomes.map(value=><Option key={value} title={t(`mock.outcome.${value}`)} selected={mock.outcome===value} disabled={mock.busy} onPress={()=>mock.setOutcome(value)}/>)}</>}
  {current&&<CheckoutText>{t('mock.latest')}: {t(`mock.outcome.${current.status}`)}</CheckoutText>}
  <CheckoutError message={mock.error}/>
  {mock.error&&<CheckoutButton title="mock.recover" secondary disabled={mock.busy} onPress={()=>{void mock.recover();}}/>}
  {!mock.state&&<CheckoutButton title="Retry" secondary onPress={mock.refresh}/>}
 </View>;
}
