/**
 * Curio Backend — AI Provider Factory
 *
 * Implements the Provider Pattern to decouple explanation logic from
 * specific model vendors. Allows dynamic switching between Gemini, Groq,
 * and test mock providers.
 *
 * @module backend/services/ai/aiProviderFactory
 */

import { GeminiProvider } from './providers/geminiProvider.js';
import { GroqProvider } from './providers/groqProvider.js';
import { config } from '../../config/env.js';

export class AIProviderFactory {
  constructor() {
    this.providers = new Map();
    this.registerBuiltInProviders();
  }

  registerBuiltInProviders() {
    this.registerProvider('gemini', new GeminiProvider());
    this.registerProvider('groq', new GroqProvider());
  }

  /**
   * Register a provider instance.
   * Useful for registering custom or mock providers during testing.
   *
   * @param {string} name
   * @param {Object} providerInstance
   */
  registerProvider(name, providerInstance) {
    if (!name || !providerInstance) {
      throw new Error('Provider name and instance are required.');
    }
    this.providers.set(name.toLowerCase(), providerInstance);
  }

  /**
   * Unregister a provider by name.
   * @param {string} name
   */
  unregisterProvider(name) {
    if (name) {
      this.providers.delete(name.toLowerCase());
    }
  }

  /**
   * Reset providers back to default built-ins.
   */
  resetProviders() {
    this.providers.clear();
    this.registerBuiltInProviders();
  }

  /**
   * Retrieve a provider by name or return the configured default.
   *
   * @param {string} [name] - Requested provider name ('gemini', 'groq')
   * @returns {Object} The provider instance
   */
  getProvider(name) {
    const targetName = (name || config.DEFAULT_AI_PROVIDER || 'gemini').toLowerCase();
    const provider = this.providers.get(targetName);

    if (provider) {
      return provider;
    }

    // Fallback to default configured provider
    const defaultProvider = this.providers.get(config.DEFAULT_AI_PROVIDER.toLowerCase());
    if (defaultProvider) {
      return defaultProvider;
    }

    // Last resort fallback: first registered provider
    const first = this.providers.values().next().value;
    if (first) {
      return first;
    }

    throw new Error(`No AI providers registered in Curio factory.`);
  }

  /**
   * Check if a specific provider is configured and available.
   * @param {string} name
   * @returns {boolean}
   */
  isProviderAvailable(name) {
    const provider = this.providers.get((name || '').toLowerCase());
    return Boolean(provider && provider.isAvailable());
  }

  /**
   * Get all registered provider names that are currently configured with active API keys.
   * @returns {string[]}
   */
  getAvailableProviders() {
    const ready = [];
    for (const [name, provider] of this.providers.entries()) {
      if (provider.isAvailable()) {
        ready.push(name);
      }
    }
    return ready;
  }

  /**
   * Find an alternative fallback provider if failover is permitted and
   * an alternative has an active API key.
   *
   * @param {string} failedProviderName
   * @returns {Object|null}
   */
  getFallbackProvider(failedProviderName) {
    if (!config.ENABLE_PROVIDER_FAILOVER) {
      return null;
    }

    const failed = (failedProviderName || '').toLowerCase();
    for (const [name, provider] of this.providers.entries()) {
      if (name !== failed && provider.isAvailable()) {
        return provider;
      }
    }

    return null;
  }
}

// Export singleton instance
export const aiProviderFactory = new AIProviderFactory();
export default aiProviderFactory;
