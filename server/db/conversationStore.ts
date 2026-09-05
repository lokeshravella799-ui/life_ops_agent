import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { getSupabaseServerClient, isSupabaseConfigured } from './supabaseClient';

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    intent?: string;
    recommendationsCount?: number;
    isLocationPrompt?: boolean;
    isBusBooking?: boolean;
    pickup?: string;
    destination?: string;
    bookingId?: string;
    error?: boolean;
    recommendations?: string[];
  };
}

export interface BookingState {
  serviceType: 'bus' | 'product' | 'hotel' | 'flight';
  pickup?: string;
  destination?: string;
  selectedItem?: any;
  totalAmount?: number;
  status: 'selected' | 'summary' | 'payment_pending' | 'confirmed';
  bookingId?: string;
  orderId?: string;
  paymentId?: string;
  confirmedAt?: string;
}

export interface StoredConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  location?: {
    latitude?: number;
    longitude?: number;
    city?: string;
    state?: string;
    formattedAddress?: string;
  };
  messages: ChatMessageItem[];
  currentBookingState?: BookingState;
  searchRequirements?: any;
  recommendations?: any[];
}

export interface ConversationSummary {
  id: string;
  userId: string;
  title: string;
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  category: 'today' | 'yesterday' | 'earlier';
}

class ConversationStore {
  private dataDir: string;
  private filePath: string;
  private memoryCache: Map<string, StoredConversation> = new Map();
  private isInitialized = false;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'server', 'data');
    this.filePath = path.join(this.dataDir, 'conversations.json');
    this.init();
  }

  private init() {
    if (this.isInitialized) return;
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        try {
          const list: StoredConversation[] = JSON.parse(raw);
          for (const item of list) {
            // Exclude old demo seed conversations so user only sees genuine interactions
            if (item.id && !item.id.startsWith('conv_seed_')) {
              this.memoryCache.set(item.id, item);
            }
          }
          logger.info(`Loaded ${this.memoryCache.size} real conversation(s) from disk store.`);
        } catch {
          this.memoryCache.clear();
        }
      }

      // Sync existing conversations from Supabase cloud storage if configured
      this.syncFromSupabase().catch((err) => {
        logger.debug('Initial Supabase conversation sync skipped or failed', { error: err?.message });
      });

      this.isInitialized = true;
    } catch (err: any) {
      logger.error('Error initializing conversation store:', { error: err?.message });
    }
  }

  /**
   * Sync persistent conversations from Supabase cloud storage
   */
  async syncFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const client = getSupabaseServerClient();
    if (!client) return;

    try {
      // 1. Check storage bucket
      const { data: files, error } = await client.storage.from('conversations').list();
      if (!error && files && files.length > 0) {
        for (const file of files) {
          if (file.name.endsWith('.json') && !file.name.startsWith('conv_seed_')) {
            const convId = file.name.replace('.json', '');
            if (!this.memoryCache.has(convId)) {
              try {
                const downloadRes = await client.storage.from('conversations').download(file.name);
                if (downloadRes.data) {
                  const text = await downloadRes.data.text();
                  const parsed: StoredConversation = JSON.parse(text);
                  if (parsed.id && Array.isArray(parsed.messages)) {
                    this.memoryCache.set(parsed.id, parsed);
                  }
                }
              } catch (dlErr: any) {
                logger.debug(`Could not download ${file.name} from Supabase:`, dlErr?.message);
              }
            }
          }
        }
        this.persistToDisk();
      }

      // 2. Also attempt PostgREST conversations table if present
      try {
        const { data: pgRows, error: pgErr } = await client
          .from('conversations')
          .select('*, messages(*)')
          .limit(50);

        if (!pgErr && Array.isArray(pgRows) && pgRows.length > 0) {
          for (const row of pgRows) {
            if (!this.memoryCache.has(row.id)) {
              const mappedMessages: ChatMessageItem[] = Array.isArray(row.messages)
                ? row.messages.map((m: any) => ({
                    id: m.id || `msg_${Date.now()}`,
                    role: m.sender || 'user',
                    content: m.content || '',
                    timestamp: m.created_at || new Date().toISOString(),
                    metadata: m.metadata || {},
                  }))
                : [];

              const conv: StoredConversation = {
                id: row.id,
                userId: row.user_id || 'default_user',
                title: row.title || 'Conversation',
                createdAt: row.created_at || new Date().toISOString(),
                updatedAt: row.updated_at || new Date().toISOString(),
                messages: mappedMessages,
              };
              this.memoryCache.set(conv.id, conv);
            }
          }
          this.persistToDisk();
        }
      } catch {
        // Table may not exist yet; bucket storage serves as primary cloud persistence
      }
    } catch (err: any) {
      logger.debug('Supabase sync error:', { error: err?.message });
    }
  }

  /**
   * Persist a conversation record to Supabase cloud
   */
  private async persistToSupabase(conv: StoredConversation): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const client = getSupabaseServerClient();
    if (!client) return;

    try {
      // 1. Cloud storage bucket persistence
      const filename = `${conv.id}.json`;
      const payload = Buffer.from(JSON.stringify(conv, null, 2), 'utf-8');
      await client.storage.from('conversations').upload(filename, payload, {
        upsert: true,
        contentType: 'application/json',
      });

      // 2. Also try PostgREST table upsert if table exists
      try {
        await client.from('conversations').upsert({
          id: conv.id,
          user_id: conv.userId,
          title: conv.title,
          updated_at: conv.updatedAt,
          created_at: conv.createdAt,
        }, { onConflict: 'id' });
      } catch {
        // PostgREST table optional
      }
    } catch (err: any) {
      logger.debug('Error persisting conversation to Supabase:', { id: conv.id, error: err?.message });
    }
  }

  private persistToDisk() {
    try {
      const list = Array.from(this.memoryCache.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err: any) {
      logger.error('Failed to persist conversations to disk:', { error: err?.message });
    }
  }

  getConversation(id: string): StoredConversation | null {
    this.init();
    return this.memoryCache.get(id) || null;
  }

  saveConversation(conv: StoredConversation): StoredConversation {
    this.init();
    conv.updatedAt = new Date().toISOString();
    this.memoryCache.set(conv.id, conv);
    this.persistToDisk();
    this.persistToSupabase(conv).catch(() => {});
    return conv;
  }

  getOrCreateConversation(id: string, userId: string = 'default_user', initialTitle?: string): StoredConversation {
    this.init();
    let conv = this.memoryCache.get(id);
    if (!conv) {
      const now = new Date().toISOString();
      conv = {
        id,
        userId,
        title: initialTitle || 'New Conversation',
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      this.memoryCache.set(id, conv);
      this.persistToDisk();
      this.persistToSupabase(conv).catch(() => {});
    }
    return conv;
  }

  addMessage(
    conversationId: string,
    message: Omit<ChatMessageItem, 'id' | 'timestamp'>,
    userId: string = 'default_user'
  ): { conversation: StoredConversation; messageItem: ChatMessageItem } {
    this.init();
    const conv = this.getOrCreateConversation(conversationId, userId);

    const messageItem: ChatMessageItem = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    // Auto-update conversation title from first user message if title is default
    if (message.role === 'user' && (conv.title === 'New Conversation' || !conv.title)) {
      const text = message.content.trim();
      let derivedTitle = text.slice(0, 36);
      if (text.toLowerCase().includes('c++')) derivedTitle = 'C++ Discussion';
      else if (text.toLowerCase().includes('bus')) derivedTitle = text.slice(0, 32);
      else if (text.toLowerCase().includes('laptop')) derivedTitle = 'Laptop search';
      conv.title = derivedTitle;
    }

    conv.messages.push(messageItem);
    conv.updatedAt = new Date().toISOString();
    this.memoryCache.set(conversationId, conv);
    this.persistToDisk();
    this.persistToSupabase(conv).catch(() => {});
    console.log(`[HISTORY] ${message.role === 'user' ? 'USER MESSAGE SAVED' : 'ASSISTANT MESSAGE SAVED'}: "${message.content.slice(0, 60)}" (conv: ${conversationId})`);

    return { conversation: conv, messageItem };
  }

  updateBookingState(conversationId: string, bookingState: BookingState): StoredConversation | null {
    this.init();
    const conv = this.memoryCache.get(conversationId);
    if (!conv) return null;
    conv.currentBookingState = bookingState;
    conv.updatedAt = new Date().toISOString();
    this.memoryCache.set(conversationId, conv);
    this.persistToDisk();
    this.persistToSupabase(conv).catch(() => {});
    return conv;
  }

  updateLocation(conversationId: string, location: StoredConversation['location']): StoredConversation | null {
    this.init();
    const conv = this.memoryCache.get(conversationId);
    if (!conv) return null;
    conv.location = location;
    conv.updatedAt = new Date().toISOString();
    this.memoryCache.set(conversationId, conv);
    this.persistToDisk();
    this.persistToSupabase(conv).catch(() => {});
    return conv;
  }

  listConversations(userId?: string): ConversationSummary[] {
    this.init();
    const all = Array.from(this.memoryCache.values());
    // Only return conversations with real messages
    const filtered = all.filter((c) => {
      const matchesUser = !userId || c.userId === userId || c.userId === 'default_user';
      return matchesUser && c.messages && c.messages.length > 0 && !c.id.startsWith('conv_seed_');
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

    return filtered
      .map((conv) => {
        const updatedTime = new Date(conv.updatedAt).getTime();
        let category: 'today' | 'yesterday' | 'earlier' = 'earlier';
        if (updatedTime >= startOfToday) {
          category = 'today';
        } else if (updatedTime >= startOfYesterday) {
          category = 'yesterday';
        }

        const lastMsg =
          conv.messages.length > 0
            ? conv.messages[conv.messages.length - 1].content.slice(0, 80)
            : '';

        return {
          id: conv.id,
          userId: conv.userId,
          title: conv.title,
          lastMessage: lastMsg,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          messageCount: conv.messages.length,
          category,
        };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  deleteConversation(id: string): boolean {
    this.init();
    const existed = this.memoryCache.delete(id);
    if (existed) {
      this.persistToDisk();
      if (isSupabaseConfigured()) {
        const client = getSupabaseServerClient();
        if (client) {
          client.storage.from('conversations').remove([`${id}.json`]).catch(() => {});
          client.from('conversations').delete().eq('id', id).catch(() => {});
        }
      }
    }
    return existed;
  }
}

export const conversationStore = new ConversationStore();
