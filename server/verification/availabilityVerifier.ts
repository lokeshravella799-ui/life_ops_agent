import type { VerificationCheck, VerificationStatus } from './types';

export interface AvailabilityVerificationResult {
  check: VerificationCheck;
  availabilityVerified: boolean;
  isAvailable: boolean;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN' | 'CHANGED';
  reason?: string;
}

export class AvailabilityVerifier {
  /**
   * Determine if a raw availability string indicates available inventory
   */
  private static isAvailableText(text?: string): boolean {
    if (!text) return true; // optimistic if not specified
    const lower = text.toLowerCase();
    if (
      lower.includes('out of stock') ||
      lower.includes('unavailable') ||
      lower.includes('sold out') ||
      lower.includes('no seats') ||
      lower.includes('fully booked')
    ) {
      return false;
    }
    return true;
  }

  /**
   * Compare search-time availability against live verified provider availability
   */
  static verify(
    searchAvailability?: string,
    verifiedStatus?: 'AVAILABLE' | 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'UNKNOWN',
    seatsAvailable?: number,
    checkedAt: string = new Date().toISOString()
  ): AvailabilityVerificationResult {
    const searchWasAvailable = this.isAvailableText(searchAvailability);

    // Explicit check for numerical seat counts (e.g. for bus transit)
    if (typeof seatsAvailable === 'number') {
      if (seatsAvailable <= 0) {
        return {
          check: {
            status: 'UNAVAILABLE',
            checkedAt,
            message: 'No seats currently available for this route.',
          },
          availabilityVerified: false,
          isAvailable: false,
          status: 'UNAVAILABLE',
          reason: 'Zero seats remaining',
        };
      }
    }

    if (!verifiedStatus || verifiedStatus === 'UNKNOWN') {
      return {
        check: {
          status: 'UNKNOWN',
          checkedAt,
          message: 'Provider did not return definitive availability data.',
        },
        availabilityVerified: false,
        isAvailable: searchWasAvailable,
        status: 'UNKNOWN',
        reason: 'Provider availability undetermined',
      };
    }

    if (verifiedStatus === 'UNAVAILABLE' || verifiedStatus === 'OUT_OF_STOCK') {
      return {
        check: {
          status: 'UNAVAILABLE',
          checkedAt,
          message: 'Item or route is no longer available from the provider.',
        },
        availabilityVerified: false,
        isAvailable: false,
        status: 'UNAVAILABLE',
        reason: 'Item is out of stock or route is fully booked',
      };
    }

    // Verified available
    if (verifiedStatus === 'AVAILABLE') {
      return {
        check: {
          status: 'VERIFIED',
          checkedAt,
          message: 'Live availability confirmed with provider.',
        },
        availabilityVerified: true,
        isAvailable: true,
        status: 'AVAILABLE',
      };
    }

    return {
      check: {
        status: 'UNKNOWN',
        checkedAt,
        message: 'Unrecognized availability status.',
      },
      availabilityVerified: false,
      isAvailable: searchWasAvailable,
      status: 'UNKNOWN',
    };
  }
}
