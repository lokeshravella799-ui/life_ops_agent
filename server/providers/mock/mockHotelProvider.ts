import type {
  IHotelProviderAdapter,
  RawHotelResult,
  ProviderSearchResponse,
  IVerifiableProvider,
  ProviderHotelVerificationResponse,
} from '../../types/provider';
import type { SearchRequirements } from '../../types/agent';

/**
 * DEVELOPMENT MOCK - Hospitality Adapter (HorizonStays Network)
 */
export class MockHotelProvider implements IHotelProviderAdapter, IVerifiableProvider {
  readonly providerId = 'mock_horizonstays';
  readonly providerName = 'DEVELOPMENT MOCK - HorizonStays';
  readonly category = 'hotel' as const;
  readonly supportsVerification: boolean = true;

  private available: boolean = true;

  setAvailable(status: boolean): void {
    this.available = status;
  }

  isAvailable(): boolean {
    return this.available;
  }

  async searchHotels(requirements: SearchRequirements): Promise<ProviderSearchResponse<RawHotelResult>> {
    const startTime = Date.now();
    const city = requirements.destination || 'Bangalore';

    const rawHotels: RawHotelResult[] = [
      {
        hotelId: 'HOTEL-IND-01',
        name: 'The Oberoi Bangalore',
        location: `${city}, MG Road`,
        images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945'],
        roomType: 'Deluxe Premier King',
        price: 14500,
        currency: 'INR',
        rating: 4.9,
        reviewCount: 3200,
        amenities: ['Free High-Speed WiFi', 'Infinity Pool', 'Spa & Wellness', 'Valet Parking'],
        cancellationPolicy: 'Free cancellation until 24 hours before check-in',
        availability: '3 rooms left',
        bookingUrl: 'https://horizonstays.example.com/hotel/oberoi-blr',
      },
    ];

    return {
      providerId: this.providerId,
      providerName: this.providerName,
      success: true,
      results: rawHotels,
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    };
  }

  async getHotelDetails(hotelId: string): Promise<RawHotelResult | null> {
    const res = await this.searchHotels({});
    return res.results.find((h) => h.hotelId === hotelId) || null;
  }

  async verifyHotel(hotelId: string): Promise<ProviderHotelVerificationResponse> {
    const hotel = await this.getHotelDetails(hotelId);
    if (!hotel) {
      return {
        success: false,
        hotelId,
        error: `Hotel ${hotelId} not found.`,
        verifiedAt: new Date().toISOString(),
      };
    }

    const priceAmount =
      typeof hotel.price === 'number'
        ? hotel.price
        : parseFloat(String(hotel.price).replace(/[^0-9.]/g, ''));

    return {
      success: true,
      hotelId,
      roomAvailability: 'AVAILABLE',
      price: {
        amount: priceAmount,
        currency: hotel.currency || 'INR',
      },
      cancellationPolicy: hotel.cancellationPolicy,
      verifiedAt: new Date().toISOString(),
    };
  }
}

