/**
 * URL Safety & Integrity Validator
 * Enforces strict URL protocol safety, format validity, and provider domain consistency
 * without scraping or contacting external hosts.
 */
export interface UrlValidationResult {
  isValid: boolean;
  reason?: string;
  domain?: string;
  protocol?: string;
}

export class UrlValidator {
  private static readonly ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
  private static readonly DISALLOWED_SCHEMES = ['javascript:', 'data:', 'file:', 'ftp:', 'blob:', 'vbscript:'];

  /**
   * Known/trusted domain suffixes for registered mock and standard providers
   */
  private static readonly PROVIDER_DOMAIN_MAP: Record<string, string[]> = {
    mock_omnistore: ['omnistore.example.com', 'example.com'],
    mock_apexretail: ['apexretail.example.com', 'example.com'],
    mock_smarttransit: ['smarttransit.example.com', 'example.com'],
    mock_horizonstays: ['horizonstays.example.com', 'example.com'],
    mock_skyroutes: ['skyroutes.example.com', 'example.com'],
    flipkart: ['flipkart.com', 'dl.flipkart.com'],
    flipkart_store: ['flipkart.com', 'dl.flipkart.com'],
    amazon_india: ['amazon.in', 'www.amazon.in', 'amzn.in', 'amzn.to'],
    amazon_in: ['amazon.in', 'www.amazon.in', 'amzn.in', 'amzn.to'],
  };

  /**
   * Validate a URL string for structure, protocol, and provider domain consistency
   */
  static validate(url: string | undefined | null, expectedProviderId?: string): UrlValidationResult {
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return {
        isValid: false,
        reason: 'URL is missing or empty',
      };
    }

    const trimmed = url.trim();

    // Check for explicitly dangerous schemes early
    const lower = trimmed.toLowerCase();
    for (const scheme of this.DISALLOWED_SCHEMES) {
      if (lower.startsWith(scheme)) {
        return {
          isValid: false,
          reason: `Disallowed dangerous URL protocol: ${scheme}`,
        };
      }
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return {
        isValid: false,
        reason: 'Malformed URL format',
      };
    }

    if (!this.ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return {
        isValid: false,
        reason: `Unsupported URL protocol "${parsed.protocol}". Only HTTP/HTTPS are allowed.`,
        protocol: parsed.protocol,
      };
    }

    if (!parsed.hostname || parsed.hostname.trim().length === 0) {
      return {
        isValid: false,
        reason: 'URL contains empty or invalid hostname',
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Provider domain consistency check
    if (expectedProviderId && this.PROVIDER_DOMAIN_MAP[expectedProviderId]) {
      const allowedDomains = this.PROVIDER_DOMAIN_MAP[expectedProviderId];
      const matchesAllowed = allowedDomains.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
      );

      if (!matchesAllowed) {
        return {
          isValid: false,
          reason: `URL hostname "${hostname}" does not match registered domains for provider "${expectedProviderId}"`,
          domain: hostname,
          protocol: parsed.protocol,
        };
      }
    }

    return {
      isValid: true,
      domain: hostname,
      protocol: parsed.protocol,
    };
  }
}
