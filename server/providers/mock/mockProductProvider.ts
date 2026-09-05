import type {
  IProductProviderAdapter,
  RawProductResult,
  ProviderSearchResponse,
  IVerifiableProvider,
  ProviderProductVerificationResponse,
} from '../../types/provider';
import type { SearchRequirements } from '../../types/agent';

export type MockProductVerificationScenario =
  | 'PRICE_UNCHANGED'
  | 'PRICE_CHANGED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'MALFORMED';

/**
 * DEVELOPMENT MOCK - Primary Commerce Adapter (OmniStore)
 * Used only for local development and architecture verification.
 */
export class MockProductProvider implements IProductProviderAdapter, IVerifiableProvider {
  readonly providerId = 'mock_omnistore';
  readonly providerName = 'DEVELOPMENT MOCK - OmniStore';
  readonly category = 'product' as const;

  private available: boolean = true;
  private shouldFail: boolean = false;

  setAvailable(status: boolean): void {
    this.available = status;
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  isAvailable(): boolean {
    return this.available;
  }

  async searchProducts(
    requirements: SearchRequirements
  ): Promise<ProviderSearchResponse<RawProductResult>> {
    const startTime = Date.now();

    if (this.shouldFail) {
      return {
        providerId: this.providerId,
        providerName: this.providerName,
        success: false,
        results: [],
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        error: {
          code: 'PROVIDER_TIMEOUT',
          message: 'Simulated connection failure on OmniStore mock adapter.',
        },
      };
    }

    const maxBudget = requirements.budget?.max || 80000;

    // Realistic raw products matching search criteria
    const rawItems: RawProductResult[] = [
      {
        providerProductId: 'OMNI-LPT-01',
        title: 'ASUS ROG Zephyrus G14 Gaming Laptop',
        description: 'AMD Ryzen 7 7840HS, RTX 4050 6GB 95W TGP, 16GB DDR5, 1TB SSD',
        images: ['https://images.unsplash.com/photo-1593642632823-8f785ba67e45'],
        productUrl: 'https://omnistore.example.com/products/asus-g14',
        price: 64999,
        originalPrice: 79990,
        currency: 'INR',
        availability: 'In Stock',
        seller: 'OmniStore Direct Tech',
        rating: 4.8,
        reviewCount: 1420,
        specifications: {
          cpu: 'AMD Ryzen 7 7840HS',
          gpu: 'RTX 4050 6GB',
          ram: '16GB DDR5',
          storage: '1TB SSD',
          category: 'electronics',
        },
        delivery: {
          estimatedDate: 'Tomorrow by 2:00 PM',
          fee: 0,
        },
      },
      {
        providerProductId: 'OMNI-LPT-02',
        title: 'Lenovo Legion Slim 5 Gaming Laptop',
        description: 'Intel Core i5-13500H, RTX 4050 6GB 100W TGP, 16GB DDR5, 512GB SSD',
        images: ['https://images.unsplash.com/photo-1603302576837-37561b2e2302'],
        productUrl: 'https://omnistore.example.com/products/lenovo-legion-slim-5',
        price: 68490,
        originalPrice: 84990,
        currency: 'INR',
        availability: 'In Stock',
        seller: 'Lenovo Authorized Retail',
        rating: 4.7,
        reviewCount: 980,
        specifications: {
          cpu: 'Intel Core i5-13500H',
          gpu: 'RTX 4050 6GB',
          ram: '16GB DDR5',
          storage: '512GB SSD',
          category: 'electronics',
        },
        delivery: {
          estimatedDate: 'Within 2 days',
          fee: 0,
        },
      },
      {
        providerProductId: 'OMNI-LPT-03',
        title: 'Acer Nitro V 15 Gaming Laptop',
        description: 'Intel Core i5-13420H, RTX 4050 6GB 75W, 16GB DDR5, 512GB SSD',
        images: ['https://images.unsplash.com/photo-1588872657578-7efd1f1555ed'],
        productUrl: 'https://omnistore.example.com/products/acer-nitro-v',
        price: 59999,
        originalPrice: 74990,
        currency: 'INR',
        availability: 'In Stock',
        seller: 'Nitro Authorized Outlet',
        rating: 4.5,
        reviewCount: 2310,
        specifications: {
          cpu: 'Intel Core i5-13420H',
          gpu: 'RTX 4050 6GB',
          ram: '16GB DDR5',
          storage: '512GB SSD',
          category: 'electronics',
        },
        delivery: {
          estimatedDate: 'Tomorrow by 6:00 PM',
          fee: 0,
        },
      },
    ];

    return {
      providerId: this.providerId,
      providerName: this.providerName,
      success: true,
      results: rawItems,
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    };
  }

  async getProductDetails(productId: string): Promise<RawProductResult | null> {
    const res = await this.searchProducts({});
    return res.results.find((p) => p.providerProductId === productId) || null;
  }

  /* ==========================================================================
     DEVELOPMENT MOCK - VERIFICATION CAPABILITY
     ========================================================================== */
  readonly supportsVerification: boolean = true;
  private scenarios: Map<string, { scenario: MockProductVerificationScenario; customPrice?: number }> = new Map();
  private defaultScenario: MockProductVerificationScenario = 'PRICE_UNCHANGED';

  setVerificationScenario(
    productId: string | 'ALL',
    scenario: MockProductVerificationScenario,
    customPrice?: number
  ): void {
    if (productId === 'ALL') {
      this.defaultScenario = scenario;
    } else {
      this.scenarios.set(productId, { scenario, customPrice });
    }
  }

  resetVerificationScenarios(): void {
    this.scenarios.clear();
    this.defaultScenario = 'PRICE_UNCHANGED';
  }

  async verifyProduct(productId: string): Promise<ProviderProductVerificationResponse> {
    const config = this.scenarios.get(productId) || { scenario: this.defaultScenario };

    if (config.scenario === 'TIMEOUT') {
      throw new Error('Verification request to OmniStore timed out after 5000ms');
    }

    if (config.scenario === 'MALFORMED') {
      return {
        success: true,
        productId,
        price: {
          amount: NaN as any,
          currency: 'INVALID',
        },
        availability: 'UNKNOWN',
        verifiedAt: new Date().toISOString(),
      };
    }

    const product = await this.getProductDetails(productId);
    if (!product) {
      return {
        success: false,
        productId,
        error: `Product ${productId} not found on OmniStore catalog.`,
        verifiedAt: new Date().toISOString(),
      };
    }

    const basePrice =
      typeof product.price === 'number'
        ? product.price
        : parseFloat(String(product.price).replace(/[^0-9.]/g, ''));

    if (config.scenario === 'UNAVAILABLE') {
      return {
        success: true,
        productId,
        price: {
          amount: basePrice,
          currency: product.currency || 'INR',
        },
        availability: 'OUT_OF_STOCK',
        verifiedAt: new Date().toISOString(),
      };
    }

    if (config.scenario === 'PRICE_CHANGED') {
      const verifiedPrice = config.customPrice ?? (basePrice > 0 ? basePrice + 3000 : 52999);
      return {
        success: true,
        productId,
        price: {
          amount: verifiedPrice,
          currency: product.currency || 'INR',
        },
        availability: 'AVAILABLE',
        verifiedAt: new Date().toISOString(),
      };
    }

    // Default CASE 1: PRICE_UNCHANGED
    return {
      success: true,
      productId,
      price: {
        amount: basePrice,
        currency: product.currency || 'INR',
      },
      availability: 'AVAILABLE',
      verifiedAt: new Date().toISOString(),
    };
  }
}

/**
 * DEVELOPMENT MOCK - Secondary Commerce Adapter (ApexRetail)
 * Used to test multi-provider aggregation, failure isolation & deduplication.
 */
export class MockSecondaryProductProvider implements IProductProviderAdapter {
  readonly providerId = 'mock_apexretail';
  readonly providerName = 'DEVELOPMENT MOCK - ApexRetail';
  readonly category = 'product' as const;

  private available: boolean = true;
  private shouldFail: boolean = false;

  setAvailable(status: boolean): void {
    this.available = status;
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  isAvailable(): boolean {
    return this.available;
  }

  async searchProducts(
    requirements: SearchRequirements
  ): Promise<ProviderSearchResponse<RawProductResult>> {
    const startTime = Date.now();

    if (this.shouldFail) {
      return {
        providerId: this.providerId,
        providerName: this.providerName,
        success: false,
        results: [],
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        error: {
          code: 'ADAPTER_ERROR',
          message: 'Simulated failure on ApexRetail adapter.',
        },
      };
    }

    const maxBudget = requirements.budget?.max || 80000;

    // Contains one distinct product and one overlapping product (for deduplication test)
    const rawItems: RawProductResult[] = [
      {
        providerProductId: 'APEX-LPT-01',
        // Overlapping product from another vendor
        title: 'ASUS ROG Zephyrus G14 Gaming Laptop',
        description: 'AMD Ryzen 7 7840HS, RTX 4050 6GB 95W TGP, 16GB RAM, 1TB SSD',
        images: ['https://images.unsplash.com/photo-1593642632823-8f785ba67e45'],
        productUrl: 'https://apexretail.example.com/laptops/asus-rog-g14',
        price: '₹64,499', // slightly different string price representation
        originalPrice: '₹78,990',
        currency: 'INR',
        availability: 'In Stock',
        seller: 'Apex Prime Electronics',
        rating: 4.8,
        reviewCount: 890,
        specifications: {
          cpu: 'AMD Ryzen 7 7840HS',
          gpu: 'RTX 4050 6GB',
          ram: '16GB DDR5',
          storage: '1TB SSD',
          category: 'electronics',
        },
      },
      {
        providerProductId: 'APEX-LPT-02',
        title: 'HP Victus 16 Gaming Laptop',
        description: 'Intel Core i5-13500H, RTX 4050 6GB, 16GB DDR5, 512GB SSD',
        images: ['https://images.unsplash.com/photo-1541807084-5c52b6b3adef'],
        productUrl: 'https://apexretail.example.com/laptops/hp-victus-16',
        price: 66990,
        originalPrice: 79990,
        currency: 'INR',
        availability: 'In Stock',
        seller: 'HP Flagship Store',
        rating: 4.6,
        reviewCount: 650,
        specifications: {
          cpu: 'Intel Core i5-13500H',
          gpu: 'RTX 4050 6GB',
          ram: '16GB DDR5',
          storage: '512GB SSD',
          category: 'electronics',
        },
      },
    ];

    return {
      providerId: this.providerId,
      providerName: this.providerName,
      success: true,
      results: rawItems,
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    };
  }

  async getProductDetails(productId: string): Promise<RawProductResult | null> {
    const res = await this.searchProducts({});
    return res.results.find((p) => p.providerProductId === productId) || null;
  }
}
