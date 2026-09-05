import type { RawBusResult, NormalizedBusResult } from '../types/provider';

export class BusNormalizer {
  private static parsePrice(raw: number | string | undefined): number {
    if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  static normalize(raw: RawBusResult, provider: { id: string; name: string }): NormalizedBusResult {
    const amount = this.parsePrice(raw.price);
    const currency = raw.currency ? raw.currency.toUpperCase() : 'INR';

    const boardingPoints = Array.isArray(raw.boardingPoints)
      ? raw.boardingPoints.filter((b) => typeof b === 'string' && b.trim().length > 0)
      : undefined;

    const droppingPoints = Array.isArray(raw.droppingPoints)
      ? raw.droppingPoints.filter((d) => typeof d === 'string' && d.trim().length > 0)
      : undefined;

    return {
      id: `${provider.id}_${raw.busId}`,
      provider: {
        id: provider.id,
        name: provider.name,
      },
      operator: raw.operator?.trim() || 'Unspecified Operator',
      source: raw.source?.trim() || '',
      destination: raw.destination?.trim() || '',
      departureTime: raw.departureTime?.trim() || '',
      arrivalTime: raw.arrivalTime?.trim(),
      duration: raw.duration?.trim(),
      busType: raw.busType?.trim() || 'Standard Bus',
      price: {
        amount,
        currency,
      },
      seatsAvailable: typeof raw.seatsAvailable === 'number' ? Math.max(0, raw.seatsAvailable) : undefined,
      boardingPoints,
      droppingPoints,
      rating: typeof raw.rating === 'number' ? Math.min(5, Math.max(0, raw.rating)) : undefined,
      cancellationPolicy: raw.cancellationPolicy?.trim(),
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
