import {Redirect,useLocalSearchParams} from 'expo-router';
import {paymentReturnId} from '../features/booking/vnpay-payment';
export default function PaymentReturn(){const {bookingId}=useLocalSearchParams();const id=paymentReturnId(bookingId);return id?<Redirect href={{pathname:'/pending/[id]',params:{id}}}/>:<Redirect href="/tickets"/>;}
