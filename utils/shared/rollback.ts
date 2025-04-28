/**
 * Rollback Manager
 * Handles rollback procedures if issues are detected during migration.
 */

import logger from './logger';
import { isFeatureEnabled } from './feature-flags';
import { migrationMonitor } from './monitoring';

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

    if (migrationMonitor.hasIssues()) {
      await this.executeRollback();
    }
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
      
      // Log final metrics before rollback
      migrationMonitor.logStatus();

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
    const metrics = migrationMonitor.getMetrics();
    
    // Format notification message
    const message = `
🚨 OpenAI Service Rollback Alert 🚨

The system has detected issues with the unified OpenAI service and has initiated a rollback to the legacy implementation.

Metrics at time of rollback:
- Unified Service Calls: ${metrics.unifiedServiceCalls}
- Legacy Service Calls: ${metrics.legacyServiceCalls}
- Unified Service Errors: ${metrics.errors.unified}
- Legacy Service Errors: ${metrics.errors.legacy}

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