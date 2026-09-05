import type {
  IFlightProviderAdapter,
  RawFlightResult,
  ProviderSearchResponse,
  IVerifiableProvider,
  ProviderFlightVerificationResponse,
} from '../../types/provider';
import type { SearchRequirements } from '../../types/agent';

/**
 * DEVELOPMENT MOCK - Aviation Adapter (SkyRoutes Global)
 */
export class MockFlightProvider implements IFlightProviderAdapter, IVerifiableProvider {
  readonly providerId = 'mock_skyroutes';
  readonly providerName = 'DEVELOPMENT MOCK - SkyRoutes';
  readonly category = 'flight' as const;
  readonly supportsVerification: boolean = true;

  private available: boolean = true;

  setAvailable(status: boolean): void {
    this.available = status;
  }

  isAvailable(): boolean {
    return this.available;
  }

  async searchFlights(requirements: SearchRequirements): Promise<ProviderSearchResponse<RawFlightResult>> {
    const startTime = Date.now();

    const rawFlights: RawFlightResult[] = [
      {
        flightId: 'FL-6E-402',
        airline: 'IndiGo',
        flightNumber: '6E 402',
        origin: requirements.source || 'HYD',
        destination: requirements.destination || 'BLR',
        departureTime: '08:15',
        arrivalTime: '09:25',
        duration: '1h 10m',
        stops: 0,
        cabinClass: 'Economy',
        baggage: '15 kg check-in, 7 kg cabin',
        price: 3499,
        currency: 'INR',
        bookingUrl: 'https://skyroutes.example.com/flights/6e402',
      },
    ];

    return {
      providerId: this.providerId,
      providerName: this.providerName,
      success: true,
      results: rawFlights,
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    };
  }

  async getFlightDetails(flightId: string): Promise<RawFlightResult | null> {
    const res = await this.searchFlights({});
    return res.results.find((f) => f.flightId === flightId) || null;
  }

  async verifyFlight(flightId: string): Promise<ProviderFlightVerificationResponse> {
    const flight = await this.getFlightDetails(flightId);
    if (!flight) {
      return {
        success: false,
        flightId,
        error: `Flight ${flightId} not found in schedule.`,
        verifiedAt: new Date().toISOString(),
      };
    }

    const priceAmount =
      typeof flight.price === 'number'
        ? flight.price
        : parseFloat(String(flight.price).replace(/[^0-9.]/g, ''));

    return {
      success: true,
      flightId,
      itinerary: {
        origin: flight.origin,
        destination: flight.destination,
        departureTime: flight.departureTime,
        arrivalTime: flight.arrivalTime,
      },
      price: {
        amount: priceAmount,
        currency: flight.currency || 'INR',
      },
      availability: 'AVAILABLE',
      verifiedAt: new Date().toISOString(),
    };
  }
}

