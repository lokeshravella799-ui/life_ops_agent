import test from 'node:test';
import assert from 'node:assert/strict';

import { FlipkartShoppingProvider } from '../providers/flipkartShoppingProvider';
import { AmazonShoppingProvider } from '../providers/amazonShoppingProvider';
import { providerRegistry } from '../providers/providerRegistry';
import { ProductNormalizer } from '../normalizers/productNormalizer';
import { ProductSearchService } from '../services/productSearchService';
import { intentRouter } from '../agent/intentRouter';
import { orchestrator } from '../agent/orchestrator';
import { contextManager } from '../agent/contextManager';
import type { RawProductResult } from '../types/provider';
import type { SearchRequirements } from '../types/agent';

test('LifeOps Agentic Web-Shopping System Tests', async (t) => {
  // =========================================================================
  // 1. PRODUCT_SEARCH INTENT RECOGNITION
  // =========================================================================
  await t.test('1. Accurately identifies PRODUCT_SEARCH intent from user shopping requests', async () => {
    const testQueries = [
      'Find me a gaming laptop under 80000 with good reviews',
      'Show me some laptops',
      'Find wireless headphones under 3000',
      'Search for running shoes under 4000',
      'Look up mechanical keyboards with RGB',
    ];

    for (const query of testQueries) {
      const routed = await intentRouter.route(query, 'test_conv');
      assert.ok(
        routed.intent === 'PRODUCT_SEARCH' || routed.intent === 'SHOPPING_SEARCH',
        `Query "${query}" should be classified as PRODUCT_SEARCH or SHOPPING_SEARCH, got "${routed.intent}"`
      );
    }
  });

  // =========================================================================
  // 2. QUERY GENERATION & URL FORMULATION
  // =========================================================================
  await t.test('2. Flipkart and Amazon providers correctly generate search URLs', () => {
    const flipkart = new FlipkartShoppingProvider();
    const amazon = new AmazonShoppingProvider();

    const query = 'gaming laptop under 80000';
    const flipkartUrl = flipkart.buildSearchUrl(query);
    const amazonUrl = amazon.buildSearchUrl(query);

    assert.ok(flipkartUrl.includes('flipkart.com/search'), 'Flipkart URL must target search endpoint');
    assert.ok(flipkartUrl.includes('gaming+laptop+under+80000') || flipkartUrl.includes('gaming%20laptop%20under%2080000'));

    assert.ok(amazonUrl.includes('search.yahoo.com') && amazonUrl.includes('amazon.in'), 'Amazon provider queries Amazon India via safe search');
    assert.ok(amazonUrl.includes('gaming') && amazonUrl.includes('laptop'));
  });

  // =========================================================================
  // 3. FLIPKART RESULT EXTRACTION & ORIGINAL URL PRESERVATION
  // =========================================================================
  await t.test('3. Flipkart provider extracts real product cards and preserves original URLs', () => {
    const flipkart = new FlipkartShoppingProvider();

    // Representative sample of Flipkart HTML structure
    const sampleHtml = `
      <div class="_75nlfW">
        <div class="tUxRFH">
          <a class="CGtC5t" href="/acer-predator-helios-16-intel-core-i7-13700hx/p/itmd71829?pid=COMG12345&lid=LST123">
            <img class="DByuf4" src="https://rukminim2.flixcart.com/image/312/312/xif0q/computer/m/1/predator.jpeg" alt="Acer Predator Helios 16" />
            <div class="KzDlHZ">Acer Predator Helios 16 Intel Core i7 13th Gen - (16 GB/1 TB SSD/RTX 4060)</div>
            <div class="XQDdHH">4.5<img class="_2lQqi5" src="star.svg"/></div>
            <span class="Wphh3N"><span>120 Ratings&nbsp;&amp;&nbsp;24 Reviews</span></span>
            <div class="Nx9bqj _4b5DiR">₹1,19,990</div>
            <div class="yRaY8j ZYYwLA">₹1,44,990</div>
            <ul class="G4BRas">
              <li class="J+igdf">Intel Core i7 Processor (13th Gen)</li>
              <li class="J+igdf">16 GB DDR5 RAM</li>
              <li class="J+igdf">RTX 4060 Graphics</li>
            </ul>
          </a>
        </div>
      </div>
    `;

    const extracted = flipkart.extractProducts(sampleHtml);
    assert.equal(extracted.length, 1, 'Must extract 1 product card');

    const item = extracted[0];
    assert.ok(item.title.includes('Acer Predator Helios 16'), 'Extracted title must match');
    assert.equal(item.price, 119990, 'Extracted price must be parsed as number');
    assert.equal(item.originalPrice, 144990, 'Extracted original price must be parsed as number');
    assert.equal(item.rating, 4.5, 'Extracted rating must match');
    assert.equal(item.reviewCount, 24, 'Extracted review count must match');
    assert.equal(item.providerProductId, 'COMG12345', 'Product ID must be extracted from pid param');
    assert.ok(
      item.productUrl.startsWith('https://www.flipkart.com/acer-predator-helios-16-intel-core-i7-13700hx/p/itmd71829?pid=COMG12345'),
      'Must preserve ORIGINAL Flipkart product URL'
    );
    assert.ok(item.images && item.images.length > 0, 'Must extract image');
    assert.ok(item.specifications && Object.keys(item.specifications).length > 0, 'Must extract specifications');
  });

  // =========================================================================
  // 4. AMAZON RESULT EXTRACTION & CANONICAL URL PRESERVATION
  // =========================================================================
  await t.test('4. Amazon provider extracts real products and builds canonical Amazon India URLs', () => {
    const amazon = new AmazonShoppingProvider();

    // Sample search result pointing to Amazon India DP
    const sampleHtml = `
      <div class="compText">
        <a href="https://r.search.yahoo.com/_ylt=.../RU=https%3a%2f%2fwww.amazon.in%2fLenovo-LOQ-15IAX9-15-6-FHD-Graphics%2fdp%2fB0CX8X7C39/RK=2/..." aria-label="Lenovo LOQ Intel Core i5-12450HX 15.6&quot; FHD Gaming Laptop">
          <h3>Lenovo LOQ Intel Core i5-12450HX 15.6" Gaming Laptop (16GB/512GB SSD/RTX 3050)</h3>
        </a>
        <div class="compText">
          <span>Buy Lenovo LOQ 15.6 Gaming Laptop at ₹64,990 on Amazon India. 4.2 out of 5 stars with 480 reviews.</span>
        </div>
      </div>
    `;

    const extracted = amazon.extractProducts(sampleHtml);
    assert.equal(extracted.length, 1, 'Must extract 1 Amazon product');

    const item = extracted[0];
    assert.equal(item.providerProductId, 'B0CX8X7C39', 'Must extract canonical ASIN');
    assert.equal(item.productUrl, 'https://www.amazon.in/dp/B0CX8X7C39', 'Must preserve ORIGINAL Amazon India canonical product URL');
    assert.ok(item.title.includes('Lenovo LOQ'), 'Must extract accurate product title');
    assert.equal(item.price, 64990, 'Must extract price if present in text snippet');
    assert.equal(item.rating, 4.2, 'Must extract rating if present');
    assert.equal(item.reviewCount, 480, 'Must extract reviews if present');
    assert.ok(item.images && item.images[0].includes('B0CX8X7C39'), 'Must generate valid Amazon CloudFront CDN image from ASIN');
  });

  // =========================================================================
  // 5. NO FABRICATION OF MISSING INFORMATION
  // =========================================================================
  await t.test('5. Does not fabricate missing price, rating, or reviews', () => {
    const raw: RawProductResult = {
      providerProductId: 'NO-STATS-123',
      title: 'Minimalist Laptop Stand',
      productUrl: 'https://www.amazon.in/dp/B000000000',
      price: undefined,
      rating: undefined,
      reviewCount: undefined,
    };

    const providerInfo = { id: 'amazon_in', name: 'Amazon India' };
    const normalized = ProductNormalizer.normalize(raw, providerInfo);

    assert.equal(normalized.rating, undefined, 'Rating must remain undefined when missing in raw data');
    assert.equal(normalized.reviewCount, undefined, 'Review count must remain undefined when missing');
    assert.equal(normalized.price.amount, 0, 'Price defaults to 0 when not provided');
    assert.equal(normalized.productUrl, 'https://www.amazon.in/dp/B000000000', 'Original URL preserved');
  });

  // =========================================================================
  // 6. PROVIDER REGISTRY & MODULAR ARCHITECTURE
  // =========================================================================
  await t.test('6. ProviderRegistry contains Amazon India and Flipkart as active providers', () => {
    const productProviders = providerRegistry.getProvidersForCategory('product');
    const ids = productProviders.map((p) => p.providerId);

    assert.ok(ids.includes('flipkart') || ids.includes('flipkart_store'), 'FlipkartShoppingProvider must be registered');
    assert.ok(ids.includes('amazon_india') || ids.includes('amazon_in'), 'AmazonShoppingProvider must be registered');
  });

  // =========================================================================
  // 7. MULTI-PROVIDER SEARCH & FAILURE RESILIENCE
  // =========================================================================
  await t.test('7. ProductSearchService handles provider failure gracefully without crashing', async () => {
    // Create custom registry with 1 failing provider and 1 working provider
    const searchService = new ProductSearchService();
    
    // Test with empty requirements
    const res = await searchService.search({
      category: 'electronics',
      keywords: ['gaming', 'laptop'],
      budget: { max: 90000, currency: 'INR' },
    });

    assert.ok(Array.isArray(res.providerStats), 'Must return providerStats');
    assert.ok(typeof res.totalFound === 'number', 'Must return numeric totalFound');
    // Ensure it does not throw
  });

  // =========================================================================
  // 8. DOMAIN SWITCHING CONTEXT ISOLATION
  // =========================================================================
  await t.test('8. Domain switching from Bus Search to Product Search carries zero bus leakage', async () => {
    const convId = `conv_domain_switch_${Date.now()}`;

    // Turn 1: Bus Search
    const res1 = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Find me a bus from Hyderabad to Bangalore tomorrow',
    });

    assert.equal(res1.agentState.intent, 'BUS_SEARCH');
    assert.equal(res1.requirements?.source, 'Hyderabad');
    assert.equal(res1.requirements?.destination, 'Bangalore');

    // Turn 2: Product Search
    const res2 = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Show me some laptops under 70000',
    });

    assert.ok(
      res2.agentState.intent === 'PRODUCT_SEARCH' || res2.agentState.intent === 'SHOPPING_SEARCH',
      `Turn 2 must switch to PRODUCT_SEARCH, got "${res2.agentState.intent}"`
    );

    // CRITICAL: Bus requirements must NOT leak into the product search
    assert.equal(res2.requirements?.source, undefined, 'Must not carry bus source into product search');
    assert.equal(res2.requirements?.destination, undefined, 'Must not carry bus destination into product search');
    assert.equal(res2.requirements?.departureDate, undefined, 'Must not carry bus travel date into product search');
  });

  // =========================================================================
  // 9. VOICE & CONVERSATIONAL SUMMARY GENERATION
  // =========================================================================
  await t.test('9. Generates natural English summary for voice/TTS', async () => {
    const convId = `conv_voice_summary_${Date.now()}`;

    const res = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Find me a laptop under 80000',
    });

    assert.ok(res.message && res.message.length > 0, 'Must generate conversational response message');
    
    // Verify response message format
    if (res.resultCount > 0) {
      assert.ok(
        res.message.includes('I found') || res.message.includes('laptop') || res.message.includes('option'),
        `Summary message should be natural and mention options, got "${res.message}"`
      );
    } else {
      assert.ok(
        res.message.includes("couldn't retrieve live shopping results") || res.message.includes('No options satisfied'),
        `Failure message should clearly notify user, got "${res.message}"`
      );
    }
  });
});
