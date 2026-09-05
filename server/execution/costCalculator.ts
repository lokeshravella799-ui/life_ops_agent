import type { CostBreakdown } from './types';
import type { NormalizedProduct, NormalizedBusResult, NormalizedHotelResult, NormalizedFlightResult } from '../types/provider';

export class CostCalculator {
  /**
   * Deterministic mathematical cost calculation
   * basePrice + taxes + deliveryFee + convenienceFee + otherFees = total
   */
  static calculate(costs: {
    basePrice: number;
    taxes?: number;
    deliveryFee?: number;
    convenienceFee?: number;
    otherFees?: number;
    currency?: string;
  }): CostBreakdown {
    const basePrice = costs.basePrice;
    const currency = costs.currency || 'INR';
    const taxes = costs.taxes !== undefined ? costs.taxes : undefined;
    const deliveryFee = costs.deliveryFee !== undefined ? costs.deliveryFee : undefined;
    const convenienceFee = costs.convenienceFee !== undefined ? costs.convenienceFee : undefined;
    const otherFees = costs.otherFees !== undefined ? costs.otherFees : undefined;

    const total =
      basePrice +
      (taxes ?? 0) +
      (deliveryFee ?? 0) +
      (convenienceFee ?? 0) +
      (otherFees ?? 0);

    return {
      basePrice,
      taxes,
      deliveryFee,
      convenienceFee,
      otherFees,
      total: Number(total.toFixed(2)),
      currency,
      isTaxEstimated: taxes === undefined,
      isDeliveryEstimated: deliveryFee === undefined,
    };
  }

  /**
   * Deterministically calculate product order costs
   * Preserves provider currency, strictly avoids inventing unknown taxes/fees,
   * and preserves individual itemized components.
   */
  static calculateProductCost(
    product: any,
    options?: {
      taxes?: number;
      deliveryFee?: number;
      convenienceFee?: number;
      otherFees?: number;
    }
  ): CostBreakdown {
    const basePrice = typeof product?.price === 'number'
      ? product.price
      : (product?.price?.amount ?? 0);
    const currency = typeof product?.price === 'object' && product?.price?.currency
      ? product.price.currency
      : (product?.currency || 'INR');

    // Check delivery fee from normalized product delivery data
    let deliveryFee: number | undefined = undefined;
    if (options?.deliveryFee !== undefined) {
      deliveryFee = options.deliveryFee;
    } else if (product.delivery && typeof product.delivery.fee === 'number') {
      deliveryFee = product.delivery.fee;
    }

    const taxes = options?.taxes !== undefined ? options.taxes : undefined;
    const convenienceFee = options?.convenienceFee !== undefined ? options.convenienceFee : undefined;
    const otherFees = options?.otherFees !== undefined ? options.otherFees : undefined;

    // Mathematical sum of known items only
    const computedTotal =
      basePrice +
      (taxes ?? 0) +
      (deliveryFee ?? 0) +
      (convenienceFee ?? 0) +
      (otherFees ?? 0);

    return {
      basePrice,
      taxes,
      deliveryFee,
      convenienceFee,
      otherFees,
      total: Number(computedTotal.toFixed(2)),
      currency,
      isTaxEstimated: taxes === undefined,
      isDeliveryEstimated: deliveryFee === undefined,
    };
  }

  /**
   * Deterministically calculate transit or booking costs (Bus, Hotel, Flight)
   */
  static calculateBookingCost(
    item: any,
    options?: {
      taxes?: number;
      convenienceFee?: number;
      otherFees?: number;
    }
  ): CostBreakdown {
    const basePrice = typeof item?.price === 'number'
      ? item.price
      : (item?.price?.amount ?? 0);
    const currency = typeof item?.price === 'object' && item?.price?.currency
      ? item.price.currency
      : (item?.currency || 'INR');

    const taxes = options?.taxes !== undefined ? options.taxes : undefined;
    const convenienceFee = options?.convenienceFee !== undefined ? options.convenienceFee : undefined;
    const otherFees = options?.otherFees !== undefined ? options.otherFees : undefined;

    const computedTotal =
      basePrice +
      (taxes ?? 0) +
      (convenienceFee ?? 0) +
      (otherFees ?? 0);

    return {
      basePrice,
      taxes,
      convenienceFee,
      otherFees,
      total: Number(computedTotal.toFixed(2)),
      currency,
      isTaxEstimated: taxes === undefined,
    };
  }
}
