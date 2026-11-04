import type { CabinClass } from '../discovery/model';

export type AiExtractedFlightSearch = {
  originIata: string;
  destinationIata: string;
  originName?: string;
  destinationName?: string;
  tripType: 'one_way' | 'round_trip';
  departureDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabinClass: CabinClass;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  flightSearch?: AiExtractedFlightSearch;
  error?: boolean;
};

