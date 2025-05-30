/**
 * Feature Flags
 * 
 * Simple feature flag implementation.
 * 
 * Last Updated: Sat May 25 2025
 */

/**
 * Check if a feature is enabled
 * @param featureName Name of the feature to check
 * @returns Whether the feature is enabled
 */
export function isFeatureEnabled(featureName: string): boolean {
  // For now, return a simple check for environment variables
  return process.env[`FEATURE_${featureName.toUpperCase()}`] === 'true';
}

/**
 * Get the value of a feature flag
 * @param featureName Name of the feature flag
 * @param defaultValue Default value if not set
 * @returns Feature flag value or default
 */
export function getFeatureFlagValue<T>(featureName: string, defaultValue: T): T {
  const envVar = process.env[`FEATURE_${featureName.toUpperCase()}`];
  if (envVar === undefined) return defaultValue;
  
  // Try to parse the value based on the type of defaultValue
  try {
    if (typeof defaultValue === 'number') {
      return Number(envVar) as unknown as T;
    } else if (typeof defaultValue === 'boolean') {
      return (envVar.toLowerCase() === 'true') as unknown as T;
    } else {
      return envVar as unknown as T;
    }
  } catch (e) {
    return defaultValue;
  }
} 