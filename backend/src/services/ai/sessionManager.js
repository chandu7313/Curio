/**
 * Curio Backend — Conversational Session Management & Bounded Memory Engine
 *
 * Responsibilities:
 *  - Unique session generation (sessionId) per explanation conversation
 *  - Context retention from original webpage selection
 *  - Multi-turn conversation state tracking
 *  - Bounded memory windowing to prevent token explosion
 *  - Conversational history condensation / summarization
 *  - Session isolation: prevents messages from different explanations from mixing
 *
 * @module backend/services/ai/sessionManager
 */

export function generateSessionId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `curio_sess_${timestamp}_${randomPart}`;
}

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
    initialStatus: 'loading',
    messages: [],
    summary: '',
  };
}

export function isSameSelectionSession(activeSession, newContext) {
  if (!activeSession || !activeSession.selectedText) return false;
  if (!newContext) return false;

  const newText = (newContext.selectedText || newContext.text || '').trim();
  if (!newText) return false;

  return activeSession.selectedText === newText;
}

export function addSessionMessage(session, message) {
  const id = `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const turn = {
    id,
    role: message.role === 'user' ? 'user' : 'assistant',
    content: message.content || '',
    timestamp: Date.now(),
    status: message.status || 'completed',
    error: message.error || null,
  };

  session.messages.push(turn);
  session.updatedAt = Date.now();

  if (session.messages.length > 8 && !session.summary) {
    session.summary = summarizeConversationHistory(session.messages.slice(0, session.messages.length - 4));
  }

  return session;
}

export function updateLastSessionMessage(session, fullText, status = 'streaming', error = null) {
  const last = session.messages[session.messages.length - 1];
  if (last && last.role === 'assistant') {
    last.content = fullText;
    last.status = status;
    last.error = error;
    session.updatedAt = Date.now();
  }
}

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
        aSnippet = assistantMsg.content.split('\n')[0].replace(/^#+\s*/, '').slice(0, 150);
      }
      bulletPoints.push(`- Q: "${q}" → A: ${aSnippet}`);
    }
  }

  return bulletPoints.join('\n');
}

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

  const pruned = allCompletedMessages.slice(0, allCompletedMessages.length - maxTurns);
  const recent = allCompletedMessages.slice(allCompletedMessages.length - maxTurns);
  const summary = session.summary || summarizeConversationHistory(pruned);

  return {
    recentHistory: recent.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    summary,
  };
}
