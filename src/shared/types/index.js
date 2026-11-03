/**
 * Curio — Strongly Typed Message & State Contracts (Pure JavaScript with Zod & JSDoc)
 * Manifest V3 Compliant Architecture
 */

import { z } from 'zod';

/**
 * Zod Schemas for Runtime Validation
 */

export const AIProviderSchema = z.enum(['gemini', 'groq', 'openai', 'anthropic']);

export const ExplanationStyleSchema = z.enum(['concise', 'detailed', 'simple']);

export const ThemeModeSchema = z.enum(['light', 'dark', 'system']);

export const AppSettingsSchema = z.object({
  shortcut: z.string().default('Alt+Shift+E'),
  theme: ThemeModeSchema.default('system'),
  aiProvider: AIProviderSchema.default('gemini'),
  apiKey: z.string().default(''),
  model: z.string().default('gemini-2.0-flash'),
  explanationStyle: ExplanationStyleSchema.default('concise'),
  enabled: z.boolean().default(true),
  showFloatingButton: z.boolean().default(true),
  contextWindowSize: z.number().min(100).max(1000).default(500),
});

export const ContentTypeSchema = z.enum([
  'general_text',
  'programming_code',
  'technical_terminology',
  'mathematical_expression',
  'abbreviation',
  'other',
  // legacy aliases for backwards compatibility
  'prose',
  'code',
  'math',
  'input',
]);

export const SelectionTypeSchema = z.enum([
  'word',
  'sentence',
  'paragraph',
  'multi_paragraph',
  'code',
  'math',
]);

export const SelectionRectSchema = z.object({
  top: z.number(),
  left: z.number(),
  width: z.number(),
  height: z.number(),
  bottom: z.number().optional(),
  right: z.number().optional(),
});

export const SelectionPayloadSchema = z.preprocess(
  (val) => {
    if (val && typeof val === 'object') {
      const obj = { ...val };

      // Synchronize sentence and surroundingSentence
      if (obj.sentence && !obj.surroundingSentence) {
        obj.surroundingSentence = obj.sentence;
      } else if (obj.surroundingSentence && !obj.sentence) {
        obj.sentence = obj.surroundingSentence;
      }

      // Synchronize paragraph and surroundingParagraph
      if (obj.paragraph && !obj.surroundingParagraph) {
        obj.surroundingParagraph = obj.paragraph;
      } else if (obj.surroundingParagraph && !obj.paragraph) {
        obj.paragraph = obj.surroundingParagraph;
      }

      // Synchronize boundingBox and selectionRect
      if (obj.boundingBox && !obj.selectionRect) {
        obj.selectionRect = {
          top: obj.boundingBox.top,
          left: obj.boundingBox.left,
          width: obj.boundingBox.width,
          height: obj.boundingBox.height,
          bottom: obj.boundingBox.bottom,
          right: obj.boundingBox.right,
        };
      } else if (obj.selectionRect && !obj.boundingBox) {
        obj.boundingBox = {
          top: obj.selectionRect.top,
          left: obj.selectionRect.left,
          width: obj.selectionRect.width,
          height: obj.selectionRect.height,
          bottom: obj.selectionRect.bottom ?? (obj.selectionRect.top + obj.selectionRect.height),
          right: obj.selectionRect.right ?? (obj.selectionRect.left + obj.selectionRect.width),
        };
      }

      // Default nodeType to contentType
      if (obj.contentType && !obj.nodeType) {
        obj.nodeType = obj.contentType;
      }

      return obj;
    }
    return val;
  },
  z.object({
    selectedText: z.string().min(1),
    contentType: ContentTypeSchema.default('prose'),
    selectionType: SelectionTypeSchema.default('word'),
    surroundingSentence: z.string().default(''),
    surroundingParagraph: z.string().default(''),
    pageTitle: z.string().default(''),
    pageUrl: z.string().default(''),
    selectionRect: SelectionRectSchema.optional(),
    timestamp: z.number().default(() => Date.now()),

    // Backwards-compatible aliases
    sentence: z.string().default(''),
    paragraph: z.string().default(''),
    precedingText: z.string().default(''),
    succeedingText: z.string().default(''),
    nearestHeading: z.string().nullable().optional(),
    boundingBox: z
      .object({
        top: z.number(),
        left: z.number(),
        bottom: z.number(),
        right: z.number(),
        width: z.number(),
        height: z.number(),
      })
      .optional(),
    nodeType: z.string().default('prose'),
    language: z.string().nullable().optional(),
  })
);

export const ExtensionMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PING'), timestamp: z.number() }),
  z.object({ type: z.literal('PONG'), version: z.string(), isReady: z.boolean() }),
  z.object({ type: z.literal('GET_SETTINGS') }),
  z.object({ type: z.literal('SAVE_SETTINGS'), payload: AppSettingsSchema.partial() }),
  z.object({ type: z.literal('GET_STATUS') }),
  z.object({ type: z.literal('TRIGGER_SELECTION_FLOW') }),
  z.object({ type: z.literal('SELECTION_CAPTURED'), payload: SelectionPayloadSchema }),
  z.object({ type: z.literal('SHORTCUT_TRIGGERED'), shortcut: z.string() }),
  z.object({ type: z.literal('OPEN_OPTIONS_PAGE') }),
  z.object({
    type: z.literal('SHOW_TOAST'),
    message: z.string(),
    toastType: z.enum(['info', 'success', 'warning', 'error']).optional(),
  }),
]);

/**
 * @typedef {z.infer<typeof AIProviderSchema>} AIProvider
 * @typedef {z.infer<typeof ExplanationStyleSchema>} ExplanationStyle
 * @typedef {z.infer<typeof ThemeModeSchema>} ThemeMode
 * @typedef {z.infer<typeof AppSettingsSchema>} AppSettings
 * @typedef {z.infer<typeof SelectionPayloadSchema>} SelectionPayload
 * @typedef {z.infer<typeof ExtensionMessageSchema>} ExtensionMessage
 */

/**
 * @typedef {Object} MessageResponse
 * @property {boolean} success
 * @property {any} [data]
 * @property {string} [error]
 */

/**
 * @typedef {Object} ExtensionStatus
 * @property {string} version
 * @property {number} manifestVersion
 * @property {boolean} serviceWorkerActive
 * @property {boolean} contentScriptInjected
 * @property {number} [tabId]
 * @property {string} [tabUrl]
 */

/**
 * Default Settings Configuration
 * @type {AppSettings}
 */
export const DEFAULT_SETTINGS = Object.freeze({
  shortcut: 'Alt+Shift+E',
  theme: 'system',
  aiProvider: 'gemini',
  apiKey: '',
  model: 'gemini-2.0-flash',
  explanationStyle: 'concise',
  enabled: true,
  showFloatingButton: true,
  contextWindowSize: 500,
});

