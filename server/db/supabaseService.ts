import { getSupabaseServerClient, isSupabaseConfigured } from './supabaseClient';
import type {
  UserPersonalizationProfile,
  RecommendationFeedbackEvent,
  PreferenceEvolutionEntry,
  StagedInference,
} from '../types/personalization';
import { logger } from '../utils/logger';

export class SupabaseDatabaseService {
  /**
   * Fetches user personalization profile from Supabase if configured.
   */
  async getProfile(userId: string): Promise<UserPersonalizationProfile | null> {
    if (!isSupabaseConfigured()) return null;

    const client = getSupabaseServerClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        if (error && error.code !== 'PGRST116') {
          logger.warn('Supabase fetch profile error', { userId, code: error.code });
        }
        return null;
      }

      return {
        userId: data.user_id,
        activePersonaId: data.active_persona_id || 'personal',
        personas: data.personas || {},
        shopping: data.shopping || {},
        travel: data.travel || {},
        stagedInferences: data.staged_inferences || [],
        evolutionHistory: data.evolution_history || [],
        feedbackHistory: data.feedback_history || [],
        updatedAt: data.updated_at || new Date().toISOString(),
      };
    } catch (err: any) {
      logger.error('Supabase profile fetch failure', { userId, error: err?.message });
      return null;
    }
  }

  /**
   * Persists user personalization profile to Supabase.
   */
  async saveProfile(profile: UserPersonalizationProfile): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const client = getSupabaseServerClient();
    if (!client) return false;

    try {
      const { error } = await client.from('profiles').upsert(
        {
          user_id: profile.userId,
          active_persona_id: profile.activePersonaId,
          personas: profile.personas,
          shopping: profile.shopping,
          travel: profile.travel,
          staged_inferences: profile.stagedInferences,
          evolution_history: profile.evolutionHistory,
          feedback_history: profile.feedbackHistory,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (error) {
        logger.warn('Supabase save profile error', { userId: profile.userId, code: error.code });
        return false;
      }

      return true;
    } catch (err: any) {
      logger.error('Supabase profile save failure', { userId: profile.userId, error: err?.message });
      return false;
    }
  }

  /**
   * Persists a recommendation feedback event.
   */
  async recordFeedback(feedback: RecommendationFeedbackEvent): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const client = getSupabaseServerClient();
    if (!client) return false;

    try {
      const { error } = await client.from('recommendation_feedback').insert({
        id: feedback.id,
        user_id: feedback.userId,
        recommendation_id: feedback.recommendationId,
        rating: feedback.rating,
        reason: feedback.reason,
        target_brand: feedback.targetBrand,
        target_title: feedback.targetTitle,
        comments: feedback.comments,
        created_at: feedback.timestamp || new Date().toISOString(),
      });

      if (error) {
        logger.warn('Supabase record feedback error', { feedbackId: feedback.id, code: error.code });
        return false;
      }

      return true;
    } catch (err: any) {
      logger.error('Supabase feedback insert failure', { error: err?.message });
      return false;
    }
  }

  /**
   * Persists preference evolution entry.
   */
  async recordEvolution(userId: string, entry: PreferenceEvolutionEntry): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const client = getSupabaseServerClient();
    if (!client) return false;

    try {
      const { error } = await client.from('preference_evolution_history').insert({
        id: entry.id,
        user_id: userId,
        field: entry.field,
        previous_value: entry.previousValue,
        new_value: entry.newValue,
        reason: entry.reason,
        revertible: entry.revertible ?? true,
        source: entry.source,
        created_at: entry.timestamp || new Date().toISOString(),
      });

      if (error) {
        logger.warn('Supabase record evolution error', { entryId: entry.id, code: error.code });
        return false;
      }

      return true;
    } catch (err: any) {
      logger.error('Supabase evolution insert failure', { error: err?.message });
      return false;
    }
  }

  /**
   * Persists staged preference inference.
   */
  async recordStagedInference(userId: string, inference: StagedInference): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const client = getSupabaseServerClient();
    if (!client) return false;

    try {
      const { error } = await client.from('staged_inferences').insert({
        id: inference.id,
        user_id: userId,
        field: inference.field,
        inferred_value: inference.inferredValue,
        confidence: inference.confidence,
        status: inference.status,
        evidence_count: inference.evidenceCount,
        created_at: inference.timestamp || new Date().toISOString(),
      });

      if (error) {
        logger.warn('Supabase record staged inference error', { inferenceId: inference.id, code: error.code });
        return false;
      }

      return true;
    } catch (err: any) {
      logger.error('Supabase staged inference insert failure', { error: err?.message });
      return false;
    }
  }
}

export const supabaseDbService = new SupabaseDatabaseService();
