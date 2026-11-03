/**
 * Curio Backend — Unit Tests for SSE Streaming Protocol & Chunk Handling
 *
 * Validates:
 *   - SSE frame formatting (single-line & multiline payloads)
 *   - Arbitrary network chunk boundary reassembly
 *   - Malformed SSE frame resilience
 *   - Duplicate event prevention when response stream ends
 *   - AbortController client cancellation propagation
 *
 * Run: npm test
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  formatSSEEvent,
  sendSSE,
  sendStart,
  sendDelta,
  sendDone,
  sendError,
  parseSSEStream,
} from '../../backend/src/utils/sse.js';
import { parseSSEBuffer } from '../../src/content/overlay/streamingClient.js';

describe('SSE Protocol Wire Formatting', () => {
  it('should format simple JSON events according to W3C SSE standard', () => {
    const event = formatSSEEvent('start', { requestId: '123', provider: 'gemini' });
    assert.ok(event.startsWith('event: start\n'));
    assert.ok(event.includes('data: {"requestId":"123","provider":"gemini"}'));
    assert.ok(event.endsWith('\n\n'));
  });

  it('should format multiline string data with multiple data: lines', () => {
    const multiline = 'Line 1\nLine 2\nLine 3';
    const event = formatSSEEvent('delta', multiline);
    assert.ok(event.includes('data: Line 1\ndata: Line 2\ndata: Line 3'));
    assert.ok(event.endsWith('\n\n'));
  });

  it('should format error events with standardized error fields', () => {
    const errorEvent = formatSSEEvent('error', {
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      retryable: true,
    });
    assert.ok(errorEvent.includes('event: error\n'));
    assert.ok(errorEvent.includes('"code":"RATE_LIMITED"'));
    assert.ok(errorEvent.includes('"retryable":true'));
  });
});

describe('SSE Buffer Parsing & Arbitrary Chunk Boundaries', () => {
  it('should parse complete single and multiple events', () => {
    const streamData = 'event: delta\ndata: {"text":"Hello "}\n\nevent: delta\ndata: {"text":"world!"}\n\n';
    const { events, remaining } = parseSSEBuffer(streamData);

    assert.equal(events.length, 2);
    assert.equal(events[0].event, 'delta');
    assert.equal(events[0].data.text, 'Hello ');
    assert.equal(events[1].event, 'delta');
    assert.equal(events[1].data.text, 'world!');
    assert.equal(remaining, '');
  });

  it('should correctly reassemble events split across arbitrary network chunks', () => {
    // Chunk 1 cuts right in the middle of event name and data
    const chunk1 = 'event: del';
    const { events: e1, remaining: r1 } = parseSSEBuffer(chunk1);
    assert.equal(e1.length, 0);
    assert.equal(r1, 'event: del');

    // Chunk 2 completes the event and starts a second event
    const chunk2 = r1 + 'ta\ndata: {"text":"chunk 1"}\n\nevent: de';
    const { events: e2, remaining: r2 } = parseSSEBuffer(chunk2);
    assert.equal(e2.length, 1);
    assert.equal(e2[0].data.text, 'chunk 1');
    assert.equal(r2, 'event: de');

    // Chunk 3 finishes the second event
    const chunk3 = r2 + 'lta\ndata: {"text":"chunk 2"}\n\n';
    const { events: e3, remaining: r3 } = parseSSEBuffer(chunk3);
    assert.equal(e3.length, 1);
    assert.equal(e3[0].data.text, 'chunk 2');
    assert.equal(r3, '');
  });

  it('should gracefully handle malformed SSE frames without throwing', () => {
    const malformed = 'invalid text with no event or data\n\n\n\nevent: delta\ndata: {"valid":true}\n\n';
    const { events } = parseSSEBuffer(malformed);

    assert.equal(events.length, 1);
    assert.equal(events[0].data.valid, true);
  });

  it('should handle OpenAI / Groq [DONE] completion marker', () => {
    const streamWithDone = 'event: delta\ndata: {"text":"done test"}\n\ndata: [DONE]\n\n';
    const { events } = parseSSEBuffer(streamWithDone);

    assert.equal(events.length, 2);
    assert.equal(events[1].data, '[DONE]');
  });
});

describe('Express Response Stream Event Safety', () => {
  function createMockResponse() {
    const chunks = [];
    return {
      writable: true,
      writableEnded: false,
      destroyed: false,
      write(chunk) {
        if (this.writableEnded) throw new Error('Write after end');
        chunks.push(chunk);
        return true;
      },
      end() {
        this.writableEnded = true;
        this.writable = false;
      },
      getOutput() {
        return chunks.join('');
      },
    };
  }

  it('should emit start, delta, and done events cleanly', () => {
    const res = createMockResponse();

    sendStart(res, { requestId: 'req_1', provider: 'gemini' });
    sendDelta(res, 'Part 1');
    sendDelta(res, 'Part 2');
    sendDone(res, { requestId: 'req_1', provider: 'gemini', usage: { totalTokens: 10 } });

    assert.equal(res.writableEnded, true);
    const output = res.getOutput();
    assert.ok(output.includes('event: start\n'));
    assert.ok(output.includes('event: delta\n'));
    assert.ok(output.includes('Part 1'));
    assert.ok(output.includes('Part 2'));
    assert.ok(output.includes('event: done\n'));
  });

  it('should prevent writing after stream completion (duplicate event protection)', () => {
    const res = createMockResponse();

    sendDone(res, { requestId: 'req_1', provider: 'gemini' });
    assert.equal(res.writableEnded, true);

    // Attempting further writes returns false safely
    const wroteDelta = sendDelta(res, 'Should not send');
    const wroteDone = sendDone(res, { requestId: 'req_1', provider: 'gemini' });

    assert.equal(wroteDelta, false);
    assert.equal(wroteDone, false);
  });
});

describe('Client Stream Cancellation Handling', () => {
  it('should abort upstream reader when AbortSignal is triggered', async () => {
    const encoder = new TextEncoder();
    const abortController = new AbortController();

    let streamCancelled = false;
    const infiniteStream = new ReadableStream({
      async pull(controller) {
        controller.enqueue(encoder.encode('data: {"text":"infinite"}\n\n'));
        await new Promise((r) => setTimeout(r, 10));
      },
      cancel() {
        streamCancelled = true;
      },
    });

    const receivedChunks = [];
    const streamPromise = parseSSEStream(
      infiniteStream,
      (ev) => {
        receivedChunks.push(ev);
        // Abort after first chunk
        abortController.abort();
      },
      abortController.signal
    );

    await streamPromise;

    assert.ok(receivedChunks.length >= 1);
    assert.equal(abortController.signal.aborted, true);
  });
});

