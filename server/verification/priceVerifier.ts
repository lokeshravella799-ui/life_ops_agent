import type { VerificationCheck, PriceChangeDetails, VerificationStatus } from './types';

export interface PriceVerificationResult {
  check: VerificationCheck;
  priceVerified: boolean;
  priceChange?: PriceChangeDetails;
}

export class PriceVerifier {
  /**
   * Compare search-time price against currently verified provider price.
   * Preserves both original and verified values without destructive overwrites.
   */
  static verify(
    searchPrice: number,
    verifiedPrice: number,
    currency: string = 'INR',
    checkedAt: string = new Date().toISOString()
  ): PriceVerificationResult {
    if (typeof searchPrice !== 'number' || isNaN(searchPrice) || typeof verifiedPrice !== 'number' || isNaN(verifiedPrice)) {
      return {
        check: {
          status: 'FAILED',
          checkedAt,
          message: 'Invalid price value encountered during verification comparison.',
        },
        priceVerified: false,
      };
    }

    const diff = verifiedPrice - searchPrice;

    // Prices are identical within rounding precision
    if (Math.abs(diff) < 0.01) {
      return {
        check: {
          status: 'VERIFIED',
          checkedAt,
          message: `Price confirmed at ${currency} ${verifiedPrice.toLocaleString('en-IN')}.`,
        },
        priceVerified: true,
      };
    }

    // Price has changed
    const percentageChange =
      searchPrice > 0 ? Number(((diff / searchPrice) * 100).toFixed(2)) : 0;

    const priceChange: PriceChangeDetails = {
      originalPrice: searchPrice,
      verifiedPrice,
      difference: diff,
      percentageChange,
      currency,
    };

    const changeDescription =
      diff > 0
        ? `Price increased by ${currency} ${diff.toLocaleString('en-IN')} (${percentageChange}%)`
        : `Price decreased by ${currency} ${Math.abs(diff).toLocaleString('en-IN')} (${Math.abs(percentageChange)}%)`;

    return {
      check: {
        status: 'CHANGED',
        checkedAt,
        message: `Price updated: was ${currency} ${searchPrice.toLocaleString('en-IN')}, now ${currency} ${verifiedPrice.toLocaleString('en-IN')}. ${changeDescription}.`,
        details: priceChange,
      },
      priceVerified: false,
      priceChange,
    };
  }
}
