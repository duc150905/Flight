import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Airport, CabinClass } from '../discovery/model';
import type { Language } from '../i18n/language';
import type { AiExtractedFlightSearch, ChatMessage } from './types';

const STORAGE_KEY = 'flyora_custom_gemini_key';

export async function getGeminiApiKey(): Promise<string> {
  const envKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (envKey && envKey.trim().length > 0) {
    return envKey.trim();
  }
  try {
    const savedKey = await AsyncStorage.getItem(STORAGE_KEY);
    return savedKey ? savedKey.trim() : '';
  } catch {
    return '';
  }
}

export async function saveCustomGeminiApiKey(key: string): Promise<void> {
  try {
    if (!key.trim()) {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, key.trim());
    }
  } catch (error) {
    console.error('Failed to save Gemini API key:', error);
  }
}

function getTodayVietnam(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts; // Returns YYYY-MM-DD
}

function buildSystemPrompt(airports: Airport[], language: Language = 'vi'): string {
  const today = getTodayVietnam();
  const airportListStr = airports
    .map(a => `${a.city} (${a.iata_code}) - ${a.name}`)
    .join('\n');

  return `You are Flyora AI Assistant — a smart, courteous, and friendly travel assistant for the Flyora flight booking mobile application.
Today's date: ${today} (Timezone: Asia/Ho_Chi_Minh).
Current app interface language: ${language === 'en' ? 'English (en)' : 'Vietnamese (vi)'}.

SUPPORTED AIRPORTS LIST:
${airportListStr || 'SGN (Ho Chi Minh City / Saigon), HAN (Hanoi), DAD (Da Nang), PQC (Phu Quoc), DLI (Da Lat), CXR (Nha Trang / Cam Ranh), VDO (Van Don), HPH (Hai Phong), VII (Vinh), HUI (Hue), UIH (Quy Nhon)'}

ANALYSIS AND CONVERSATION RULES:
1. BILINGUAL SUPPORT (VIETNAMESE & ENGLISH):
   - You MUST communicate fluently in both Vietnamese and English.
   - Detect and match the user's language automatically: If the user writes in English, reply in natural, polite English. If the user writes in Vietnamese, reply in natural, polite Vietnamese.
2. AIRPORT AND CITY RECOGNITION (both Vietnamese and English):
   - Ho Chi Minh City / Saigon / HCMC / HCM / Sài Gòn / TP.HCM -> SGN
   - Hanoi / Ha Noi / Noi Bai -> HAN
   - Da Nang / Danang -> DAD
   - Phu Quoc -> PQC
   - Da Lat / Dalat -> DLI
   - Nha Trang / Cam Ranh -> CXR
   - Hai Phong -> HPH, Van Don / Quang Ninh -> VDO, Hue -> HUI, Quy Nhon -> UIH, Vinh -> VII
3. RELATIVE DATE COMPUTATION (YYYY-MM-DD):
   - Today is ${today}.
   - Understand relative dates in both Vietnamese ('ngày mai', 'cuối tuần này', 'thứ sáu tuần sau'...) and English ('tomorrow', 'this weekend', 'next Friday', 'next week', 'in 3 days'...).
   - Departure and return dates must never be in the past.
4. CALLING 'search_flights' FUNCTION:
   - When the user expresses intent to find or book a flight and provides origin, destination, and departure date, YOU MUST call the 'search_flights' function.
   - If crucial information is missing (such as destination or departure date), ask the user politely and conversationally in their language. DO NOT guess or invent dates.
5. In addition to calling 'search_flights', always provide a brief, helpful, warm response in the user's language.
6. FORMATTING: Use clean, natural mobile text. Avoid excessive markdown symbols. Keep responses conversational, concise, and easy to read in a mobile chat bubble.`;
}

const SEARCH_FLIGHTS_TOOL = {
  functionDeclarations: [
    {
      name: 'search_flights',
      description: 'Thực hiện tìm kiếm chuyến bay phù hợp khi người dùng đã xác định rõ nơi đi, nơi đến và ngày bay.',
      parameters: {
        type: 'OBJECT',
        properties: {
          originIata: {
            type: 'STRING',
            description: 'Mã IATA 3 ký tự viết hoa của sân bay khởi hành (ví dụ: SGN, HAN, DAD).',
          },
          destinationIata: {
            type: 'STRING',
            description: 'Mã IATA 3 ký tự viết hoa của sân bay đến (ví dụ: SGN, HAN, DAD).',
          },
          tripType: {
            type: 'STRING',
            enum: ['one_way', 'round_trip'],
            description: 'Loại hành trình: one_way (một chiều) hoặc round_trip (khứ hồi).',
          },
          departureDate: {
            type: 'STRING',
            description: 'Ngày khởi hành định dạng YYYY-MM-DD.',
          },
          returnDate: {
            type: 'STRING',
            description: 'Ngày về định dạng YYYY-MM-DD (bắt buộc nếu là khứ hồi round_trip).',
          },
          adults: {
            type: 'INTEGER',
            description: 'Số người lớn (từ 12 tuổi trở lên), mặc định 1.',
          },
          children: {
            type: 'INTEGER',
            description: 'Số trẻ em (2-11 tuổi), mặc định 0.',
          },
          infants: {
            type: 'INTEGER',
            description: 'Số em bé dưới 2 tuổi (ngồi chung ghế với người lớn), mặc định 0.',
          },
          cabinClass: {
            type: 'STRING',
            enum: ['economy', 'premium_economy', 'business', 'first'],
            description: 'Hạng khoang: economy (phổ thông), business (thương gia)... mặc định economy.',
          },
        },
        required: ['originIata', 'destinationIata', 'tripType', 'departureDate'],
      },
    },
  ],
};

export async function sendChatMessageToGemini(
  conversationHistory: ChatMessage[],
  airports: Airport[],
  apiKey: string,
  language: Language = 'vi'
): Promise<{ text: string; flightSearch?: AiExtractedFlightSearch }> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('MISSING_API_KEY');
  }

  const cleanKey = apiKey.trim();

  // Format contents for Gemini (keep latest 8 messages to prevent TPM rate limits)
  const filteredMessages = conversationHistory
    .filter(msg => msg.role === 'user' || msg.role === 'assistant');
  const recentMessages = filteredMessages.slice(-8);

  const contents = recentMessages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }],
  }));

  const systemInstruction = {
    parts: [{ text: buildSystemPrompt(airports, language) }],
  };

  const payload = {
    systemInstruction,
    contents,
    tools: [SEARCH_FLIGHTS_TOOL],
    toolConfig: {
      functionCallingConfig: {
        mode: 'AUTO',
      },
    },
    generationConfig: {
      temperature: 0.2, // Low temperature for high precision tool calls
    },
  };

  // High-availability candidate models verified for Gemini API
  const candidateModels = [
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3-flash-preview',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
  ];
  let lastError = '';
  let responseData: any = null;
  let encounteredRateLimit = false;

  for (let attempt = 0; attempt < candidateModels.length; attempt++) {
    const model = candidateModels[attempt];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        responseData = await response.json();
        break;
      }

      const errorBody = await response.text();
      lastError = errorBody;

      if (response.status === 400 || response.status === 401 || response.status === 403) {
        if (
          errorBody.includes('API_KEY_INVALID') ||
          errorBody.includes('key not valid') ||
          errorBody.includes('UNAUTHENTICATED') ||
          errorBody.includes('PERMISSION_DENIED')
        ) {
          throw new Error('INVALID_API_KEY');
        }
      }

      // If rate limited on this model (429), pause briefly and fallback to next model
      if (response.status === 429) {
        encounteredRateLimit = true;
        if (attempt < candidateModels.length - 1) {
          await new Promise(r => setTimeout(r, 800));
          continue;
        }
      }

      // If 404 (model not found) or 503 (model temporarily busy), try next model
      if (response.status === 404 || response.status === 503) {
        continue;
      }

      // If other unexpected error, attempt next model before failing
      if (attempt < candidateModels.length - 1) {
        continue;
      }
    } catch (err: any) {
      if (err?.message === 'INVALID_API_KEY') {
        throw err;
      }
      lastError = err?.message || String(err);
    }
  }

  if (!responseData) {
    if (encounteredRateLimit) {
      throw new Error('QUOTA_EXCEEDED');
    }
    throw new Error(`API_ERROR: ${lastError}`);
  }

  const data = responseData;
  const candidate = data.candidates?.[0];
  if (!candidate || !candidate.content?.parts) {
    return { text: 'Xin lỗi, Flyora AI không nhận được phản hồi phù hợp. Bạn hãy thử lại nhé!' };
  }

  let textResponse = '';
  let flightSearch: AiExtractedFlightSearch | undefined = undefined;

  for (const part of candidate.content.parts) {
    if (part.text) {
      textResponse += part.text;
    }
    if (part.functionCall && part.functionCall.name === 'search_flights') {
      const args = part.functionCall.args || {};
      const originIata = String(args.originIata || '').trim().toUpperCase();
      const destinationIata = String(args.destinationIata || '').trim().toUpperCase();
      const tripType = args.tripType === 'round_trip' ? 'round_trip' : 'one_way';
      const departureDate = String(args.departureDate || '').trim();
      const returnDate = args.returnDate ? String(args.returnDate).trim() : undefined;
      const adults = Math.max(1, Number(args.adults) || 1);
      const children = Math.max(0, Number(args.children) || 0);
      const infants = Math.max(0, Number(args.infants) || 0);
      const cabinClass = (args.cabinClass || 'economy') as CabinClass;

      // Find airport names
      const originAirport = airports.find(a => a.iata_code.toUpperCase() === originIata);
      const destAirport = airports.find(a => a.iata_code.toUpperCase() === destinationIata);

      flightSearch = {
        originIata,
        destinationIata,
        originName: originAirport ? `${originAirport.city} (${originIata})` : originIata,
        destinationName: destAirport ? `${destAirport.city} (${destinationIata})` : destinationIata,
        tripType,
        departureDate,
        returnDate,
        adults,
        children,
        infants,
        cabinClass,
      };

      if (!textResponse.trim()) {
        const routeLabel = `${flightSearch.originName} → ${flightSearch.destinationName}`;
        if (language === 'en') {
          const typeLabel = tripType === 'round_trip' ? 'round-trip' : 'one-way';
          textResponse = `I found ${typeLabel} flight options from ${routeLabel} for ${adults} passenger(s) on ${departureDate}. Please check the summary card below and tap the button to view flights and fares! ✨`;
        } else {
          const typeLabel = tripType === 'round_trip' ? 'khứ hồi' : 'một chiều';
          textResponse = `Dạ, em đã tìm thấy chuyến bay ${typeLabel} từ ${routeLabel} cho ${adults} người lớn vào ngày ${departureDate}. Bạn xem thông tin tóm tắt bên dưới và bấm nút để xem chi tiết vé nhé! ✨`;
        }
      }
    }
  }

  return {
    text: textResponse.trim() || (language === 'en' ? 'I understood your flight request!' : 'Em đã hiểu yêu cầu của bạn!'),
    flightSearch,
  };
}

