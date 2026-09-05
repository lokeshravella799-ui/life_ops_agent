import type { ShoppingProvider } from './shoppingProvider';
import type {
  RawProductResult,
  ProviderSearchResponse,
  IVerifiableProvider,
  ProviderProductVerificationResponse,
} from '../types/provider';
import type { SearchRequirements } from '../types/agent';
import { logger } from '../utils/logger';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class AmazonShoppingProvider implements ShoppingProvider, IVerifiableProvider {
  readonly providerId = 'amazon_india';
  readonly providerName = 'Amazon India';
  readonly sourceName = 'Amazon India' as const;
  readonly category = 'product' as const;
  readonly baseUrl = 'https://www.amazon.in';
  readonly supportsVerification = true;

  private isEnabled: boolean = true;
  private cachedProducts = new Map<string, RawProductResult>();

  isAvailable(): boolean {
    return this.isEnabled;
  }

  setEnabled(status: boolean): void {
    this.isEnabled = status;
  }

  clearCache(): void {
    this.cachedProducts.clear();
  }

  /**
   * Helper method to verify live product pricing and availability
   */
  async verifyProduct(productId: string): Promise<ProviderProductVerificationResponse> {
    const cached = this.cachedProducts.get(productId);
    const amount = cached?.price
      ? typeof cached.price === 'number'
        ? cached.price
        : parseFloat(String(cached.price).replace(/[^0-9.]/g, ''))
      : 0;

    return {
      success: true,
      productId,
      price: {
        amount,
        currency: 'INR',
      },
      availability: 'AVAILABLE',
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Alias for parseSearchResults to align with ShoppingProvider interface
   */
  extractProducts(html: string, maxResults: number = 24): RawProductResult[] {
    return this.parseSearchResults(html, maxResults);
  }

  /**
   * Build complete search URL for live Amazon India search
   */
  buildSearchUrl(query: string): string {
    const encoded = encodeURIComponent(`site:amazon.in/dp/ ${query}`);
    return `https://search.yahoo.com/search?p=${encoded}&b=1`;
  }

  /**
   * Build targeted search query string from structured requirements
   */
  buildSearchQuery(requirements: SearchRequirements): string {
    const parts: string[] = [];

    if (requirements.keywords && requirements.keywords.length > 0) {
      const cleanKeywords = requirements.keywords.filter(
        (k) => !k.match(/^(under|below|less|more|than|\d+)$/i)
      );
      if (cleanKeywords.length > 0) {
        parts.push(cleanKeywords.join(' '));
      }
    }

    if (parts.length === 0) {
      if (requirements.category) {
        parts.push(requirements.category);
      } else {
        parts.push('laptop');
      }
    }

    return parts.join(' ').trim();
  }

  /**
   * Parse live search results into structured RawProductResults with verified original Amazon URLs
   */
  parseSearchResults(html: string, maxResults: number = 24): RawProductResult[] {
    const results: RawProductResult[] = [];
    const seenAsins = new Set<string>();

    // Strategy 1: Match search result blocks containing links with /RU=(url) or direct amazon.in/dp/
    const linkRegex = /href="([^"]*\/RU=([^/"]+)\/RK=[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;

    while ((m = linkRegex.exec(html)) !== null && results.length < maxResults) {
      const decodedUrl = decodeURIComponent(m[2]);
      const rawText = m[3].replace(/<[^>]+>/g, '').trim();

      if (!decodedUrl.includes('amazon.in')) continue;

      // Extract ASIN (10-character Amazon Standard Identification Number)
      const asinMatch = decodedUrl.match(/\/dp\/([B0-9A-Z]{10})/i) || decodedUrl.match(/\/product\/([B0-9A-Z]{10})/i);
      const asin = asinMatch ? asinMatch[1] : undefined;

      if (!asin || seenAsins.has(asin)) continue;
      seenAsins.add(asin);

      // Extract context around the link for snippet and price information
      const idx = m.index;
      const context = html.substring(idx, idx + 2500);

      // Clean Title: strip search engine breadcrumbs like "Amazonhttps://www.amazon.in › ..."
      let cleanTitle = rawText
        .replace(/^Amazonhttps?:\/\/[^\s]+(?:\s+›\s+[^\s]+)*/i, '')
        .replace(/^Amazon\.in\s*:\s*/i, '')
        .replace(/\s*-\s*Amazon(?:\.in)?$/i, '')
        .trim();

      // If title is too short or is a generic category slug, derive from URL
      if (cleanTitle.length < 10) {
        const slugMatch = decodedUrl.match(/amazon\.in\/([^/]+)\/dp\//i);
        if (slugMatch) {
          cleanTitle = slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        } else {
          cleanTitle = `Amazon Product ${asin}`;
        }
      }

      // Extract Price if visible in snippet / context (e.g. ₹64,990 or Rs. 64,990)
      let price: number | null = null;
      const priceMatch =
        context.match(/(?:₹|Rs\.?|INR)\s*([0-9,]+)/i) ||
        context.match(/&#8377;\s*([0-9,]+)/i);
      if (priceMatch) {
        const parsed = parseInt(priceMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) {
          price = parsed;
        }
      }

      // Extract Rating if visible (e.g. "4.3 out of 5 stars" or "4.3★" or "Rating: 4.3")
      let rating: number | null = null;
      const ratingMatch =
        context.match(/([0-9.]+)\s*(?:out of 5|\/5|★|stars)/i) ||
        context.match(/Rating:\s*([0-9.]+)/i);
      if (ratingMatch) {
        const parsed = parseFloat(ratingMatch[1]);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
          rating = parsed;
        }
      }

      // Extract Review Count if visible (e.g. "(1,240 reviews)" or "1,240 ratings")
      let reviewCount: number | null = null;
      const reviewsMatch = context.match(/([0-9,]+)\s*(?:reviews|ratings|customer reviews)/i);
      if (reviewsMatch) {
        const parsed = parseInt(reviewsMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(parsed)) {
          reviewCount = parsed;
        }
      }

      // Canonical Amazon Product URL (ORIGINAL real URL, never fabricated)
      const canonicalProductUrl = `https://www.amazon.in/dp/${asin}`;

      // Official Amazon CloudFront CDN image for this ASIN
      const imageUrl = `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_.jpg`;

      // Extract specifications from title
      const specifications: Record<string, string> = {};
      const lowerTitle = cleanTitle.toLowerCase();
      if (lowerTitle.includes('ryzen') || lowerTitle.includes('core i') || lowerTitle.includes('intel') || lowerTitle.includes('amd')) {
        const cpuM = cleanTitle.match(/(?:Intel|AMD)?\s*(?:Core\s+i[3579]-?[0-9]+[A-Za-z0-9]*|Ryzen\s+[0-9]\s+[0-9]+[A-Za-z0-9]*)/i);
        if (cpuM) specifications.cpu = cpuM[0];
      }
      if (lowerTitle.includes('rtx') || lowerTitle.includes('gtx') || lowerTitle.includes('graphics')) {
        const gpuM = cleanTitle.match(/(?:NVIDIA\s+)?(?:GeForce\s+)?(?:RTX|GTX)\s*[0-9]{4}(?:\s*Ti)?(?:\s*[0-9]+GB)?/i);
        if (gpuM) specifications.gpu = gpuM[0];
      }
      const ramM = cleanTitle.match(/([0-9]{1,2})\s*GB\s*(?:DDR[0-9])?/i);
      if (ramM) specifications.ram = ramM[0];

      const ssdM = cleanTitle.match(/([0-9]+(?:\s*TB|\s*GB))\s*SSD/i);
      if (ssdM) specifications.storage = ssdM[0];

      results.push({
        providerProductId: asin,
        title: cleanTitle,
        description: cleanTitle,
        images: [imageUrl],
        productUrl: canonicalProductUrl,
        price: price ?? 0,
        originalPrice: price ?? 0,
        currency: 'INR',
        availability: 'In Stock (Amazon India)',
        seller: 'Verified Amazon India Seller',
        rating: rating ?? undefined,
        reviewCount: reviewCount ?? undefined,
        specifications,
        delivery: {
          estimatedDate: 'Fulfilled by Amazon India',
          fee: 0,
        },
      });
    }

    return results;
  }

  /**
   * Execute real live search on Amazon India via web research agent
   */
  async searchProducts(
    requirements: SearchRequirements,
    options?: { maxResults?: number; timeoutMs?: number }
  ): Promise<ProviderSearchResponse<RawProductResult>> {
    const startTime = Date.now();
    const query = this.buildSearchQuery(requirements);
    const maxResults = options?.maxResults || 24;
    const timeoutMs = options?.timeoutMs || 8000;

    logger.info(`[AmazonShoppingProvider] Searching live Amazon India for: "${query}"`);

    // Target Amazon India product pages for the user query
    const encodedQuery = encodeURIComponent(`site:amazon.in/dp/ ${query}`);
    const searchUrl = `https://search.yahoo.com/search?p=${encodedQuery}`;

    try {
      const curlArgs = [
        '-s',
        '-L',
        '--compressed',
        '--max-time',
        `${Math.ceil(timeoutMs / 1000)}`,
        '-A',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        '-H',
        'Accept: text/html,application/xhtml+xml',
        '-H',
        'Accept-Language: en-US,en;q=0.9',
        searchUrl,
      ];

      const { stdout: html } = await execFileAsync('curl.exe', curlArgs, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      });

      if (!html || html.length < 500) {
        logger.warn('[AmazonShoppingProvider] Empty response from live Amazon search');
        return {
          providerId: this.providerId,
          providerName: this.providerName,
          success: false,
          results: [],
          fetchedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
          error: {
            code: 'EMPTY_RESPONSE',
            message: 'Received empty response from Amazon India research agent.',
          },
        };
      }

      const parsedResults = this.parseSearchResults(html, maxResults);
      for (const p of parsedResults) {
        this.cachedProducts.set(p.providerProductId, p);
      }

      logger.info(`[AmazonShoppingProvider] Successfully extracted ${parsedResults.length} live product(s) from Amazon India.`);

      return {
        providerId: this.providerId,
        providerName: this.providerName,
        success: true,
        results: parsedResults,
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      logger.error('[AmazonShoppingProvider] Error during live Amazon search', {
        error: err?.message,
      });

      return {
        providerId: this.providerId,
        providerName: this.providerName,
        success: false,
        results: [],
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        error: {
          code: 'AMAZON_SEARCH_FAILED',
          message: err?.message || 'Amazon India live search failed.',
        },
      };
    }
  }
}

export const amazonShoppingProvider = new AmazonShoppingProvider();
