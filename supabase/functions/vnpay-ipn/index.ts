import {endpoint,json,rpc,runtime} from '../_shared/runtime.ts';
import {readConfig} from '../_shared/vnpay/config.ts';
import {verifyPayCallback} from '../_shared/vnpay/signing.ts';
endpoint(async request=>{
 if(request.method!=='GET')return json({RspCode:'99',Message:'Method not supported'},405);
 let result;try{result=await verifyPayCallback(new URL(request.url).searchParams,readConfig(k=>runtime.env.get(k)));}
 catch{return json({RspCode:'97',Message:'Invalid signature or parameters'});}
 if(result.outcome==='waiting')return json({RspCode:'00',Message:'Pending result recorded for reconciliation'});
 try{return json(await rpc('apply_vnpay_result',{p_ref:result.ref,p_amount:result.amount,p_success:result.success,p_transaction_no:result.transactionNo,p_pay_date:result.payDate,p_code:result.code}));}
 catch{return json({RspCode:'99',Message:'Please retry'});}
});
