import type {
  IBusProviderAdapter,
  RawBusResult,
  ProviderSearchResponse,
  IVerifiableProvider,
  ProviderBusVerificationResponse,
} from '../../types/provider';
import type { SearchRequirements } from '../../types/agent';

export type MockBusVerificationScenario =
  | 'PRICE_UNCHANGED'
  | 'PRICE_CHANGED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'MALFORMED';

/**
 * DEVELOPMENT MOCK - Bus Transit Adapter (SmartTransit Direct)
 * Used only for local development and architecture verification.
 */
export class MockBusProvider implements IBusProviderAdapter, IVerifiableProvider {
  readonly providerId = 'mock_smarttransit';
  readonly providerName = 'DEVELOPMENT MOCK - SmartTransit';
  readonly category = 'bus' as const;
  readonly supportsVerification: boolean = true;

  private available: boolean = true;
  private scenarios: Map<string, { scenario: MockBusVerificationScenario; customPrice?: number }> = new Map();
  private defaultScenario: MockBusVerificationScenario = 'PRICE_UNCHANGED';

  setAvailable(status: boolean): void {
    this.available = status;
  }

  isAvailable(): boolean {
    return this.available;
  }

  setVerificationScenario(
    busId: string | 'ALL',
    scenario: MockBusVerificationScenario,
    customPrice?: number
  ): void {
    if (busId === 'ALL') {
      this.defaultScenario = scenario;
    } else {
      this.scenarios.set(busId, { scenario, customPrice });
    }
  }

  resetVerificationScenarios(): void {
    this.scenarios.clear();
    this.defaultScenario = 'PRICE_UNCHANGED';
  }

  private cachedBuses: Map<string, RawBusResult> = new Map();

  async searchBuses(requirements: SearchRequirements): Promise<ProviderSearchResponse<RawBusResult>> {
    const startTime = Date.now();
    const source = requirements.source || 'Hyderabad';
    const destination = requirements.destination || 'Bangalore';
    const isCustomRoute = Boolean(requirements.source || requirements.destination);

    const rawBuses: RawBusResult[] = [
      {
        busId: isCustomRoute
          ? `ST-${source.slice(0, 3).toUpperCase()}-${destination.slice(0, 3).toUpperCase()}-01`
          : 'ST-HYD-BLR-01',
        operator: 'IntrCity SmartBus',
        source,
        destination,
        departureTime: '20:30',
        arrivalTime: '06:30',
        duration: '10h 00m',
        busType: 'AC Sleeper (2+1)',
        price: 1299,
        currency: 'INR',
        seatsAvailable: 8,
        boardingPoints: [`${source} Central`, 'Gachibowli ORR', 'Ameerpet'],
        droppingPoints: [`${destination} Central`, 'Koyambedu', 'Tambaram'],
        rating: 4.8,
        cancellationPolicy: 'Free cancellation up to 6 hours before departure',
        bookingUrl: `https://smarttransit.example.com/book/ST-01`,
      },
      {
        busId: isCustomRoute
          ? `ST-${source.slice(0, 3).toUpperCase()}-${destination.slice(0, 3).toUpperCase()}-02`
          : 'ST-HYD-BLR-02',
        operator: 'Orange Tours & Travels',
        source,
        destination,
        departureTime: '21:15',
        arrivalTime: '07:00',
        duration: '9h 45m',
        busType: 'Volvo Multi-Axle AC Sleeper',
        price: 1450,
        currency: 'INR',
        seatsAvailable: 14,
        boardingPoints: [`${source} Hub`, 'Kukatpally', 'Hitec City'],
        droppingPoints: [`${destination} Terminus`, 'Koyambedu', 'Adyar'],
        rating: 4.7,
        cancellationPolicy: '90% refund if cancelled 12h prior',
        bookingUrl: `https://smarttransit.example.com/book/ST-02`,
      },
      {
        busId: isCustomRoute
          ? `ST-${source.slice(0, 3).toUpperCase()}-${destination.slice(0, 3).toUpperCase()}-03`
          : 'ST-HYD-BLR-03',
        operator: 'Kaveri Travels',
        source,
        destination,
        departureTime: '22:00',
        arrivalTime: '08:15',
        duration: '10h 15m',
        busType: 'Bharat Benz AC Seater/Sleeper',
        price: 990,
        currency: 'INR',
        seatsAvailable: 19,
        boardingPoints: [`${source} Bus Station`, 'Dilsukhnagar', 'LB Nagar'],
        droppingPoints: [`${destination} Bypass`, 'Madhavaram', 'Koyambedu'],
        rating: 4.6,
        cancellationPolicy: '80% refund if cancelled 8h prior',
        bookingUrl: `https://smarttransit.example.com/book/ST-03`,
      },
    ];

    for (const b of rawBuses) {
      this.cachedBuses.set(b.busId, b);
    }

    return {
      providerId: this.providerId,
      providerName: this.providerName,
      success: true,
      results: rawBuses,
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    };
  }

  async getBusDetails(busId: string): Promise<RawBusResult | null> {
    if (this.cachedBuses.has(busId)) {
      return this.cachedBuses.get(busId)!;
    }
    if (busId === 'ST-HYD-BLR-01') {
      return {
        busId: 'ST-HYD-BLR-01',
        operator: 'IntrCity SmartBus',
        source: 'Hyderabad',
        destination: 'Bangalore',
        departureTime: '19:30',
        arrivalTime: '06:00',
        duration: '10h 30m',
        busType: 'AC Sleeper (2+1)',
        price: 1299,
        currency: 'INR',
        seatsAvailable: 8,
        boardingPoints: ['Gachibowli ORR', 'Ameerpet', 'Lakdikapul'],
        droppingPoints: ['Hebbal', 'Majestic', 'Electronic City'],
        rating: 4.8,
        cancellationPolicy: 'Free cancellation up to 6 hours before departure',
        bookingUrl: 'https://smarttransit.example.com/book/ST-HYD-BLR-01',
      };
    }
    const res = await this.searchBuses({});
    return res.results.find((b) => b.busId === busId) || null;
  }

  async verifyBus(busId: string): Promise<ProviderBusVerificationResponse> {
    const config = this.scenarios.get(busId) || { scenario: this.defaultScenario };

    if (config.scenario === 'TIMEOUT') {
      throw new Error('Verification request to SmartTransit timed out');
    }

    if (config.scenario === 'MALFORMED') {
      return {
        success: true,
        busId,
        price: {
          amount: NaN as any,
          currency: 'INVALID',
        },
        availability: 'UNKNOWN',
        verifiedAt: new Date().toISOString(),
      };
    }

    const bus = await this.getBusDetails(busId);
    if (!bus) {
      return {
        success: false,
        busId,
        error: `Bus ${busId} not found in SmartTransit schedule.`,
        verifiedAt: new Date().toISOString(),
      };
    }

    const basePrice =
      typeof bus.price === 'number'
        ? bus.price
        : parseFloat(String(bus.price).replace(/[^0-9.]/g, ''));

    if (config.scenario === 'UNAVAILABLE') {
      return {
        success: true,
        busId,
        route: { source: bus.source, destination: bus.destination },
        departureTime: bus.departureTime,
        price: {
          amount: basePrice,
          currency: bus.currency || 'INR',
        },
        seatsAvailable: 0,
        availability: 'UNAVAILABLE',
        verifiedAt: new Date().toISOString(),
      };
    }

    if (config.scenario === 'PRICE_CHANGED') {
      const verifiedPrice = config.customPrice ?? (basePrice > 0 ? basePrice + 200 : 1499);
      return {
        success: true,
        busId,
        route: { source: bus.source, destination: bus.destination },
        departureTime: bus.departureTime,
        price: {
          amount: verifiedPrice,
          currency: bus.currency || 'INR',
        },
        seatsAvailable: bus.seatsAvailable,
        availability: 'AVAILABLE',
        verifiedAt: new Date().toISOString(),
      };
    }

    // Default: PRICE_UNCHANGED
    return {
      success: true,
      busId,
      route: { source: bus.source, destination: bus.destination },
      departureTime: bus.departureTime,
      price: {
        amount: basePrice,
        currency: bus.currency || 'INR',
      },
      seatsAvailable: bus.seatsAvailable,
      availability: 'AVAILABLE',
      verifiedAt: new Date().toISOString(),
    };
  }
}

