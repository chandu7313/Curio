/**
 * Curio — Conversational AI & Contextual Follow-up Engine Test Suite
 *
 * Exhaustively tests:
 *   1. Session Architecture & ID isolation
 *   2. Context retention across multiple follow-up turns
 *   3. Bounded history windowing & automatic summarization
 *   4. Prompt orchestration with original context preservation
 *   5. AbortController streaming cancellation & upstream cleanup
 *   6. Error handling & conversational retry capabilities
 *   7. Dynamic provider switching & offline mock fallback
 *   8. Session reset upon new, distinct text selections
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateSessionId,
  createExplanationSession,
  isSameSelectionSession,
  addSessionMessage,
  updateLastSessionMessage,
  summarizeConversationHistory,
  getBoundedHistory,
} from '../../src/shared/services/sessionManager.js';

import {
  buildFollowUpUserPrompt,
  buildSystemPrompt,
} from '../../backend/src/services/ai/promptBuilder.js';

import { FollowUpStreamSchema } from '../../backend/src/middleware/validation.js';
import { aiProviderFactory } from '../../backend/src/services/ai/aiProviderFactory.js';
import { explanationService } from '../../backend/src/services/ai/explanationService.js';

describe('Conversational Session Architecture & Isolation', () => {
  it('should generate cryptographically distinct session IDs with curio_sess prefix', () => {
    const id1 = generateSessionId();
    const id2 = generateSessionId();

    assert.ok(id1.startsWith('curio_sess_'));
    assert.ok(id2.startsWith('curio_sess_'));
    assert.notEqual(id1, id2);
  });

  it('should initialize a complete explanation session holding original selection context', () => {
    const mockContext = {
      selectedText: 'Python map()',
      paragraph: 'In functional programming, Python map() applies a function to all items in an input list.',
      sentence: 'Python map() applies a function to all items in an input list.',
      pageTitle: 'Python Built-in Functions',
      pageUrl: 'https://docs.python.org/3/library/functions.html#map',
      contentType: 'programming_code',
      language: 'python',
    };

    const session = createExplanationSession(mockContext, 'intermediate', 'gemini');

    assert.ok(session.sessionId.startsWith('curio_sess_'));
    assert.equal(session.selectedText, 'Python map()');
    assert.equal(session.surroundingContext, mockContext.paragraph);
    assert.equal(session.contentType, 'programming_code');
    assert.equal(session.explanationLevel, 'intermediate');
    assert.equal(session.provider, 'gemini');
    assert.deepEqual(session.messages, []);
    assert.equal(session.summary, '');
    assert.ok(session.createdAt > 0);
  });

  it('should isolate sessions and recognize when a new user selection warrants a new session', () => {
    const session = createExplanationSession({ selectedText: 'Python map()' });

    // Same selection (same session)
    assert.equal(isSameSelectionSession(session, { selectedText: 'Python map()' }), true);
    assert.equal(isSameSelectionSession(session, { text: '  Python map()  ' }), true);

    // Different selection (requires new session)
    assert.equal(isSameSelectionSession(session, { selectedText: 'Python filter()' }), false);
    assert.equal(isSameSelectionSession(session, { selectedText: 'list comprehension' }), false);
    assert.equal(isSameSelectionSession(session, null), false);
  });
});

describe('Continuous Multi-Turn Conversation & Bounded Memory', () => {
  it('should append user and assistant messages, tracking status and timestamps', () => {
    const session = createExplanationSession({ selectedText: 'Python map()' });

    addSessionMessage(session, { role: 'user', content: 'What is the difference between map() and filter()?' });
    assert.equal(session.messages.length, 1);
    assert.equal(session.messages[0].role, 'user');
    assert.equal(session.messages[0].content, 'What is the difference between map() and filter()?');

    addSessionMessage(session, { role: 'assistant', content: 'map() transforms items, while filter() selects items.', status: 'completed' });
    assert.equal(session.messages.length, 2);
    assert.equal(session.messages[1].role, 'assistant');
    assert.equal(session.messages[1].status, 'completed');
  });

  it('should update active assistant message during streaming deltas', () => {
    const session = createExplanationSession({ selectedText: 'Python map()' });
    addSessionMessage(session, { role: 'user', content: 'Show an example' });
    addSessionMessage(session, { role: 'assistant', content: '', status: 'streaming' });

    updateLastSessionMessage(session, 'numbers = [1, 2, 3]\n', 'streaming');
    assert.equal(session.messages[1].content, 'numbers = [1, 2, 3]\n');
    assert.equal(session.messages[1].status, 'streaming');

    updateLastSessionMessage(session, 'numbers = [1, 2, 3]\nsquared = list(map(lambda x: x**2, numbers))', 'completed');
    assert.equal(session.messages[1].status, 'completed');
    assert.ok(session.messages[1].content.includes('squared = list(map'));
  });

  it('should enforce sliding window bounded memory and summarize older turns when history grows large', () => {
    const session = createExplanationSession({ selectedText: 'Python map()' });

    // Simulate 10 turns of conversation (5 Q&A pairs)
    const qaPairs = [
      ['What is map()?', 'map() applies a transformation function across an iterable.'],
      ['Can it take multiple iterables?', 'Yes, map(func, iter1, iter2) consumes elements in parallel.'],
      ['What if iterables have different lengths?', 'map stops when the shortest iterable is exhausted.'],
      ['Does it return a list or an iterator in Python 3?', 'In Python 3 it returns a lazy map object (iterator).'],
      ['How does it compare with list comprehension?', 'List comprehensions are generally more readable and faster in Python.'],
    ];

    for (const [q, a] of qaPairs) {
      addSessionMessage(session, { role: 'user', content: q });
      addSessionMessage(session, { role: 'assistant', content: a, status: 'completed' });
    }

    assert.equal(session.messages.length, 10);

    // Bounded window with maxTurns=4 should return last 4 messages and summarize previous 6
    const bounded = getBoundedHistory(session, 4);

    assert.equal(bounded.recentHistory.length, 4);
    assert.equal(bounded.recentHistory[0].content, 'Does it return a list or an iterator in Python 3?');
    assert.equal(bounded.recentHistory[3].content, 'List comprehensions are generally more readable and faster in Python.');

    // Summary must capture earlier Q&A items
    assert.ok(bounded.summary.length > 0);
    assert.ok(bounded.summary.includes('What is map()'));
    assert.ok(bounded.summary.includes('Can it take multiple iterables?'));
  });
});

describe('Follow-Up Prompt Orchestration & Context Retention', () => {
  it('should preserve original selected content inside delimiters across follow-up queries', () => {
    const prompt = buildFollowUpUserPrompt({
      sessionId: 'curio_sess_test_123',
      selectedText: 'Python map()',
      surroundingContext: 'def square(n): return n*n\nnumbers = [1, 2, 3]',
      previousExplanation: 'map(func, iterable) returns an iterator.',
      question: 'What is the difference between map() and filter()?',
    });

    assert.ok(prompt.includes('Session ID: curio_sess_test_123'));
    assert.ok(prompt.includes('<original_selected_text>\nPython map()\n</original_selected_text>'));
    assert.ok(prompt.includes('<original_context>\ndef square(n): return n*n'));
    assert.ok(prompt.includes('<previous_explanation>\nmap(func, iterable) returns an iterator.'));
    assert.ok(prompt.includes('<user_follow_up_question>\nWhat is the difference between map() and filter()?\n</user_follow_up_question>'));
    assert.ok(prompt.includes('CRITICAL CONVERSATIONAL INSTRUCTIONS:'));
  });

  it('should embed conversational summary when previous history is condensed', () => {
    const prompt = buildFollowUpUserPrompt({
      selectedText: 'Python map()',
      summary: '- Q: "What is map?" -> A: Built-in transformation function.\n- Q: "Lazy?" -> A: Returns generator.',
      question: 'Show an example using lambda.',
    });

    assert.ok(prompt.includes('<earlier_conversation_summary>'));
    assert.ok(prompt.includes('- Q: "What is map?" -> A: Built-in transformation function.'));
    assert.ok(prompt.includes('<user_follow_up_question>\nShow an example using lambda.\n</user_follow_up_question>'));
  });
});

describe('Validation Schema for Conversational Endpoints', () => {
  it('should validate valid follow-up request with sessionId, bounded history and summary', () => {
    const validPayload = {
      sessionId: 'curio_sess_xyz789',
      selectedText: 'Python map()',
      surroundingContext: 'Code block',
      previousExplanation: 'Initial explanation text',
      summary: '- Q: "What is it?" -> A: Functional tool.',
      conversationHistory: [
        { role: 'user', content: 'Difference from filter?' },
        { role: 'assistant', content: 'Filter selects by boolean predicate.' },
      ],
      question: 'Can you show an example with lambda?',
      explanationLevel: 'intermediate',
      provider: 'gemini',
    };

    const parsed = FollowUpStreamSchema.safeParse(validPayload);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.sessionId, 'curio_sess_xyz789');
    assert.equal(parsed.data.conversationHistory.length, 2);
  });

  it('should reject follow-up payload when question is empty or exceeds limit', () => {
    const emptyQ = FollowUpStreamSchema.safeParse({
      selectedText: 'Python map()',
      question: '   ',
    });
    assert.equal(emptyQ.success, false);

    const hugeQ = FollowUpStreamSchema.safeParse({
      selectedText: 'Python map()',
      question: 'a'.repeat(2500),
    });
    assert.equal(hugeQ.success, false);
  });
});

function createMockStreamResponse() {
  const chunks = [];
  return {
    writable: true,
    writableEnded: false,
    destroyed: false,
    write(chunk) {
      chunks.push(chunk);
      return true;
    },
    end() {
      this.writableEnded = true;
      this.writable = false;
    },
    getRawOutput() {
      return chunks.join('');
    },
  };
}

describe('Conversational Streaming, Retry & Cancellation', () => {
  beforeEach(() => {
    aiProviderFactory.resetProviders();
  });

  it('should stream follow-up answer using mock provider and emit standard SSE events', async () => {
    const mockRes = createMockStreamResponse();

    // Register test mock provider
    aiProviderFactory.registerProvider('test-mock', {
      name: 'test-mock',
      model: 'mock-v1',
      isAvailable: () => true,
      streamFollowUp: async (_opts, onDelta) => {
        onDelta('map() and filter() differ in their transformation logic.');
        onDelta(' filter() removes items that evaluate to false.');
        return { usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 } };
      },
    });

    await explanationService.streamFollowUp(
      {
        selectedText: 'Python map()',
        question: 'What is the difference between map() and filter()?',
        provider: 'test-mock',
      },
      mockRes
    );

    const sseOutput = mockRes.getRawOutput();
    assert.ok(sseOutput.includes('event: start'));
    assert.ok(sseOutput.includes('event: delta'));
    assert.ok(sseOutput.includes('map() and filter() differ'));
    assert.ok(sseOutput.includes('event: done'));
  });

  it('should cleanly abort upstream stream when AbortController signal triggers', async () => {
    const mockRes = createMockStreamResponse();
    const ac = new AbortController();

    aiProviderFactory.registerProvider('cancellation-mock', {
      name: 'cancellation-mock',
      model: 'mock-v1',
      isAvailable: () => true,
      streamFollowUp: async (_opts, onDelta, signal) => {
        onDelta('First chunk.');
        ac.abort(); // Cancel stream mid-generation
        if (signal?.aborted) {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          throw err;
        }
      },
    });

    await explanationService.streamFollowUp(
      {
        selectedText: 'Python map()',
        question: 'Explain memory footprint',
        provider: 'cancellation-mock',
      },
      mockRes,
      ac.signal
    );

    const sseOutput = mockRes.getRawOutput();
    assert.ok(!sseOutput.includes('event: error'));
  });

  it('should support conversational retry when primary provider fails before stream starts', async () => {
    const mockRes = createMockStreamResponse();

    aiProviderFactory.registerProvider('failing-primary', {
      name: 'failing-primary',
      model: 'fail-v1',
      isAvailable: () => true,
      streamFollowUp: async () => {
        throw new Error('Primary follow-up capacity reached');
      },
    });

    aiProviderFactory.registerProvider('healthy-backup', {
      name: 'healthy-backup',
      model: 'backup-v1',
      isAvailable: () => true,
      streamFollowUp: async (_opts, onDelta) => {
        onDelta('Backup provider successfully answered follow-up.');
        return { usage: null };
      },
    });

    // Configure fallback
    aiProviderFactory.getFallbackProvider = () => aiProviderFactory.getProvider('healthy-backup');

    await explanationService.streamFollowUp(
      {
        selectedText: 'Python map()',
        question: 'Can you show an example with lambda?',
        provider: 'failing-primary',
      },
      mockRes
    );

    const sseOutput = mockRes.getRawOutput();
    assert.ok(sseOutput.includes('Backup provider successfully answered follow-up.'));
    assert.ok(sseOutput.includes('event: done'));
  });
});
