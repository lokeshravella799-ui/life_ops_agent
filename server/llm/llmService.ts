import type { IntentType, SearchRequirements, AgentPlan } from '../types/agent';
import type { PreferenceUpdateCommand } from '../types/personalization';
import { getLLMProvider, LLMProvider } from './provider';
import { liveDataService } from '../services/liveDataService';
import { logger } from '../utils/logger';

export interface LLMIntentResult {
  intent: IntentType;
  confidence: number;
  reasoning: string;
}

export interface LLMExtractionResult {
  requirements: SearchRequirements;
  isModification: boolean;
  confidence: number;
}

export interface LLMPlanResult {
  plan: AgentPlan;
}

export class LLMService {
  get provider(): LLMProvider {
    return getLLMProvider();
  }

  get activeModel(): string {
    return this.provider.model;
  }

  get activeProviderName(): string {
    return this.provider.name;
  }

  /**
   * Universal Structured Intent Classification
   */
  async classifyIntent(
    text: string,
    context?: { previousIntent?: IntentType; pendingExecution?: any; previousRecommendations?: any[] }
  ): Promise<LLMIntentResult> {
    const clean = text.trim();
    const lower = clean.toLowerCase();

    // 1. Cancellation Request
    // e.g. "cancel", "cancel it", "don't proceed", "do not proceed", "abort", "stop", "nevermind", "don't book"
    if (
      lower.match(/^(cancel(\s+(it|this|order|booking|preparation|the\s+order|the\s+booking))?|don'?t\s+proceed|do\s+not\s+proceed|don'?t\s+book|do\s+not\s+book|abort|stop|nevermind)[\s!.]*$/i)
    ) {
      return {
        intent: 'CANCELLATION_REQUEST',
        confidence: 0.95,
        reasoning: 'User requested cancellation or aborting current flow.',
      };
    }

    // 1.1 Persona Switch Request
    // e.g. "switch to work profile", "switch to personal persona", "switch to work", "use work profile", "switch persona to personal"
    if (
      lower.match(/^(?:switch\s+(?:to\s+)?(?:persona\s+to\s+|profile\s+to\s+)?(work|personal)(\s+persona|\s+profile)?|use\s+(?:my\s+)?(work|personal)\s+(?:persona|profile)|change\s+to\s+(work|personal)\s+(?:persona|profile))[\s!.]*$/i) ||
      lower.match(/^switch\s+(to\s+)?(work|personal)[\s!.]*$/i)
    ) {
      return {
        intent: 'PERSONA_SWITCH',
        confidence: 0.97,
        reasoning: 'User requested switching active persona profile.',
      };
    }

    // 1.2 Feedback Submission
    // e.g. "thumbs up on option 1", "thumbs down", "good recommendation", "too expensive for an acer", "disliked this option"
    if (
      lower.match(/^(?:thumbs\s+(?:up|down)|feedback:|\+1|-1|good\s+recommendation|bad\s+recommendation|great\s+choice|poor\s+choice|disliked\s+(?:this|option|brand)|too\s+expensive\s+for|wrong\s+timing\s+for)/i) ||
      lower.match(/^(?:i\s+like|i\s+dislike|i\s+love|i\s+hate)\s+(?:this\s+option|option\s+\d+|this\s+recommendation)/i)
    ) {
      return {
        intent: 'FEEDBACK_SUBMISSION',
        confidence: 0.95,
        reasoning: 'User provided structured explicit feedback on a recommendation.',
      };
    }

    // 2. Explicit Personalization / Preference Update Request
    // e.g. "I prefer ASUS", "Only for this search, choose the cheapest", "For this trip, prefer morning buses", "Ignore my usual brand preference"
    const isScopedPreferenceLead = Boolean(
      lower.match(
        /^(only\s+for\s+this\s+(?:search|query|turn|trip)|for\s+this\s+(?:trip|flight|bus|search)|this\s+time|just\s+for\s+now|ignore\s+my\s+usual|keep\s+my\s+usual|use\s+my\s+normal|don'?t\s+change\s+my\s+saved|actually,?\s*(?:remove|delete)|prioritize\s+price\s+for\s+this\s+search|keep\s+apple\s+as\s+the\s+priority)/i
      )
    );

    const isSearchLead = !isScopedPreferenceLead && Boolean(lower.match(/^(find|search|show|get|look for|recommend)\s+/i));

    if (!isSearchLead) {
      if (
        isScopedPreferenceLead ||
        lower.match(/^(?:yes,?\s*)?(?:please\s+)?(?:add|save|confirm|accept)\s+.*to\s+(?:my\s+)?profile/i) ||
        lower.match(/^(?:yes,?\s*)?(?:please\s+)?(?:add|save|confirm|accept)\s+(?:staged|inferred)?\s*(?:suggestion|inference|preference)/i) ||
        lower.match(/^(?:yes,?\s*)?(?:add|accept)\s+[a-z0-9\s-]+(?:\s+as\s+preferred|\s+to\s+preferred|\s+to\s+profile)/i) ||
        lower.match(/^(clear|reset)\s+(my\s+)?preferences/i) ||
        lower.match(/^(remember\s+that\s+)?i\s+(usually\s+|always\s+)?prefer\s+/i) ||
        lower.match(/^prefer\s+(morning|afternoon|evening|night|lowest\s+price|cheapest|quality|fastest|[a-z0-9]+)/i) ||
        lower.match(/^i\s+don'?t\s+like\s+/i) ||
        lower.match(/^don'?t\s+show\s+(me\s+)?/i) ||
        lower.match(/^never\s+show\s+(me\s+)?/i) ||
        lower.match(/^exclude\s+(brand\s+)?/i) ||
        lower.match(/^(actually,?\s*)?(prioritize|focus\s+on)\s+(price|cost|quality|performance|speed|fastest)/i) ||
        lower.match(/^(actually,?\s*)?i\s+(usually\s+|always\s+)?want\s+(the\s+)?(cheapest|lowest\s+price|highest\s+quality|best\s+performance|fastest|something\s+cheap|cheap)(\s+option)?/i) ||
        lower.match(/^this\s+time,?\s*i\s+don'?t\s+care\s+about\s+brand/i)
      ) {
        return {
          intent: 'PREFERENCE_UPDATE',
          confidence: 0.96,
          reasoning: 'User explicitly stated a persistent or session-scoped preference or priority constraint.',
        };
      }
    }

    // 3. Transaction / Confirmation / Selection Request detection
    // e.g. "Yes", "Confirm", "Yes, confirm it", "Proceed", "Authorize", "Accept"
    // e.g. "the second one", "option 2", "I want the second option", "select the ASUS", "option 99", "the tenth one"
    const isAffirmativeConfirmation =
      lower.match(/^(yes(\s*,\s*|\s+)?(confirm(\s+it)?|proceed|authorize|please)?|confirm(\s+it|\s+order|\s+booking|\s+execution)?|proceed(\s+with(\s+it)?)?|authorize|accept|go\s+ahead)[\s!.]*$/i);

    const isExplicitSelection =
      lower.match(/^(the\s+)?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|1st|2nd|3rd|4th|5th|\d+(?:st|nd|rd|th)?)\s+(one|option|item|choice|product|bus|hotel|flight)[\s!.]*$/i) ||
      lower.match(/^(option|item|choice|number|#)\s*\d+[\s!.]*$/i) ||
      lower.match(/^(book|buy|purchase|pay for|reserve|order)\s+(the\s+)?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|1st|2nd|3rd|4th|5th|\d+(?:st|nd|rd|th)?|this|that|it|option|one|\d+)/i) ||
      lower.match(/^(i\s+want|i'll\s+take|ill\s+take|select|choose|pick|go\s+with)\s+(the\s+)?([a-zA-Z0-9\s-]+)$/i) ||
      lower.match(/^(select|choose|pick)\s+(the\s+)?([a-zA-Z0-9\s-]+)$/i) ||
      lower.match(/^(order|book)\s+(this|the)\s+([a-zA-Z0-9\s-]+)$/i) ||
      lower.match(/^(book|buy|purchase)\s+it$/i);

    if (isAffirmativeConfirmation || isExplicitSelection) {
      return {
        intent: 'TRANSACTION_REQUEST',
        confidence: 0.96,
        reasoning: isAffirmativeConfirmation
          ? 'User explicitly confirmed an action or transaction.'
          : 'User explicitly expressed intent to select or prepare an item for transaction.',
      };
    }

    // 4. Modification Request (preserves previous search context)
    // e.g., "Make it 60,000", "Actually increase my budget to ₹60,000", "Make the laptop budget ₹60,000", "Change to Bangalore", "Under 60000"
    const isSearchDomain = Boolean(
      context?.previousIntent &&
      ['PRODUCT_SEARCH', 'SHOPPING_SEARCH', 'BUS_SEARCH', 'HOTEL_SEARCH', 'FLIGHT_SEARCH'].includes(context.previousIntent)
    );

    const isEllipticalBudgetModifier = isSearchDomain && Boolean(
      lower.match(/^(?:actually\s+)?(?:under|below|within|max|budget(?:\s+of|\s+is)?)\s*(?:₹|rs\.?|inr\s*)?[0-9]+/i) ||
      lower.match(/^(?:only\s+)?(?:under|below|less\s+than)\s+[0-9]+/i) ||
      lower.match(/^(?:show\s+(?:me\s+)?)?(?:cheaper|more\s+affordable|lower\s+price|under\s+[0-9k]+)/i) ||
      lower.match(/\b(make\s+(?:it|them|this)\s+(?:cheaper|more\s+affordable)|cheaper\s+options?|show\s+cheaper)\b/i) ||
      lower.match(/^(?:cheaper|more\s+affordable|lowest\s+price|make\s+them\s+cheaper|make\s+it\s+cheaper)[\s!.]*$/i)
    );

    if (
      isEllipticalBudgetModifier ||
      lower.match(/^(actually\s+)?(make\s+(it|them|this|the\s+price)|increase|decrease|change|update|modify|set\s+(the\s+)?budget)/i) ||
      lower.match(/^(make\s+(the\s+)?(laptop|bus|hotel|flight)?\s*budget)/i) ||
      (lower.match(/^(what about|instead|change to)\s+/i) && context?.previousIntent)
    ) {
      return {
        intent: 'MODIFICATION_REQUEST',
        confidence: 0.94,
        reasoning: 'User is modifying previous search constraints or parameters.',
      };
    }

    // 4. Bus Search
    // e.g. "Find me an AC sleeper bus from Hyderabad to Bangalore", "Book me a bus"
    if (lower.includes('bus') || lower.includes('sleeper bus') || lower.includes('volvo')) {
      return {
        intent: 'BUS_SEARCH',
        confidence: 0.96,
        reasoning: 'Request concerns bus travel or transportation query.',
      };
    }

    // 5. Hotel Search
    if (lower.includes('hotel') || lower.includes('resort') || lower.includes('stay in') || lower.includes('room booking')) {
      return {
        intent: 'HOTEL_SEARCH',
        confidence: 0.95,
        reasoning: 'Request concerns accommodation or hotel booking.',
      };
    }

    // 6. Flight Search
    if (lower.includes('flight') || lower.includes('airline') || lower.includes('air ticket') || lower.includes('fly to')) {
      return {
        intent: 'FLIGHT_SEARCH',
        confidence: 0.95,
        reasoning: 'Request concerns flight booking.',
      };
    }

    // 7. General Questions & Informational Queries / Chat / Greeting
    // Check for informational, conversational, news, weather, stock, or knowledge queries
    const isGeneralInformational = Boolean(
      lower.match(/^(hi|hello|hey|greetings|good\s+(morning|evening|afternoon)|sup|yo)[\s!.]*$/i) ||
      lower.match(/^(who\s+are\s+you|what\s+can\s+you\s+do|how\s+does\s+this\s+work|help)[\s?.]*$/i) ||
      lower.match(/^(give\s+me|show\s+me|tell\s+me)\s+(today'?s?\s+)?(news|technology\s+news|weather|joke)/i) ||
      lower.match(/\b(joke|news|weather|stock\s+market|stock\s+price|current\s+events|capital\s+of|president\s+of|meaning\s+of|history\s+of)\b/i) ||
      lower.match(/^(what|who|where|when|why|how)\s+(is|are|was|were|do|does|did|can|could|would|should|invented|created|wrote|discovered|built|founded|to)\b/i) ||
      lower.match(/^(explain|define|describe|summarize|write|tell\s+me\s+about|give\s+me)\b/i) ||
      lower.match(/\b(recursion|quantum|algorithm|blockchain|physics|chemistry|biology|science|history|philosophy|recipe|breakfast|dinner|lunch|story|poem|code|program)\b/i)
    );

    // If query matches general informational patterns and does NOT contain explicit shopping budget/buying keywords:
    const hasCommercialShoppingIntent = Boolean(
      lower.match(/\b(under|below|budget|price|buy|purchase|store|discount|rupees|inr|₹)\b/i) &&
      lower.match(/\b(laptop|phone|smartphone|headphone|earphones|monitor|keyboard|mouse|shoes|watch|tv|tablet)\b/i)
    );

    if (isGeneralInformational && !hasCommercialShoppingIntent) {
      return {
        intent: 'GENERAL_CHAT',
        confidence: 0.96,
        reasoning: 'General conversational inquiry, informational question, or greeting.',
      };
    }

    // 8. General Product Search / Shopping
    // e.g. "Find me a laptop under 50000", "gaming laptop", "phone", "headphones", "shoes"
    const productKeywords = [
      'laptop',
      'thinkpad',
      'phone',
      'smartphone',
      'headphone',
      'earphones',
      'watch',
      'monitor',
      'keyboard',
      'mouse',
      'macbook',
      'ipad',
      'tablet',
      'tv',
      'camera',
      'gadget',
      'shoes',
      'shirt',
      'product',
      'item',
    ];
    if (
      productKeywords.some((k) => lower.includes(k)) ||
      lower.match(/^(find|search|show|get|recommend)\s+(me\s+)?(a|an|the|some)?\s*[a-zA-Z0-9\s]+/i)
    ) {
      return {
        intent: 'PRODUCT_SEARCH',
        confidence: 0.92,
        reasoning: 'Identified consumer product search query.',
      };
    }

    // Fallback if none matched: route to general conversational chat
    return {
      intent: 'GENERAL_CHAT',
      confidence: 0.7,
      reasoning: 'General conversational request.',
    };
  }

  /**
   * Universal Conversational and Informational Query Handler
   * Sends the user query to the real Groq LLM API.
   * Connects live real-time services for weather, news, and stock market queries.
   */
  async answerGeneralQuery(
    text: string,
    context?: {
      userProfile?: any;
      previousIntent?: IntentType;
      location?: {
        latitude?: number;
        longitude?: number;
        city?: string;
        state?: string;
        formattedAddress?: string;
      };
      conversationHistory?: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
      }>;
    }
  ): Promise<string> {
    const clean = text.trim();
    const lower = clean.toLowerCase();

    // 0. Live Device Location Query
    const isLocationQuery = Boolean(
      lower.match(/\b(what('?s| is) my (current )?location|where am i|can you fetch my location|fetch my location|get my location|detect my location|find my location|my coordinates|what city am i in|check my location|show my location)\b/i)
    );
    if (isLocationQuery) {
      if (context?.location && (context.location.city || context.location.formattedAddress || context.location.latitude)) {
        const readable = context.location.formattedAddress || `${context.location.city || 'Hyderabad'}, ${context.location.state || 'Telangana'}`;
        const coords = context.location.latitude && context.location.longitude
          ? ` (Coordinates: ${context.location.latitude.toFixed(4)}° N, ${context.location.longitude.toFixed(4)}° E)`
          : '';
        return `Your current location is ${readable}${coords}. I have access to your device location to provide nearby services, pickup points, and travel bookings.`;
      }
      return `Your permitted location is set to Hyderabad, Telangana. You can update or re-detect your live coordinates at any time via the location control.`;
    }

    // 1. Live Weather Query
    const isLiveWeatherQuery = Boolean(
      lower.match(/\b(today'?s?\s+weather|weather\s+today|current\s+weather|temperature\s+outside|forecast\s+today|weather\s+forecast|weather\s+near\s+me|weather)\b/i) &&
      !lower.match(/\b(laptop|phone|flight|bus|hotel|shirt|shoe)\b/i)
    );

    // 2. Live News Query
    const isLiveNewsQuery = Boolean(
      lower.match(/\b(today'?s?\s+news|breaking\s+news|latest\s+news|current\s+events|technology\s+news|news\s+today|happened\s+in\s+today'?s?\s+news|news\s+near\s+me|news)\b/i) &&
      !lower.match(/\b(laptop|phone|flight|bus|hotel|shirt|shoe)\b/i)
    );

    // 3. Live Stock / Market Query
    const isLiveStockQuery = Boolean(
      lower.match(/\b(stock\s+market|stock\s+price|market\s+today|sensex|nifty|nasdaq|crypto\s+price|happening\s+in\s+the\s+stock\s+market|reliance|tcs|infosys)\b/i) &&
      !lower.match(/\b(laptop|flight|bus|hotel)\b/i)
    );

    // Handle Live Weather
    if (isLiveWeatherQuery) {
      let targetCity: string | undefined = undefined;
      const inMatch = clean.match(/(?:\bin\b|\bfor\b|\bat\b|\bnear\b)\s+([a-zA-Z\s]+?)(?:\s+today|\s+now|\s*\?|$)/i);
      if (inMatch && !['me', 'here', 'now', 'today'].includes(inMatch[1].toLowerCase().trim())) {
        targetCity = inMatch[1].trim();
      } else if (context?.location?.city) {
        targetCity = context.location.city;
      }

      const weatherResult = await liveDataService.getWeather({
        city: targetCity,
        latitude: context?.location?.latitude,
        longitude: context?.location?.longitude,
      });

      if (weatherResult.needLocation) {
        return "Could you please tell me which city you'd like the weather for, or allow location access so I can check your local forecast?";
      }

      if (weatherResult.success && weatherResult.data) {
        const wd = weatherResult.data;
        const prompt = `You are LifeOps. Here is the verified real-time live weather data retrieved just now from Open-Meteo:
Location: ${wd.city}
Current Temperature: ${wd.temperature}°C
Condition: ${wd.condition}
Humidity: ${wd.humidity}%
Wind Speed: ${wd.windSpeed} km/h
Source: Open-Meteo (${wd.sourceUrl})

Answer the user's weather inquiry conversationally and clearly in 2 natural sentences for voice text-to-speech output. Mention the temperature, condition, and location clearly.`;

        try {
          const res = await this.provider.chatCompletion([
            { role: 'system', content: 'You are LifeOps, an intelligent personal AI assistant. Keep responses natural for voice synthesis.' },
            { role: 'user', content: prompt },
          ], { temperature: 0.3, max_tokens: 250 });
          if (res && res.trim()) return res.trim();
        } catch {
          return `Currently in ${wd.city}, it's ${wd.condition} at ${wd.temperature}°C with ${wd.humidity}% humidity and winds at ${wd.windSpeed} km/h (via Open-Meteo).`;
        }
      }
    }

    // Handle Live News
    if (isLiveNewsQuery) {
      let topic = '';
      if (lower.includes('tech') || lower.includes('technology')) topic = 'technology';
      else if (lower.includes('business') || lower.includes('economy')) topic = 'business';
      else if (lower.includes('sports')) topic = 'sports';

      const newsResult = await liveDataService.getNews(topic);
      if (newsResult.success && newsResult.items.length > 0) {
        const topArticles = newsResult.items.slice(0, 4);
        const articleList = topArticles
          .map((a, i) => `${i + 1}. "${a.title}" (Source: ${a.source})`)
          .join('\n');

        const prompt = `You are LifeOps. Here are the top live real-time news headlines retrieved right now from Google News:
${articleList}

Provide a natural, engaging 2 to 3 sentence spoken summary of these current top stories for text-to-speech output. Mention the top 2-3 stories and cite the primary publishers.`;

        try {
          const res = await this.provider.chatCompletion([
            { role: 'system', content: 'You are LifeOps, a helpful personal AI operator. Summarize current news clearly and conversationally.' },
            { role: 'user', content: prompt },
          ], { temperature: 0.4, max_tokens: 350 });
          if (res && res.trim()) return res.trim();
        } catch {
          return `Here are today's top stories: ${topArticles.map(a => a.title).join('. ')}`;
        }
      }
    }

    // Handle Live Stock Market
    if (isLiveStockQuery) {
      const stockResult = await liveDataService.getStock(clean);
      if (stockResult.success && stockResult.data) {
        const sd = stockResult.data;
        const prompt = `You are LifeOps. Here is the verified live real-time market data retrieved from Yahoo Finance:
Asset: ${sd.name} (${sd.symbol})
Current Price: ${sd.currency} ${sd.price.toLocaleString('en-IN')}
Change: ${sd.change >= 0 ? '+' : ''}${sd.change} (${sd.changePercent >= 0 ? '+' : ''}${sd.changePercent}%)
Source: Yahoo Finance (${sd.sourceUrl})

Provide a concise, conversational 1-2 sentence market update suitable for text-to-speech voice output.`;

        try {
          const res = await this.provider.chatCompletion([
            { role: 'system', content: 'You are LifeOps. Provide concise financial updates for voice output.' },
            { role: 'user', content: prompt },
          ], { temperature: 0.2, max_tokens: 200 });
          if (res && res.trim()) return res.trim();
        } catch {
          return `${sd.name} is currently trading at ${sd.currency} ${sd.price.toLocaleString('en-IN')}, ${sd.change >= 0 ? 'up' : 'down'} by ${sd.changePercent}% today (via Yahoo Finance).`;
        }
      }
    }

    // Standard General Knowledge / Conversational Queries
    try {
      if (!this.provider || !this.provider.isAvailable()) {
        logger.error('LLM provider is unavailable or missing API key', { provider: this.provider?.name });
        return 'AI service is temporarily unavailable. Please verify that GROQ_API_KEY is configured.';
      }

      const systemPrompt = `You are LifeOps, an intelligent, helpful personal AI operator and voice assistant.
Answer the user's question clearly, concisely, and conversationally in natural English suitable for text-to-speech voice output.
CRITICAL RULES:
1. Always maintain conversational continuity. If the user refers to previous context or requests follow-ups like "Explain in detail", "Give me an example", "Tell me more", or "Compare them", immediately continue the topic discussed in the recent turns. Never ask "What topic should I explain?".
2. Keep your answer direct, conversational, and typically 2 to 4 sentences unless a detailed explanation or code was explicitly asked.
3. For general knowledge, facts, science, technology, concepts, or jokes, answer accurately, engagingly, and helpfully.
4. For questions asking for code or programs, provide a clear, concise implementation.
5. Keep the language natural and fluid for text-to-speech voice output.`;

      // Format previous conversation turns if provided
      const recentTurns: import('./provider').ChatMessage[] = (context?.conversationHistory || [])
        .slice(-6)
        .map((m) => ({
          role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: m.content,
        }));

      const isFollowUp = Boolean(
        lower.match(/\b(explain in detail|explain more|give me an example|give an example|show me an example|simpler version|practice questions|what about the second one|tell me more|compare them)\b/i)
      );

      let contextualUserMessage = clean;
      if (isFollowUp && recentTurns.length > 0) {
        contextualUserMessage = `[Directive: Continue the previous discussion topic from the conversation turns above. Answer "${clean}" directly and thoroughly. Do NOT ask for topic clarification.]`;
      }

      const messages: import('./provider').ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...recentTurns,
        { role: 'user', content: contextualUserMessage },
      ];

      logger.info('Calling Groq LLM for general query', { promptPreview: clean.slice(0, 60), model: this.activeModel, historyTurns: recentTurns.length });

      const response = await this.provider.chatCompletion(messages, {
        temperature: 0.5,
        max_tokens: 650,
      });

      if (response && response.trim()) {
        return response.trim();
      }

      throw new Error('Empty response received from LLM provider.');
    } catch (err: any) {
      console.error(`[LLM] error in general query:`, err?.status || '', err?.message || err);
      logger.error('LLM provider general query error', { model: this.activeModel, error: err?.message, status: err?.status });
      return `Groq API Error (${this.activeModel}): ${err?.message || 'Unknown error'}. Please check server terminal logs and GROQ_API_KEY.`;
    }
  }

  /**
   * Generates EXACTLY 3 contextual recommendations tailored to the active query/topic
   */
  generate3Recommendations(
    intent?: string,
    query?: string,
    response?: string
  ): [string, string, string] {
    const combined = `${intent || ''} ${query || ''} ${response || ''}`.toLowerCase();

    if (
      combined.includes('bus') ||
      combined.includes('travel') ||
      combined.includes('chennai') ||
      combined.includes('hyderabad') ||
      combined.includes('route') ||
      combined.includes('pickup')
    ) {
      return ['Find buses to Chennai', 'Show cheaper options', 'Book the selected bus'];
    }

    if (
      combined.includes('laptop') ||
      combined.includes('phone') ||
      combined.includes('gaming') ||
      combined.includes('electronics') ||
      combined.includes('80000') ||
      combined.includes('flipkart') ||
      combined.includes('amazon')
    ) {
      return ['Compare these laptops', 'Show the best option', 'Find one under ₹80,000'];
    }

    if (
      combined.includes('c++') ||
      combined.includes('type conversion') ||
      combined.includes('python') ||
      combined.includes('code') ||
      combined.includes('programming') ||
      combined.includes('function') ||
      combined.includes('algorithm')
    ) {
      return ['Explain with an example', 'Show a simpler version', 'Give me practice questions'];
    }

    return ['Explain in detail', 'Give an everyday example', 'Tell me more'];
  }

  /**
   * Synthesizes a natural, conversational response from live structured search results using Groq LLM.
   * Eliminates hardcoded canned responses ("I understood your query...") and replaces them with real reasoning.
   */
  async synthesizeSearchResultsResponse(
    query: string,
    intent: IntentType,
    requirements: SearchRequirements,
    recommendations: any[],
    options?: {
      noMatchReason?: string;
      suggestedRelaxations?: string[];
      pickupLocation?: string;
    }
  ): Promise<string> {
    if (!this.provider || !this.provider.isAvailable()) {
      if (recommendations && recommendations.length > 0) {
        const isBus = intent === 'BUS_SEARCH' || Boolean(recommendations[0]?.item?.operator);
        const isHotel = intent === 'HOTEL_SEARCH';
        const isFlight = intent === 'FLIGHT_SEARCH';
        const itemNoun = isBus ? 'bus options' : isHotel ? 'hotel options' : isFlight ? 'flight options' : 'options';
        const route = isBus && requirements.source && requirements.destination
          ? ` from ${requirements.source} to ${requirements.destination}`
          : '';
        const loc = isHotel && requirements.destination ? ` in ${requirements.destination}` : '';
        const top = recommendations[0]?.item || recommendations[0];
        const topName = top.title || top.name || top.operator || 'verified option';
        const numPrice = typeof top.price === 'number' ? top.price : typeof top.price?.amount === 'number' ? top.price.amount : typeof top.searchPrice === 'number' ? top.searchPrice : 0;
        const topPrice = numPrice > 0 ? ` at ₹${numPrice.toLocaleString('en-IN')}` : '';
        return `I found ${recommendations.length} verified ${itemNoun}${route}${loc}. The top recommendation is ${topName}${topPrice}.`;
      }
      return 'AI service is temporarily unavailable. Please verify that GROQ_API_KEY is configured in your .env file.';
    }

    if (!recommendations || recommendations.length === 0) {
      const reason = options?.noMatchReason || 'No items satisfied all specified constraints.';
      const relax = options?.suggestedRelaxations?.length
        ? ` Suggestions: ${options.suggestedRelaxations.join('; ')}.`
        : '';
      const prompt = `The user asked: "${query}".
No matching items were found in our live search.
Reason: ${reason}.${relax}

Provide a helpful, concise 1 to 2 sentence explanation for voice text-to-speech output. Explain why no options were found and advise on how to adjust budget or criteria.`;

      try {
        const res = await this.provider.chatCompletion([
          { role: 'system', content: 'You are LifeOps, an autonomous personal AI operator. Keep responses natural and concise for voice output.' },
          { role: 'user', content: prompt },
        ], { temperature: 0.3, max_tokens: 200 });
        if (res && res.trim()) return res.trim();
      } catch {
        return `No matching options found for your search. ${reason}${relax}`;
      }
    }

    // Build structured items summary for Groq to reason over
    const isBus = intent === 'BUS_SEARCH' || Boolean(recommendations[0]?.item?.operator);
    const itemsSummary = recommendations.slice(0, 4).map((r, i) => {
      const it = r.item || r;
      if (isBus) {
        return `Option ${i + 1}: ${it.operator || 'Bus'} (${it.busType || 'Bus'}) — Price: ₹${it.price?.amount || it.price}, Departure: ${it.departureTime || 'Scheduled'}, Rating: ${it.rating || 'N/A'}/5, Seats: ${it.seatsAvailable ?? 'Available'}`;
      }
      const title = it.title || it.name || 'Product';
      const price = it.price?.amount || it.price || 'N/A';
      const source = it.provider?.name || it.source || 'Verified Merchant';
      const rating = it.rating ? `${it.rating}/5` : 'N/A';
      const specs = it.specifications ? Object.entries(it.specifications).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
      return `Option ${i + 1}: "${title}" — Price: ₹${typeof price === 'number' ? price.toLocaleString('en-IN') : price} on ${source}, Rating: ${rating}. ${specs}`;
    }).join('\n');

    const prompt = `User request: "${query}"
Domain: ${intent}
Structured Results Found: ${recommendations.length} verified options:
${itemsSummary}
${options?.pickupLocation ? `Pickup Location: ${options.pickupLocation}` : ''}

Task: Write a natural, spoken response (2 to 3 sentences) suitable for text-to-speech voice output.
CRITICAL RULES:
1. Speak directly as LifeOps, the user's personal AI operator.
2. Explicitly highlight Option 1 (Top Recommendation) with its title/model, price, and why it ranked #1.
3. Mention Option 2 or a key alternative if available.
4. NEVER output robotic canned phrases like "I understood your query..." or "I can help coordinate products, travel...".
5. Keep it conversational, crisp, and high-impact.`;

    try {
      const res = await this.provider.chatCompletion([
        { role: 'system', content: 'You are LifeOps, an autonomous personal AI operator and voice assistant. Respond with natural, conversational English suitable for voice text-to-speech.' },
        { role: 'user', content: prompt },
      ], { temperature: 0.3, max_tokens: 350 });

      if (res && res.trim()) {
        return res.trim();
      }
    } catch (err: any) {
      logger.error('Error in Groq search results synthesis', { error: err?.message });
    }

    // Fallback if Groq call is temporarily interrupted
    const top = recommendations[0]?.item || recommendations[0];
    const topName = top.title || top.name || top.operator || 'verified option';
    const numPrice = typeof top.price === 'number' ? top.price : typeof top.price?.amount === 'number' ? top.price.amount : typeof top.searchPrice === 'number' ? top.searchPrice : 0;
    const topPrice = numPrice > 0 ? ` at ₹${numPrice.toLocaleString('en-IN')}` : '';
    return `I found ${recommendations.length} verified options. The top recommendation is **${topName}**${topPrice}. Review the detailed specifications and comparisons below.`;
  }

  /**
   * Evaluates whether a new conversational turn should inherit previous search requirements
   * or establish a clean active domain search.
   */
  shouldInheritPreviousContext(
    message: string,
    currentIntent: IntentType,
    previousIntent?: IntentType,
    previousRequirements?: SearchRequirements
  ): boolean {
    // 0. Transaction and Cancellation flows always operate on active transaction context
    if (currentIntent === 'TRANSACTION_REQUEST' || currentIntent === 'CANCELLATION_REQUEST') {
      return true;
    }

    if (!previousRequirements && !previousIntent) return false;

    const clean = message.trim();
    const lower = clean.toLowerCase();

    // 1. Explicit modification or reference phrasing that signals continuity
    const isExplicitModification = Boolean(
      lower.match(/\b(make\s+it|make\s+the|change\s+to|change\s+the|increase|decrease|cheaper|more\s+expensive|less\s+expensive|another\s+one|another\s+option|what\s+about|instead|give\s+me\s+another|same\s+(date|route|city|budget|time|brand))\b/i) ||
      lower.match(/\b(the\s+)?(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s+(one|option|choice|item|bus|hotel|flight|laptop|product)\b/i) ||
      lower.match(/\b(that\s+(option|choice|item|bus|hotel|flight|laptop|product))\b/i) ||
      currentIntent === 'MODIFICATION_REQUEST'
    );

    const searchDomains: IntentType[] = ['BUS_SEARCH', 'HOTEL_SEARCH', 'FLIGHT_SEARCH', 'PRODUCT_SEARCH', 'SHOPPING_SEARCH'];
    const isConcreteSearchIntent = searchDomains.includes(currentIntent);
    const prevDomain = previousRequirements?.intent || previousIntent;

    // 2. Concrete domain switch detection (e.g. BUS_SEARCH -> PRODUCT_SEARCH, PRODUCT_SEARCH -> HOTEL_SEARCH, etc.)
    if (isConcreteSearchIntent && prevDomain && searchDomains.includes(prevDomain as IntentType)) {
      if (currentIntent !== prevDomain) {
        // Different domain: only inherit if message explicitly references previous domain
        if (!isExplicitModification) {
          return false;
        }
      }
    }

    // 3. Workflow exit detection: Previous was a transaction / booking / cancellation flow
    if (isConcreteSearchIntent && (prevDomain === 'TRANSACTION_REQUEST' || prevDomain === 'CANCELLATION_REQUEST')) {
      if (!isExplicitModification) {
        return false;
      }
    }

    // 4. If explicit modification language is present, inherit context
    if (isExplicitModification) {
      return true;
    }

    // 5. If user provides a fresh search command (e.g., "Find me...", "Show me...", "Search for...", "Book a...")
    const isFreshSearchLead = Boolean(
      lower.match(/^(find|search|show\s+me|get\s+me|look\s+for|recommend|book\s+me|i\s+want\s+to\s+search)\s+/i)
    );
    if (isFreshSearchLead) {
      return false;
    }

    // 6. Default to inheriting within the same domain for implicit continuation
    if (prevDomain === currentIntent) {
      return true;
    }

    return false;
  }

  /**
   * Universal Structured Requirement Extraction
   */
  async extractRequirements(
    text: string,
    intent: IntentType,
    context?: { previousRequirements?: SearchRequirements; previousIntent?: IntentType }
  ): Promise<LLMExtractionResult> {
    const clean = text.trim();
    const lower = clean.toLowerCase();

    const shouldInherit = this.shouldInheritPreviousContext(
      clean,
      intent,
      context?.previousIntent,
      context?.previousRequirements
    );

    // Start with base or merged requirements
    const reqs: SearchRequirements = {
      intent,
      category:
        intent === 'BUS_SEARCH'
          ? 'bus'
          : intent === 'PRODUCT_SEARCH' || intent === 'SHOPPING_SEARCH'
          ? 'electronics'
          : intent === 'HOTEL_SEARCH'
          ? 'hotel'
          : intent === 'FLIGHT_SEARCH'
          ? 'flight'
          : undefined,
      source: undefined,
      destination: undefined,
      date: undefined,
      returnDate: undefined,
      departureAfter: undefined,
      departureBefore: undefined,
      budget: null,
      currency: 'INR',
      quantity: undefined,
      preferences: {},
      constraints: {},
      sortPreference: undefined,
      keywords: [],
    };

    // If this is a genuine modification request or contextual refinement, inherit previous requirements
    if (shouldInherit && context?.previousRequirements) {
      const prev = JSON.parse(JSON.stringify(context.previousRequirements));
      Object.assign(reqs, prev);
      reqs.intent = intent === 'MODIFICATION_REQUEST' ? (prev.intent || intent) : intent;
    }

    // Parse Currency and Budget
    // Handles ₹50,000, 50000, 50k, 60,000, etc.
    const hasBudgetModifier =
      lower.includes('under') ||
      lower.includes('below') ||
      lower.includes('max') ||
      lower.includes('budget') ||
      lower.includes('make it') ||
      lower.includes('make the') ||
      lower.includes('increase') ||
      lower.includes('decrease');

    if (hasBudgetModifier) {
      const numMatch = clean.match(/(?:₹|rs\.?|inr\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,7})(?:\s*k)?/i);
      if (numMatch) {
        let valStr = numMatch[1].replace(/,/g, '');
        let numeric = parseFloat(valStr);
        if (numMatch[0].toLowerCase().includes('k')) numeric *= 1000;

        reqs.budget = {
          max: numeric,
          currency: 'INR',
        };
      }
    }

    // Parse Sort Preferences
    if (lower.includes('cheapest') || lower.includes('cheaper') || lower.includes('lowest price') || lower.includes('most affordable')) {
      reqs.sortPreference = 'cheapest';
    } else if (lower.includes('best') || lower.includes('top rated') || lower.includes('highest rating')) {
      reqs.sortPreference = 'rating';
    }

    // Category & Domain specific extractions
    if (intent === 'BUS_SEARCH' || (reqs.category === 'bus' && intent === 'MODIFICATION_REQUEST')) {
      reqs.category = 'bus';

      // Extract Route: "from [City] to [City]" (bounded before date/time words)
      const routeMatch = clean.match(/from\s+([A-Za-z]+)\s+to\s+([A-Za-z]+)(?:\s+(?:tomorrow|today|after|at|before|on|\d))?/i);
      if (routeMatch) {
        reqs.source = routeMatch[1].trim();
        reqs.destination = routeMatch[2].trim();
      } else {
        // Direct "to [City]"
        const toMatch = clean.match(/to\s+([A-Za-z]+)(?:\s+(?:tomorrow|today|after|at|before|on|\d))?/i);
        if (toMatch && !reqs.destination) {
          reqs.destination = toMatch[1].trim();
        }
      }

      // Extract Bus Type preferences (e.g. "AC sleeper", "sleeper", "volvo", "seater")
      if (lower.includes('ac sleeper') || lower.includes('a/c sleeper')) {
        reqs.preferences = { ...reqs.preferences, busType: 'AC Sleeper' };
      } else if (lower.includes('sleeper')) {
        reqs.preferences = { ...reqs.preferences, busType: 'Sleeper' };
      }

      // Extract Departure Time filter (e.g. "after 6 PM", "after 18:00")
      const afterMatch = clean.match(/after\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?)/i);
      if (afterMatch) {
        let timeStr = afterMatch[1].trim().toLowerCase();
        if (timeStr.includes('pm')) {
          const hours = parseInt(timeStr.replace(/[^0-9]/g, ''), 10);
          const normalized = hours < 12 ? hours + 12 : hours;
          reqs.departureAfter = `${normalized}:00`;
        } else {
          reqs.departureAfter = timeStr;
        }
      }

      // Extract Date (e.g. "tomorrow", "today", "friday")
      if (lower.includes('tomorrow')) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        reqs.date = d.toISOString().split('T')[0];
      } else if (lower.includes('today')) {
        reqs.date = new Date().toISOString().split('T')[0];
      }
    } else if (
      intent === 'PRODUCT_SEARCH' ||
      intent === 'SHOPPING_SEARCH' ||
      (reqs.category === 'electronics' && intent === 'MODIFICATION_REQUEST')
    ) {
      reqs.category = 'electronics';

      // Extract keywords, preserving contextual keywords ONLY if inheriting previous context
      const keywords: string[] = (shouldInherit && context?.previousRequirements?.keywords)
        ? [...context.previousRequirements.keywords]
        : [];

      if (lower.includes('gaming laptop')) {
        if (!keywords.includes('gaming laptop')) keywords.unshift('gaming laptop');
      } else if (lower.includes('laptop')) {
        if (keywords.length === 0) keywords.push('laptop');
      } else if (lower.includes('smartphone') || lower.includes('phone')) {
        if (!keywords.includes('smartphone')) keywords.push('smartphone');
      } else if (lower.includes('headphone') || lower.includes('earphones')) {
        if (!keywords.includes('headphone')) keywords.push('headphone');
      } else if (lower.includes('shoe')) {
        if (!keywords.includes('shoes')) keywords.push('shoes');
      }

      if (lower.includes('engineering')) keywords.push('engineering');
      if (lower.includes('5g')) reqs.constraints = { ...reqs.constraints, network: '5G' };

      const knownBrands = ['asus', 'dell', 'hp', 'apple', 'lenovo', 'acer', 'samsung', 'sony', 'boat', 'realme', 'redmi', 'xiaomi', 'oneplus', 'lg', 'msi'];
      for (const b of knownBrands) {
        if (new RegExp(`\\b${b}\\b`, 'i').test(clean)) {
          reqs.brand = b.toUpperCase();
          if (!keywords.includes(b)) {
            keywords.unshift(b);
          }
          break;
        }
      }

      // RAM constraint (e.g. "at least 8GB RAM", "16GB RAM")
      const ramMatch = clean.match(/([0-9]{1,2})\s*gb\s*ram/i);
      if (ramMatch) {
        reqs.constraints = { ...reqs.constraints, minRamGb: parseInt(ramMatch[1], 10) };
      }

      if (keywords.length > 0) {
        reqs.keywords = keywords;
      }
    } else if (intent === 'HOTEL_SEARCH' || (reqs.category === 'hotel' && intent === 'MODIFICATION_REQUEST')) {
      reqs.category = 'hotel';
      const cityMatch = clean.match(/(?:in|at|near)\s+([A-Za-z]+)/i);
      if (cityMatch) {
        reqs.destination = cityMatch[1].trim();
      }
    } else if (intent === 'FLIGHT_SEARCH' || (reqs.category === 'flight' && intent === 'MODIFICATION_REQUEST')) {
      reqs.category = 'flight';
      const routeMatch = clean.match(/from\s+([A-Za-z]+)\s+to\s+([A-Za-z]+)/i);
      if (routeMatch) {
        reqs.source = routeMatch[1].trim();
        reqs.destination = routeMatch[2].trim();
      } else {
        const toMatch = clean.match(/to\s+([A-Za-z]+)/i);
        if (toMatch) {
          reqs.destination = toMatch[1].trim();
        }
      }
    }

    return {
      requirements: reqs,
      isModification: intent === 'MODIFICATION_REQUEST' || (shouldInherit && Boolean(context?.previousRequirements)),
      confidence: 0.93,
    };
  }

  /**
   * Normalizes brand names to canonical display casing
   */
  normalizeBrandName(brand: string): string {
    const b = brand.toLowerCase().trim();
    if (b === 'asus') return 'ASUS';
    if (b === 'hp') return 'HP';
    if (b === 'dell') return 'Dell';
    if (b === 'lenovo') return 'Lenovo';
    if (b === 'apple') return 'Apple';
    if (b === 'acer') return 'Acer';
    if (b === 'msi') return 'MSI';
    if (b === 'samsung') return 'Samsung';
    if (b === 'sony') return 'Sony';
    if (b === 'lg') return 'LG';
    return brand.trim().charAt(0).toUpperCase() + brand.trim().slice(1);
  }

  /**
   * Universal Structured Preference Extraction
   */
  extractPreferenceUpdate(text: string): PreferenceUpdateCommand | null {
    const clean = text.trim();
    const lower = clean.toLowerCase();

    // Determine scope: session vs global
    const isSessionScoped = Boolean(
      lower.match(
        /(?:only\s+for\s+this\s+(?:search|query|turn|trip)|for\s+this\s+(?:trip|flight|bus|search)|this\s+time|just\s+for\s+now|temporarily|don'?t\s+change\s+my\s+saved)/i
      )
    );
    const scope: import('../types/personalization').PreferenceScope = isSessionScoped ? 'session' : 'global';

    // 1. Clear / Reset
    if (lower.match(/^(clear|reset)\s+(all\s+)?(my\s+)?preferences/i)) {
      return { action: 'CLEAR_ALL', scope, rawText: clean };
    }

    // 2. Ignore Saved Preferences
    if (
      lower.match(
        /(?:ignore\s+(?:my\s+)?usual\s+(?:brand\s+)?preference|ignore\s+(?:my\s+)?saved\s+preferences|this\s+time,?\s*i\s+don'?t\s+care\s+about\s+brand|don'?t\s+use\s+saved\s+preferences)/i
      )
    ) {
      return { action: 'IGNORE_SAVED_PREFERENCES', scope: 'session', rawText: clean };
    }

    // 3. Restore / Keep Saved Preferences
    if (
      lower.match(
        /(?:keep\s+(?:my\s+)?usual\s+.*preference|use\s+(?:my\s+)?normal\s+preferences|restore\s+(?:my\s+)?saved\s+preferences|use\s+saved\s+preferences)/i
      )
    ) {
      return { action: 'RESTORE_SAVED_PREFERENCES', scope: 'session', rawText: clean };
    }

    // 4. Remove Brand from Preferences
    const removeMatch = lower.match(
      /(?:actually,?\s*)?(?:remove|delete)\s+([a-zA-Z0-9]+)\s+(?:from\s+(?:my\s+)?preferences)/i
    );
    if (removeMatch) {
      const brand = this.normalizeBrandName(removeMatch[1]);
      return { action: 'REMOVE_PREFERRED_BRAND', brand, scope: 'global', rawText: clean };
    }

    // 5. Ranking Priorities
    if (
      lower.match(
        /(?:actually,?\s*)?(?:prioritize\s+(lowest\s+)?(price|cost)|(cheapest|lowest\s+price)\s+option|focus\s+on\s+(price|cost)|i\s+(?:usually\s+)?want\s+(?:the\s+)?(?:cheapest|something\s+cheap|cheap)|choose\s+the\s+cheapest|prioritize\s+price)/i
      ) ||
      lower.match(/^(?:actually,?\s*)?(prioritize\s+price|cheapest\s+first)/i)
    ) {
      return { action: 'SET_RANKING_PRIORITY', priority: 'lowest_price', scope, rawText: clean };
    }

    if (
      lower.match(
        /(?:actually,?\s*)?(?:prioritize\s+quality|highest\s+quality|focus\s+on\s+quality|best\s+performance|prioritize\s+performance|focus\s+on\s+performance)/i
      )
    ) {
      return { action: 'SET_RANKING_PRIORITY', priority: 'highest_quality', scope, rawText: clean };
    }

    if (
      lower.match(
        /prioritize\s+(speed|fastest)|focus\s+on\s+speed|i\s+(usually\s+)?want\s+(the\s+)?fastest/i
      )
    ) {
      return { action: 'SET_RANKING_PRIORITY', priority: 'fastest', scope, rawText: clean };
    }

    // 6. Travel Departure Time Windows
    if (lower.match(/prefer\s+.*morning|morning\s+(departures|buses|flights)/i) || lower.match(/^morning\s+departures/i)) {
      return { action: 'SET_DEPARTURE_WINDOW', departureWindow: 'morning', scope, rawText: clean };
    }
    if (lower.match(/prefer\s+.*afternoon|afternoon\s+(departures|buses|flights)/i)) {
      return { action: 'SET_DEPARTURE_WINDOW', departureWindow: 'afternoon', scope, rawText: clean };
    }
    if (lower.match(/prefer\s+.*evening|evening\s+(departures|buses|flights)/i)) {
      return { action: 'SET_DEPARTURE_WINDOW', departureWindow: 'evening', scope, rawText: clean };
    }
    if (lower.match(/prefer\s+.*night|night\s+(departures|buses|flights)/i)) {
      return { action: 'SET_DEPARTURE_WINDOW', departureWindow: 'night', scope, rawText: clean };
    }

    // 7. Excluded Brands
    // e.g. "I don't like Lenovo", "Don't show me HP", "Never Lenovo", "Exclude Dell"
    const excludeMatch = lower.match(/(?:don'?t\s+like\s+|don'?t\s+show\s+(?:me\s+)?|never\s+show\s+(?:me\s+)?|never\s+|exclude\s+(?:brand\s+)?)([a-zA-Z0-9]+)/i);
    if (excludeMatch) {
      const rawBrand = excludeMatch[1].trim();
      const brand = this.normalizeBrandName(rawBrand);
      return { action: 'ADD_EXCLUDED_BRAND', brand, scope, rawText: clean };
    }

    // 8. Preferred Brands
    // e.g. "I prefer ASUS", "I usually prefer ASUS", "Prefer ASUS", "Always choose ASUS"
    const preferMatch = lower.match(/(?:i\s+(?:usually\s+|always\s+)?prefer|prefer|always\s+choose|i\s+like)\s+([a-zA-Z0-9]+)/i);
    if (preferMatch) {
      const rawBrand = preferMatch[1].trim();
      const reserved = ['morning', 'afternoon', 'evening', 'night', 'cheapest', 'flights', 'buses', 'hotels', 'price', 'quality', 'speed', 'work', 'personal'];
      if (!reserved.includes(rawBrand.toLowerCase())) {
        const brand = this.normalizeBrandName(rawBrand);
        return { action: 'ADD_PREFERRED_BRAND', brand, scope, rawText: clean };
      }
    }

    // 9. Persona Switch Command
    const personaMatch = lower.match(/(?:switch\s+(?:to\s+)?(?:persona\s+to\s+|profile\s+to\s+)?|use\s+(?:my\s+)?|change\s+to\s+)(work|personal)(?:\s+persona|\s+profile)?/i);
    if (personaMatch) {
      const personaId = personaMatch[1].toLowerCase() as 'work' | 'personal';
      return { action: 'SWITCH_PERSONA', personaId, scope: 'global', rawText: clean };
    }

    // 10. Accept / Confirm Staged Inference
    // e.g. "Yes, add Lenovo to my profile", "Accept suggestion", "Add to my profile", "Confirm inference"
    const brandAddMatch = lower.match(/(?:yes,?\s*)?(?:please\s+)?add\s+([a-zA-Z0-9]+)\s+to\s+(?:my\s+)?profile/i);
    if (brandAddMatch) {
      const brand = this.normalizeBrandName(brandAddMatch[1]);
      return { action: 'ACCEPT_INFERENCE', brand, scope: 'global', rawText: clean };
    }

    const acceptInferenceMatch =
      lower.match(/(?:yes,?\s*)?(?:accept|approve|confirm|add)\s+(?:suggestion|inference|to\s+my\s+profile|to\s+profile)/i);
    if (acceptInferenceMatch) {
      return { action: 'ACCEPT_INFERENCE', scope: 'global', rawText: clean };
    }

    // 11. Reject / Dismiss Staged Inference
    // e.g. "No, don't add to profile", "Reject suggestion", "Dismiss suggestion", "No, don't update profile"
    const rejectInferenceMatch = lower.match(/(?:no,?\s*)?(?:reject|dismiss|ignore|don'?t\s+add|do\s+not\s+add)\s+(?:suggestion|inference|to\s+my\s+profile|to\s+profile)?/i);
    if (rejectInferenceMatch) {
      return { action: 'REJECT_INFERENCE', scope: 'global', rawText: clean };
    }

    // 12. Revert / Undo Evolution Entry
    // e.g. "Undo last change", "Revert profile change", "Undo profile change"
    const revertMatch = lower.match(/(?:undo|revert)\s+(?:profile\s+change|last\s+change|change\s+([a-zA-Z0-9_-]+))/i);
    if (revertMatch) {
      const entryId = revertMatch[1];
      return { action: 'REVERT_EVOLUTION', evolutionEntryId: entryId, scope: 'global', rawText: clean };
    }

    return null;
  }

  /**
   * Universal Structured Feedback Extraction
   */
  extractFeedback(
    text: string,
    context?: { previousRecommendations?: any[]; pendingExecution?: any }
  ): {
    recommendationId?: string;
    rating: 'positive' | 'negative';
    reason?: import('../types/personalization').RecommendationFeedbackReason;
    targetBrand?: string;
    targetTitle?: string;
    comments?: string;
  } | null {
    const clean = text.trim();
    const lower = clean.toLowerCase();

    // Determine rating
    let rating: 'positive' | 'negative' = 'positive';
    if (
      lower.includes('thumbs down') ||
      lower.includes('-1') ||
      lower.includes('bad') ||
      lower.includes('dislike') ||
      lower.includes('too expensive') ||
      lower.includes('poor') ||
      lower.includes('hate') ||
      lower.includes('terrible')
    ) {
      rating = 'negative';
    } else if (
      lower.includes('thumbs up') ||
      lower.includes('+1') ||
      lower.includes('good') ||
      lower.includes('great') ||
      lower.includes('like') ||
      lower.includes('love') ||
      lower.includes('awesome')
    ) {
      rating = 'positive';
    }

    // Determine reason
    let reason: import('../types/personalization').RecommendationFeedbackReason | undefined = undefined;
    if (lower.includes('too expensive') || lower.includes('high price') || lower.includes('costly')) {
      reason = 'PRICE_TOO_HIGH';
    } else if (lower.includes('disliked brand') || lower.includes("don't like brand") || lower.includes('bad brand')) {
      reason = 'DISLIKED_BRAND';
    } else if (lower.includes('wrong timing') || lower.includes('bad time') || lower.includes('too late') || lower.includes('too early')) {
      reason = 'INCONVENIENT_SCHEDULE';
    } else if (lower.includes('poor spec') || lower.includes('low ram') || lower.includes('slow')) {
      reason = 'POOR_SPECS';
    } else if (lower.includes('great value') || lower.includes('cheap') || lower.includes('good price')) {
      reason = 'PRICE_ATTRACTIVE';
    } else if (lower.includes('preferred brand') || lower.includes('love brand')) {
      reason = 'PREFERRED_BRAND';
    }

    // Resolve target recommendation
    let targetRec: any = undefined;
    const candidates = context?.previousRecommendations || [];

    const numMatch = lower.match(/(?:option|item|choice|#)\s*(\d+)/i);
    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx >= 0 && idx < candidates.length) {
        targetRec = candidates[idx];
      }
    }

    if (!targetRec && candidates.length > 0) {
      // Find by brand in message
      for (const cand of candidates) {
        const itemBrand = (cand.item?.brand || cand.item?.specifications?.brand || '').toLowerCase();
        if (itemBrand && lower.includes(itemBrand)) {
          targetRec = cand;
          break;
        }
      }
    }

    // Default to first recommendation or pending execution
    if (!targetRec && candidates.length > 0) {
      targetRec = candidates[0];
    }

    const recItem = targetRec?.item || context?.pendingExecution?.item;
    const targetBrand = recItem?.brand || recItem?.specifications?.brand || undefined;
    const targetTitle = recItem?.title || recItem?.operator || recItem?.airline || undefined;

    return {
      recommendationId: targetRec?.id || 'rec_general',
      rating,
      reason,
      targetBrand,
      targetTitle,
      comments: clean,
    };
  }
}

export const llmService = new LLMService();
