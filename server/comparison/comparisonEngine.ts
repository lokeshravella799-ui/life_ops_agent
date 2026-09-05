import type { NormalizedProduct, NormalizedBusResult } from '../types/provider';
import type { ComparisonSummary } from './types';

export class ComparisonEngine {
  /**
   * Compares two normalized products and generates a factual difference statement
   */
  static comparePair(productA: NormalizedProduct, productB: NormalizedProduct): string {
    const priceDiff = Math.abs(productA.price.amount - productB.price.amount);
    const cheaper = productA.price.amount < productB.price.amount ? productA : productB;
    const dearer = productA.price.amount < productB.price.amount ? productB : productA;

    const parts: string[] = [];

    if (priceDiff > 0) {
      parts.push(
        `${cheaper.title.split(' ')[0]} is ₹${priceDiff.toLocaleString('en-IN')} cheaper than ${dearer.title.split(' ')[0]}`
      );
    }

    const gpuA = productA.specifications['gpu'] || '';
    const gpuB = productB.specifications['gpu'] || '';
    if (gpuA && gpuB && gpuA !== gpuB) {
      parts.push(`${productA.title.split(' ')[0]} features ${gpuA} vs ${gpuB}`);
    }

    const ramA = productA.specifications['ram'] || '';
    const ramB = productB.specifications['ram'] || '';
    if (ramA && ramB && ramA !== ramB) {
      parts.push(`${productA.title.split(' ')[0]} provides ${ramA} vs ${ramB}`);
    }

    return parts.join(', while ') || 'Both options offer very similar specifications.';
  }

  /**
   * Summarizes multi-item comparisons
   */
  static summarizeProducts(products: NormalizedProduct[]): ComparisonSummary {
    if (products.length === 0) {
      return {
        comparedCount: 0,
        bestOverallId: '',
        keyDifferentiators: [],
      };
    }

    const keyDifferentiators: string[] = [];
    const prices = products.map((p) => p.price.amount);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (maxPrice > minPrice) {
      keyDifferentiators.push(
        `Price spans from ₹${minPrice.toLocaleString('en-IN')} to ₹${maxPrice.toLocaleString('en-IN')}`
      );
    }

    const ramOptions = Array.from(new Set(products.map((p) => p.specifications['ram']).filter(Boolean)));
    if (ramOptions.length > 1) {
      keyDifferentiators.push(`RAM options include ${ramOptions.join(', ')}`);
    }

    const pairwiseComparisons: ComparisonSummary['pairwiseComparisons'] = [];
    if (products.length >= 2) {
      pairwiseComparisons.push({
        itemAId: products[0].id,
        itemBId: products[1].id,
        summary: this.comparePair(products[0], products[1]),
      });
    }

    return {
      comparedCount: products.length,
      bestOverallId: products[0].id,
      keyDifferentiators,
      pairwiseComparisons,
    };
  }
}
