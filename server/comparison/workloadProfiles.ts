import type { UserObjective, WorkloadProfile } from './types';
import type { SearchRequirements } from '../types/agent';

export const WORKLOAD_PROFILES: Record<string, WorkloadProfile> = {
  gaming: {
    name: 'gaming',
    description: 'High graphics processing, fast refresh rate display, and sustained thermal dissipation',
    priorities: ['gpu', 'cpu', 'display', 'thermals'],
    weightOverrides: {
      gpu: 0.35,
      cpu: 0.25,
      price: 0.15,
      ram: 0.15,
      rating: 0.10,
    },
  },
  machine_learning: {
    name: 'machine_learning',
    description: 'High CUDA core count, VRAM capacity, system RAM, and multithreaded CPU performance',
    priorities: ['gpu', 'vram', 'ram', 'cpu'],
    weightOverrides: {
      gpu: 0.35,
      ram: 0.25,
      cpu: 0.20,
      price: 0.10,
      storage: 0.10,
    },
  },
  video_editing: {
    name: 'video_editing',
    description: 'Hardware video encoders/decoders, color-accurate display, high RAM, and fast NVMe storage',
    priorities: ['gpu', 'cpu', 'ram', 'storage', 'display'],
    weightOverrides: {
      cpu: 0.25,
      gpu: 0.25,
      ram: 0.20,
      storage: 0.15,
      price: 0.15,
    },
  },
  coding: {
    name: 'coding',
    description: 'Fast compilation CPU, 16GB+ RAM, comfortable keyboard, and battery longevity',
    priorities: ['cpu', 'ram', 'storage', 'battery'],
    weightOverrides: {
      cpu: 0.30,
      ram: 0.30,
      price: 0.20,
      storage: 0.10,
      rating: 0.10,
    },
  },
  office: {
    name: 'office',
    description: 'Affordable price, long battery life, light portability, and smooth multitasking',
    priorities: ['battery', 'price', 'ram', 'portability'],
    weightOverrides: {
      price: 0.40,
      rating: 0.20,
      ram: 0.20,
      cpu: 0.20,
    },
  },
};

/**
 * Detect user objective based on search criteria and keywords
 */
export function detectObjective(reqs: SearchRequirements, text: string = ''): UserObjective {
  const combined = `${text} ${reqs.sortPreference || ''} ${reqs.keywords?.join(' ') || ''}`.toLowerCase();

  if (combined.includes('cheapest') || combined.includes('lowest price') || combined.includes('most affordable') || combined.includes('budget option')) {
    return 'CHEAPEST';
  }
  if (combined.includes('best value') || combined.includes('value for money') || combined.includes('worth')) {
    return 'BEST_VALUE';
  }
  if (combined.includes('fastest') || combined.includes('quickest') || combined.includes('shortest duration')) {
    return 'FASTEST';
  }
  if (combined.includes('top rated') || combined.includes('highest rating') || combined.includes('best reviewed')) {
    return 'HIGHEST_RATED';
  }
  if (combined.includes('best') || combined.includes('highest performance') || combined.includes('flagship') || combined.includes('fast') || combined.includes('powerful')) {
    return 'BEST_PERFORMANCE';
  }

  return 'BALANCED';
}

/**
 * Detect workload profile from requirements
 */
export function detectWorkload(reqs: SearchRequirements, text: string = ''): WorkloadProfile | null {
  const combined = `${text} ${reqs.keywords?.join(' ') || ''}`.toLowerCase();

  if (combined.includes('game') || combined.includes('gaming') || combined.includes('rtx') || combined.includes('fps')) {
    return WORKLOAD_PROFILES.gaming;
  }
  if (combined.includes('machine learning') || combined.includes('ml') || combined.includes('ai') || combined.includes('deep learning')) {
    return WORKLOAD_PROFILES.machine_learning;
  }
  if (combined.includes('video editing') || combined.includes('premiere') || combined.includes('davinci') || combined.includes('render')) {
    return WORKLOAD_PROFILES.video_editing;
  }
  if (combined.includes('code') || combined.includes('coding') || combined.includes('development') || combined.includes('programming')) {
    return WORKLOAD_PROFILES.coding;
  }
  if (combined.includes('office') || combined.includes('college') || combined.includes('study') || combined.includes('student')) {
    return WORKLOAD_PROFILES.office;
  }

  return null;
}

/**
 * Dynamically computes factor weights based on objective, domain, and workload
 */
export function getDynamicWeights(
  objective: UserObjective,
  category: string = 'product',
  workload?: WorkloadProfile | null
): Record<string, number> {
  if (category === 'bus') {
    switch (objective) {
      case 'CHEAPEST':
        return { price: 0.60, departureTime: 0.15, duration: 0.15, rating: 0.10 };
      case 'FASTEST':
        return { duration: 0.50, departureTime: 0.20, price: 0.20, rating: 0.10 };
      case 'HIGHEST_RATED':
        return { rating: 0.50, price: 0.20, duration: 0.15, departureTime: 0.15 };
      default:
        return { price: 0.35, duration: 0.25, departureTime: 0.20, rating: 0.20 };
    }
  }

  if (category === 'hotel') {
    switch (objective) {
      case 'CHEAPEST':
        return { price: 0.60, rating: 0.20, amenities: 0.20 };
      case 'HIGHEST_RATED':
        return { rating: 0.50, amenities: 0.25, price: 0.25 };
      default:
        return { price: 0.40, rating: 0.35, amenities: 0.25 };
    }
  }

  // Product / Electronics Domain
  if (workload && workload.weightOverrides) {
    if (objective === 'CHEAPEST') {
      // Invert to heavily weight price even if gaming/workload specified
      return {
        price: 0.50,
        gpu: (workload.weightOverrides['gpu'] || 0.2) * 0.5,
        cpu: (workload.weightOverrides['cpu'] || 0.2) * 0.5,
        ram: (workload.weightOverrides['ram'] || 0.2) * 0.5,
        rating: 0.10,
      };
    }
    return { ...workload.weightOverrides };
  }

  switch (objective) {
    case 'CHEAPEST':
      return { price: 0.60, performance: 0.15, ram: 0.15, rating: 0.10 };
    case 'BEST_PERFORMANCE':
      return { performance: 0.40, ram: 0.25, cpu: 0.20, price: 0.10, rating: 0.05 };
    case 'HIGHEST_RATED':
      return { rating: 0.45, price: 0.25, performance: 0.15, ram: 0.15 };
    case 'BEST_VALUE':
    default:
      return { price: 0.35, performance: 0.25, ram: 0.20, rating: 0.20 };
  }
}
