type LegacySnapshot={version?:1;code:string;email:string;total:number;flights:Record<string,string>[];passengers:{name:string}[];seats:{seat:string}[];addons:{name:string;quantity?:number}[]};
type MailAddon={name:string;quantity?:number};
type MailTraveller={name:string;requiresSeat:boolean;seat:string|null;addons:MailAddon[]};
type MailSegment={journeyNumber:number;legNumber:number;flight:Record<string,string>;passengers:MailTraveller[]};
type DetailedSnapshot={version:2;tripType:'one_way'|'round_trip'|'multi_city';code:string;email:string;total:number;segments:MailSegment[]};
type Snapshot=LegacySnapshot|DetailedSnapshot;
function escape(value:unknown){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}
// Keep the old request byte-for-byte stable for already attempted outbox rows:
// Resend rejects changed payloads under an existing idempotency key.
function legacyConfirmationEmail(data:LegacySnapshot,from:string){
 const rows=data.flights.map(f=>`<li>${escape(f.flight_number)} · ${escape(f.departure_iata)} → ${escape(f.arrival_iata)} · ${escape(f.departure_at)}</li>`).join('');
 const html=`<div style="font-family:Arial,sans-serif;color:#102a43;max-width:600px;margin:auto"><div style="padding:24px;background:#00b8d0"><h1>Flyora</h1></div><div style="padding:24px"><h2>Đặt vé thành công / Booking confirmed</h2><p>Mã đặt chỗ / Booking reference: <strong>${escape(data.code)}</strong></p><ul>${rows}</ul><p>Hành khách / Travellers: ${data.passengers.map(p=>escape(p.name)).join(' · ')}</p><p>Ghế / Seats: ${data.seats.map(s=>escape(s.seat)).join(', ')}</p><p>Dịch vụ / Add-ons: ${data.addons.map(a=>`${escape(a.name)} × ${escape(a.quantity??1)}`).join(', ')||'—'}</p><p>Tổng tiền / Total: <strong>${escape(new Intl.NumberFormat('vi-VN').format(data.total))} VND</strong></p><p>Đây là đặt vé thử nghiệm, không phải vé của hãng hay thẻ lên máy bay.<br/>This is a sandbox booking, not an airline ticket or boarding pass.</p></div></div>`;
 return {from,to:[data.email],subject:`Flyora — Booking confirmed ${data.code}`,html};
}

function localTime(value:string,timezone:string){
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return 'Chưa có thông tin / Not available';
 const options:Intl.DateTimeFormatOptions={timeZone:timezone||'UTC',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'shortOffset'};
 let parts:Intl.DateTimeFormatPart[];
 try{parts=new Intl.DateTimeFormat('vi-VN',options).formatToParts(date);}
 catch{parts=new Intl.DateTimeFormat('vi-VN',{...options,timeZone:'UTC'}).formatToParts(date);}
 const part=(type:string)=>parts.find(p=>p.type===type)?.value??'';
 return `${part('hour')}:${part('minute')} · ${part('day')}/${part('month')}/${part('year')} (${part('timeZoneName')})`;
}

export function confirmationEmail(data:Snapshot,from:string){
 if(data.version!==2)return legacyConfirmationEmail(data,from);
 const segments=[...data.segments].sort((a,b)=>a.journeyNumber-b.journeyNumber||a.legNumber-b.legNumber);
 const sections=segments.map((segment,index)=>{
  const flight=segment.flight;
  let title=`Chặng ${index+1} / Leg ${index+1}`;
  if(data.tripType==='round_trip'){
   title=segment.journeyNumber===1?'Chiều đi / Outbound':'Chiều về / Return';
   if(segments.filter(s=>s.journeyNumber===segment.journeyNumber).length>1)title+=` · Chặng ${segment.legNumber} / Leg ${segment.legNumber}`;
  }
  const travellers=segment.passengers.map(p=>{
   const seat=p.requiresSeat?(p.seat?`Ghế / Seat: <strong>${escape(p.seat)}</strong>`:'Chưa có thông tin ghế / Seat unavailable'):'Em bé — Không có ghế riêng / Infant — No separate seat';
   const addons=p.addons.map(a=>`${escape(a.name)} × ${escape(a.quantity??1)}`).join(', ');
   return `<tr><td style="padding:12px 0;border-top:1px solid #dbe7ed;vertical-align:top"><strong>${escape(p.name)}</strong><br/><span>${seat}</span>${addons?`<br/><span style="color:#526777">Dịch vụ / Add-ons: ${addons}</span>`:''}</td></tr>`;
  }).join('');
  return `<div style="margin:24px 0;padding:16px;border:1px solid #cfe5ea;border-radius:12px"><h3 style="margin:0 0 10px;color:#007f91">${title}</h3><p style="margin:0 0 8px;font-size:18px"><strong>${escape(flight.departure_iata)} → ${escape(flight.arrival_iata)}</strong></p><p style="margin:0 0 12px">${escape(flight.airline_name)} · ${escape(flight.flight_number)}${flight.fare_name?`<br/>${escape(flight.fare_name)}`:''}</p><p style="margin:6px 0">Khởi hành / Departure: ${escape(localTime(flight.departure_at,flight.departure_timezone))}</p><p style="margin:6px 0 16px">Đến nơi / Arrival: ${escape(localTime(flight.arrival_at,flight.arrival_timezone))}</p><table role="presentation" style="width:100%;border-collapse:collapse"><tbody>${travellers}</tbody></table></div>`;
 }).join('');
 const html=`<div style="font-family:Arial,sans-serif;color:#102a43;max-width:600px;margin:auto;line-height:1.6;background:#ffffff"><div style="padding:24px;background:#00b8d0"><h1 style="margin:0;color:#ffffff">Flyora</h1></div><div style="padding:24px"><h2>Đặt vé thành công / Booking confirmed</h2><p>Mã đặt chỗ / Booking reference:<br/><strong style="overflow-wrap:anywhere;word-break:break-all">${escape(data.code)}</strong></p>${sections}<p style="padding:16px;background:#e5f8fa;border-radius:8px">Tổng tiền / Total: <strong>${escape(new Intl.NumberFormat('vi-VN').format(data.total))} VND</strong></p><p style="font-size:13px;color:#526777">Đây là đặt vé thử nghiệm, không phải vé của hãng hay thẻ lên máy bay.<br/>This is a sandbox booking, not an airline ticket or boarding pass.</p></div></div>`;
 return {from,to:[data.email],subject:`Flyora — Booking confirmed ${data.code}`,html};
}
export type BookingMailSnapshot=Snapshot;
