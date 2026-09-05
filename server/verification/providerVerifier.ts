import { providerRegistry as defaultRegistry, ProviderRegistry } from '../providers/providerRegistry';
import { UrlValidator } from './urlValidator';
import type { VerificationCheck } from './types';

export interface ProviderVerificationResult {
  check: VerificationCheck;
  providerVerified: boolean;
  issues: string[];
}

export class ProviderVerifier {
  /**
   * Verify provider authenticity and validate URL safety
   */
  static verify(
    providerId: string,
    url?: string,
    registry: ProviderRegistry = defaultRegistry,
    checkedAt: string = new Date().toISOString()
  ): ProviderVerificationResult {
    const issues: string[] = [];

    // 1. Authenticate Provider Identity against Configured Registry
    const isRegistered = registry.hasProvider(providerId);

    if (!isRegistered) {
      issues.push(`Provider "${providerId}" is not registered in configured adapter registry.`);
      return {
        check: {
          status: 'FAILED',
          checkedAt,
          message: `Unknown or unconfigured provider: ${providerId}`,
        },
        providerVerified: false,
        issues,
      };
    }

    // 2. Validate URL Format and Domain Consistency (if URL is present)
    if (url) {
      const urlCheck = UrlValidator.validate(url, providerId);
      if (!urlCheck.isValid) {
        issues.push(`URL validation failed: ${urlCheck.reason || 'Invalid format'}`);
        return {
          check: {
            status: 'FAILED',
            checkedAt,
            message: `URL security check failed: ${urlCheck.reason}`,
          },
          providerVerified: false,
          issues,
        };
      }
    }

    return {
      check: {
        status: 'VERIFIED',
        checkedAt,
        message: `Provider identity "${providerId}" authenticated via adapter registry.`,
      },
      providerVerified: true,
      issues: [],
    };
  }
}
