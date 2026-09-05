import { Router, Request, Response } from 'express';
import { orchestrator } from '../agent/orchestrator';
import { profileStore } from '../personalization/profileStore';
import { conversationStore } from '../db/conversationStore';
import { logger } from '../utils/logger';

export const agentRouter = Router();

/**
 * POST /api/agent/message
 * Primary endpoint for processing natural language requests through the Agent Core
 */
agentRouter.post('/message', async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId, message, userId, location } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({
        error: 'Invalid request: "message" string field is required.',
      });
      return;
    }

    const convId = conversationId || `conv_${Date.now()}`;

    const response = await orchestrator.processMessage({
      conversationId: convId,
      message,
      userId,
      location,
    });

    res.json(response);
  } catch (err: any) {
    logger.error('Unhandled exception in /api/agent/message', {
      errorMessage: err?.message,
    });

    // Clean controlled error response without leaking stack traces or internal secrets
    res.status(500).json({
      error: 'The agent encountered an unexpected internal error. Please try again.',
    });
  }
});

/**
 * GET /api/agent/profile
 * Retrieves personalization profile for a user
 */
agentRouter.get('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.query.userId as string) || 'default_user';
    const profile = profileStore.getProfile(userId);
    res.json({ success: true, profile });
  } catch (err: any) {
    logger.error('Error fetching personalization profile', { error: err?.message });
    res.status(500).json({ error: 'Failed to retrieve personalization profile.' });
  }
});

/**
 * POST /api/agent/profile
 * Updates personalization profile or applies a discrete preference action
 */
agentRouter.post('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      userId = 'default_user',
      action,
      brand,
      priority,
      departureWindow,
      personaId,
      inferenceId,
      evolutionEntryId,
      feedback,
      profile: partialProfile,
    } = req.body;

    let updatedProfile;
    if (action) {
      updatedProfile = profileStore.applyCommand(userId, {
        action,
        brand,
        priority,
        departureWindow,
        personaId,
        inferenceId,
        evolutionEntryId,
        feedback,
      });
    } else if (partialProfile && typeof partialProfile === 'object') {
      updatedProfile = profileStore.updateProfile(userId, partialProfile);
    } else {
      updatedProfile = profileStore.getProfile(userId);
    }

    res.json({ success: true, profile: updatedProfile });
  } catch (err: any) {
    logger.error('Error updating personalization profile', { error: err?.message });
    res.status(500).json({ error: 'Failed to update personalization profile.' });
  }
});

/**
 * POST /api/agent/feedback
 * Records explicit feedback on recommendations
 */
agentRouter.post('/feedback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId = 'default_user', recommendationId, rating, reason, targetBrand, targetTitle, comments } = req.body;
    if (!rating || !recommendationId) {
      res.status(400).json({ error: 'recommendationId and rating ("positive" | "negative") are required.' });
      return;
    }

    const event = {
      id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId,
      recommendationId,
      rating,
      reason,
      targetBrand,
      targetTitle,
      comments,
      timestamp: new Date().toISOString(),
    };

    const updatedProfile = profileStore.recordFeedback(userId, event);
    res.json({ success: true, message: 'Feedback recorded successfully', profile: updatedProfile });
  } catch (err: any) {
    logger.error('Error recording recommendation feedback', { error: err?.message });
    res.status(500).json({ error: 'Failed to record feedback.' });
  }
});

/**
 * POST /api/agent/persona/switch
 * Switches active persona (e.g. personal vs work)
 */
agentRouter.post('/persona/switch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId = 'default_user', personaId } = req.body;
    if (!personaId || (personaId !== 'personal' && personaId !== 'work')) {
      res.status(400).json({ error: 'Valid personaId ("personal" | "work") is required.' });
      return;
    }

    const updatedProfile = profileStore.switchPersona(userId, personaId);
    res.json({ success: true, message: `Switched to ${personaId} persona`, profile: updatedProfile });
  } catch (err: any) {
    logger.error('Error switching persona', { error: err?.message });
    res.status(500).json({ error: 'Failed to switch persona.' });
  }
});

/**
 * POST /api/agent/inferences/:inferenceId/accept
 */
agentRouter.post('/inferences/:inferenceId/accept', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.body?.userId as string) || 'default_user';
    const { inferenceId } = req.params;
    const updatedProfile = profileStore.acceptStagedInference(userId, inferenceId);
    res.json({ success: true, message: 'Staged preference inference accepted', profile: updatedProfile });
  } catch (err: any) {
    logger.error('Error accepting staged inference', { error: err?.message });
    res.status(500).json({ error: 'Failed to accept staged inference.' });
  }
});

/**
 * POST /api/agent/inferences/:inferenceId/reject
 */
agentRouter.post('/inferences/:inferenceId/reject', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.body?.userId as string) || 'default_user';
    const { inferenceId } = req.params;
    const updatedProfile = profileStore.rejectStagedInference(userId, inferenceId);
    res.json({ success: true, message: 'Staged preference inference dismissed', profile: updatedProfile });
  } catch (err: any) {
    logger.error('Error rejecting staged inference', { error: err?.message });
    res.status(500).json({ error: 'Failed to reject staged inference.' });
  }
});

/**
 * POST /api/agent/evolution/:entryId/revert
 */
agentRouter.post('/evolution/:entryId/revert', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.body?.userId as string) || 'default_user';
    const { entryId } = req.params;
    const updatedProfile = profileStore.revertEvolutionEntry(userId, entryId);
    res.json({ success: true, message: 'Profile evolution change reverted', profile: updatedProfile });
  } catch (err: any) {
    logger.error('Error reverting profile change', { error: err?.message });
    res.status(500).json({ error: 'Failed to revert profile change.' });
  }
});

/**
 * DELETE /api/agent/profile
 * Resets preferences for user to clean default profile
 */
agentRouter.delete('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.query.userId as string) || (req.body?.userId as string) || 'default_user';
    const resetProfile = profileStore.clearProfile(userId);
    res.json({ success: true, profile: resetProfile, message: 'Preferences cleared.' });
  } catch (err: any) {
    logger.error('Error clearing personalization profile', { error: err?.message });
    res.status(500).json({ error: 'Failed to clear personalization profile.' });
  }
});

/**
 * GET /api/agent/conversations
 * Lists conversations for the current user
 */
agentRouter.get('/conversations', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.query.userId as string) || 'default_user';
    const list = conversationStore.listConversations(userId);
    res.json({ success: true, conversations: list });
  } catch (err: any) {
    logger.error('Error listing conversations', { error: err?.message });
    res.status(500).json({ error: 'Failed to list conversations.' });
  }
});

/**
 * GET /api/agent/conversations/:id
 * Retrieves a single conversation by ID with all messages
 */
agentRouter.get('/conversations/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const conv = conversationStore.getConversation(id);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    res.json({ success: true, conversation: conv });
  } catch (err: any) {
    logger.error('Error fetching conversation', { error: err?.message });
    res.status(500).json({ error: 'Failed to fetch conversation.' });
  }
});

/**
 * POST /api/agent/conversations/:id
 * Saves or updates a conversation
 */
agentRouter.post('/conversations/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { conversation } = req.body;
    if (!conversation) {
      res.status(400).json({ error: 'Conversation payload required.' });
      return;
    }
    conversation.id = id;
    const saved = conversationStore.saveConversation(conversation);
    res.json({ success: true, conversation: saved });
  } catch (err: any) {
    logger.error('Error saving conversation', { error: err?.message });
    res.status(500).json({ error: 'Failed to save conversation.' });
  }
});

/**
 * DELETE /api/agent/conversations/:id
 * Deletes a conversation
 */
agentRouter.delete('/conversations/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = conversationStore.deleteConversation(id);
    res.json({ success: true, deleted });
  } catch (err: any) {
    logger.error('Error deleting conversation', { error: err?.message });
    res.status(500).json({ error: 'Failed to delete conversation.' });
  }
});

