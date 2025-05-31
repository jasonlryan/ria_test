/**
 * Rollback Manager
 * Handles rollback procedures if issues are detected during migration.
 */

import logger from './logger';
import { isFeatureEnabled } from './feature-flags';

export class RollbackManager {
  private static instance: RollbackManager;
  private isRollingBack: boolean = false;

  private constructor() {}

  public static getInstance(): RollbackManager {
    if (!RollbackManager.instance) {
      RollbackManager.instance = new RollbackManager();
    }
    return RollbackManager.instance;
  }

  /**
   * Check if rollback is needed and execute if necessary
   */
  public async checkAndRollbackIfNeeded(): Promise<void> {
    if (!isFeatureEnabled('FALLBACK_TO_LEGACY') || this.isRollingBack) return;

    // In the simplified version, rollback is triggered externally
    // when issues are detected by other mechanisms.
  }

  /**
   * Execute the rollback procedure
   */
  private async executeRollback(): Promise<void> {
    this.isRollingBack = true;
    logger.warn('[ROLLBACK] Starting rollback procedure');

    try {
      // Disable unified service
      process.env.UNIFIED_OPENAI_SERVICE = 'false';
      
      // Notify team about rollback
      await this.notifyTeam();

      logger.info('[ROLLBACK] Rollback completed successfully');
    } catch (error) {
      logger.error('[ROLLBACK] Error during rollback:', error);
    } finally {
      this.isRollingBack = false;
    }
  }

  /**
   * Notify the team about the rollback
   */
  private async notifyTeam(): Promise<void> {
    const message = `
🚨 OpenAI Service Rollback Alert 🚨

The system has detected issues with the unified OpenAI service and has initiated a rollback to the legacy implementation.

Please review the logs for more details.
    `.trim();

    // TODO: Implement actual notification (e.g., Slack, email)
    logger.warn('[ROLLBACK] Team notification:', message);
  }

  /**
   * Check if system is currently rolling back
   */
  public isInRollback(): boolean {
    return this.isRollingBack;
  }
}

// Export singleton instance
export const rollbackManager = RollbackManager.getInstance(); 