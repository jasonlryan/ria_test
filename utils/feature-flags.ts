/**
 * Feature Flag System
 * Manages feature toggles for gradual rollout of new functionality.
 * Supports both environment-based and code-based feature flags.
 */

import logger from './logger';

/**
 * Represents the configuration for a feature flag
 */
export interface FeatureFlagConfig {
  /** Whether the feature is enabled */
  enabled: boolean;
  /** Optional environment variable to override the enabled status */
  envKey?: string;
  /** Description of what the feature flag controls */
  description: string;
}

/**
 * Type-safe feature flag definitions
 */
export interface FeatureFlags {
  USE_RESPONSES_API: FeatureFlagConfig;
  UNIFIED_OPENAI_SERVICE: FeatureFlagConfig;
  UNIFIED_POLLING: FeatureFlagConfig;
  ENHANCED_ERROR_HANDLING: FeatureFlagConfig;
}

/**
 * Feature flag definitions with their default values and descriptions
 */
export const featureFlags: FeatureFlags = {
  USE_RESPONSES_API: {
    enabled: false,
    envKey: 'USE_RESPONSES_API',
    description: 'Controls whether to use the new OpenAI Responses API',
  },
  UNIFIED_OPENAI_SERVICE: {
    enabled: false,
    envKey: 'UNIFIED_OPENAI_SERVICE',
    description: 'Controls whether to use the unified OpenAI service implementation',
  },
  UNIFIED_POLLING: {
    enabled: false,
    envKey: 'UNIFIED_POLLING',
    description: 'Controls whether to use the centralized polling manager',
  },
  ENHANCED_ERROR_HANDLING: {
    enabled: true,
    envKey: 'ENHANCED_ERROR_HANDLING',
    description: 'Controls whether to use enhanced error handling and fallback mechanisms',
  },
};

/**
 * Type for feature flag names
 */
export type FeatureFlagName = keyof FeatureFlags;

/**
 * Feature flag service for managing and checking feature flags
 */
export class FeatureFlagService {
  private static instance: FeatureFlagService;
  private flags: FeatureFlags;

  private constructor() {
    this.flags = this.initializeFlags();
  }

  /**
   * Get the singleton instance of FeatureFlagService
   */
  public static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  /**
   * Initialize feature flags with environment overrides
   */
  private initializeFlags(): FeatureFlags {
    const flags = { ...featureFlags };
    
    // Apply environment overrides
    Object.entries(flags).forEach(([key, config]) => {
      if (config.envKey && process.env[config.envKey] !== undefined) {
        const envValue = process.env[config.envKey];
        flags[key as FeatureFlagName].enabled = envValue === 'true';
        logger.info(`[FEATURE_FLAGS] Override ${key} from env: ${envValue}`);
      }
    });

    return flags;
  }

  /**
   * Check if a feature flag is enabled
   * @param flagName - Name of the feature flag to check
   * @returns boolean indicating if the feature is enabled
   */
  public isEnabled(flagName: FeatureFlagName): boolean {
    return this.flags[flagName].enabled;
  }

  /**
   * Get the current state of all feature flags
   * @returns Record of feature flag states
   */
  public getFeatureStates(): Record<FeatureFlagName, boolean> {
    return Object.entries(this.flags).reduce((acc, [key, config]) => {
      acc[key as FeatureFlagName] = config.enabled;
      return acc;
    }, {} as Record<FeatureFlagName, boolean>);
  }

  /**
   * Log the current state of all feature flags
   */
  public logFeatureStates(): void {
    const states = this.getFeatureStates();
    logger.info('[FEATURE_FLAGS] Current feature flag states:', states);
  }
}

// Export singleton instance
export const featureFlagService = FeatureFlagService.getInstance();

// Export convenience function for checking flags
export function isFeatureEnabled(flagName: FeatureFlagName): boolean {
  return featureFlagService.isEnabled(flagName);
} 