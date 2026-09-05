import type { AgentState, AgentPhase, IntentType, SearchRequirements, AgentPlan } from '../types/agent';
import { logger } from '../utils/logger';

export class AgentStateManager {
  private states: Map<string, AgentState> = new Map();

  getInitialState(sessionId: string): AgentState {
    return {
      sessionId,
      phase: 'IDLE',
      intent: null,
      requirements: null,
      plan: null,
      selectedTool: null,
      results: [],
      selectedResult: null,
      awaitingUserConfirmation: false,
      error: null,
    };
  }

  getState(sessionId: string): AgentState {
    let state = this.states.get(sessionId);
    if (!state) {
      state = this.getInitialState(sessionId);
      this.states.set(sessionId, state);
    }
    return state;
  }

  transition(sessionId: string, phase: AgentPhase, data?: Partial<AgentState>): AgentState {
    const current = this.getState(sessionId);
    const updated: AgentState = {
      ...current,
      ...data,
      phase,
    };

    this.states.set(sessionId, updated);
    logger.debug('Agent state transitioned', { sessionId, from: current.phase, to: phase });
    return updated;
  }

  reset(sessionId: string): AgentState {
    const fresh = this.getInitialState(sessionId);
    this.states.set(sessionId, fresh);
    return fresh;
  }
}

export const stateManager = new AgentStateManager();
