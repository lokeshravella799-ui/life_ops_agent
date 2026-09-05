import type { RawHotelResult, NormalizedHotelResult } from '../types/provider';

export class HotelNormalizer {
  private static parsePrice(raw: number | string | undefined): number {
    if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  static normalize(raw: RawHotelResult, provider: { id: string; name: string }): NormalizedHotelResult {
    const amount = this.parsePrice(raw.price);
    const currency = raw.currency ? raw.currency.toUpperCase() : 'INR';

    const images: string[] = Array.isArray(raw.images)
      ? raw.images.filter((img) => typeof img === 'string' && img.trim().length > 0)
      : [];

    const amenities: string[] = Array.isArray(raw.amenities)
      ? raw.amenities.filter((a) => typeof a === 'string' && a.trim().length > 0)
      : [];

    return {
      id: `${provider.id}_${raw.hotelId}`,
      provider: {
        id: provider.id,
        name: provider.name,
      },
      name: raw.name?.trim() || 'Hotel',
      location: raw.location?.trim() || '',
      images,
      roomType: raw.roomType?.trim(),
      price: {
        amount,
        currency,
      },
      rating: typeof raw.rating === 'number' ? Math.min(5, Math.max(0, raw.rating)) : undefined,
      reviewCount: typeof raw.reviewCount === 'number' ? Math.max(0, raw.reviewCount) : undefined,
      amenities,
      cancellationPolicy: raw.cancellationPolicy?.trim(),
      availability: raw.availability?.trim(),
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
