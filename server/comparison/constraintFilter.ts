import type { SearchRequirements } from '../types/agent';
import type { NormalizedProduct, NormalizedBusResult } from '../types/provider';
import type { ConstraintEvaluation } from './types';

export class ConstraintFilter {
  /**
   * Filter normalized products against hard constraints
   */
  static filterProducts(
    products: NormalizedProduct[],
    requirements: SearchRequirements
  ): ConstraintEvaluation<NormalizedProduct> {
    const eligible: NormalizedProduct[] = [];
    const excluded: ConstraintEvaluation<NormalizedProduct>['excluded'] = [];
    const partialMatches: ConstraintEvaluation<NormalizedProduct>['partialMatches'] = [];
    const unmetList: string[] = [];

    const maxBudget = requirements.budget?.max;
    const minRamGb = requirements.constraints?.['minRamGb'] || this.parseMinRamFromReqs(requirements);
    const requiredGpuPrefix = requirements.constraints?.['gpu'] || this.parseRequiredGpu(requirements);
    const effectiveProfile = (requirements as any).effectivePreferences || requirements.profile;
    const excludedBrands: string[] = effectiveProfile?.shopping?.excludedBrands || [];

    for (const product of products) {
      let isEligible = true;
      let violatedReason = '';
      let violatedConstraint = '';
      const matchedConstraints: string[] = [];
      const unmetConstraints: string[] = [];

      // 1. Hard Constraint: Budget
      if (maxBudget !== undefined && maxBudget > 0) {
        if (product.price.amount > 0 && product.price.amount <= maxBudget) {
          matchedConstraints.push(`Under budget ₹${maxBudget.toLocaleString('en-IN')}`);
        } else {
          isEligible = false;
          violatedConstraint = 'budget';
          violatedReason =
            product.price.amount > 0
              ? `Price ₹${product.price.amount.toLocaleString('en-IN')} exceeds hard budget limit of ₹${maxBudget.toLocaleString('en-IN')}`
              : `Price is not available to verify against hard budget limit of ₹${maxBudget.toLocaleString('en-IN')}`;
          unmetConstraints.push(
            product.price.amount > 0
              ? `Exceeds budget by ₹${(product.price.amount - maxBudget).toLocaleString('en-IN')}`
              : `Price unverified`
          );
        }
      }

      // 2. Hard Constraint: Minimum RAM (if requested)
      if (minRamGb !== undefined && minRamGb > 0) {
        const productRamGb = this.extractRamGb(product.specifications['ram'] || product.title);
        if (productRamGb !== null) {
          if (productRamGb >= minRamGb) {
            matchedConstraints.push(`RAM ${productRamGb}GB >= ${minRamGb}GB`);
          } else {
            isEligible = false;
            violatedConstraint = 'minRamGb';
            violatedReason = `RAM capacity of ${productRamGb}GB is below required minimum of ${minRamGb}GB`;
            unmetConstraints.push(`RAM ${productRamGb}GB < ${minRamGb}GB`);
          }
        }
      }

      // 3. Hard Constraint: Required GPU (if strictly required)
      if (requiredGpuPrefix) {
        const specGpu = (product.specifications['gpu'] || product.title).toLowerCase();
        if (specGpu.includes(requiredGpuPrefix.toLowerCase())) {
          matchedConstraints.push(`GPU contains ${requiredGpuPrefix}`);
        } else {
          isEligible = false;
          violatedConstraint = 'gpu';
          violatedReason = `Does not include required GPU (${requiredGpuPrefix})`;
          unmetConstraints.push(`Missing required GPU ${requiredGpuPrefix}`);
        }
      }

      // 4. Hard Constraint: Excluded Brands
      if (excludedBrands.length > 0) {
        const isExcluded = excludedBrands.some(
          (b) => product.brand?.toLowerCase() === b.toLowerCase() || product.title.toLowerCase().includes(b.toLowerCase())
        );
        if (isExcluded) {
          isEligible = false;
          violatedConstraint = 'excluded_brand';
          violatedReason = `Matches excluded brand (${product.brand || 'specified'})`;
          unmetConstraints.push(`Excluded brand ${product.brand}`);
        }
      }

      // 5. Hard Constraint: Explicit Requested Brand
      const requiredBrand = (requirements.brand || (requirements.constraints?.brand as string))?.toLowerCase();
      if (requiredBrand) {
        const prodBrand = (product.brand || '').toLowerCase();
        const prodTitle = product.title.toLowerCase();
        if (prodBrand === requiredBrand || prodTitle.includes(requiredBrand)) {
          matchedConstraints.push(`Matches requested brand ${requiredBrand.toUpperCase()}`);
        } else {
          isEligible = false;
          violatedConstraint = 'brand';
          violatedReason = `Does not match requested brand (${requiredBrand.toUpperCase()})`;
          unmetConstraints.push(`Missing requested brand ${requiredBrand.toUpperCase()}`);
        }
      }

      if (isEligible) {
        eligible.push(product);
      } else {
        excluded.push({
          item: product,
          violatedConstraint,
          reason: violatedReason,
        });

        // Evaluate if product qualifies as a "close match" (e.g. within 15% budget or satisfies other specs)
        const budgetDelta = maxBudget ? product.price.amount - maxBudget : 0;
        const isCloseBudget = maxBudget ? budgetDelta <= maxBudget * 0.15 : false;

        if (isCloseBudget || matchedConstraints.length > 0) {
          const totalChecks = matchedConstraints.length + unmetConstraints.length;
          partialMatches.push({
            item: product,
            matchedConstraints,
            unmetConstraints,
            matchRatio: totalChecks > 0 ? matchedConstraints.length / totalChecks : 0.5,
          });
        }
      }
    }

    const hasMatches = eligible.length > 0;
    const suggestedRelaxations: string[] = [];

    if (!hasMatches) {
      if (maxBudget) {
        if (products.length > 0) {
          const validPriced = products.filter((p) => p.price.amount > 0);
          const minAvailablePrice = validPriced.length > 0 ? Math.min(...validPriced.map((p) => p.price.amount)) : Infinity;
          if (isFinite(minAvailablePrice) && minAvailablePrice > maxBudget) {
            suggestedRelaxations.push(`Increase budget to at least ₹${minAvailablePrice.toLocaleString('en-IN')}`);
          } else {
            suggestedRelaxations.push(`Increase budget above ₹${maxBudget.toLocaleString('en-IN')}`);
          }
        } else {
          suggestedRelaxations.push(`Increase budget above ₹${maxBudget.toLocaleString('en-IN')}`);
        }
      }
      if (minRamGb) {
        suggestedRelaxations.push(`Relax RAM requirement from ${minRamGb}GB to 8GB`);
      }
      if (requiredGpuPrefix) {
        suggestedRelaxations.push(`Consider alternatives without mandatory ${requiredGpuPrefix} GPU`);
      }
    }

    return {
      eligible,
      excluded,
      partialMatches,
      hasMatches,
      suggestedRelaxations: suggestedRelaxations.length > 0 ? suggestedRelaxations : undefined,
    };
  }

  /**
   * Filter normalized buses against hard transit constraints
   */
  static filterBuses(
    buses: NormalizedBusResult[],
    requirements: SearchRequirements
  ): ConstraintEvaluation<NormalizedBusResult> {
    const eligible: NormalizedBusResult[] = [];
    const excluded: ConstraintEvaluation<NormalizedBusResult>['excluded'] = [];
    const partialMatches: ConstraintEvaluation<NormalizedBusResult>['partialMatches'] = [];

    const reqSource = requirements.source?.toLowerCase().trim();
    const reqDest = requirements.destination?.toLowerCase().trim();
    const departureAfter = requirements.departureAfter; // e.g. "18:00"
    const reqBusType = requirements.preferences?.['busType']?.toLowerCase();
    const maxBudget = requirements.budget?.max;
    const effectiveProfile = (requirements as any).effectivePreferences || requirements.profile;
    const excludedOperators: string[] = effectiveProfile?.travel?.excludedOperators || [];

    for (const bus of buses) {
      let isEligible = true;
      let violatedReason = '';
      let violatedConstraint = '';
      const matchedConstraints: string[] = [];
      const unmetConstraints: string[] = [];

      // 1. Route match (source & destination)
      if (reqSource && !bus.source.toLowerCase().includes(reqSource)) {
        isEligible = false;
        violatedConstraint = 'source';
        violatedReason = `Bus departs from ${bus.source}, not requested ${requirements.source}`;
        unmetConstraints.push(`Source mismatch: ${bus.source}`);
      } else {
        matchedConstraints.push('Source matches');
      }

      if (reqDest && !bus.destination.toLowerCase().includes(reqDest)) {
        isEligible = false;
        violatedConstraint = 'destination';
        violatedReason = `Bus arrives at ${bus.destination}, not requested ${requirements.destination}`;
        unmetConstraints.push(`Destination mismatch: ${bus.destination}`);
      } else {
        matchedConstraints.push('Destination matches');
      }

      // Hard Constraint: Excluded Operators
      if (excludedOperators.length > 0) {
        const isExcluded = excludedOperators.some((op) =>
          bus.operator.toLowerCase().includes(op.toLowerCase())
        );
        if (isExcluded) {
          isEligible = false;
          violatedConstraint = 'excluded_operator';
          violatedReason = `Matches excluded operator (${bus.operator})`;
          unmetConstraints.push(`Excluded operator ${bus.operator}`);
        }
      }

      // 2. Departure Time After (e.g. after 6 PM / 18:00)
      if (departureAfter) {
        const busMinutes = this.timeStringToMinutes(bus.departureTime);
        const reqMinutes = this.timeStringToMinutes(departureAfter);

        if (busMinutes < reqMinutes) {
          isEligible = false;
          violatedConstraint = 'departureAfter';
          violatedReason = `Departs at ${bus.departureTime}, earlier than requested cutoff of ${departureAfter}`;
          unmetConstraints.push(`Departs before ${departureAfter}`);
        } else {
          matchedConstraints.push(`Departs after ${departureAfter}`);
        }
      }

      // 3. Bus Type match (e.g. AC Sleeper)
      if (reqBusType) {
        const busTypeLower = (bus.busType || '').toLowerCase();
        if (reqBusType.includes('sleeper') && !busTypeLower.includes('sleeper')) {
          isEligible = false;
          violatedConstraint = 'busType';
          violatedReason = `Bus type is ${bus.busType}, but user requested sleeper`;
          unmetConstraints.push('Not a sleeper bus');
        } else if (reqBusType.includes('ac') && !busTypeLower.includes('ac') && !busTypeLower.includes('a/c')) {
          isEligible = false;
          violatedConstraint = 'busType';
          violatedReason = `Bus type is ${bus.busType}, but user requested AC`;
          unmetConstraints.push('Non-AC bus');
        } else {
          matchedConstraints.push('Bus type matches');
        }
      }

      // 4. Budget
      if (maxBudget && bus.price.amount > maxBudget) {
        isEligible = false;
        violatedConstraint = 'budget';
        violatedReason = `Fare ₹${bus.price.amount} exceeds budget ₹${maxBudget}`;
        unmetConstraints.push('Exceeds budget');
      }

      if (isEligible) {
        eligible.push(bus);
      } else {
        excluded.push({ item: bus, violatedConstraint, reason: violatedReason });
        partialMatches.push({
          item: bus,
          matchedConstraints,
          unmetConstraints,
          matchRatio: matchedConstraints.length / (matchedConstraints.length + unmetConstraints.length || 1),
        });
      }
    }

    const hasMatches = eligible.length > 0;
    const suggestedRelaxations: string[] = [];

    if (!hasMatches) {
      if (departureAfter) suggestedRelaxations.push(`Expand departure window to include earlier buses before ${departureAfter}`);
      if (reqBusType) suggestedRelaxations.push('Consider standard or seater buses');
      if (maxBudget) suggestedRelaxations.push(`Increase travel budget above ₹${maxBudget}`);
    }

    return {
      eligible,
      excluded,
      partialMatches,
      hasMatches,
      suggestedRelaxations: suggestedRelaxations.length > 0 ? suggestedRelaxations : undefined,
    };
  }

  // --- Helper parsers ---
  private static parseMinRamFromReqs(reqs: SearchRequirements): number | undefined {
    const combined = `${reqs.keywords?.join(' ') || ''} ${JSON.stringify(reqs.constraints || {})}`.toLowerCase();
    const match = combined.match(/([0-9]+)\s*gb\s*(?:ram|memory)?/);
    if (match) return parseInt(match[1], 10);
    return undefined;
  }

  private static parseRequiredGpu(reqs: SearchRequirements): string | undefined {
    const combined = `${reqs.keywords?.join(' ') || ''}`.toLowerCase();
    if (combined.includes('rtx 4060')) return 'RTX 4060';
    if (combined.includes('rtx 4050')) return 'RTX 4050';
    if (combined.includes('rtx')) return 'RTX';
    return undefined;
  }

  private static extractRamGb(ramStr?: string): number | null {
    if (!ramStr) return null;
    const match = ramStr.match(/([0-9]+)\s*gb/i);
    return match ? parseInt(match[1], 10) : null;
  }

  private static timeStringToMinutes(timeStr: string): number {
    const clean = timeStr.trim().toLowerCase();
    let [hours, mins] = [0, 0];

    const isPM = clean.includes('pm');
    const isAM = clean.includes('am');
    const digitsOnly = clean.replace(/[^0-9:]/g, '');

    if (digitsOnly.includes(':')) {
      const parts = digitsOnly.split(':');
      hours = parseInt(parts[0], 10);
      mins = parseInt(parts[1], 10);
    } else {
      hours = parseInt(digitsOnly, 10);
      mins = 0;
    }

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    return hours * 60 + mins;
  }
}
