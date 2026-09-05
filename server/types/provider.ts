import type { SearchRequirements } from './agent';

/**
 * Reusable generic provider response envelope
 */
export interface ProviderSearchResponse<T> {
  providerId: string;
  providerName: string;
  success: boolean;
  results: T[];
  fetchedAt: string;
  latencyMs?: number;
  error?: {
    code: string;
    message: string;
  };
}

export interface PriceChangeDetails {
  originalPrice: number;
  verifiedPrice: number;
  difference: number;
  percentageChange: number;
  currency: string;
}

export type VerificationStatus =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'CHANGED'
  | 'UNAVAILABLE'
  | 'FAILED'
  | 'UNKNOWN'
  | 'UNSUPPORTED';

export type FreshnessStatus = 'FRESH' | 'STALE' | 'UNKNOWN';

export interface VerificationFreshness {
  status: FreshnessStatus;
  ageSeconds: number;
}

/**
 * Verification status metadata
 */
export interface VerificationMetadata {
  priceVerified: boolean;
  availabilityVerified: boolean;
  providerVerified: boolean;
  verifiedAt?: string;
  status?: VerificationStatus;
  freshness?: VerificationFreshness;
  priceChange?: PriceChangeDetails;
  issues?: string[];
}

/* ==========================================================================
   1. COMMERCE / PRODUCT MODELS
   ========================================================================== */

export interface RawProductResult {
  providerProductId: string;
  title: string;
  description?: string;
  images?: string[];
  productUrl: string;
  price: number | string;
  originalPrice?: number | string;
  currency?: string;
  availability?: string;
  brand?: string;
  seller?: string;
  rating?: number;
  reviewCount?: number;
  specifications?: Record<string, any>;
  delivery?: {
    estimatedDate?: string;
    fee?: number | string;
  };
  rawMetadata?: Record<string, any>;
}

export interface NormalizedProduct {
  id: string;
  provider: {
    id: string;
    name: string;
  };
  title: string;
  description?: string;
  images: string[];
  price: {
    amount: number;
    currency: string;
  };
  originalPrice?: {
    amount: number;
    currency: string;
  };
  discount?: number;
  availability?: string;
  productUrl: string;
  seller?: string;
  brand?: string;
  category: string;
  specifications: Record<string, string>;
  rating?: number;
  reviewCount?: number;
  delivery?: {
    estimatedDate?: string;
    fee?: number;
  };
  fetchedAt: string;
  verification?: VerificationMetadata;
}

/* ==========================================================================
   2. TRANSIT / BUS MODELS
   ========================================================================== */

export interface RawBusResult {
  busId: string;
  operator: string;
  source: string;
  destination: string;
  departureTime: string;
  arrivalTime?: string;
  duration?: string;
  busType?: string;
  price: number | string;
  currency?: string;
  seatsAvailable?: number;
  boardingPoints?: string[];
  droppingPoints?: string[];
  rating?: number;
  cancellationPolicy?: string;
  bookingUrl?: string;
  rawMetadata?: Record<string, any>;
}

export interface NormalizedBusResult {
  id: string;
  provider: {
    id: string;
    name: string;
  };
  operator: string;
  source: string;
  destination: string;
  departureTime: string;
  arrivalTime?: string;
  duration?: string;
  busType?: string;
  price: {
    amount: number;
    currency: string;
  };
  seatsAvailable?: number;
  boardingPoints?: string[];
  droppingPoints?: string[];
  rating?: number;
  cancellationPolicy?: string;
  bookingUrl?: string;
  fetchedAt: string;
  verification?: VerificationMetadata;
}

/* ==========================================================================
   3. HOSPITALITY / HOTEL MODELS
   ========================================================================== */

export interface RawHotelResult {
  hotelId: string;
  name: string;
  location: string;
  images?: string[];
  roomType?: string;
  price: number | string;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  amenities?: string[];
  cancellationPolicy?: string;
  availability?: string;
  bookingUrl?: string;
  rawMetadata?: Record<string, any>;
}

export interface NormalizedHotelResult {
  id: string;
  provider: {
    id: string;
    name: string;
  };
  name: string;
  location: string;
  images: string[];
  roomType?: string;
  price: {
    amount: number;
    currency: string;
  };
  rating?: number;
  reviewCount?: number;
  amenities: string[];
  cancellationPolicy?: string;
  availability?: string;
  bookingUrl?: string;
  fetchedAt: string;
  verification?: VerificationMetadata;
}

/* ==========================================================================
   4. AVIATION / FLIGHT MODELS
   ========================================================================== */

export interface RawFlightResult {
  flightId: string;
  airline: string;
  flightNumber?: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime?: string;
  duration?: string;
  stops?: number;
  cabinClass?: string;
  baggage?: string;
  price: number | string;
  currency?: string;
  bookingUrl?: string;
  rawMetadata?: Record<string, any>;
}

export interface NormalizedFlightResult {
  id: string;
  provider: {
    id: string;
    name: string;
  };
  airline: string;
  flightNumber?: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime?: string;
  duration?: string;
  stops: number;
  cabinClass?: string;
  baggage?: string;
  price: {
    amount: number;
    currency: string;
  };
  bookingUrl?: string;
  fetchedAt: string;
  verification?: VerificationMetadata;
}

/* ==========================================================================
   5. PROVIDER ADAPTER INTERFACES
   ========================================================================== */

export type ProviderCategory = 'product' | 'bus' | 'hotel' | 'flight';

export interface IProviderAdapter<TRaw = any> {
  readonly providerId: string;
  readonly providerName: string;
  readonly category: ProviderCategory;
  isAvailable(): boolean;
}

export interface IProductProviderAdapter extends IProviderAdapter<RawProductResult> {
  readonly category: 'product';
  searchProducts(requirements: SearchRequirements): Promise<ProviderSearchResponse<RawProductResult>>;
  getProductDetails(productId: string): Promise<RawProductResult | null>;
}

export interface IBusProviderAdapter extends IProviderAdapter<RawBusResult> {
  readonly category: 'bus';
  searchBuses(requirements: SearchRequirements): Promise<ProviderSearchResponse<RawBusResult>>;
  getBusDetails(busId: string): Promise<RawBusResult | null>;
}

export interface IHotelProviderAdapter extends IProviderAdapter<RawHotelResult> {
  readonly category: 'hotel';
  searchHotels(requirements: SearchRequirements): Promise<ProviderSearchResponse<RawHotelResult>>;
  getHotelDetails(hotelId: string): Promise<RawHotelResult | null>;
}

export interface IFlightProviderAdapter extends IProviderAdapter<RawFlightResult> {
  readonly category: 'flight';
  searchFlights(requirements: SearchRequirements): Promise<ProviderSearchResponse<RawFlightResult>>;
  getFlightDetails(flightId: string): Promise<RawFlightResult | null>;
}

/* ==========================================================================
   6. VERIFICATION INTERFACES
   ========================================================================== */

export interface ProviderProductVerificationResponse {
  success: boolean;
  productId: string;
  price?: {
    amount: number;
    currency: string;
  };
  availability?: 'AVAILABLE' | 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'UNKNOWN';
  verifiedAt: string;
  error?: string;
  rawDetails?: any;
}

export interface ProviderBusVerificationResponse {
  success: boolean;
  busId: string;
  route?: {
    source: string;
    destination: string;
  };
  departureTime?: string;
  price?: {
    amount: number;
    currency: string;
  };
  seatsAvailable?: number;
  availability?: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';
  verifiedAt: string;
  error?: string;
  rawDetails?: any;
}

export interface ProviderHotelVerificationResponse {
  success: boolean;
  hotelId: string;
  roomAvailability?: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';
  price?: {
    amount: number;
    currency: string;
  };
  dates?: {
    checkIn?: string;
    checkOut?: string;
  };
  cancellationPolicy?: string;
  verifiedAt: string;
  error?: string;
  rawDetails?: any;
}

export interface ProviderFlightVerificationResponse {
  success: boolean;
  flightId: string;
  itinerary?: {
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime?: string;
  };
  price?: {
    amount: number;
    currency: string;
  };
  availability?: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';
  verifiedAt: string;
  error?: string;
  rawDetails?: any;
}

export interface ProviderAvailabilityResponse {
  success: boolean;
  resultId: string;
  available: boolean;
  availabilityStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';
  verifiedAt: string;
  reason?: string;
}

export interface IVerifiableProvider {
  readonly supportsVerification?: boolean;
  verifyProduct?(productId: string): Promise<ProviderProductVerificationResponse>;
  verifyBus?(busId: string): Promise<ProviderBusVerificationResponse>;
  verifyHotel?(hotelId: string): Promise<ProviderHotelVerificationResponse>;
  verifyFlight?(flightId: string): Promise<ProviderFlightVerificationResponse>;
  verifyAvailability?(resultId: string): Promise<ProviderAvailabilityResponse>;
}

