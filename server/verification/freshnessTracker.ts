import type { VerificationFreshness, FreshnessStatus } from './types';

export class FreshnessTracker {
  /**
   * Default freshness time-to-live in seconds (5 minutes)
   */
  public static readonly DEFAULT_FRESHNESS_TTL_SECONDS: number = 300;

  /**
   * Evaluate the freshness of a verification timestamp against the current or provided time
   */
  static evaluateFreshness(
    verifiedAt?: string,
    options?: { thresholdSeconds?: number; currentTime?: string | number | Date }
  ): VerificationFreshness {
    if (!verifiedAt || typeof verifiedAt !== 'string') {
      return {
        status: 'UNKNOWN',
        ageSeconds: -1,
      };
    }

    const verifiedTimestamp = Date.parse(verifiedAt);
    if (isNaN(verifiedTimestamp)) {
      return {
        status: 'UNKNOWN',
        ageSeconds: -1,
      };
    }

    const currentTimestamp = options?.currentTime
      ? options.currentTime instanceof Date
        ? options.currentTime.getTime()
        : typeof options.currentTime === 'string'
        ? Date.parse(options.currentTime)
        : options.currentTime
      : Date.now();

    const threshold = options?.thresholdSeconds ?? this.DEFAULT_FRESHNESS_TTL_SECONDS;
    const ageSeconds = Math.max(0, Math.floor((currentTimestamp - verifiedTimestamp) / 1000));

    const status: FreshnessStatus = ageSeconds <= threshold ? 'FRESH' : 'STALE';

    return {
      status,
      ageSeconds,
    };
  }

  static isFresh(
    verifiedAt?: string,
    options?: { thresholdSeconds?: number; currentTime?: string | number | Date }
  ): boolean {
    return this.evaluateFreshness(verifiedAt, options).status === 'FRESH';
  }
}
