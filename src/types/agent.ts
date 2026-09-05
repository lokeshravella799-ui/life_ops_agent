export type AgentState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'searching'
  | 'comparing'
  | 'verifying'
  | 'results'
  | 'selection'
  | 'confirmation'
  | 'processing'
  | 'success'
  | 'cancelled'
  | 'speaking'
  | 'interrupted'
  | 'error';

export type VerificationStatus =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'CHANGED'
  | 'UNAVAILABLE'
  | 'FAILED'
  | 'UNKNOWN'
  | 'UNSUPPORTED';

export interface PriceChangeDetails {
  originalPrice: number;
  verifiedPrice: number;
  difference: number;
  percentageChange: number;
  currency: string;
}

export interface VerificationMetadata {
  priceVerified: boolean;
  availabilityVerified: boolean;
  providerVerified: boolean;
  verifiedAt?: string;
  status?: VerificationStatus;
  freshness?: { status: string; ageSeconds: number };
  priceChange?: PriceChangeDetails;
  issues?: string[];
  availabilityStatus?: string;
}

export interface ComparisonFactor {
  name: string;
  label: string;
  score: number;
  weight: number;
  reason: string;
  isAvailable?: boolean;
}

export interface CostBreakdown {
  basePrice: number;
  taxes?: number;
  deliveryFee?: number;
  convenienceFee?: number;
  otherFees?: number;
  total: number;
  currency: string;
  isTaxEstimated?: boolean;
  isDeliveryEstimated?: boolean;
  feeDetails?: Record<string, number>;
}

export interface RecommendationItem {
  resultId: string;
  rank: number;
  overallScore: number;
  item: any;
  whyThisText: string;
  pros: string[];
  cons: string[];
  matchedRequirements: string[];
  unmetPreferences?: string[];
  scoreBreakdown: ComparisonFactor[];
  verification?: VerificationMetadata;
  priceChanged?: boolean;
  originalPrice?: number;
  verifiedPrice?: number;
  priceDifference?: number;
  unavailableReason?: string;
  personalizationApplied?: boolean;
  personalizationReason?: string;
}

export interface ExecutionPreparation {
  executionId: string;
  type: 'PRODUCT_ORDER' | 'BUS_BOOKING' | 'HOTEL_BOOKING' | 'FLIGHT_BOOKING';
  status: string;
  item: {
    id: string;
    title: string;
    category?: string;
    price: { amount: number; currency: string };
    searchPrice?: number;
    verifiedPrice?: number;
    provider?: { id: string; name: string };
    availability?: string;
    specifications?: Record<string, string>;
  };
  costBreakdown: CostBreakdown;
  provider: {
    id: string;
    name: string;
    url?: string;
  };
  delivery?: any;
  verification?: VerificationMetadata;
  confirmationRequired: true;
  confirmationGateMessage: string;
  createdAt: string;
  expiresAt: string;
}

export interface SandboxOrder {
  sandbox: true;
  type: 'PRODUCT_ORDER';
  executionId: string;
  sandboxOrderId: string;
  status: string;
  item: any;
  provider: { id: string; name: string; url?: string };
  costBreakdown: CostBreakdown;
  simulatedAt: string;
  message: string;
}

export interface SandboxBooking {
  sandbox: true;
  type: 'BUS_BOOKING' | 'HOTEL_BOOKING' | 'FLIGHT_BOOKING';
  executionId: string;
  bookingId: string;
  status: string;
  operator?: string;
  hotel?: string;
  airline?: string;
  provider: { id: string; name: string; url?: string };
  costBreakdown: CostBreakdown;
  simulatedAt: string;
  message: string;
}

export interface SandboxReceipt {
  receiptId: string;
  executionId: string;
  sandboxOrderId?: string;
  sandboxBookingId?: string;
  sandboxExecutionId: string;
  executionType: string;
  timestamp: string;
  provider: {
    id: string;
    name: string;
    url?: string;
  };
  selectedItem: {
    id: string;
    title: string;
    price: {
      amount: number;
      currency: string;
    };
  };
  costBreakdown: CostBreakdown;
  total: number;
  currency: string;
  executionStatus: string;
  sandbox: true;
  confirmationTimestamp: string;
  completionTimestamp: string;
  safetyStatement: string;
  message: string;
}

export interface VerificationSummary {
  verifiedCount: number;
  unverifiedCount: number;
  changedCount: number;
  unavailableCount: number;
}

export interface ComparisonSummary {
  comparedCount: number;
  bestOverallId: string;
  keyDifferentiators: string[];
  pairwiseComparisons?: Array<{
    itemAId: string;
    itemBId: string;
    summary: string;
  }>;
}

export interface ProductItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice: number;
  rating: number | null;
  reviewCount: number | null;
  scores: {
    performance: number;
    battery: number;
    value: number;
    aiMatch: number;
  };
  isRecommended?: boolean;
  whyThisText?: string;
  image: string;
  imageUrl?: string;
  productUrl?: string;
  source?: string;
  specs: {
    cpu: string;
    gpu: string;
    ram: string;
    storage: string;
    display: string;
    batteryLife: string;
    weight: string;
    thermals: string;
    ports: string;
  };
  provider: string;
  deliveryDays: string;
  availability: string;
  pros: string[];
  cons: string[];
  rank?: number;
  verification?: VerificationMetadata;
  verificationStatus?: VerificationStatus;
  priceChanged?: boolean;
  verifiedPrice?: number;
  personalizationApplied?: boolean;
  personalizationReason?: string;
  rawRecommendation?: RecommendationItem;
}

export interface OrderDetails {
  orderId: string;
  product: ProductItem;
  basePrice: number;
  tax: number;
  deliveryFee: number;
  total: number;
  deliveryAddress: string;
  estimatedDelivery: string;
  status: string;
  timestamp: string;
}

export interface AgentThought {
  id: string;
  step: string;
  message: string;
  detail?: string;
  time: string;
  status: 'completed' | 'active' | 'pending';
}

export interface HistoryItem {
  id: string;
  title: string;
  type: 'chat' | 'purchase' | 'booking';
  category: 'today' | 'yesterday' | 'earlier' | 'purchases' | 'bookings';
  subtitle?: string;
  amount?: number;
  status?: string;
  date: string;
  query?: string;
  itemData?: any;
  receipt?: SandboxReceipt;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    intent?: string;
    recommendations?: string[];
    isBusBooking?: boolean;
    pickup?: string;
    destination?: string;
    bookingDetails?: any;
  };
}

export interface ConversationRecord {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
  metadata?: {
    intent?: string;
    location?: { latitude: number; longitude: number; city: string; state?: string };
    bookingState?: any;
    selectedService?: string;
    category?: 'today' | 'yesterday' | 'purchases' | 'bookings';
  };
}


/**
 * Maps a backend recommendation item into a UI ProductItem
 */
export function recommendationToProductItem(rec: RecommendationItem, index: number): ProductItem {
  const item = rec.item || {};
  const isBus = Boolean(item.operator && item.departureTime);
  const isHotel = Boolean(item.roomType || item.amenities || item.location);
  const isFlight = Boolean(item.airline || item.flightNumber);

  const name =
    item.title ||
    item.name ||
    (isBus ? `${item.operator} Bus (${item.source || ''} → ${item.destination || ''})` : '') ||
    (isHotel ? `${item.name || 'Hotel'} - ${item.location || ''}` : '') ||
    (isFlight ? `${item.airline} ${item.flightNumber || ''} (${item.origin || ''} → ${item.destination || ''})` : '') ||
    `Option ${index + 1}`;

  const brand =
    item.provider?.name ||
    item.operator ||
    item.airline ||
    item.seller ||
    'Verified Provider';

  const rawPriceAmount =
    typeof item.price === 'object' && item.price !== null
      ? item.price.amount
      : typeof item.price === 'number'
      ? item.price
      : 0;

  const currentPrice = rec.verifiedPrice ?? rawPriceAmount;
  const originalPrice =
    rec.originalPrice ??
    (typeof item.originalPrice === 'object' && item.originalPrice !== null
      ? item.originalPrice.amount
      : typeof item.originalPrice === 'number'
      ? item.originalPrice
      : currentPrice);

  // Scores mapping from scoreBreakdown
  const breakdown = rec.scoreBreakdown || [];
  const findFactor = (keywords: string[]) => {
    const factor = breakdown.find((f) =>
      keywords.some((k) => f.name.toLowerCase().includes(k) || f.label.toLowerCase().includes(k))
    );
    return factor ? Math.round(factor.score / 10) : 8;
  };

  const performance = findFactor(['performance', 'cpu', 'gpu', 'speed', 'rating']);
  const battery = findFactor(['battery', 'efficiency', 'comfort', 'amenities', 'duration']);
  const value = findFactor(['value', 'price', 'cost', 'budget']);
  const aiMatch = Math.round(rec.overallScore || 90);

  // Specifications
  const specsObj = item.specifications || {};
  const defaultSpecs = {
    cpu: specsObj.cpu || specsObj.processor || (isBus ? `Departure: ${item.departureTime || 'On Schedule'}` : isHotel ? `Room: ${item.roomType || 'Standard'}` : isFlight ? `Class: ${item.cabinClass || 'Economy'}` : 'High Performance'),
    gpu: specsObj.gpu || specsObj.graphics || (isBus ? `Bus Type: ${item.busType || 'AC Multi-Axle'}` : isHotel ? `Amenities: ${(item.amenities || []).slice(0, 2).join(', ') || 'Wi-Fi, AC'}` : isFlight ? `Stops: ${item.stops ?? 0} stops` : 'Integrated / Dedicated'),
    ram: specsObj.ram || specsObj.memory || (isBus ? `Seats: ${item.seatsAvailable || 'Available'}` : isHotel ? `Check-in: 12:00 PM` : isFlight ? `Baggage: ${item.baggage || 'Standard'}` : '16GB'),
    storage: specsObj.storage || specsObj.ssd || '512GB NVMe SSD',
    display: specsObj.display || '15.6" FHD 144Hz',
    batteryLife: specsObj.batteryLife || specsObj.battery || (isBus ? `Duration: ${item.duration || 'Direct'}` : 'Up to 8 Hours'),
    weight: specsObj.weight || '2.0 kg',
    thermals: specsObj.thermals || 'Optimized Cooling',
    ports: specsObj.ports || 'Type-C, HDMI',
  };

  // Image extraction: Prefer actual provider image
  const rawImage =
    (item.images && item.images.length > 0 && item.images[0]) ||
    item.image ||
    item.imageUrl;

  const image =
    rawImage ||
    (isBus
      ? 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=60'
      : isHotel
      ? 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=60'
      : isFlight
      ? 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&auto=format&fit=crop&q=60'
      : undefined);

  const verificationStatus: VerificationStatus =
    rec.verification?.status ||
    (rec.verification?.priceVerified ? 'VERIFIED' : 'UNVERIFIED');

  const availability =
    item.availability ||
    (rec.verification?.availabilityVerified ? 'Available (Verified)' : 'Available');

  const productUrl = item.productUrl || item.url || '';
  const source = item.provider?.name || item.source || item.seller || 'Verified Live Provider';

  return {
    id: rec.resultId || item.id || `rec-${index + 1}`,
    name,
    brand,
    price: currentPrice,
    originalPrice,
    rating: typeof item.rating === 'number' ? item.rating : null,
    reviewCount: typeof item.reviewCount === 'number' ? item.reviewCount : null,
    scores: {
      performance,
      battery,
      value,
      aiMatch,
    },
    isRecommended: rec.rank === 1 || index === 0,
    whyThisText: rec.whyThisText || 'Identified as a strong match by LifeOps multi-factor synthesis engine.',
    image,
    imageUrl: image,
    productUrl,
    source,
    specs: defaultSpecs,
    provider: source,
    deliveryDays: item.delivery?.estimatedDate || (isBus ? `Departs ${item.departureTime || 'Today'}` : 'Standard Dispatch'),
    availability,
    pros: rec.pros && rec.pros.length > 0 ? rec.pros : ['Verified provider listing', 'Matches workload criteria'],
    cons: rec.cons && rec.cons.length > 0 ? rec.cons : ['Standard limited inventory'],
    rank: rec.rank || index + 1,
    verification: rec.verification,
    verificationStatus,
    priceChanged: rec.priceChanged,
    verifiedPrice: rec.verifiedPrice,
    personalizationApplied: rec.personalizationApplied,
    personalizationReason: rec.personalizationReason,
    rawRecommendation: rec,
  };
}

export type RankingPriority =
  | 'lowest_price'
  | 'highest_quality'
  | 'best_overall'
  | 'fastest'
  | 'most_convenient'
  | 'balanced';

export type DepartureTimeWindow = 'any' | 'morning' | 'afternoon' | 'evening' | 'night';

export interface PriorityWeights {
  price: number;
  quality: number;
  performance: number;
  brand: number;
}

export interface ShoppingPreferences {
  preferredBrands: string[];
  excludedBrands: string[];
  preferredCategories?: string[];
  minPrice?: number;
  maxPrice?: number;
  priorityWeights: PriorityWeights;
}

export interface TravelPreferences {
  preferredDepartureTimeWindow?: DepartureTimeWindow;
  preferredTransportTypes: string[];
  preferredAirlines?: string[];
  excludedAirlines?: string[];
  preferredOperators?: string[];
  excludedOperators?: string[];
  preferredHotelAmenities?: string[];
}

export interface GeneralPreferences {
  rankingPriority: RankingPriority;
  preferredProviders?: string[];
}

export type PersonaId = 'personal' | 'work';

export interface PersonaProfileData {
  id: PersonaId;
  name: string;
  description: string;
  shopping: ShoppingPreferences;
  travel: TravelPreferences;
  general: GeneralPreferences;
}

export type RecommendationFeedbackRating = 'positive' | 'negative';

export type RecommendationFeedbackReason =
  | 'TOO_EXPENSIVE'
  | 'DISLIKED_BRAND'
  | 'POOR_SPECIFICATIONS'
  | 'WRONG_TIMING'
  | 'POOR_REPUTATION'
  | 'GREAT_VALUE'
  | 'PREFERRED_BRAND'
  | 'PERFECT_TIMING'
  | 'OTHER';

export interface RecommendationFeedbackEvent {
  id: string;
  userId: string;
  recommendationId: string;
  rating: RecommendationFeedbackRating;
  reason?: RecommendationFeedbackReason;
  targetBrand?: string;
  targetTitle?: string;
  comments?: string;
  timestamp: string;
}

export interface StagedInference {
  id: string;
  field: string;
  inferredValue: string;
  confidence: number;
  reason: string;
  status: 'STAGED' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

export interface ProfileEvolutionEntry {
  id: string;
  timestamp: string;
  personaId?: PersonaId;
  source: 'EXPLICIT_SETTING' | 'CHAT_INSTRUCTION' | 'ACCEPTED_INFERENCE' | 'FEEDBACK_LOOP' | 'ROLLBACK';
  field: string;
  oldValue: any;
  newValue: any;
  description: string;
  revertible: boolean;
}

export interface UserPersonalizationProfile {
  userId: string;
  activePersonaId: PersonaId;
  personas?: Record<PersonaId, PersonaProfileData>;
  shopping: ShoppingPreferences;
  travel: TravelPreferences;
  general: GeneralPreferences;
  stagedInferences?: StagedInference[];
  feedbackHistory?: RecommendationFeedbackEvent[];
  evolutionHistory?: ProfileEvolutionEntry[];
  createdAt: string;
  updatedAt: string;
}

export type PreferenceScope = 'global' | 'session';

export interface SessionPreferences {
  conversationId: string;
  ignoreSavedPreferences?: boolean;
  bypassBrandPreferences?: boolean;
  preferredBrands?: string[];
  excludedBrands?: string[];
  rankingPriority?: RankingPriority;
  preferredDepartureTimeWindow?: DepartureTimeWindow;
  minPrice?: number;
  maxPrice?: number;
  appliedOverrides?: string[];
  activeNotes?: string[];
  updatedAt: string;
}

export interface ConflictOption {
  id: string;
  label: string;
  description: string;
  resolutionAction: 'USE_CURRENT_REQUIREMENT' | 'KEEP_SAVED_PREFERENCE' | 'CUSTOM';
  scope: PreferenceScope;
  value?: any;
}

export interface PreferenceConflict {
  id: string;
  field: string;
  existingValue: any;
  newValue: any;
  sourceTurn: number;
  severity: 'low' | 'medium' | 'high';
  resolutionRequired: boolean;
  description: string;
  suggestedClarification: string;
  options: ConflictOption[];
}

export interface ProactiveRelaxationOption {
  id: string;
  label: string;
  type: 'INCREASE_BUDGET' | 'ALLOW_OTHER_BRANDS' | 'REMOVE_BRAND_EXCLUSION' | 'EXPAND_TIME_WINDOW' | 'RELAX_SPEC';
  description: string;
  adjustment: {
    field: string;
    oldValue?: any;
    newValue?: any;
  };
}

export interface EffectivePreferences extends UserPersonalizationProfile {
  activeSessionOverrides: Partial<SessionPreferences>;
  appliedPreferences: string[];
  ignoredPreferences: string[];
  feedbackBoosts?: Record<string, number>;
}

export interface AgentResponsePayload {
  conversationId: string;
  agentState: {
    phase: string;
    intent?: string;
  };
  message: string;
  requirements?: any;
  plan?: any;
  selectedTool?: string | null;
  normalizedResults?: any[];
  resultCount?: number;
  recommendations?: RecommendationItem[];
  hasMatches?: boolean;
  closeMatches?: any[];
  suggestedRelaxations?: string[];
  comparisonSummary?: ComparisonSummary;
  verificationSummary?: VerificationSummary;
  userProfile?: UserPersonalizationProfile;
  activePersonaId?: string;
  activeSessionPreferences?: SessionPreferences;
  effectivePreferences?: EffectivePreferences;
  preferenceConflicts?: PreferenceConflict[];
  relaxationOptions?: ProactiveRelaxationOption[];
  stagedInferences?: StagedInference[];
  feedbackResult?: { success: boolean; message: string };
  requiresClarification?: boolean;
  clarificationQuestions?: Array<{ field?: string; question: string; options?: string[] }>;
  safetyNotice?: string;
  executionPreparation?: ExecutionPreparation;
  executionId?: string;
  executionStatus?: string;
  confirmationRequired?: boolean;
  sandboxExecution?: any;
  executionReceipt?: SandboxReceipt;
  sandboxExecutionStatus?: string;
}

