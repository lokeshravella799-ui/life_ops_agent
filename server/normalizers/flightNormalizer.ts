import type { RawFlightResult, NormalizedFlightResult } from '../types/provider';

export class FlightNormalizer {
  private static parsePrice(raw: number | string | undefined): number {
    if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  static normalize(raw: RawFlightResult, provider: { id: string; name: string }): NormalizedFlightResult {
    const amount = this.parsePrice(raw.price);
    const currency = raw.currency ? raw.currency.toUpperCase() : 'INR';

    return {
      id: `${provider.id}_${raw.flightId}`,
      provider: {
        id: provider.id,
        name: provider.name,
      },
      airline: raw.airline?.trim() || 'Airlines',
      flightNumber: raw.flightNumber?.trim(),
      origin: raw.origin?.trim() || '',
      destination: raw.destination?.trim() || '',
      departureTime: raw.departureTime?.trim() || '',
      arrivalTime: raw.arrivalTime?.trim(),
      duration: raw.duration?.trim(),
      stops: typeof raw.stops === 'number' ? Math.max(0, raw.stops) : 0,
      cabinClass: raw.cabinClass?.trim() || 'Economy',
      baggage: raw.baggage?.trim(),
      price: {
        amount,
        currency,
      },
      bookingUrl: raw.bookingUrl?.trim(),
      fetchedAt: new Date().toISOString(),
      verification: {
        priceVerified: false,
        availabilityVerified: false,
        providerVerified: false,
      },
    };
  }
}
