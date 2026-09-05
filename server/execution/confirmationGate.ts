import type {
  AnyPreparation,
  ConfirmationState,
  ConfirmationResult,
} from './types';
import { sandboxExecutor } from './sandboxExecutor';
import { logger } from '../utils/logger';

export class ConfirmationGate {
  private activePreparations: Map<string, ConfirmationState> = new Map();

  /**
   * Register a prepared execution into the confirmation state manager
   */
  registerPreparation(preparation: AnyPreparation): ConfirmationState {
    const state: ConfirmationState = {
      executionId: preparation.executionId,
      preparation,
      status: 'AWAITING_CONFIRMATION',
      createdAt: preparation.createdAt,
      isExecuted: false,
      financialTransactionInitiated: false,
    };
    this.activePreparations.set(preparation.executionId, state);

    sandboxExecutor.logAuditEvent({
      eventType: 'PREPARATION_CREATED',
      executionId: preparation.executionId,
      type: preparation.type,
      status: 'AWAITING_CONFIRMATION',
      timestamp: preparation.createdAt,
      metadata: {
        total: preparation.costBreakdown?.total,
        currency: preparation.costBreakdown?.currency,
      },
    });

    sandboxExecutor.logAuditEvent({
      eventType: 'CONFIRMATION_REQUESTED',
      executionId: preparation.executionId,
      type: preparation.type,
      status: 'AWAITING_CONFIRMATION',
      timestamp: new Date().toISOString(),
    });

    logger.info('ConfirmationGate registered execution preparation', {
      executionId: preparation.executionId,
      type: preparation.type,
    });
    return state;
  }

  getConfirmationState(executionId: string): ConfirmationState | undefined {
    return this.activePreparations.get(executionId);
  }

  /**
   * Confirm an execution with double-execution and expiry guards
   */
  confirm(executionId: string): ConfirmationResult {
    const state = this.activePreparations.get(executionId);

    if (!state) {
      return {
        success: false,
        executionId,
        status: 'FAILED',
        isExecuted: false,
        error: `Execution preparation "${executionId}" not found.`,
        message: 'No active transaction preparation was found matching this identifier.',
      };
    }

    // Double-execution protection: cannot confirm an already confirmed execution
    if (state.status === 'CONFIRMED') {
      logger.warn('Double execution blocked in ConfirmationGate', { executionId });
      return {
        success: false,
        executionId,
        status: 'CONFIRMED',
        isExecuted: false,
        state,
        error: `Cannot confirm preparation in status "CONFIRMED". Execution "${executionId}" has already been confirmed. Duplicate confirmation blocked.`,
        message: 'This transaction was already authorized. Duplicate execution prevented.',
      };
    }

    // Guard against confirming a cancelled execution
    if (state.status === 'CANCELLED') {
      return {
        success: false,
        executionId,
        status: 'CANCELLED',
        isExecuted: false,
        state,
        error: `Cannot confirm preparation in status "CANCELLED". Execution "${executionId}" was previously cancelled.`,
        message: 'This preparation was previously cancelled and cannot be confirmed.',
      };
    }

    // Expiry check
    if (state.preparation.expiresAt) {
      const expiryTimestamp = Date.parse(state.preparation.expiresAt);
      if (!isNaN(expiryTimestamp) && Date.now() > expiryTimestamp) {
        state.status = 'FAILED';
        state.actionTaken = 'EXPIRED';
        return {
          success: false,
          executionId,
          status: 'FAILED',
          isExecuted: false,
          error: `Execution preparation "${executionId}" has expired. Please refresh your search.`,
          message: 'The quote or inventory reservation has expired. A fresh search is required.',
        };
      }
    }

    // Transition to CONFIRMED (Crucial: isExecuted remains FALSE in Step 5!)
    state.status = 'CONFIRMED';
    state.confirmedAt = new Date().toISOString();
    state.actionTaken = 'AUTHORIZED_FOR_EXECUTION';
    state.preparation.status = 'CONFIRMED';

    sandboxExecutor.logAuditEvent({
      eventType: 'CONFIRMED',
      executionId,
      type: state.preparation.type,
      status: 'CONFIRMED',
      timestamp: state.confirmedAt,
    });

    logger.info('ConfirmationGate authorized execution', { executionId });

    return {
      success: true,
      executionId,
      status: 'CONFIRMED',
      isExecuted: false, // Invariant: no real payment executed
      state,
      message: 'Transaction successfully authorized. Ready for execution layer in future phase.',
    };
  }

  /**
   * Cancel an execution preparation
   */
  cancel(executionId: string, reason?: string): ConfirmationResult {
    const state = this.activePreparations.get(executionId);

    if (!state) {
      return {
        success: false,
        executionId,
        status: 'FAILED',
        isExecuted: false,
        error: `Execution preparation "${executionId}" not found.`,
        message: 'No active transaction preparation was found to cancel.',
      };
    }

    state.status = 'CANCELLED';
    state.cancelledAt = new Date().toISOString();
    state.actionTaken = 'ABORTED';
    state.preparation.status = 'CANCELLED';

    sandboxExecutor.logAuditEvent({
      eventType: 'EXECUTION_CANCELLED',
      executionId,
      type: state.preparation.type,
      status: 'CANCELLED',
      timestamp: state.cancelledAt,
      metadata: { reason },
    });

    logger.info('ConfirmationGate cancelled execution', { executionId, reason });

    return {
      success: true,
      executionId,
      status: 'CANCELLED',
      isExecuted: false,
      state,
      message: reason || 'Transaction preparation was safely cancelled.',
    };
  }

  confirmPreparation(executionId: string): ConfirmationResult {
    return this.confirm(executionId);
  }

  cancelPreparation(executionId: string, reason?: string): ConfirmationResult {
    return this.cancel(executionId, reason);
  }

  markExecuted(executionId: string): void {
    const state = this.activePreparations.get(executionId);
    if (state) {
      state.isExecuted = true;
      state.actionTaken = 'EXECUTED_SANDBOX';
    }
  }

  clear(): void {
    this.activePreparations.clear();
  }
}

export const confirmationGate = new ConfirmationGate();

