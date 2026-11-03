/**
 * Curio Backend — Request Validation Middleware (Zod)
 *
 * Enforces strict input validation on all AI endpoints.
 * Protects backend from oversized payloads, invalid provider identifiers,
 * and malicious or malformed context structures.
 *
 * @module backend/middleware/validation
 */

import { z } from 'zod';

export const ExplainStreamSchema = z.object({
  selectedText: z
    .string({ required_error: 'selectedText is required' })
    .trim()
    .min(1, 'selectedText cannot be empty')
    .max(15000, 'selectedText exceeds maximum length (15,000 chars)'),
  surroundingContext: z
    .string()
    .max(10000, 'surroundingContext exceeds maximum allowed length')
    .optional()
    .default(''),
  surroundingSentence: z
    .string()
    .max(2000, 'surroundingSentence exceeds maximum allowed length')
    .optional()
    .default(''),
  pageTitle: z.string().max(500).optional().default(''),
  pageUrl: z.string().max(2000).optional().default(''),
  contentType: z.string().max(100).optional().default('general_text'),
  selectionType: z
    .enum(['word', 'sentence', 'paragraph', 'multi_paragraph', 'code', 'math'])
    .optional()
    .default('word'),
  explanationLevel: z
    .enum(['beginner', 'intermediate', 'advanced', 'simple'])
    .transform((val) => (val === 'simple' ? 'beginner' : val))
    .default('intermediate'),
  provider: z
    .enum(['gemini', 'groq'])
    .optional(),
  model: z.string().max(100).optional(),
});

export const FollowUpStreamSchema = z.object({
  sessionId: z.string().max(120).optional(),
  selectedText: z
    .string({ required_error: 'selectedText is required' })
    .trim()
    .min(1, 'selectedText cannot be empty')
    .max(15000),
  surroundingContext: z.string().max(10000).optional().default(''),
  previousExplanation: z.string().max(15000).optional().default(''),
  summary: z.string().max(3000).optional().default(''),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'model']),
        content: z.string().max(6000),
      })
    )
    .max(10, 'conversationHistory exceeds maximum turn limit of 10')
    .optional()
    .default([]),
  question: z
    .string({ required_error: 'question is required' })
    .trim()
    .min(1, 'question cannot be empty')
    .max(2000, 'question exceeds maximum length (2000 chars)'),
  explanationLevel: z
    .enum(['beginner', 'intermediate', 'advanced', 'simple'])
    .transform((val) => (val === 'simple' ? 'beginner' : val))
    .default('intermediate'),
  provider: z
    .enum(['gemini', 'groq'])
    .optional(),
  model: z.string().max(100).optional(),
});

/**
 * Express middleware generator for validating request bodies against a Zod schema.
 *
 * @param {z.ZodSchema} schema
 * @returns {import('express').RequestHandler}
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    req.validatedBody = result.data;
    next();
  };
}

