import {CheckoutProvider} from '@/features/booking/checkout-provider';
import {PendingBookingScreen} from '@/features/booking/pending-screen';
export default function DemoReceiptRoute(){return <CheckoutProvider><PendingBookingScreen receipt/></CheckoutProvider>;}
