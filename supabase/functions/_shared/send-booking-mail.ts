import {env,rpc} from './runtime.ts';import {confirmationEmail,type BookingMailSnapshot} from './booking-email.ts';
export async function sendBookingMail(){
 const key=env('RESEND_API_KEY'),sender=env('BOOKING_EMAIL_FROM');
 const claim=await rpc<{bookingId:string;snapshot:BookingMailSnapshot;sender:string}|null>('claim_booking_mail',{p_sender:sender});if(!claim)return false;
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`booking-confirmed/${claim.bookingId}`},body:JSON.stringify(confirmationEmail(claim.snapshot,claim.sender)),signal:AbortSignal.timeout(15000)});
  const result=await response.json();const id=response.ok&&typeof result.id==='string'?result.id:'';
  await rpc('finish_booking_mail',{p_booking_id:claim.bookingId,p_provider_id:id,p_error:response.status===409&&result.name==='invalid_idempotent_request'?'conflict':id?'':`resend_${response.status}`});
 }catch{await rpc('finish_booking_mail',{p_booking_id:claim.bookingId,p_provider_id:'',p_error:'transport_unknown'});}
 return true;
}
