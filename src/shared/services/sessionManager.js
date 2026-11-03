/**
 * Curio — Conversational Session Management & Bounded Memory Engine
 *
 * Responsibilities:
 *  - Unique session generation (sessionId) per explanation conversation
 *  - Context retention from original webpage selection
 *  - Multi-turn conversation state tracking
 *  - Bounded memory windowing to prevent token explosion
 *  - Conversational history condensation / summarization
 *  - Session isolation: prevents messages from different explanations from mixing
 *
 * @module shared/services/sessionManager
 */

/**
 * Generate a cryptographically random unique session ID.
 * Format: curio_sess_<timestamp>_<randomHex>
 * @returns {string}
 */
export function generateSessionId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `curio_sess_${timestamp}_${randomPart}`;
}

/**
 * Create a fresh explanation conversation session.
 *
 * @param {Object} context - Initial context captured by Selection Engine
 * @param {string} [level='intermediate'] - Initial explanation level
 * @param {string} [provider='gemini'] - Preferred AI provider
 * @returns {Object} ExplanationSession
 */
export function createExplanationSession(context, level = 'intermediate', provider = 'gemini') {
  const cleanSelectedText = (context?.selectedText || context?.text || '').trim();
  const sessionId = generateSessionId();

  return {
    sessionId,
    selectedText: cleanSelectedText,
    surroundingContext: (context?.paragraph || context?.surroundingParagraph || context?.surroundingContext || '').trim(),
    surroundingSentence: (context?.sentence || context?.surroundingSentence || '').trim(),
    pageTitle: (context?.pageTitle || '').trim(),
    pageUrl: (context?.pageUrl || '').trim(),
    contentType: context?.contentType || 'general_text',
    selectionType: context?.selectionType || 'word',
    language: context?.language || null,
    explanationLevel: level,
    provider,
    model: context?.model || null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    initialExplanation: '',
    initialStatus: 'loading', // 'loading' | 'streaming' | 'completed' | 'error'
    messages: [], // Array of { id, role, content, timestamp, status, error? }
    summary: '', // Compressed summary of older turns when conversation grows large
  };
}

/**
 * Verify whether a new context payload belongs to the active session
 * or represents a new, distinct user selection.
 *
 * @param {Object} activeSession - Current active session
 * @param {Object} newContext - Newly captured context
 * @returns {boolean} True if context belongs to current session, false if new session required
 */
export function isSameSelectionSession(activeSession, newContext) {
  if (!activeSession || !activeSession.selectedText) return false;
  if (!newContext) return false;

  const newText = (newContext.selectedText || newContext.text || '').trim();
  if (!newText) return false;

  // Exact match or normalized whitespace match
  return activeSession.selectedText === newText;
}

/**
 * Add a message turn to the session.
 *
 * @param {Object} session - Active session
 * @param {Object} message - { role: 'user' | 'assistant', content: string, status?: string, error?: string }
 * @returns {Object} Updated session
 */
export function addSessionMessage(session, message) {
  const id = `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const turn = {
    id,
    role: message.role === 'user' ? 'user' : 'assistant',
    content: message.content || '',
    timestamp: Date.now(),
    status: message.status || 'completed', // 'streaming' | 'completed' | 'error' | 'cancelled'
    error: message.error || null,
  };

  session.messages.push(turn);
  session.updatedAt = Date.now();

  // If messages grow beyond threshold, trigger background summarization
  if (session.messages.length > 8 && !session.summary) {
    session.summary = summarizeConversationHistory(session.messages.slice(0, session.messages.length - 4));
  }

  return session;
}

/**
 * Update the last assistant message (used during streaming deltas).
 *
 * @param {Object} session
 * @param {string} fullText - Accumulated streaming text
 * @param {string} [status='streaming']
 * @param {string} [error=null]
 */
export function updateLastSessionMessage(session, fullText, status = 'streaming', error = null) {
  const last = session.messages[session.messages.length - 1];
  if (last && last.role === 'assistant') {
    last.content = fullText;
    last.status = status;
    last.error = error;
    session.updatedAt = Date.now();
  }
}

/**
 * Summarize older conversation history turns into a concise bulleted representation.
 * Keeps memory compact without losing critical nuances or requiring external vector DBs.
 *
 * @param {Array<Object>} messages - Array of older turns
 * @returns {string} Condensed summary text
 */
export function summarizeConversationHistory(messages) {
  if (!messages || messages.length === 0) return '';

  const bulletPoints = [];
  for (let i = 0; i < messages.length; i += 2) {
    const userMsg = messages[i];
    const assistantMsg = messages[i + 1];

    if (userMsg && userMsg.role === 'user') {
      const q = userMsg.content.slice(0, 120);
      let aSnippet = '';
      if (assistantMsg && assistantMsg.content) {
        // Extract first 150 chars or first line of answer
        aSnippet = assistantMsg.content.split('\n')[0].replace(/^#+\s*/, '').slice(0, 150);
      }
      bulletPoints.push(`- Q: "${q}" → A: ${aSnippet}`);
    }
  }

  return bulletPoints.join('\n');
}

/**
 * Extract a bounded, token-safe conversation history for sending to LLM.
 * Implements sliding window memory with optional summary of pruned turns.
 *
 * @param {Object} session - Active session
 * @param {number} [maxTurns=6] - Maximum individual messages to include
 * @returns {{ recentHistory: Array<{ role: string, content: string }>, summary: string }}
 */
export function getBoundedHistory(session, maxTurns = 6) {
  if (!session || !session.messages || session.messages.length === 0) {
    return { recentHistory: [], summary: '' };
  }

  const allCompletedMessages = session.messages.filter(
    (m) => m.status === 'completed' || (m.status === 'streaming' && m.content)
  );

  if (allCompletedMessages.length <= maxTurns) {
    return {
      recentHistory: allCompletedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      summary: session.summary || '',
    };
  }

  // Slice sliding window of recent messages
  const pruned = allCompletedMessages.slice(0, allCompletedMessages.length - maxTurns);
  const recent = allCompletedMessages.slice(allCompletedMessages.length - maxTurns);

  // If summary not generated yet, summarize the pruned portion
  const summary = session.summary || summarizeConversationHistory(pruned);

  return {
    recentHistory: recent.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    summary,
  };
}

