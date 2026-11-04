-- =============================================================================
-- Flight — Seed dữ liệu danh mục, lịch bay, bảng giá, kho ghế & dịch vụ (TV3)
-- Idempotent: có thể chạy lại nhiều lần qua `supabase db reset` hoặc `db query`
-- mà không tạo bản ghi trùng hoặc làm hỏng khóa ngoại.
-- =============================================================================

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- Hàm tạm sinh UUID tất định (deterministic UUID) từ khóa chuỗi để seed idempotent
create or replace function pg_temp.seed_uuid(p_key text)
returns uuid
language sql
immutable
as $$
  select md5('flight-seed-v1:' || p_key)::uuid;
$$;

-- =============================================================================
-- 1. SÂN BAY (public.airports) — Nội địa & Quốc tế
-- =============================================================================
insert into public.airports (id, iata_code, name, city, country_code, timezone, is_active)
values
  (pg_temp.seed_uuid('airport:SGN'), 'SGN', 'Sân bay Quốc tế Tân Sơn Nhất', 'TP. Hồ Chí Minh', 'VN', 'Asia/Ho_Chi_Minh', true),
  (pg_temp.seed_uuid('airport:HAN'), 'HAN', 'Sân bay Quốc tế Nội Bài', 'Hà Nội', 'VN', 'Asia/Ho_Chi_Minh', true),
  (pg_temp.seed_uuid('airport:DAD'), 'DAD', 'Sân bay Quốc tế Đà Nẵng', 'Đà Nẵng', 'VN', 'Asia/Ho_Chi_Minh', true),
  (pg_temp.seed_uuid('airport:PQC'), 'PQC', 'Sân bay Quốc tế Phú Quốc', 'Phú Quốc', 'VN', 'Asia/Ho_Chi_Minh', true),
  (pg_temp.seed_uuid('airport:CXR'), 'CXR', 'Sân bay Quốc tế Cam Ranh', 'Nha Trang', 'VN', 'Asia/Ho_Chi_Minh', true),
  (pg_temp.seed_uuid('airport:DLI'), 'DLI', 'Sân bay Liên Khương', 'Đà Lạt', 'VN', 'Asia/Ho_Chi_Minh', true),
  (pg_temp.seed_uuid('airport:HUI'), 'HUI', 'Sân bay Quốc tế Phú Bài', 'Huế', 'VN', 'Asia/Ho_Chi_Minh', true),
  (pg_temp.seed_uuid('airport:HPH'), 'HPH', 'Sân bay Quốc tế Cát Bi', 'Hải Phòng', 'VN', 'Asia/Ho_Chi_Minh', true),
  (pg_temp.seed_uuid('airport:SIN'), 'SIN', 'Sân bay Quốc tế Changi', 'Singapore', 'SG', 'Asia/Singapore', true),
  (pg_temp.seed_uuid('airport:BKK'), 'BKK', 'Sân bay Quốc tế Suvarnabhumi', 'Bangkok', 'TH', 'Asia/Bangkok', true),
  (pg_temp.seed_uuid('airport:ICN'), 'ICN', 'Sân bay Quốc tế Incheon', 'Seoul', 'KR', 'Asia/Seoul', true),
  (pg_temp.seed_uuid('airport:NRT'), 'NRT', 'Sân bay Quốc tế Narita', 'Tokyo', 'JP', 'Asia/Tokyo', true)
on conflict (iata_code) do update
set
  name = excluded.name,
  city = excluded.city,
  country_code = excluded.country_code,
  timezone = excluded.timezone,
  is_active = excluded.is_active;

-- =============================================================================
-- 2. HÃNG HÀNG KHÔNG (public.airlines)
-- =============================================================================
insert into public.airlines (id, iata_code, name, logo_path, is_active)
values
  (pg_temp.seed_uuid('airline:VN'), 'VN', 'Vietnam Airlines', 'airlines/vn.png', true),
  (pg_temp.seed_uuid('airline:VJ'), 'VJ', 'Vietjet Air', 'airlines/vj.png', true),
  (pg_temp.seed_uuid('airline:QH'), 'QH', 'Bamboo Airways', 'airlines/qh.png', true),
  (pg_temp.seed_uuid('airline:VU'), 'VU', 'Vietravel Airlines', 'airlines/vu.png', true),
  (pg_temp.seed_uuid('airline:SQ'), 'SQ', 'Singapore Airlines', 'airlines/sq.png', true)
on conflict (iata_code) do update
set
  name = excluded.name,
  logo_path = excluded.logo_path,
  is_active = excluded.is_active;

-- =============================================================================
-- 3. ĐIỂM ĐẾN GỢI Ý TRÊN TRANG CHỦ (public.destinations) — Tối đa 8 nổi bật
-- =============================================================================
insert into public.destinations (id, airport_id, slug, title, description, image_path, is_featured, sort_order, is_active)
values
  (
    pg_temp.seed_uuid('dest:ha-noi'),
    (select id from public.airports where iata_code = 'HAN'),
    'ha-noi',
    'Hà Nội ngàn năm văn hiến',
    'Khám phá phố cổ, Hồ Gươm và ẩm thực mùa thu đặc sắc.',
    'destinations/ha-noi.jpg',
    true, 1, true
  ),
  (
    pg_temp.seed_uuid('dest:da-nang'),
    (select id from public.airports where iata_code = 'DAD'),
    'da-nang',
    'Đà Nẵng — Thành phố đáng sống',
    'Biển Mỹ Khê, Cầu Rồng và hành trình di sản miền Trung.',
    'destinations/da-nang.jpg',
    true, 2, true
  ),
  (
    pg_temp.seed_uuid('dest:phu-quoc'),
    (select id from public.airports where iata_code = 'PQC'),
    'phu-quoc',
    'Đảo ngọc Phú Quốc',
    'Bãi Sao cát trắng, hoàng hôn Nam đảo và nghỉ dưỡng biển.',
    'destinations/phu-quoc.jpg',
    true, 3, true
  ),
  (
    pg_temp.seed_uuid('dest:nha-trang'),
    (select id from public.airports where iata_code = 'CXR'),
    'nha-trang',
    'Vịnh biển Nha Trang',
    'Lặn ngắm san hô, cáp treo vượt biển và hải sản tươi ngon.',
    'destinations/nha-trang.jpg',
    true, 4, true
  ),
  (
    pg_temp.seed_uuid('dest:da-lat'),
    (select id from public.airports where iata_code = 'DLI'),
    'da-lat',
    'Đà Lạt ngàn hoa',
    'Không khí se lạnh cao nguyên, rừng thông và đồi chè Cầu Đất.',
    'destinations/da-lat.jpg',
    true, 5, true
  ),
  (
    pg_temp.seed_uuid('dest:hue'),
    (select id from public.airports where iata_code = 'HUI'),
    'hue',
    'Cố đô Huế mộng mơ',
    'Đại Nội, sông Hương, chùa Thiên Mụ và ẩm thực cung đình.',
    'destinations/hue.jpg',
    true, 6, true
  ),
  (
    pg_temp.seed_uuid('dest:singapore'),
    (select id from public.airports where iata_code = 'SIN'),
    'singapore',
    'Singapore hiện đại & xanh mát',
    'Gardens by the Bay, Marina Bay Sands và thiên đường mua sắm.',
    'destinations/singapore.jpg',
    true, 7, true
  ),
  (
    pg_temp.seed_uuid('dest:bangkok'),
    (select id from public.airports where iata_code = 'BKK'),
    'bangkok',
    'Bangkok sôi động',
    'Chùa Vàng, chợ đêm ẩm thực đường phố và trung tâm thương mại.',
    'destinations/bangkok.jpg',
    true, 8, true
  )
on conflict (slug) do update
set
  airport_id = excluded.airport_id,
  title = excluded.title,
  description = excluded.description,
  image_path = excluded.image_path,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

-- =============================================================================
-- 4. MÁY BAY (public.aircraft)
-- =============================================================================
insert into public.aircraft (id, airline_id, registration_code, model_name, is_active)
values
  (pg_temp.seed_uuid('aircraft:VN-A861'), (select id from public.airlines where iata_code = 'VN'), 'VN-A861', 'Airbus A350-900', true),
  (pg_temp.seed_uuid('aircraft:VN-A321'), (select id from public.airlines where iata_code = 'VN'), 'VN-A321', 'Airbus A321neo', true),
  (pg_temp.seed_uuid('aircraft:VN-A650'), (select id from public.airlines where iata_code = 'VJ'), 'VN-A650', 'Airbus A321neo ACF', true),
  (pg_temp.seed_uuid('aircraft:VN-A651'), (select id from public.airlines where iata_code = 'VJ'), 'VN-A651', 'Airbus A320-200', true),
  (pg_temp.seed_uuid('aircraft:VN-A588'), (select id from public.airlines where iata_code = 'QH'), 'VN-A588', 'Airbus A321neo', true),
  (pg_temp.seed_uuid('aircraft:VN-A819'), (select id from public.airlines where iata_code = 'QH'), 'VN-A819', 'Boeing 787-9 Dreamliner', true),
  (pg_temp.seed_uuid('aircraft:VN-A288'), (select id from public.airlines where iata_code = 'VU'), 'VN-A288', 'Airbus A321-200', true),
  (pg_temp.seed_uuid('aircraft:9V-SMB'),  (select id from public.airlines where iata_code = 'SQ'), '9V-SMB',  'Airbus A350-900', true)
on conflict (registration_code) do update
set
  airline_id = excluded.airline_id,
  model_name = excluded.model_name,
  is_active = excluded.is_active;

-- =============================================================================
-- 5. SƠ ĐỒ GHẾ MẪU CỦA MÁY BAY (public.seats)
-- Mỗi máy bay có:
--   - Hàng 1: first (4 ghế: A, C, D, F)
--   - Hàng 2..3: business (4 ghế/hàng: A, C, D, F)
--   - Hàng 4..5: premium_economy (6 ghế/hàng: A..F)
--   - Hàng 6..15: economy (6 ghế/hàng: A..F, hàng 10 là exit row)
-- Tổng cộng: 4 + 8 + 12 + 60 = 84 ghế mẫu trên mỗi máy bay
-- =============================================================================
with seat_layout as (
  select
    a.id as aircraft_id,
    a.registration_code,
    r.row_num::smallint as row_number,
    c.col_num::smallint as column_number,
    (r.row_num::text || c.letter) as seat_code,
    case
      when r.row_num = 1 then 'first'::public.cabin_class
      when r.row_num between 2 and 3 then 'business'::public.cabin_class
      when r.row_num between 4 and 5 then 'premium_economy'::public.cabin_class
      else 'economy'::public.cabin_class
    end as cabin_class,
    c.pos::public.seat_position as position,
    (r.row_num = 10) as is_exit_row
  from public.aircraft a
  cross join generate_series(1, 15) as r(row_num)
  cross join (
    values
      (1, 'A', 'window'),
      (2, 'B', 'middle'),
      (3, 'C', 'aisle'),
      (4, 'D', 'aisle'),
      (5, 'E', 'middle'),
      (6, 'F', 'window')
  ) as c(col_num, letter, pos)
  where a.registration_code in ('VN-A861', 'VN-A321', 'VN-A650', 'VN-A651', 'VN-A588', 'VN-A819', 'VN-A288', '9V-SMB')
    and (r.row_num >= 4 or c.letter in ('A', 'C', 'D', 'F'))
)
insert into public.seats (
  id, aircraft_id, seat_code, row_number, column_number, cabin_class, position, is_exit_row, is_active
)
select
  pg_temp.seed_uuid('seat:' || registration_code || ':' || seat_code),
  aircraft_id,
  seat_code,
  row_number,
  column_number,
  cabin_class,
  position,
  is_exit_row,
  true
from seat_layout
on conflict (aircraft_id, seat_code) do update
set
  row_number = excluded.row_number,
  column_number = excluded.column_number,
  cabin_class = excluded.cabin_class,
  position = excluded.position,
  is_exit_row = excluded.is_exit_row,
  is_active = excluded.is_active;

-- =============================================================================
-- 6. DANH MỤC DỊCH VỤ BỔ SUNG & HÀNH LÝ (public.addon_products)
-- =============================================================================
insert into public.addon_products (id, code, name, category, description, weight_kg, is_active)
values
  (
    pg_temp.seed_uuid('addon:BAG_15KG'),
    'BAG_15KG',
    'Hành lý ký gửi 15kg',
    'baggage',
    'Thêm 01 kiện hành lý ký gửi tiêu chuẩn tối đa 15kg.',
    15.00,
    true
  ),
  (
    pg_temp.seed_uuid('addon:BAG_23KG'),
    'BAG_23KG',
    'Hành lý ký gửi 23kg',
    'baggage',
    'Thêm 01 kiện hành lý ký gửi tiêu chuẩn tối đa 23kg.',
    23.00,
    true
  ),
  (
    pg_temp.seed_uuid('addon:BAG_32KG'),
    'BAG_32KG',
    'Hành lý ký gửi 32kg',
    'baggage',
    'Thêm 01 kiện hành lý ký gửi cỡ lớn tối đa 32kg.',
    32.00,
    true
  ),
  (
    pg_temp.seed_uuid('addon:MEAL_HOT_VN'),
    'MEAL_HOT_VN',
    'Suất ăn nóng truyền thống',
    'meal',
    'Cơm gà sốt sả hoặc phở bò phục vụ nóng kèm nước suối.',
    null,
    true
  ),
  (
    pg_temp.seed_uuid('addon:MEAL_VEG'),
    'MEAL_VEG',
    'Suất ăn chay thanh đạm',
    'meal',
    'Thực đơn rau củ hữu cơ và nấm chế biến theo tiêu chuẩn hàng không.',
    null,
    true
  ),
  (
    pg_temp.seed_uuid('addon:MEAL_COMBO_DRINK'),
    'MEAL_COMBO_DRINK',
    'Combo bánh ngọt & trà/cà phê',
    'meal',
    'Bánh sừng bò nướng bơ Pháp kèm trà đào hoặc cà phê sữa đá.',
    null,
    true
  ),
  (
    pg_temp.seed_uuid('addon:INS_BASIC_DEMO'),
    'INS_BASIC_DEMO',
    'Bảo vệ hành trình Cơ bản',
    'insurance_demo',
    'Quyền lợi bảo vệ hành trình theo gói đã chọn.',
    null,
    true
  ),
  (
    pg_temp.seed_uuid('addon:INS_PLUS_DEMO'),
    'INS_PLUS_DEMO',
    'Bảo vệ hành trình Nâng cao',
    'insurance_demo',
    'Quyền lợi bảo vệ hành trình theo gói đã chọn.',
    null,
    true
  )
on conflict (code) do update
set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  weight_kg = excluded.weight_kg,
  is_active = excluded.is_active;

-- =============================================================================
-- 7. LỊCH BAY MẪU 15 NGÀY TỚI (public.flight_instances)
-- Sinh chuyến bay từ hôm nay (day_offset = 0) đến +14 ngày tới trên các đường bay
-- nội địa & quốc tế phổ biến, đảm bảo mỗi máy bay không bị trùng lịch bay.
-- =============================================================================
with route_templates as (
  select *
  from (
    values
      -- SGN <-> HAN (nhiều khung giờ và hãng bay để dễ test lọc/sắp xếp)
      ('SGN-HAN-VN210', 'VN', 'VN-A861', 'VN210', 'SGN', 'HAN', '07:30:00'::time, 130, 1450000::bigint, 'scheduled'::public.flight_status),
      ('HAN-SGN-VN215', 'VN', 'VN-A861', 'VN215', 'HAN', 'SGN', '11:30:00'::time, 135, 1450000::bigint, 'scheduled'::public.flight_status),
      ('SGN-HAN-VN220', 'VN', 'VN-A861', 'VN220', 'SGN', 'HAN', '19:00:00'::time, 130, 1590000::bigint, 'scheduled'::public.flight_status),

      ('SGN-HAN-VJ122', 'VJ', 'VN-A650', 'VJ122', 'SGN', 'HAN', '09:15:00'::time, 130,  990000::bigint, 'scheduled'::public.flight_status),
      ('HAN-SGN-VJ133', 'VJ', 'VN-A650', 'VJ133', 'HAN', 'SGN', '13:30:00'::time, 135, 1020000::bigint, 'scheduled'::public.flight_status),
      ('SGN-HAN-VJ174', 'VJ', 'VN-A650', 'VJ174', 'SGN', 'HAN', '21:15:00'::time, 130,  890000::bigint, 'delayed'::public.flight_status),

      ('SGN-HAN-QH202', 'QH', 'VN-A819', 'QH202', 'SGN', 'HAN', '14:00:00'::time, 130, 1290000::bigint, 'scheduled'::public.flight_status),
      ('HAN-SGN-QH225', 'QH', 'VN-A819', 'QH225', 'HAN', 'SGN', '18:00:00'::time, 135, 1320000::bigint, 'scheduled'::public.flight_status),

      -- SGN <-> DAD
      ('SGN-DAD-VN118', 'VN', 'VN-A321', 'VN118', 'SGN', 'DAD', '08:00:00'::time,  85, 1050000::bigint, 'scheduled'::public.flight_status),
      ('DAD-SGN-VN125', 'VN', 'VN-A321', 'VN125', 'DAD', 'SGN', '10:45:00'::time,  90, 1050000::bigint, 'scheduled'::public.flight_status),
      ('SGN-DAD-VJ624', 'VJ', 'VN-A651', 'VJ624', 'SGN', 'DAD', '15:20:00'::time,  85,  750000::bigint, 'scheduled'::public.flight_status),
      ('DAD-SGN-VJ631', 'VJ', 'VN-A651', 'VJ631', 'DAD', 'SGN', '18:10:00'::time,  90,  780000::bigint, 'scheduled'::public.flight_status),

      -- HAN <-> DAD
      ('HAN-DAD-QH101', 'QH', 'VN-A588', 'QH101', 'HAN', 'DAD', '08:30:00'::time,  85,  980000::bigint, 'scheduled'::public.flight_status),
      ('DAD-HAN-QH106', 'QH', 'VN-A588', 'QH106', 'DAD', 'HAN', '11:15:00'::time,  85,  980000::bigint, 'scheduled'::public.flight_status),

      -- SGN <-> PQC & HAN <-> PQC
      ('SGN-PQC-VN1823', 'VN', 'VN-A321', 'VN1823', 'SGN', 'PQC', '14:15:00'::time, 65,  890000::bigint, 'scheduled'::public.flight_status),
      ('PQC-SGN-VN1826', 'VN', 'VN-A321', 'VN1826', 'PQC', 'SGN', '16:30:00'::time, 65,  890000::bigint, 'scheduled'::public.flight_status),
      ('HAN-PQC-QH1521', 'QH', 'VN-A588', 'QH1521', 'HAN', 'PQC', '14:45:00'::time, 130, 1550000::bigint, 'scheduled'::public.flight_status),
      ('PQC-HAN-QH1524', 'QH', 'VN-A588', 'QH1524', 'PQC', 'HAN', '18:15:00'::time, 130, 1550000::bigint, 'scheduled'::public.flight_status),

      -- SGN <-> CXR, DLI, HUI
      ('SGN-CXR-VU302', 'VU', 'VN-A288', 'VU302', 'SGN', 'CXR', '09:00:00'::time,  70,  690000::bigint, 'scheduled'::public.flight_status),
      ('CXR-SGN-VU305', 'VU', 'VN-A288', 'VU305', 'CXR', 'SGN', '11:30:00'::time,  70,  690000::bigint, 'scheduled'::public.flight_status),
      ('SGN-DLI-VU512', 'VU', 'VN-A288', 'VU512', 'SGN', 'DLI', '15:00:00'::time,  55,  650000::bigint, 'scheduled'::public.flight_status),
      ('DLI-SGN-VU515', 'VU', 'VN-A288', 'VU515', 'DLI', 'SGN', '17:00:00'::time,  55,  650000::bigint, 'scheduled'::public.flight_status),
      ('SGN-HUI-VJ304', 'VJ', 'VN-A651', 'VJ304', 'SGN', 'HUI', '20:30:00'::time,  85,  820000::bigint, 'scheduled'::public.flight_status),

      -- Tuyến Quốc tế (để kiểm thử quy tắc hộ chiếu / quốc tịch của TV2)
      ('SGN-SIN-SQ177', 'SQ', '9V-SMB',  'SQ177', 'SGN', 'SIN', '12:30:00'::time, 130, 2650000::bigint, 'scheduled'::public.flight_status),
      ('SIN-SGN-SQ186', 'SQ', '9V-SMB',  'SQ186', 'SIN', 'SGN', '17:30:00'::time, 130, 2650000::bigint, 'scheduled'::public.flight_status),
      ('SGN-BKK-VN605', 'VN', 'VN-A321', 'VN605', 'SGN', 'BKK', '19:45:00'::time,  95, 1950000::bigint, 'scheduled'::public.flight_status)
  ) as t(route_key, airline_code, reg_code, flight_number, dep_iata, arr_iata, local_dep_time, duration_mins, base_eco_price, flight_status)
),
generated_flights as (
  select
    pg_temp.seed_uuid('flight:' || rt.route_key || ':' || d.local_day::text) as flight_id,
    rt.route_key,
    d.local_day,
    al.id as airline_id,
    ac.id as aircraft_id,
    rt.flight_number,
    dep.id as departure_airport_id,
    arr.id as arrival_airport_id,
    ((d.local_day + rt.local_dep_time) at time zone dep.timezone) as departure_at,
    ((d.local_day + rt.local_dep_time) at time zone dep.timezone) + make_interval(mins => rt.duration_mins) as arrival_at,
    ((d.local_day + rt.local_dep_time) at time zone dep.timezone) - interval '60 minutes' as sales_close_at,
    rt.flight_status as status,
    now() - interval '1 day' as published_at,
    rt.base_eco_price
  from route_templates rt
  cross join (
    select ((now() at time zone 'Asia/Ho_Chi_Minh')::date + offs) as local_day
    from generate_series(0, 14) as offs
  ) d
  join public.airlines al on al.iata_code = rt.airline_code
  join public.aircraft ac on ac.registration_code = rt.reg_code
  join public.airports dep on dep.iata_code = rt.dep_iata
  join public.airports arr on arr.iata_code = rt.arr_iata
)
insert into public.flight_instances (
  id, airline_id, aircraft_id, flight_number,
  departure_airport_id, arrival_airport_id,
  departure_at, arrival_at, sales_close_at,
  status, published_at
)
select
  flight_id, airline_id, aircraft_id, flight_number,
  departure_airport_id, arrival_airport_id,
  departure_at, arrival_at, sales_close_at,
  status, published_at
from generated_flights
on conflict (airline_id, flight_number, departure_at) do update
set
  aircraft_id = excluded.aircraft_id,
  departure_airport_id = excluded.departure_airport_id,
  arrival_airport_id = excluded.arrival_airport_id,
  arrival_at = excluded.arrival_at,
  sales_close_at = excluded.sales_close_at,
  status = excluded.status,
  published_at = excluded.published_at;

-- =============================================================================
-- 8. BẢNG GIÁ & HẠNG VÉ CHO TỪNG CHUYẾN (public.flight_fares)
-- Mỗi chuyến bay có 5 gói giá trải đều 4 hạng ghế:
--   - ECO_SAVER (economy): Phổ thông Tiết kiệm (không hoàn hủy)
--   - ECO_FLEX  (economy): Phổ thông Linh hoạt (cho phép hủy có phí)
--   - PREM_ECO  (premium_economy): Phổ thông Đặc biệt
--   - BIZ_FLEX  (business): Thương gia Linh hoạt
--   - FIRST_VIP (first): Hạng Nhất Hoàng gia
-- =============================================================================
with target_flights as (
  select
    f.id as flight_id,
    f.flight_number,
    f.departure_at,
    case
      when dep.country_code <> arr.country_code then 2400000::bigint
      when f.flight_number like 'VN%' then 1350000::bigint
      when f.flight_number like 'QH%' then 1200000::bigint
      when f.flight_number like 'VJ%' then  890000::bigint
      else 750000::bigint
    end as ref_base
  from public.flight_instances f
  join public.airports dep on dep.id = f.departure_airport_id
  join public.airports arr on arr.id = f.arrival_airport_id
  where f.published_at is not null
),
fare_templates as (
  select *
  from (
    values
      (
        'ECO_SAVER', 'economy'::public.cabin_class, 'Phổ thông Tiết kiệm',
        1.00::numeric, 180000::bigint, 90000::bigint,
        '{"cabin_pieces":1,"cabin_kg":7,"checked_pieces":0,"checked_kg":0}'::jsonb,
        false, 180, 0::bigint
      ),
      (
        'ECO_FLEX', 'economy'::public.cabin_class, 'Phổ thông Linh hoạt',
        1.35::numeric, 180000::bigint, 90000::bigint,
        '{"cabin_pieces":1,"cabin_kg":10,"checked_pieces":1,"checked_kg":23}'::jsonb,
        true, 180, 350000::bigint
      ),
      (
        'PREM_ECO', 'premium_economy'::public.cabin_class, 'Phổ thông Đặc biệt',
        1.85::numeric, 220000::bigint, 100000::bigint,
        '{"cabin_pieces":2,"cabin_kg":12,"checked_pieces":1,"checked_kg":32}'::jsonb,
        true, 120, 250000::bigint
      ),
      (
        'BIZ_FLEX', 'business'::public.cabin_class, 'Thương gia Linh hoạt',
        2.80::numeric, 300000::bigint, 120000::bigint,
        '{"cabin_pieces":2,"cabin_kg":18,"checked_pieces":2,"checked_kg":32}'::jsonb,
        true, 60, 150000::bigint
      ),
      (
        'FIRST_VIP', 'first'::public.cabin_class, 'Hạng Nhất Đặc quyền',
        4.20::numeric, 350000::bigint, 150000::bigint,
        '{"cabin_pieces":2,"cabin_kg":20,"checked_pieces":3,"checked_kg":32}'::jsonb,
        true, 60, 0::bigint
      )
  ) as ft(
    fare_code, cabin_class, fare_name,
    multiplier, adult_tax, adult_fee,
    baggage_allowance, cancellation_allowed, cutoff_mins, cancel_fee
  )
)
insert into public.flight_fares (
  id, flight_id, fare_code, cabin_class, name,
  adult_base_amount, child_base_amount, infant_base_amount,
  adult_tax_amount, child_tax_amount, infant_tax_amount,
  adult_fee_amount, child_fee_amount, infant_fee_amount,
  currency, baggage_allowance,
  cancellation_allowed, cancellation_cutoff_minutes, cancellation_fee_amount,
  is_active
)
select
  pg_temp.seed_uuid('fare:' || tf.flight_id::text || ':' || ft.fare_code),
  tf.flight_id,
  ft.fare_code,
  ft.cabin_class,
  ft.fare_name,
  round(tf.ref_base * ft.multiplier, -3)::bigint as adult_base_amount,
  round(tf.ref_base * ft.multiplier * 0.75, -3)::bigint as child_base_amount,
  round(tf.ref_base * ft.multiplier * 0.10, -3)::bigint as infant_base_amount,
  ft.adult_tax,
  round(ft.adult_tax * 0.75, -3)::bigint,
  0::bigint,
  ft.adult_fee,
  ft.adult_fee,
  20000::bigint,
  'VND',
  ft.baggage_allowance,
  ft.cancellation_allowed,
  ft.cutoff_mins,
  ft.cancel_fee,
  true
from target_flights tf
cross join fare_templates ft
on conflict (flight_id, fare_code) do update
set
  cabin_class = excluded.cabin_class,
  name = excluded.name,
  adult_base_amount = excluded.adult_base_amount,
  child_base_amount = excluded.child_base_amount,
  infant_base_amount = excluded.infant_base_amount,
  adult_tax_amount = excluded.adult_tax_amount,
  child_tax_amount = excluded.child_tax_amount,
  infant_tax_amount = excluded.infant_tax_amount,
  adult_fee_amount = excluded.adult_fee_amount,
  child_fee_amount = excluded.child_fee_amount,
  infant_fee_amount = excluded.infant_fee_amount,
  baggage_allowance = excluded.baggage_allowance,
  cancellation_allowed = excluded.cancellation_allowed,
  cancellation_cutoff_minutes = excluded.cancellation_cutoff_minutes,
  cancellation_fee_amount = excluded.cancellation_fee_amount,
  is_active = excluded.is_active;

-- =============================================================================
-- 9. KHO GHẾ VẬT LÝ THEO CHUYẾN BAY (public.flight_seats)
-- Sao chép từ sơ đồ ghế mẫu `public.seats` của máy bay gắn với từng chuyến.
-- =============================================================================
insert into public.flight_seats (
  id, flight_id, seat_id, seat_code, row_number, column_number,
  cabin_class, position, is_exit_row, is_blocked, selection_fee_amount, currency
)
select
  pg_temp.seed_uuid('flight_seat:' || f.id::text || ':' || s.seat_code),
  f.id as flight_id,
  s.id as seat_id,
  s.seat_code,
  s.row_number,
  s.column_number,
  s.cabin_class,
  s.position,
  s.is_exit_row,
  (s.seat_code in ('6B', '15E')) as is_blocked,
  case
    when s.cabin_class in ('first', 'business') then 0::bigint
    when s.cabin_class = 'premium_economy' then 60000::bigint
    when s.is_exit_row then 90000::bigint
    when s.position = 'window' then 50000::bigint
    when s.position = 'aisle' then 40000::bigint
    else 30000::bigint
  end as selection_fee_amount,
  'VND'
from public.flight_instances f
join public.seats s on s.aircraft_id = f.aircraft_id and s.is_active = true
where f.published_at is not null
on conflict (flight_id, seat_id) do update
set
  seat_code = excluded.seat_code,
  row_number = excluded.row_number,
  column_number = excluded.column_number,
  cabin_class = excluded.cabin_class,
  position = excluded.position,
  is_exit_row = excluded.is_exit_row,
  is_blocked = excluded.is_blocked,
  selection_fee_amount = excluded.selection_fee_amount;

-- =============================================================================
-- 10. GÓI DỊCH VỤ BÁN TRÊN TỪNG CHUYẾN (public.flight_addon_offers)
-- =============================================================================
with product_pricing as (
  select
    p.id as product_id,
    p.code,
    case p.code
      when 'BAG_15KG' then 220000::bigint
      when 'BAG_23KG' then 320000::bigint
      when 'BAG_32KG' then 450000::bigint
      when 'MEAL_HOT_VN' then 110000::bigint
      when 'MEAL_VEG' then 105000::bigint
      when 'MEAL_COMBO_DRINK' then 75000::bigint
      when 'INS_BASIC_DEMO' then 85000::bigint
      when 'INS_PLUS_DEMO' then 145000::bigint
      else 100000::bigint
    end as unit_amount,
    case
      when p.category = 'insurance_demo' then 1::smallint
      else 2::smallint
    end as max_qty
  from public.addon_products p
  where p.is_active = true
)
insert into public.flight_addon_offers (
  id, flight_id, product_id, unit_amount, currency, max_quantity_per_passenger, is_active
)
select
  pg_temp.seed_uuid('offer:' || f.id::text || ':' || pp.code),
  f.id,
  pp.product_id,
  pp.unit_amount,
  'VND',
  pp.max_qty,
  true
from public.flight_instances f
cross join product_pricing pp
where f.published_at is not null
on conflict (flight_id, product_id) do update
set
  unit_amount = excluded.unit_amount,
  max_quantity_per_passenger = excluded.max_quantity_per_passenger,
  is_active = excluded.is_active;

-- =============================================================================
-- 11. CẤP QUYỀN ADMIN (private.user_roles)
-- Tự động cấp quyền admin cho tài khoản quản trị đã đăng ký hoặc tài khoản đầu tiên
-- trên môi trường dev nếu chưa có admin nào trên hệ thống.
-- =============================================================================
insert into private.user_roles (user_id, role)
select u.id, 'admin'
from auth.users u
where lower(u.email) in ('admin@flight.local', 'admin@example.com')
   or not exists (select 1 from private.user_roles where role = 'admin')
order by u.created_at asc
limit 1
on conflict (user_id) do nothing;

notify pgrst, 'reload schema';
commit;

