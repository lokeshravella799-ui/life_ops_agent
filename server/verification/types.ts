import type {
  VerificationStatus,
  FreshnessStatus,
  VerificationFreshness,
  PriceChangeDetails,
  VerificationMetadata,
  IVerifiableProvider,
  ProviderProductVerificationResponse,
  ProviderBusVerificationResponse,
  ProviderHotelVerificationResponse,
  ProviderFlightVerificationResponse,
  ProviderAvailabilityResponse,
} from '../types/provider';

export type {
  VerificationStatus,
  FreshnessStatus,
  VerificationFreshness,
  PriceChangeDetails,
  VerificationMetadata,
  IVerifiableProvider,
  ProviderProductVerificationResponse,
  ProviderBusVerificationResponse,
  ProviderHotelVerificationResponse,
  ProviderFlightVerificationResponse,
  ProviderAvailabilityResponse,
};

export interface VerificationCheck {
  status: VerificationStatus;
  checkedAt: string;
  message?: string;
  details?: any;
}

export interface VerificationResult {
  resultId: string;
  providerId: string;
  verified: boolean;
  checks: {
    price: VerificationCheck;
    availability: VerificationCheck;
    provider: VerificationCheck;
  };
  priceChange?: PriceChangeDetails;
  issues: string[];
  verifiedAt: string;
  freshness: VerificationFreshness;
  status: VerificationStatus;
  unavailableReason?: string;
}

export interface VerificationSummary {
  verifiedCount: number;
  unverifiedCount: number;
  changedCount: number;
  unavailableCount: number;
}

export interface VerificationOptions {
  batchSize?: number;
  freshnessTtlSeconds?: number;
  currentTime?: string | number | Date;
}

export type VerificationAuditEventType =
  | 'RESULT_VERIFIED'
  | 'PRICE_CHANGED'
  | 'AVAILABILITY_CHANGED'
  | 'PROVIDER_VERIFICATION_FAILED'
  | 'VERIFICATION_ERROR';

export interface VerificationAuditEvent {
  eventId: string;
  eventType: VerificationAuditEventType;
  resultId: string;
  providerId: string;
  timestamp: string;
  details: Record<string, any>;
}
