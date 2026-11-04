import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.generated';
import type { CheckoutItinerary } from './itinerary-data';
import { parseAllowance, type BaggageOffer, type MealOffer } from './baggage.ts';
export async function loadBaggage(client: SupabaseClient<Database>, itinerary: CheckoutItinerary) {
  const [fares, offers, products] = await Promise.all([
    client.from('flight_fares').select('id,flight_id,baggage_allowance,is_active').in('id', itinerary.legs.map(l => l.fareId)).eq('is_active', true),
    client.from('flight_addon_offers').select('id,flight_id,product_id,unit_amount,currency,max_quantity_per_passenger').in('flight_id', itinerary.legs.map(l => l.flightId)).eq('is_active', true),
    client.from('addon_products').select('id,name,category,description,weight_kg').in('category', ['baggage', 'meal']).eq('is_active', true),
  ]);
  if (fares.error || offers.error || products.error) throw new Error('extras.loadError');
  const allowances: Record<string, ReturnType<typeof parseAllowance>> = {};
  for (const leg of itinerary.legs) {
    const fare = fares.data.find(f => f.id === leg.fareId && f.flight_id === leg.flightId);
    if (!fare) throw new Error('extras.unavailable');
    allowances[leg.flightId] = parseAllowance(fare.baggage_allowance);
  }
  const baggageOffers: BaggageOffer[] = offers.data.flatMap(o => {
    const product = products.data.find(p => p.id === o.product_id && p.category === 'baggage');
    return product && o.currency === 'VND' && Number.isSafeInteger(o.unit_amount) && o.unit_amount >= 0
      && product.weight_kg !== null && product.weight_kg > 0 && o.max_quantity_per_passenger >= 1
      ? [{ id: o.id, flightId: o.flight_id, name: product.name, weightKg: product.weight_kg, amount: o.unit_amount, currency: 'VND' as const }] : [];
  });

  const mealOffers: MealOffer[] = offers.data.flatMap(o => {
    const product = products.data.find(p => p.id === o.product_id && p.category === 'meal');
    return product && o.currency === 'VND' && Number.isSafeInteger(o.unit_amount) && o.unit_amount >= 0
      ? [{ id: o.id, flightId: o.flight_id, productId: product.id, name: product.name, description: product.description, amount: o.unit_amount, currency: 'VND' as const }] : [];
  });

  for (const leg of itinerary.legs) {
    const hasMeal = mealOffers.some(m => m.flightId === leg.flightId);
    if (!hasMeal) {
      const generalMeals = products.data.filter(p => p.category === 'meal');
      for (const gm of generalMeals) {
        mealOffers.push({
          id: `meal:${leg.flightId}:${gm.id}`,
          flightId: leg.flightId,
          productId: gm.id,
          name: gm.name,
          description: gm.description,
          amount: 0,
          currency: 'VND',
        });
      }
    }
  }

  return { allowances, offers: baggageOffers, meals: mealOffers };
}
