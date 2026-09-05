import type { RawProductResult, NormalizedProduct } from '../types/provider';

export class ProductNormalizer {
  private static parsePrice(raw: number | string | undefined): number {
    if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private static parseCurrency(rawCurr?: string, rawPrice?: string | number): string {
    if (rawCurr && rawCurr.trim().length > 0) {
      const c = rawCurr.trim().toUpperCase();
      if (c === '₹' || c === 'RS' || c === 'RS.') return 'INR';
      if (c === '$') return 'USD';
      if (c === '€') return 'EUR';
      return c;
    }
    if (typeof rawPrice === 'string') {
      if (rawPrice.includes('₹') || rawPrice.toLowerCase().includes('rs')) return 'INR';
      if (rawPrice.includes('$')) return 'USD';
      if (rawPrice.includes('€')) return 'EUR';
    }
    return 'INR';
  }

  static normalize(raw: RawProductResult, provider: { id: string; name: string }): NormalizedProduct {
    const amount = this.parsePrice(raw.price);
    const currency = this.parseCurrency(raw.currency, raw.price);

    let originalPriceAmount: number | undefined = undefined;
    if (raw.originalPrice !== undefined) {
      const parsedOrig = this.parsePrice(raw.originalPrice);
      if (parsedOrig > 0) {
        originalPriceAmount = parsedOrig;
      }
    }

    let discount: number | undefined = undefined;
    if (originalPriceAmount && originalPriceAmount > amount && amount > 0) {
      discount = Math.round(((originalPriceAmount - amount) / originalPriceAmount) * 100);
    }

    // Sanitize image URLs
    const images: string[] = Array.isArray(raw.images)
      ? raw.images.filter((img) => typeof img === 'string' && img.trim().length > 0)
      : [];

    // Normalize specifications to Record<string, string>
    const specifications: Record<string, string> = {};
    if (raw.specifications && typeof raw.specifications === 'object') {
      for (const [k, v] of Object.entries(raw.specifications)) {
        if (v !== undefined && v !== null) {
          specifications[k] = String(v).trim();
        }
      }
    }

    // Delivery normalization
    let delivery: { estimatedDate?: string; fee?: number } | undefined = undefined;
    if (raw.delivery) {
      delivery = {
        estimatedDate: raw.delivery.estimatedDate,
        fee: raw.delivery.fee !== undefined ? this.parsePrice(raw.delivery.fee) : undefined,
      };
    }

    let brand = specifications['brand'] || raw.brand;
    if (!brand) {
      const knownBrands = ['ASUS', 'HP', 'Dell', 'Lenovo', 'Acer', 'Apple', 'Samsung', 'Sony', 'boAt', 'Realme', 'Redmi', 'Xiaomi', 'OnePlus', 'LG', 'MSI', 'Neopticon'];
      const found = knownBrands.find((b) => new RegExp(`\\b${b}\\b`, 'i').test(raw.title || ''));
      if (found) {
        brand = found;
      }
    }

    return {
      id: `${provider.id}_${raw.providerProductId}`,
      provider: {
        id: provider.id,
        name: provider.name,
      },
      title: raw.title?.trim() || 'Untitled Product',
      description: raw.description?.trim(),
      images,
      price: {
        amount,
        currency,
      },
      originalPrice: originalPriceAmount
        ? {
            amount: originalPriceAmount,
            currency,
          }
        : undefined,
      discount,
      availability: raw.availability?.trim(),
      productUrl: raw.productUrl?.trim() || '',
      seller: raw.seller?.trim(),
      brand,
      category: specifications['category'] || 'electronics',
      specifications,
      rating: typeof raw.rating === 'number' ? Math.min(5, Math.max(0, raw.rating)) : undefined,
      reviewCount: typeof raw.reviewCount === 'number' ? Math.max(0, raw.reviewCount) : undefined,
      delivery,
      fetchedAt: new Date().toISOString(),
      verification: {
        priceVerified: false,
        availabilityVerified: false,
        providerVerified: false,
      },
    };
  }
}
