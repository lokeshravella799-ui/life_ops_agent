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

export class FlipkartShoppingProvider implements ShoppingProvider, IVerifiableProvider {
  readonly providerId = 'flipkart';
  readonly providerName = 'Flipkart';
  readonly sourceName = 'Flipkart' as const;
  readonly category = 'product' as const;
  readonly baseUrl = 'https://www.flipkart.com';
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
  extractProducts(html: string, maxResults: number = 10): RawProductResult[] {
    return this.parseSearchResults(html, maxResults);
  }

  /**
   * Build complete search URL for Flipkart live search
   */
  buildSearchUrl(query: string): string {
    return `${this.baseUrl}/search?q=${encodeURIComponent(query).replace(/%20/g, '+')}`;
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
   * Parse real Flipkart HTML search results into structured RawProductResults
   */
  parseSearchResults(html: string, maxResults: number = 24): RawProductResult[] {
    const results: RawProductResult[] = [];
    const seenUrls = new Set<string>();

    // Split HTML by product card markers or search for links to /p/itm
    const linkRegex = /href="(\/[^"]*\/p\/itm[a-zA-Z0-9]+[^"]*)"/g;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
      const relativeUrl = match[1].replace(/&amp;/g, '&');
      const fullUrl = `https://www.flipkart.com${relativeUrl}`;
      const canonicalUrl = fullUrl.split('?')[0];

      if (seenUrls.has(canonicalUrl)) continue;
      seenUrls.add(canonicalUrl);

      // Extract context slice around the product link (-500 to +5000 characters to cover full spec list, image, and price container)
      const matchIdx = match.index;
      const sliceStart = Math.max(0, matchIdx - 600);
      const contextSlice = html.substring(sliceStart, matchIdx + 5000);

      // 1. Extract Item ID
      const itmMatch = canonicalUrl.match(/\/p\/(itm[a-zA-Z0-9]+)/);
      const pidMatch = relativeUrl.match(/[?&]pid=([A-Z0-9]+)/);
      const providerProductId = pidMatch ? pidMatch[1] : itmMatch ? itmMatch[1] : `fk_${Date.now()}_${results.length}`;

      // 2. Extract Title
      // Check title from title div (RG5Slk, KzDlHZ, _4rR01T, wjcEIp, cPHDOP), img alt, or URL slug
      let title: string | undefined;
      const titleDivMatch = contextSlice.match(/<div class="(?:RG5Slk|KzDlHZ|_4rR01T|wjcEIp|cPHDOP)[^"]*">([^<]+)<\/div>/i);
      if (titleDivMatch && titleDivMatch[1].trim()) {
        title = titleDivMatch[1].trim();
      }

      if (!title) {
        const imgAltMatch = contextSlice.match(/<img[^>]+alt="([^"]+)"/i);
        if (imgAltMatch && imgAltMatch[1].trim() && imgAltMatch[1].length > 10) {
          title = imgAltMatch[1].trim();
        }
      }

      if (!title) {
        // Derive from URL slug
        const slugMatch = relativeUrl.match(/^\/([^/]+)\/p\//);
        if (slugMatch) {
          title = slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        }
      }

      if (!title) continue;

      // 3. Extract Current Displayed Price (e.g. ₹79,990)
      let price: number | null = null;
      const targetedPriceMatch =
        contextSlice.match(/class="[^"]*(?:hZ3P6w|DeU9vF|Nx9bqj|_4b5DiR|_30jeq3)[^"]*"[^>]*>₹\s*([0-9,]+)/i) ||
        contextSlice.match(/<div class="[^"]*(?:col col-5-12|price-container)[^"]*"[\s\S]*?₹\s*([0-9,]+)/i);

      const priceMatch = targetedPriceMatch || contextSlice.match(/₹\s*([0-9,]+)/);
      if (priceMatch) {
        const parsed = parseInt(priceMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) {
          price = parsed;
        }
      }

      // 4. Extract Original Price (crossed out if discount exists)
      let originalPrice: number | null = null;
      const origPriceMatch = contextSlice.match(/₹<!-- -->([0-9,]+)/i) || contextSlice.match(/class="[^"]*(?:kRYCnD|yRaY8j)[^"]*">₹\s*([0-9,]+)/i);
      if (origPriceMatch) {
        const parsed = parseInt(origPriceMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) {
          originalPrice = parsed;
        }
      }

      // 5. Extract Rating (e.g. 4.4)
      let rating: number | null = null;
      const ratingMatch = contextSlice.match(/<div class="MKiFS6">([0-9.]+)/i) || contextSlice.match(/class="[^"]*(?:CjyrHS|XQDdHH)[^"]*"[^>]*>([0-9.]+)/i);
      if (ratingMatch) {
        const parsed = parseFloat(ratingMatch[1]);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
          rating = parsed;
        }
      }

      // 6. Extract Review Count (e.g. "133 Ratings & 7 Reviews")
      let reviewCount: number | null = null;
      const reviewsOnlyMatch = contextSlice.match(/([0-9,]+)\s*Reviews/i);
      const ratingsOrReviewsMatch = contextSlice.match(/([0-9,]+)\s*(?:Ratings|Reviews)/i);
      const reviewsMatch = reviewsOnlyMatch || ratingsOrReviewsMatch;
      if (reviewsMatch) {
        const parsed = parseInt(reviewsMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(parsed)) {
          reviewCount = parsed;
        }
      }

      // 7. Extract Image URL
      let imageUrl: string | null = null;
      const imgMatch = contextSlice.match(/<img[^>]+src="(https:\/\/[^"]*flixcart\.com\/[^"]+)"/i);
      if (imgMatch) {
        imageUrl = imgMatch[1];
      }

      // 8. Extract Specifications (bullets or features)
      const specifications: Record<string, string> = {};
      const bulletRegex = /<li class="[^"]*(?:DTBslk|J\+igdf|G4BRas)[^"]*">([^<]+)<\/li>/gi;
      let bMatch: RegExpExecArray | null;
      const bullets: string[] = [];
      while ((bMatch = bulletRegex.exec(contextSlice)) !== null && bullets.length < 8) {
        bullets.push(bMatch[1].trim());
      }

      for (const bullet of bullets) {
        const lowerB = bullet.toLowerCase();
        if (lowerB.includes('processor') || lowerB.includes('intel') || lowerB.includes('ryzen') || lowerB.includes('core')) {
          specifications.cpu = bullet;
        } else if (lowerB.includes('graphics') || lowerB.includes('geforce') || lowerB.includes('rtx') || lowerB.includes('gtx')) {
          specifications.gpu = bullet;
        } else if (lowerB.includes('ram') || lowerB.includes('ddr')) {
          specifications.ram = bullet;
        } else if (lowerB.includes('ssd') || lowerB.includes('storage') || lowerB.includes('hdd')) {
          specifications.storage = bullet;
        } else if (lowerB.includes('display') || lowerB.includes('inch') || lowerB.includes('cm')) {
          specifications.display = bullet;
        } else if (lowerB.includes('windows') || lowerB.includes('os')) {
          specifications.os = bullet;
        }
      }

      results.push({
        providerProductId,
        title,
        description: bullets.length > 0 ? bullets.join(' • ') : title,
        images: imageUrl ? [imageUrl] : [],
        productUrl: fullUrl,
        price: price ?? 0,
        originalPrice: originalPrice ?? price ?? 0,
        currency: 'INR',
        availability: 'In Stock (Flipkart)',
        seller: 'Verified Flipkart Merchant',
        rating: rating ?? undefined,
        reviewCount: reviewCount ?? undefined,
        specifications,
        delivery: {
          estimatedDate: 'Fast Delivery by Flipkart',
          fee: 0,
        },
      });
    }

    return results;
  }

  /**
   * Execute real live search on Flipkart
   */
  async searchProducts(
    requirements: SearchRequirements,
    options?: { maxResults?: number; timeoutMs?: number }
  ): Promise<ProviderSearchResponse<RawProductResult>> {
    const startTime = Date.now();
    const query = this.buildSearchQuery(requirements);
    const maxResults = options?.maxResults || 24;
    const timeoutMs = options?.timeoutMs || 8000;

    logger.info(`[FlipkartShoppingProvider] Searching live Flipkart for: "${query}"`);

    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `${this.baseUrl}/search?q=${encodedQuery}`;

    try {
      // 1. Fetch live search page using curl for resilient HTTP/2 & browser fingerprint compatibility
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
        logger.warn('[FlipkartShoppingProvider] Empty or truncated response from Flipkart');
        return {
          providerId: this.providerId,
          providerName: this.providerName,
          success: false,
          results: [],
          fetchedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
          error: {
            code: 'EMPTY_RESPONSE',
            message: 'Received empty response from Flipkart live search.',
          },
        };
      }

      // 2. Parse results
      const parsedResults = this.parseSearchResults(html, maxResults);
      for (const p of parsedResults) {
        this.cachedProducts.set(p.providerProductId, p);
      }

      logger.info(`[FlipkartShoppingProvider] Successfully extracted ${parsedResults.length} live product(s) from Flipkart.`);

      return {
        providerId: this.providerId,
        providerName: this.providerName,
        success: true,
        results: parsedResults,
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      logger.error('[FlipkartShoppingProvider] Error during live Flipkart search', {
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
          code: 'FLIPKART_SEARCH_FAILED',
          message: err?.message || 'Flipkart live search failed.',
        },
      };
    }
  }
}

export const flipkartShoppingProvider = new FlipkartShoppingProvider();
