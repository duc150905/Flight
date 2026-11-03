import {Image} from 'expo-image';
import {SymbolView} from 'expo-symbols';
import {router} from 'expo-router';
import {ScrollView,StyleSheet,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useLanguage} from '../i18n/provider';
import {MoneyText,CurrencyRateNote} from '../currency/ui';
import {formatDateTime} from '../tickets/presentation';
import type {PendingBooking} from './pending-booking';
import {CheckoutText,CheckoutButton,useCheckoutColors} from './ui';
export function PaymentSuccessView({booking}:{booking:PendingBooking}){
 const {t,language}=useLanguage();const c=useCheckoutColors();const first=booking.segments[0].snapshot;const last=booking.segments.at(-1)!.snapshot;
 return <SafeAreaView style={{flex:1,backgroundColor:c.background}}><ScrollView contentContainerStyle={{paddingBottom:28}}>
  <View style={styles.hero}><Image source={require('../../../assets/images/booking-success-reference.png')} style={{width:'100%',aspectRatio:390/844}} contentFit="cover" accessibilityLabel={t('mock.success')}/></View>
  <View style={[styles.card,{backgroundColor:c.surface,borderColor:c.border}]}>
   <View style={{alignItems:'center',gap:16}}>
    <SymbolView name={{ios:'checkmark.circle',android:'check_circle',web:'check_circle'}} size={34} tintColor={c.primary}/>
    <CheckoutText title message="mock.success"/><CheckoutText muted message="mock.noMoney"/>
    <CheckoutText>{t('Booking reference')}: {booking.bookingCode}</CheckoutText>
   </View>
   <View style={styles.route}><View style={{flex:1,gap:8}}><CheckoutText title>{first.departure_iata}</CheckoutText><CheckoutText muted>{formatDateTime(first.departure_at,first.departure_timezone,language)}</CheckoutText></View>
    <SymbolView name={{ios:'airplane',android:'flight',web:'flight'}} size={26} tintColor={c.muted}/>
    <View style={{flex:1,gap:8}}><CheckoutText title>{last.arrival_iata}</CheckoutText><CheckoutText muted>{formatDateTime(last.arrival_at,last.arrival_timezone,language)}</CheckoutText></View></View>
   <CheckoutText>{booking.passengers.map(p=>`${p.givenNames} ${p.familyName}`).join(' · ')}</CheckoutText>
   <MoneyText amount={booking.total} style={{fontSize:26,fontWeight:'700',textAlign:'center'}}/><CurrencyRateNote/>
   <CheckoutButton title="mock.ticket" onPress={()=>router.replace({pathname:'/receipt/[id]',params:{id:booking.id}})}/>
   <CheckoutButton title="mock.home" secondary onPress={()=>router.replace('/')}/>
   <CheckoutText muted message="mock.notBoardingPass"/>
  </View>
 </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({hero:{height:300,overflow:'hidden'},card:{marginTop:-48,marginHorizontal:20,padding:20,gap:22,borderWidth:1,borderRadius:12,maxWidth:580,width:'90%',alignSelf:'center',alignItems:'stretch'},route:{flexDirection:'row',alignItems:'center',gap:16}});
