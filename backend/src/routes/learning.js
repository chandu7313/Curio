/**
 * Curio Backend — Learning Intelligence & Sync Routes
 *
 * Validates payloads with Zod and synchronizes local extension concepts
 * with PostgreSQL storage.
 *
 * @module backend/routes/learning
 */

import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';

const router = Router();

// ─── Zod Schemas for Request Validation ───────────────────────────────

const ConceptSyncItemSchema = z.object({
  id: z.string().min(1),
  term: z.string().min(1).max(255),
  selectedText: z.string().min(1),
  category: z.string().default('General'),
  understandingLevel: z.enum(['need_explanation', 'reviewing', 'understood']).default('reviewing'),
  isSaved: z.boolean().default(false),
  notes: z.string().default(''),
  exploreCount: z.number().int().min(1).default(1),
  firstExploredAt: z.number(),
  lastExploredAt: z.number(),
  sourceUrl: z.string().optional().default(''),
  sourceTitle: z.string().optional().default(''),
  explanation: z
    .object({
      title: z.string().default(''),
      summary: z.string().default(''),
      keyPoints: z.array(z.string()).default([]),
      codeExample: z
        .object({
          language: z.string().optional(),
          code: z.string(),
          caption: z.string().optional(),
        })
        .nullable()
        .optional(),
      deepDive: z.string().nullable().optional(),
      mode: z.string().default('intermediate'),
    })
    .optional(),
  relatedConcepts: z
    .array(
      z.object({
        term: z.string(),
        relation: z.string(),
        label: z.string().optional(),
      })
    )
    .default([]),
});

const SyncPayloadSchema = z.object({
  userId: z.string().uuid(),
  concepts: z.array(ConceptSyncItemSchema),
});

// ─── Routes ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/sync
 * Bulk synchronizes concepts from the extension into PostgreSQL.
 */
router.post('/sync', async (req, res, next) => {
  try {
    const parseResult = SyncPayloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid synchronization payload',
        details: parseResult.error.errors,
      });
    }

    const { userId, concepts } = parseResult.data;
    let syncedCount = 0;

    for (const item of concepts) {
      await query(
        `INSERT INTO concepts (
          user_id, client_id, term, selected_text, category,
          understanding_level, is_saved, notes, explore_count,
          first_explored_at, last_explored_at, source_url, source_title
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, to_timestamp($10 / 1000.0), to_timestamp($11 / 1000.0), $12, $13
        )
        ON CONFLICT (user_id, client_id) DO UPDATE SET
          term = EXCLUDED.term,
          category = EXCLUDED.category,
          understanding_level = EXCLUDED.understanding_level,
          is_saved = EXCLUDED.is_saved,
          notes = EXCLUDED.notes,
          explore_count = EXCLUDED.explore_count,
          last_explored_at = EXCLUDED.last_explored_at,
          updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          item.id,
          item.term,
          item.selectedText,
          item.category,
          item.understandingLevel,
          item.isSaved,
          item.notes,
          item.exploreCount,
          item.firstExploredAt,
          item.lastExploredAt,
          item.sourceUrl,
          item.sourceTitle,
        ]
      );
      syncedCount++;
    }

    return res.json({
      success: true,
      data: {
        syncedRecords: syncedCount,
        serverTimestamp: Date.now(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/concepts
 * Retrieve synced concepts for an authenticated user.
 */
router.get('/concepts', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing x-user-id authentication header' });
    }

    const result = await query(
      `SELECT client_id as id, term, selected_text, category,
              understanding_level, is_saved, notes, explore_count,
              extract(epoch from first_explored_at) * 1000 as first_explored_at,
              extract(epoch from last_explored_at) * 1000 as last_explored_at,
              source_url, source_title
       FROM concepts
       WHERE user_id = $1
       ORDER BY last_explored_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/user/data
 * Compliance & Privacy: Wipe all data for a user upon request.
 */
router.delete('/user/data', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing x-user-id header' });
    }

    await query('DELETE FROM concepts WHERE user_id = $1', [userId]);

    return res.json({
      success: true,
      message: 'All personal learning data deleted from server.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;

