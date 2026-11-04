type Snapshot={code:string;email:string;total:number;flights:Record<string,string>[];passengers:{name:string}[];seats:{seat:string}[];addons:{name:string;quantity?:number}[]};
function escape(value:unknown){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}
export function confirmationEmail(data:Snapshot,from:string){
 const rows=data.flights.map(f=>`<li>${escape(f.flight_number)} · ${escape(f.departure_iata)} → ${escape(f.arrival_iata)} · ${escape(f.departure_at)}</li>`).join('');
 const html=`<div style="font-family:Arial,sans-serif;color:#102a43;max-width:600px;margin:auto"><div style="padding:24px;background:#00b8d0"><h1>Flyora</h1></div><div style="padding:24px"><h2>Đặt vé thành công / Booking confirmed</h2><p>Mã đặt chỗ / Booking reference: <strong>${escape(data.code)}</strong></p><ul>${rows}</ul><p>Hành khách / Travellers: ${data.passengers.map(p=>escape(p.name)).join(' · ')}</p><p>Ghế / Seats: ${data.seats.map(s=>escape(s.seat)).join(', ')}</p><p>Dịch vụ / Add-ons: ${data.addons.map(a=>`${escape(a.name)} × ${escape(a.quantity??1)}`).join(', ')||'—'}</p><p>Tổng tiền / Total: <strong>${escape(new Intl.NumberFormat('vi-VN').format(data.total))} VND</strong></p><p>Đây là đặt vé thử nghiệm, không phải vé của hãng hay thẻ lên máy bay.<br/>This is a sandbox booking, not an airline ticket or boarding pass.</p></div></div>`;
 return {from,to:[data.email],subject:`Flyora — Booking confirmed ${data.code}`,html};
}
export type BookingMailSnapshot=Snapshot;
