import { expandedCatalogueEnglish } from './expanded-catalogue.ts';
import { mealCatalogueEnglish } from './meal-catalogue.ts';

// Shared catalogue copy is translated at display time; database identifiers and prices stay intact.
export const catalogueEnglish = {
  ...expandedCatalogueEnglish,
  ...mealCatalogueEnglish,
  'Hà Nội ngàn năm văn hiến': 'Hanoi, a thousand years of heritage',
  'Đà Nẵng — Thành phố đáng sống': 'Da Nang, where coast meets city',
  'Đảo ngọc Phú Quốc': 'Phu Quoc, the pearl island',
  'Vịnh biển Nha Trang': 'Discover Nha Trang Bay',
  'Đà Lạt ngàn hoa': 'Da Lat, the city of flowers',
  'Cố đô Huế mộng mơ': 'Hue, the timeless imperial city',
  'Singapore hiện đại & xanh mát': 'Singapore, a city in a garden',
  'Bangkok sôi động': 'Experience vibrant Bangkok',
  'TP. Hồ Chí Minh': 'Ho Chi Minh City', 'Hà Nội': 'Hanoi', 'Đà Nẵng': 'Da Nang',
  'Phú Quốc': 'Phu Quoc', 'Đà Lạt': 'Da Lat', 'Huế': 'Hue', 'Hải Phòng': 'Hai Phong',
  'Sân bay Quốc tế Tân Sơn Nhất': 'Tan Son Nhat International Airport',
  'Sân bay Quốc tế Nội Bài': 'Noi Bai International Airport',
  'Sân bay Quốc tế Đà Nẵng': 'Da Nang International Airport',
  'Sân bay Quốc tế Phú Quốc': 'Phu Quoc International Airport',
  'Sân bay Liên Khương': 'Lien Khuong Airport',
  'Sân bay Quốc tế Phú Bài': 'Phu Bai International Airport',
  'Sân bay Quốc tế Cát Bi': 'Cat Bi International Airport',
  'Sân bay Quốc tế Changi': 'Changi International Airport',
  'Sân bay Quốc tế Incheon': 'Incheon International Airport',
  'Sân bay Quốc tế Narita': 'Narita International Airport',
  'Sân bay Quốc tế Suvarnabhumi': 'Suvarnabhumi International Airport',
  'Sân bay Quốc tế Cam Ranh': 'Cam Ranh International Airport',
  'Demo Standard': 'Standard', 'Demo Flex': 'Flex',
  'Phổ thông Tiết kiệm': 'Economy Saver', 'Phổ thông Linh hoạt': 'Economy Flex',
  'Phổ thông Đặc biệt': 'Premium Economy', 'Thương gia Linh hoạt': 'Business Flex',
  'Hạng nhất Linh hoạt': 'First Flex',
  'Demo checked baggage 15 kg': '15 kg checked baggage',
  'Demo checked baggage 25 kg': '25 kg checked baggage',
  'Hành lý ký gửi 15 kg': '15 kg checked baggage', 'Hành lý ký gửi 25 kg': '25 kg checked baggage',
  'Hành lý ký gửi 15kg': '15 kg checked baggage', 'Hành lý ký gửi 23kg': '23 kg checked baggage',
  'Hành lý ký gửi 32kg': '32 kg checked baggage',
  'Bảo vệ hành trình Cơ bản': 'Basic journey protection', 'Bảo vệ hành trình Nâng cao': 'Enhanced journey protection',
  'Hành lý ký gửi mua thêm cho từng hành khách và chặng bay.': 'Additional checked baggage for each passenger and flight.',
  'Suất ăn đặt trước cho từng hành khách và chặng bay.': 'Pre-ordered meals for each passenger and flight.',
} as const;

export const catalogueVietnamese = {
  ...Object.fromEntries(Object.keys(catalogueEnglish).map(key => [key, key])),
  'Demo Standard': 'Tiêu chuẩn', 'Demo Flex': 'Linh hoạt',
  'Demo checked baggage 15 kg': 'Hành lý ký gửi 15 kg',
  'Demo checked baggage 25 kg': 'Hành lý ký gửi 25 kg',
} as Record<keyof typeof catalogueEnglish, string>;
