/**
 * Curio Backend — Integration Tests for Explanation Streaming & Failover
 *
 * Validates:
 *   - Health endpoint operational reporting
 *   - Request validation schemas (rejection of invalid/oversized payloads)
 *   - Progressive streaming flow via explanationService
 *   - Pre-stream failover to secondary provider when primary fails before first delta
 *   - Mid-stream failure isolation (never concatenate partial responses)
 *   - Follow-up conversational question streaming
 *
 * Run: npm test
 */

import { strict as assert } from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import { ExplainStreamSchema, FollowUpStreamSchema } from '../../backend/src/middleware/validation.js';
import { explanationService } from '../../backend/src/services/ai/explanationService.js';
import { aiProviderFactory } from '../../backend/src/services/ai/aiProviderFactory.js';
import { healthController } from '../../backend/src/controllers/healthController.js';

// Helper mock response
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
    getParsedEvents() {
      const raw = chunks.join('');
      const parts = raw.split(/\n\n/).filter(Boolean);
      return parts.map((part) => {
        const lines = part.split('\n');
        let event = 'message';
        let data = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) event = line.slice(7);
          if (line.startsWith('data: ')) data = line.slice(6);
        }
        try {
          return { event, data: JSON.parse(data) };
        } catch (_e) {
          return { event, data };
        }
      });
    },
  };
}

describe('Health Check Endpoint', () => {
  it('should return operational status without leaking API keys or secrets', async () => {
    let statusCode = null;
    let jsonResponse = null;

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    await healthController.getHealth({}, mockRes);

    assert.equal(statusCode, 200);
    assert.ok(jsonResponse.status === 'healthy' || jsonResponse.status === 'degraded');
    assert.equal(jsonResponse.version, '1.0.0');
    assert.ok(jsonResponse.services.aiProviders);

    // Verify secrets are strictly not exposed
    const stringified = JSON.stringify(jsonResponse);
    assert.ok(!stringified.includes('AIza'));
    assert.ok(!stringified.includes('gsk_'));
    assert.ok(!stringified.includes('secret'));
  });
});

describe('Explanation Request Validation Schemas', () => {
  it('should reject empty or missing selectedText', () => {
    const emptyResult = ExplainStreamSchema.safeParse({ selectedText: '' });
    assert.equal(emptyResult.success, false);

    const whitespaceResult = ExplainStreamSchema.safeParse({ selectedText: '   ' });
    assert.equal(whitespaceResult.success, false);

    const missingResult = ExplainStreamSchema.safeParse({});
    assert.equal(missingResult.success, false);
  });

  it('should reject excessively large selectedText (>15,000 characters)', () => {
    const hugeText = 'x'.repeat(16000);
    const result = ExplainStreamSchema.safeParse({ selectedText: hugeText });
    assert.equal(result.success, false);
  });

  it('should accept valid explanation payload and transform simple to beginner', () => {
    const valid = {
      selectedText: 'useMemo',
      surroundingContext: 'React optimization hooks memoize calculations.',
      explanationLevel: 'simple',
      provider: 'gemini',
    };

    const parsed = ExplainStreamSchema.parse(valid);
    assert.equal(parsed.selectedText, 'useMemo');
    assert.equal(parsed.explanationLevel, 'beginner');
    assert.equal(parsed.provider, 'gemini');
  });

  it('should validate follow-up question payloads and reject conversationHistory > 10 items', () => {
    const tooManyHistory = Array.from({ length: 15 }, (_, i) => ({
      role: 'user',
      content: `Question ${i}`,
    }));

    const result = FollowUpStreamSchema.safeParse({
      selectedText: 'iterable',
      question: 'Can you show an example?',
      conversationHistory: tooManyHistory,
    });

    assert.equal(result.success, false);
  });
});

describe('Explanation Streaming Orchestration & Failover', () => {
  beforeEach(() => {
    aiProviderFactory.resetProviders();
  });

  it('should successfully stream explanation chunks and finish with done event', async () => {
    const mockProvider = {
      name: 'mock_working',
      model: 'mock-model-v1',
      isAvailable: () => true,
      async streamExplanation(options, onDelta) {
        onDelta('First explanation part. ');
        onDelta('Second explanation part.');
        return { usage: { inputTokens: 10, outputTokens: 20 } };
      },
    };

    aiProviderFactory.registerProvider('mock_working', mockProvider);

    const res = createMockStreamResponse();
    await explanationService.streamExplanation(
      {
        selectedText: 'test_token',
        provider: 'mock_working',
        explanationLevel: 'intermediate',
      },
      res
    );

    const events = res.getParsedEvents();
    assert.equal(events[0].event, 'start');
    assert.equal(events[0].data.provider, 'mock_working');

    assert.equal(events[1].event, 'delta');
    assert.equal(events[1].data.text, 'First explanation part. ');

    assert.equal(events[2].event, 'delta');
    assert.equal(events[2].data.text, 'Second explanation part.');

    assert.equal(events[3].event, 'done');
    assert.equal(events[3].data.provider, 'mock_working');
    assert.equal(events[3].data.usage.outputTokens, 20);
  });

  it('should failover to secondary provider when primary fails before emitting any deltas', async () => {
    const failingPrimary = {
      name: 'failing_primary',
      model: 'fail-v1',
      isAvailable: () => true,
      async streamExplanation() {
        throw new Error('Primary connection failed immediately');
      },
    };

    const healthySecondary = {
      name: 'healthy_secondary',
      model: 'healthy-v1',
      isAvailable: () => true,
      async streamExplanation(options, onDelta) {
        onDelta('Content successfully recovered via secondary provider.');
        return { usage: { totalTokens: 15 } };
      },
    };

    aiProviderFactory.registerProvider('failing_primary', failingPrimary);
    aiProviderFactory.registerProvider('healthy_secondary', healthySecondary);

    const res = createMockStreamResponse();
    await explanationService.streamExplanation(
      {
        selectedText: 'failover_test',
        provider: 'failing_primary',
      },
      res
    );

    const events = res.getParsedEvents();
    // Verify failover started with secondary
    const startEvents = events.filter((e) => e.event === 'start');
    assert.ok(startEvents.length >= 1);

    const deltaEvents = events.filter((e) => e.event === 'delta');
    assert.equal(deltaEvents.length, 1);
    assert.equal(deltaEvents[0].data.text, 'Content successfully recovered via secondary provider.');

    const doneEvent = events.find((e) => e.event === 'done');
    assert.ok(doneEvent);
    assert.equal(doneEvent.data.provider, 'healthy_secondary');
  });

  it('should NEVER failover or concatenate if error occurs mid-stream (after deltas sent)', async () => {
    let secondaryInvoked = false;

    const midStreamFailing = {
      name: 'mid_stream_failing',
      model: 'mid-v1',
      isAvailable: () => true,
      async streamExplanation(options, onDelta) {
        onDelta('First half of answer successfully emitted.');
        throw new Error('Network cable unplugged mid-stream!');
      },
    };

    const secondaryBackup = {
      name: 'secondary_backup',
      isAvailable: () => true,
      async streamExplanation() {
        secondaryInvoked = true;
      },
    };

    aiProviderFactory.registerProvider('mid_stream_failing', midStreamFailing);
    aiProviderFactory.registerProvider('secondary_backup', secondaryBackup);

    const res = createMockStreamResponse();
    await explanationService.streamExplanation(
      {
        selectedText: 'mid_stream_test',
        provider: 'mid_stream_failing',
      },
      res
    );

    assert.equal(secondaryInvoked, false, 'Secondary provider must NEVER be invoked after deltas have been sent');

    const events = res.getParsedEvents();
    const errorEvent = events.find((e) => e.event === 'error');
    assert.ok(errorEvent, 'Must emit error event rather than concatenating responses');
  });

  it('should stream follow-up conversational question responses', async () => {
    const followUpMock = {
      name: 'fu_mock',
      isAvailable: () => true,
      async streamFollowUp(options, onDelta) {
        onDelta(`Follow-up answer to "${options.question}"`);
        return { usage: { outputTokens: 8 } };
      },
    };

    aiProviderFactory.registerProvider('fu_mock', followUpMock);

    const res = createMockStreamResponse();
    await explanationService.streamFollowUp(
      {
        selectedText: 'map',
        question: 'Can you show a lambda example?',
        provider: 'fu_mock',
      },
      res
    );

    const events = res.getParsedEvents();
    assert.equal(events[0].event, 'start');
    assert.equal(events[1].event, 'delta');
    assert.ok(events[1].data.text.includes('lambda example'));
    assert.equal(events[2].event, 'done');
  });
});
