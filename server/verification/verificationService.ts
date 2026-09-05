import type {
  NormalizedProduct,
  NormalizedBusResult,
  NormalizedHotelResult,
  NormalizedFlightResult,
  ProviderCategory,
  IVerifiableProvider,
} from '../types/provider';
import type { RecommendationResult } from '../comparison/types';
import { providerRegistry as defaultRegistry, ProviderRegistry } from '../providers/providerRegistry';
import { PriceVerifier } from './priceVerifier';
import { AvailabilityVerifier } from './availabilityVerifier';
import { ProviderVerifier } from './providerVerifier';
import { FreshnessTracker } from './freshnessTracker';
import { logger } from '../utils/logger';
import type {
  VerificationResult,
  VerificationSummary,
  VerificationOptions,
  VerificationStatus,
  VerificationAuditEvent,
  VerificationAuditEventType,
} from './types';

export class VerificationService {
  private registry: ProviderRegistry;
  private defaultBatchSize: number;
  private defaultFreshnessTtl: number;
  private auditEvents: VerificationAuditEvent[] = [];

  constructor(
    registry: ProviderRegistry = defaultRegistry,
    options?: { batchSize?: number; freshnessTtlSeconds?: number }
  ) {
    this.registry = registry;
    this.defaultBatchSize = options?.batchSize ?? (process.env.VERIFICATION_BATCH_SIZE ? parseInt(process.env.VERIFICATION_BATCH_SIZE, 10) : 10);
    this.defaultFreshnessTtl = options?.freshnessTtlSeconds ?? FreshnessTracker.DEFAULT_FRESHNESS_TTL_SECONDS;
  }

  private logAuditEvent(eventType: VerificationAuditEventType, resultId: string, providerId: string, details: Record<string, any>): void {
    const event: VerificationAuditEvent = {
      eventId: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      resultId,
      providerId,
      timestamp: new Date().toISOString(),
      // Strictly sanitize: ensure no passwords, keys or tokens
      details: { ...details },
    };
    this.auditEvents.push(event);
    if (this.auditEvents.length > 1000) {
      this.auditEvents.shift();
    }
    logger.debug(`[AUDIT] Verification event: ${eventType}`, { resultId, providerId });
  }

  getAuditEvents(): VerificationAuditEvent[] {
    return [...this.auditEvents];
  }

  clearAuditEvents(): void {
    this.auditEvents = [];
  }

  /**
   * Verify an individual product against its provider
   */
  async verifyProduct(product: NormalizedProduct, options?: VerificationOptions): Promise<VerificationResult> {
    const checkedAt = new Date().toISOString();
    const providerId = product.provider.id;
    const provider = this.registry.getProvider(providerId) as (IVerifiableProvider & any) | undefined;
    const issues: string[] = [];

    // 1. Provider Authenticity & URL Validation
    const provCheck = ProviderVerifier.verify(providerId, product.productUrl, this.registry, checkedAt);
    if (provCheck.issues.length > 0) {
      issues.push(...provCheck.issues);
    }

    // 2. Capability Detection
    const hasCapability = Boolean(provider && typeof provider.verifyProduct === 'function');
    if (!hasCapability) {
      logger.debug(`Provider "${providerId}" has no product verification capability`);
      const result: VerificationResult = {
        resultId: product.id,
        providerId,
        verified: false,
        checks: {
          price: {
            status: 'UNSUPPORTED',
            checkedAt,
            message: `Provider "${providerId}" does not support live price verification.`,
          },
          availability: {
            status: 'UNSUPPORTED',
            checkedAt,
            message: `Provider "${providerId}" does not support live availability verification.`,
          },
          provider: provCheck.check,
        },
        issues: [...issues, 'Verification unsupported by provider adapter'],
        verifiedAt: checkedAt,
        freshness: FreshnessTracker.evaluateFreshness(checkedAt, {
          thresholdSeconds: options?.freshnessTtlSeconds ?? this.defaultFreshnessTtl,
          currentTime: options?.currentTime,
        }),
        status: 'UNSUPPORTED',
      };
      return result;
    }

    // 3. Execute live verification against adapter with failure isolation
    let liveResponse: any;
    try {
      // Extract raw provider product ID if format is "provider_productId"
      const rawProductId = product.id.startsWith(`${providerId}_`)
        ? product.id.slice(providerId.length + 1)
        : product.id;

      liveResponse = await provider.verifyProduct(rawProductId);
    } catch (err: any) {
      logger.error(`Error during live product verification for ${product.id}`, { error: err?.message });
      this.logAuditEvent('PROVIDER_VERIFICATION_FAILED', product.id, providerId, { error: err?.message });
      return {
        resultId: product.id,
        providerId,
        verified: false,
        checks: {
          price: {
            status: 'FAILED',
            checkedAt,
            message: `Provider verification failed: ${err?.message || 'Connection timeout'}`,
          },
          availability: {
            status: 'FAILED',
            checkedAt,
            message: `Provider verification failed: ${err?.message || 'Connection timeout'}`,
          },
          provider: provCheck.check,
        },
        issues: [...issues, `Provider error: ${err?.message || 'Timeout'}`],
        verifiedAt: checkedAt,
        freshness: FreshnessTracker.evaluateFreshness(checkedAt, {
          thresholdSeconds: options?.freshnessTtlSeconds ?? this.defaultFreshnessTtl,
          currentTime: options?.currentTime,
        }),
        status: 'FAILED',
      };
    }

    if (!liveResponse || !liveResponse.success) {
      const errorMsg = liveResponse?.error || 'Provider returned unsuccessful verification response';
      issues.push(errorMsg);
      this.logAuditEvent('PROVIDER_VERIFICATION_FAILED', product.id, providerId, { error: errorMsg });
      return {
        resultId: product.id,
        providerId,
        verified: false,
        checks: {
          price: {
            status: 'FAILED',
            checkedAt,
            message: errorMsg,
          },
          availability: {
            status: 'FAILED',
            checkedAt,
            message: errorMsg,
          },
          provider: provCheck.check,
        },
        issues,
        verifiedAt: checkedAt,
        freshness: FreshnessTracker.evaluateFreshness(checkedAt, {
          thresholdSeconds: options?.freshnessTtlSeconds ?? this.defaultFreshnessTtl,
          currentTime: options?.currentTime,
        }),
        status: 'FAILED',
      };
    }

    // 4. Verify Price
    const verifiedPrice = liveResponse.price?.amount;
    const priceRes = PriceVerifier.verify(
      product.price.amount,
      verifiedPrice ?? NaN,
      liveResponse.price?.currency || product.price.currency,
      checkedAt
    );
    if (priceRes.priceChange) {
      this.logAuditEvent('PRICE_CHANGED', product.id, providerId, priceRes.priceChange);
    }

    // 5. Verify Availability
    const availRes = AvailabilityVerifier.verify(
      product.availability,
      liveResponse.availability,
      undefined,
      checkedAt
    );
    if (availRes.status === 'UNAVAILABLE') {
      this.logAuditEvent('AVAILABILITY_CHANGED', product.id, providerId, { status: 'UNAVAILABLE' });
    }

    // 6. Overall Status Determination
    const isPriceVerified = priceRes.priceVerified;
    const isAvailVerified = availRes.availabilityVerified;
    const isProvVerified = provCheck.providerVerified;

    let overallStatus: VerificationStatus = 'UNVERIFIED';
    let unavailableReason: string | undefined = undefined;

    if (availRes.status === 'UNAVAILABLE') {
      overallStatus = 'UNAVAILABLE';
      unavailableReason = availRes.reason || 'Product is currently out of stock';
    } else if (priceRes.check.status === 'CHANGED') {
      overallStatus = 'CHANGED';
    } else if (isPriceVerified && isAvailVerified && isProvVerified) {
      overallStatus = 'VERIFIED';
      this.logAuditEvent('RESULT_VERIFIED', product.id, providerId, { verifiedPrice: product.price.amount });
    } else if (priceRes.check.status === 'FAILED' || availRes.check.status === 'FAILED' || provCheck.check.status === 'FAILED') {
      overallStatus = 'FAILED';
    }

    return {
      resultId: product.id,
      providerId,
      verified: overallStatus === 'VERIFIED',
      checks: {
        price: priceRes.check,
        availability: availRes.check,
        provider: provCheck.check,
      },
      priceChange: priceRes.priceChange,
      issues,
      verifiedAt: checkedAt,
      freshness: FreshnessTracker.evaluateFreshness(checkedAt, {
        thresholdSeconds: options?.freshnessTtlSeconds ?? this.defaultFreshnessTtl,
        currentTime: options?.currentTime,
      }),
      status: overallStatus,
      unavailableReason,
    };
  }

  /**
   * Verify an individual bus transit schedule against its provider
   */
  async verifyBus(bus: NormalizedBusResult, options?: VerificationOptions): Promise<VerificationResult> {
    const checkedAt = new Date().toISOString();
    const providerId = bus.provider.id;
    const provider = this.registry.getProvider(providerId) as (IVerifiableProvider & any) | undefined;
    const issues: string[] = [];

    // 1. Provider Authenticity & URL Validation
    const provCheck = ProviderVerifier.verify(providerId, bus.bookingUrl, this.registry, checkedAt);
    if (provCheck.issues.length > 0) {
      issues.push(...provCheck.issues);
    }

    // 2. Capability Detection
    const hasCapability = Boolean(provider && typeof provider.verifyBus === 'function');
    if (!hasCapability) {
      return {
        resultId: bus.id,
        providerId,
        verified: false,
        checks: {
          price: {
            status: 'UNSUPPORTED',
            checkedAt,
            message: `Bus provider "${providerId}" does not support verification.`,
          },
          availability: {
            status: 'UNSUPPORTED',
            checkedAt,
            message: `Bus provider "${providerId}" does not support verification.`,
          },
          provider: provCheck.check,
        },
        issues: [...issues, 'Verification unsupported by provider adapter'],
        verifiedAt: checkedAt,
        freshness: FreshnessTracker.evaluateFreshness(checkedAt, {
          thresholdSeconds: options?.freshnessTtlSeconds ?? this.defaultFreshnessTtl,
          currentTime: options?.currentTime,
        }),
        status: 'UNSUPPORTED',
      };
    }

    // 3. Execute live verification with failure isolation
    let liveResponse: any;
    try {
      const rawBusId = bus.id.startsWith(`${providerId}_`)
        ? bus.id.slice(providerId.length + 1)
        : bus.id;

      liveResponse = await provider.verifyBus(rawBusId);
    } catch (err: any) {
      logger.error(`Error during live bus verification for ${bus.id}`, { error: err?.message });
      return {
        resultId: bus.id,
        providerId,
        verified: false,
        checks: {
          price: {
            status: 'FAILED',
            checkedAt,
            message: `Bus verification failure: ${err?.message || 'Timeout'}`,
          },
          availability: {
            status: 'FAILED',
            checkedAt,
            message: `Bus verification failure: ${err?.message || 'Timeout'}`,
          },
          provider: provCheck.check,
        },
        issues: [...issues, `Bus provider error: ${err?.message || 'Timeout'}`],
        verifiedAt: checkedAt,
        freshness: FreshnessTracker.evaluateFreshness(checkedAt, {
          thresholdSeconds: options?.freshnessTtlSeconds ?? this.defaultFreshnessTtl,
          currentTime: options?.currentTime,
        }),
        status: 'FAILED',
      };
    }

    if (!liveResponse || !liveResponse.success) {
      const errorMsg = liveResponse?.error || 'Provider returned unsuccessful bus verification';
      return {
        resultId: bus.id,
        providerId,
        verified: false,
        checks: {
          price: {
            status: 'FAILED',
            checkedAt,
            message: errorMsg,
          },
          availability: {
            status: 'FAILED',
            checkedAt,
            message: errorMsg,
          },
          provider: provCheck.check,
        },
        issues: [...issues, errorMsg],
        verifiedAt: checkedAt,
        freshness: FreshnessTracker.evaluateFreshness(checkedAt, {
          thresholdSeconds: options?.freshnessTtlSeconds ?? this.defaultFreshnessTtl,
          currentTime: options?.currentTime,
        }),
        status: 'FAILED',
      };
    }

    // 4. Verify Price
    const verifiedPrice = liveResponse.price?.amount;
    const priceRes = PriceVerifier.verify(
      bus.price.amount,
      verifiedPrice ?? NaN,
      liveResponse.price?.currency || bus.price.currency,
      checkedAt
    );

    // 5. Verify Availability (Seat Count & Status)
    const availRes = AvailabilityVerifier.verify(
      undefined,
      liveResponse.availability,
      liveResponse.seatsAvailable ?? bus.seatsAvailable,
      checkedAt
    );

    let overallStatus: VerificationStatus = 'UNVERIFIED';
    let unavailableReason: string | undefined = undefined;

    if (availRes.status === 'UNAVAILABLE') {
      overallStatus = 'UNAVAILABLE';
      unavailableReason = availRes.reason || 'No seats currently available for this route';
    } else if (priceRes.check.status === 'CHANGED') {
      overallStatus = 'CHANGED';
    } else if (priceRes.priceVerified && availRes.availabilityVerified && provCheck.providerVerified) {
      overallStatus = 'VERIFIED';
    } else if (priceRes.check.status === 'FAILED' || availRes.check.status === 'FAILED') {
      overallStatus = 'FAILED';
    }

    return {
      resultId: bus.id,
      providerId,
      verified: overallStatus === 'VERIFIED',
      checks: {
        price: priceRes.check,
        availability: availRes.check,
        provider: provCheck.check,
      },
      priceChange: priceRes.priceChange,
      issues,
      verifiedAt: checkedAt,
      freshness: FreshnessTracker.evaluateFreshness(checkedAt, {
        thresholdSeconds: options?.freshnessTtlSeconds ?? this.defaultFreshnessTtl,
        currentTime: options?.currentTime,
      }),
      status: overallStatus,
      unavailableReason,
    };
  }

  /**
   * Verify an individual hotel accommodation against its provider
   */
  async verifyHotel(hotel: NormalizedHotelResult, options?: VerificationOptions): Promise<VerificationResult> {
    const checkedAt = new Date().toISOString();
    const providerId = hotel.provider.id;
    const provider = this.registry.getProvider(providerId) as (IVerifiableProvider & any) | undefined;
    const provCheck = ProviderVerifier.verify(providerId, hotel.bookingUrl, this.registry, checkedAt);

    if (!provider || typeof provider.verifyHotel !== 'function') {
      return {
        resultId: hotel.id,
        providerId,
        verified: false,
        checks: {
          price: { status: 'UNSUPPORTED', checkedAt, message: 'Hotel verification unsupported.' },
          availability: { status: 'UNSUPPORTED', checkedAt, message: 'Hotel verification unsupported.' },
          provider: provCheck.check,
        },
        issues: ['Hotel verification unsupported by adapter'],
        verifiedAt: checkedAt,
        freshness: FreshnessTracker.evaluateFreshness(checkedAt, {
          thresholdSeconds: options?.freshnessTtlSeconds ?? this.defaultFreshnessTtl,
          currentTime: options?.currentTime,
        }),
        status: 'UNSUPPORTED',
      };
    }

    try {
      const rawHotelId = hotel.id.startsWith(`${providerId}_`) ? hotel.id.slice(providerId.length + 1) : hotel.id;
      const live = await provider.verifyHotel(rawHotelId);

      if (!live || !live.success) {
        return {
          resultId: hotel.id,
          providerId,
          verified: false,
          checks: {
            price: { status: 'FAILED', checkedAt, message: live?.error || 'Hotel verification failed' },
            availability: { status: 'FAILED', checkedAt, message: live?.error || 'Hotel verification failed' },
            provider: provCheck.check,
          },
          issues: [live?.error || 'Verification failed'],
          verifiedAt: checkedAt,
          freshness: FreshnessTracker.evaluateFreshness(checkedAt),
          status: 'FAILED',
        };
      }

      const priceRes = PriceVerifier.verify(hotel.price.amount, live.price?.amount ?? NaN, hotel.price.currency, checkedAt);
      const availRes = AvailabilityVerifier.verify(hotel.availability, live.roomAvailability, undefined, checkedAt);

      const isVerified = priceRes.priceVerified && availRes.availabilityVerified && provCheck.providerVerified;
      const status: VerificationStatus =
        availRes.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : priceRes.check.status === 'CHANGED' ? 'CHANGED' : isVerified ? 'VERIFIED' : 'UNVERIFIED';

      return {
        resultId: hotel.id,
        providerId,
        verified: status === 'VERIFIED',
        checks: { price: priceRes.check, availability: availRes.check, provider: provCheck.check },
        priceChange: priceRes.priceChange,
        issues: [],
        verifiedAt: checkedAt,
        freshness: FreshnessTracker.evaluateFreshness(checkedAt),
        status,
      };
    } catch (err: any) {
      return {
        resultId: hotel.id,
        providerId,
        verified: false,
        checks: {
          price: { status: 'FAILED', checkedAt, message: err?.message },
          availability: { status: 'FAILED', checkedAt, message: err?.message },
          provider: provCheck.check,
        },
        issues: [err?.message || 'Hotel verification error'],
        verifiedAt: checkedAt,
        freshness: FreshnessTracker.evaluateFreshness(checkedAt),
        status: 'FAILED',
      };
    }
  }

  /**
   * Verify an individual flight itinerary against its provider
   */
  async verifyFlight(flight: NormalizedFlightResult, options?: VerificationOptions): Promise<VerificationResult> {
    const checkedAt = new Date().toISOString();
    const providerId = flight.provider.id;
    const provider = this.registry.getProvider(providerId) as (IVerifiableProvider & any) | undefined;
    const provCheck = ProviderVerifier.verify(providerId, flight.bookingUrl, this.registry, checkedAt);

    if (!provider || typeof provider.verifyFlight !== 'function') {
      return {
        resultId: flight.id,
        providerId,
        verified: false,
        checks: {
          price: { status: 'UNSUPPORTED', checkedAt, message: 'Flight verification unsupported.' },
          availability: { status: 'UNSUPPORTED', checkedAt, message: 'Flight verification unsupported.' },
          provider: provCheck.check,
        },
        issues: ['Flight verification unsupported by adapter'],
        verifiedAt: checkedAt,
        freshness: FreshnessTracker.evaluateFreshness(checkedAt),
        status: 'UNSUPPORTED',
      };
    }

    try {
      const rawFlightId = flight.id.startsWith(`${providerId}_`) ? flight.id.slice(providerId.length + 1) : flight.id;
      const live = await provider.verifyFlight(rawFlightId);

      if (!live || !live.success) {
        return {
          resultId: flight.id,
          providerId,
          verified: false,
          checks: {
            price: { status: 'FAILED', checkedAt, message: live?.error || 'Flight verification failed' },
            availability: { status: 'FAILED', checkedAt, message: live?.error || 'Flight verification failed' },
            provider: provCheck.check,
          },
          issues: [live?.error || 'Verification failed'],
          verifiedAt: checkedAt,
          freshness: FreshnessTracker.evaluateFreshness(checkedAt),
          status: 'FAILED',
        };
      }

      const priceRes = PriceVerifier.verify(flight.price.amount, live.price?.amount ?? NaN, flight.price.currency, checkedAt);
      const availRes = AvailabilityVerifier.verify(undefined, live.availability, undefined, checkedAt);

      const isVerified = priceRes.priceVerified && availRes.availabilityVerified && provCheck.providerVerified;
      const status: VerificationStatus =
        availRes.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : priceRes.check.status === 'CHANGED' ? 'CHANGED' : isVerified ? 'VERIFIED' : 'UNVERIFIED';

      return {
        resultId: flight.id,
        providerId,
        verified: status === 'VERIFIED',
        checks: { price: priceRes.check, availability: availRes.check, provider: provCheck.check },
        priceChange: priceRes.priceChange,
        issues: [],
        verifiedAt: checkedAt,
        freshness: FreshnessTracker.evaluateFreshness(checkedAt),
        status,
      };
    } catch (err: any) {
      return {
        resultId: flight.id,
        providerId,
        verified: false,
        checks: {
          price: { status: 'FAILED', checkedAt, message: err?.message },
          availability: { status: 'FAILED', checkedAt, message: err?.message },
          provider: provCheck.check,
        },
        issues: [err?.message || 'Flight verification error'],
        verifiedAt: checkedAt,
        freshness: FreshnessTracker.evaluateFreshness(checkedAt),
        status: 'FAILED',
      };
    }
  }

  /**
   * General verification pipeline for arrays of search results with failure isolation
   */
  async verifyResults(
    items: any[],
    category: ProviderCategory,
    options?: VerificationOptions
  ): Promise<{ verifiedItems: any[]; summary: VerificationSummary; results: VerificationResult[] }> {
    const limit = options?.batchSize ?? this.defaultBatchSize;
    const targetItems = items.slice(0, limit);

    logger.info(`Starting failure-isolated verification on ${targetItems.length} item(s) (${category})`);

    const promises = targetItems.map(async (item) => {
      switch (category) {
        case 'product':
          return this.verifyProduct(item, options);
        case 'bus':
          return this.verifyBus(item, options);
        case 'hotel':
          return this.verifyHotel(item, options);
        case 'flight':
          return this.verifyFlight(item, options);
        default:
          return this.verifyProduct(item, options);
      }
    });

    const settled = await Promise.allSettled(promises);
    const results: VerificationResult[] = [];

    for (let i = 0; i < targetItems.length; i++) {
      const item = targetItems[i];
      const s = settled[i];

      if (s.status === 'fulfilled') {
        const ver = s.value;
        results.push(ver);

        // Attach verification metadata to the item
        item.verification = {
          priceVerified: ver.checks.price.status === 'VERIFIED',
          availabilityVerified: ver.checks.availability.status === 'VERIFIED',
          providerVerified: ver.checks.provider.status === 'VERIFIED',
          verifiedAt: ver.verifiedAt,
          status: ver.status,
          freshness: ver.freshness,
          priceChange: ver.priceChange,
          issues: ver.issues,
        };

        if (ver.status === 'UNAVAILABLE') {
          item.availability = 'UNAVAILABLE';
        }
      } else {
        // Individual rejection caught and isolated
        logger.error(`Unhandled verification promise rejection for item ${item.id}`, { reason: s.reason });
        const failCheckedAt = new Date().toISOString();
        const ver: VerificationResult = {
          resultId: item.id,
          providerId: item.provider?.id || 'unknown',
          verified: false,
          checks: {
            price: { status: 'FAILED', checkedAt: failCheckedAt, message: String(s.reason) },
            availability: { status: 'FAILED', checkedAt: failCheckedAt, message: String(s.reason) },
            provider: { status: 'FAILED', checkedAt: failCheckedAt, message: String(s.reason) },
          },
          issues: [String(s.reason)],
          verifiedAt: failCheckedAt,
          freshness: FreshnessTracker.evaluateFreshness(failCheckedAt),
          status: 'FAILED',
        };
        results.push(ver);
        item.verification = {
          priceVerified: false,
          availabilityVerified: false,
          providerVerified: false,
          verifiedAt: failCheckedAt,
          status: 'FAILED',
          freshness: ver.freshness,
          issues: ver.issues,
        };
      }
    }

    const summary = this.computeSummary(results, items.length);

    return {
      verifiedItems: items,
      summary,
      results,
    };
  }

  /**
   * Verify top recommendations output by the comparison engine
   */
  async verifyRecommendations(
    recommendations: RecommendationResult[],
    options?: VerificationOptions
  ): Promise<{ recommendations: RecommendationResult[]; summary: VerificationSummary }> {
    if (!recommendations || recommendations.length === 0) {
      return {
        recommendations: [],
        summary: { verifiedCount: 0, unverifiedCount: 0, changedCount: 0, unavailableCount: 0 },
      };
    }

    const limit = options?.batchSize ?? this.defaultBatchSize;
    const prioritized = recommendations.slice(0, limit);

    logger.info(`Verifying top ${prioritized.length} ranked recommendation(s)`);

    const verificationPromises = prioritized.map(async (rec) => {
      const item = rec.item;
      // Detect category from item structure
      const isBus = Boolean(item.operator && item.departureTime);
      const isHotel = Boolean(item.roomType || item.amenities);
      const isFlight = Boolean(item.airline || item.flightNumber);

      if (isBus) return this.verifyBus(item, options);
      if (isHotel) return this.verifyHotel(item, options);
      if (isFlight) return this.verifyFlight(item, options);
      return this.verifyProduct(item, options);
    });

    const settled = await Promise.allSettled(verificationPromises);
    const verificationResults: VerificationResult[] = [];

    for (let i = 0; i < prioritized.length; i++) {
      const rec = prioritized[i];
      const s = settled[i];

      if (s.status === 'fulfilled') {
        const ver = s.value;
        verificationResults.push(ver);

        // Attach metadata to recommendation
        rec.verification = {
          priceVerified: ver.checks.price.status === 'VERIFIED',
          availabilityVerified: ver.checks.availability.status === 'VERIFIED',
          providerVerified: ver.checks.provider.status === 'VERIFIED',
          verifiedAt: ver.verifiedAt,
          status: ver.status,
          freshness: ver.freshness,
          priceChange: ver.priceChange,
          issues: ver.issues,
        };

        // Attach metadata to underlying item
        rec.item.verification = { ...rec.verification };

        // Handle Price Changes on Recommendation
        if (ver.priceChange) {
          rec.priceChanged = true;
          rec.originalPrice = ver.priceChange.originalPrice;
          rec.verifiedPrice = ver.priceChange.verifiedPrice;
          rec.priceDifference = ver.priceChange.difference;

          // Update recommendation narrative to reference current verified price rather than stale search price
          const oldFormatted = `${ver.priceChange.currency} ${ver.priceChange.originalPrice.toLocaleString('en-IN')}`;
          const newFormatted = `${ver.priceChange.currency} ${ver.priceChange.verifiedPrice.toLocaleString('en-IN')}`;

          if (rec.whyThisText && rec.whyThisText.includes(oldFormatted)) {
            rec.whyThisText = rec.whyThisText.replace(new RegExp(oldFormatted, 'g'), `${newFormatted} (verified price updated from ${oldFormatted})`);
          } else {
            rec.whyThisText = `${rec.whyThisText || ''} [Note: Current verified price is ${newFormatted}].`.trim();
          }
        }

        // Handle Unavailable inventory on Recommendation
        if (ver.status === 'UNAVAILABLE') {
          rec.unavailableReason = ver.unavailableReason || 'Item is no longer available from the provider';
          rec.item.availability = 'UNAVAILABLE';
        }
      } else {
        const failCheckedAt = new Date().toISOString();
        const ver: VerificationResult = {
          resultId: rec.resultId,
          providerId: rec.item?.provider?.id || 'unknown',
          verified: false,
          checks: {
            price: { status: 'FAILED', checkedAt: failCheckedAt, message: String(s.reason) },
            availability: { status: 'FAILED', checkedAt: failCheckedAt, message: String(s.reason) },
            provider: { status: 'FAILED', checkedAt: failCheckedAt, message: String(s.reason) },
          },
          issues: [String(s.reason)],
          verifiedAt: failCheckedAt,
          freshness: FreshnessTracker.evaluateFreshness(failCheckedAt),
          status: 'FAILED',
        };
        verificationResults.push(ver);
        rec.verification = {
          priceVerified: false,
          availabilityVerified: false,
          providerVerified: false,
          verifiedAt: failCheckedAt,
          status: 'FAILED',
          freshness: ver.freshness,
          issues: ver.issues,
        };
      }
    }

    const summary = this.computeSummary(verificationResults, recommendations.length);

    return {
      recommendations,
      summary,
    };
  }

  computeSummary(results: VerificationResult[], totalResultsCount: number = results.length): VerificationSummary {
    let verifiedCount = 0;
    let changedCount = 0;
    let unavailableCount = 0;
    let unverifiedCount = 0;

    for (const res of results) {
      switch (res.status) {
        case 'VERIFIED':
          verifiedCount++;
          break;
        case 'CHANGED':
          changedCount++;
          break;
        case 'UNAVAILABLE':
          unavailableCount++;
          break;
        default:
          unverifiedCount++;
          break;
      }
    }

    // Any remaining items not verified due to batch limits are counted as unverified
    const unbatched = Math.max(0, totalResultsCount - results.length);
    unverifiedCount += unbatched;

    return {
      verifiedCount,
      unverifiedCount,
      changedCount,
      unavailableCount,
    };
  }
}

export const verificationService = new VerificationService();
