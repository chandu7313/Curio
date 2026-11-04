/**
 * Curio — Premium In-Situ Floating AI Explanation Interface
 *
 * Designed with a dark-mode-first, minimal, sophisticated aesthetic.
 * Operates inside an isolated Shadow DOM container with zero host page bleed.
 *
 * Features:
 *  - Selection quote anchor with content-type badge
 *  - Multi-depth explanation toggle (Simple, Intermediate, Advanced)
 *  - Shimmer loading & streaming skeleton
 *  - Syntax-highlighted code blocks with dedicated copy actions
 *  - Follow-up Q&A conversation thread with prompt chips
 *  - Persistent bookmarking to chrome.storage
 *  - Draggable header with viewport collision clamping
 *  - Escape key to dismiss
 *
 * @module overlay/FloatingOverlay
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Bookmark,
  BookmarkCheck,
  GripHorizontal,
  Sparkles,
  Send,
  Terminal,
  BookOpen,
  Cpu,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  MessageSquare,
  RefreshCw,
  GitFork,
  CheckCircle2,
  HelpCircle,
  Clock,
  Tag,
  Square,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  createExplanationSession,
  isSameSelectionSession,
  addSessionMessage,
  getBoundedHistory,
} from '../../shared/services/sessionManager.js';
import { saveVaultConcept, updateVaultConcept } from '../../shared/services/vaultStorage.js';
import { getCuratedRecommendations } from '../../shared/services/knowledgeGraph.js';
import { calculateOverlayPosition, clampDragPosition } from './positioning.js';
import {
  generateMockExplanation,
  fetchExplanationWithLatency,
  answerFollowUpQuestion,
} from './mockExplainer.js';
import {
  streamExplanationFromBackend,
  streamFollowUpFromBackend,
} from './streamingClient.js';
import { MarkdownRenderer } from './markdownRenderer.jsx';
import {
  recordConceptExploration,
  getConceptByText,
  updateUnderstandingLevel,
  toggleSaveConcept,
} from '../../shared/services/learningService.js';
import { getSettings, subscribeToSettings } from '../../shared/services/settingsService.js';
import { DEFAULT_SETTINGS } from '../../shared/types/index.js';

/**
 * Lightweight Code Block with Line Numbers & Copy Action
 */
function CodeBlock({ code, language, caption }) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  const lines = useMemo(() => (code || '').trim().split('\n'), [code]);

  // Syntax keyword highlighter
  const highlightLine = (line) => {
    // Basic regex-based tokenizer for clean aesthetic without a 2MB library
    const parts = line.split(/(\b(?:const|let|var|function|return|async|await|import|export|from|class|if|else|try|catch|new|typeof|def|val)\b|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`|\/\/.+$)/g);
    return parts.map((part, idx) => {
      if (/^\b(?:const|let|var|function|return|async|await|import|export|from|class|if|else|try|catch|new|typeof|def|val)\b$/.test(part)) {
        return <span key={idx} className="text-purple-400 font-semibold">{part}</span>;
      }
      if (/^["'`].*["'`]$/.test(part)) {
        return <span key={idx} className="text-emerald-300">{part}</span>;
      }
      if (/^\/\/.+$/.test(part)) {
        return <span key={idx} className="text-zinc-500 italic">{part}</span>;
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div className="my-3 rounded-xl border border-zinc-800/80 bg-zinc-900/90 overflow-hidden shadow-inner text-xs font-mono">
      {/* Code Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800/70 text-zinc-400 select-none">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[11px] font-medium tracking-wide uppercase text-zinc-300">
            {language || 'code'}
          </span>
          {caption && <span className="text-zinc-500 text-[10px]">— {caption}</span>}
        </div>
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors text-[11px]"
          title="Copy code snippet"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-sans">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-3 overflow-x-auto curio-scrollbar text-zinc-200 leading-relaxed font-mono">
        <table className="border-collapse w-full">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-zinc-800/30 transition-colors">
                <td className="pr-3 text-right select-none text-zinc-600 text-[10px] align-top w-6">
                  {idx + 1}
                </td>
                <td className="whitespace-pre">
                  {highlightLine(line)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Shimmer Loading Skeleton
 */
function LoadingSkeleton() {
  return (
    <div className="p-5 space-y-4 curio-animate-enter">
      <div className="flex items-center gap-2 text-zinc-400 text-xs">
        <Sparkles className="w-4 h-4 text-brand-400 animate-spin" />
        <span className="font-medium text-zinc-300">Synthesizing explanation...</span>
      </div>

      <div className="space-y-2.5">
        <div className="h-4 rounded-md curio-shimmer w-11/12" />
        <div className="h-4 rounded-md curio-shimmer w-full" />
        <div className="h-4 rounded-md curio-shimmer w-4/5" />
      </div>

      <div className="pt-2 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-zinc-800" />
          <div className="h-3.5 rounded-md curio-shimmer w-3/4" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-zinc-800" />
          <div className="h-3.5 rounded-md curio-shimmer w-5/6" />
        </div>
      </div>
    </div>
  );
}

/**
 * Main Floating Overlay Component
 */
export function FloatingOverlay({ context, onClose }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [currentContext, setCurrentContext] = useState(context);
  const [session, setSession] = useState(() => createExplanationSession(context, 'intermediate'));
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const [mode, setMode] = useState('intermediate');
  const [status, setStatus] = useState('loading'); // 'loading' | 'streaming' | 'completed' | 'error' | 'cancelled'
  const [streamingText, setStreamingText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [providerInfo, setProviderInfo] = useState({ name: '', model: '' });
  const [bookmarked, setBookmarked] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedTurnIndex, setCopiedTurnIndex] = useState(null);
  const [quoteExpanded, setQuoteExpanded] = useState(false);
  const [learningConcept, setLearningConcept] = useState(null);

  const abortControllerRef = useRef(null);
  const followUpAbortRef = useRef(null);

  // Position & Drag state
  const [position, setPosition] = useState({ top: 100, left: 100 });
  const [maxHeight, setMaxHeight] = useState(520);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragOriginPosRef = useRef({ top: 0, left: 0 });

  // Follow-up interaction thread
  const [thread, setThread] = useState([]);
  const [questionInput, setQuestionInput] = useState('');
  const [askingFollowUp, setAskingFollowUp] = useState(false);

  const cardRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // ─── Synchronize Settings ──────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    getSettings().then((s) => {
      if (mounted && s) {
        setSettings(s);
        if (s.defaultLevel) {
          setMode(s.defaultLevel);
        }
      }
    });

    const unsubscribe = subscribeToSettings((newSettings) => {
      if (mounted && newSettings) {
        setSettings(newSettings);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // ─── Detect Different Selection & Reset Session ───────────────────
  useEffect(() => {
    if (!isSameSelectionSession(sessionRef.current, context)) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (followUpAbortRef.current) followUpAbortRef.current.abort();

      const newSess = createExplanationSession(context, mode);
      setSession(newSess);
      sessionRef.current = newSess;
      setCurrentContext(context);
      setThread([]);
      setStreamingText('');
      setAskingFollowUp(false);
      setStatus('loading');
    }
  }, [context, mode]);

  // ─── Initial Position Calculation ──────────────────────────────────
  useEffect(() => {
    const widthMap = { compact: 380, standard: 450, wide: 540 };
    const targetWidth = widthMap[settings.overlayWidth] || 450;
    const rect = currentContext.boundingBox || currentContext.selectionRect || currentContext.rect;

    if (settings.windowBehavior === 'top_right') {
      const pad = 24;
      const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024;
      setPosition({ top: pad, left: Math.max(pad, viewportW - targetWidth - pad) });
      setMaxHeight(520);
    } else if (settings.windowBehavior === 'center') {
      const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768;
      setPosition({
        top: Math.max(20, Math.round((viewportH - 520) / 2)),
        left: Math.max(20, Math.round((viewportW - targetWidth) / 2)),
      });
      setMaxHeight(520);
    } else {
      const coords = calculateOverlayPosition(rect, {
        width: targetWidth,
        height: 520,
      });
      setPosition({ top: coords.top, left: coords.left });
      setMaxHeight(coords.maxHeight);
    }
  }, [currentContext, settings.windowBehavior, settings.overlayWidth]);

  // ─── Check Previous Learning History ───────────────────────────────
  useEffect(() => {
    let active = true;
    getConceptByText(currentContext.selectedText).then((existing) => {
      if (active && existing) {
        setLearningConcept(existing);
        setBookmarked(existing.isSaved);
      }
    });
    return () => {
      active = false;
    };
  }, [currentContext.selectedText]);

  // ─── Stop / Cancel Generation ──────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (followUpAbortRef.current) {
      followUpAbortRef.current.abort();
      followUpAbortRef.current = null;
    }
    if (settings.cancellationBehavior === 'discard_cancelled') {
      setStreamingText('');
    }
    setStatus((prev) => (prev === 'loading' || prev === 'streaming' ? 'cancelled' : prev));
    setAskingFollowUp(false);
  }, [settings.cancellationBehavior]);

  const handleCancelFollowUp = useCallback(() => {
    if (followUpAbortRef.current) {
      followUpAbortRef.current.abort();
      followUpAbortRef.current = null;
    }
    setAskingFollowUp(false);
    setThread((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.sender === 'curio') {
        copy[copy.length - 1] = {
          ...last,
          isStreaming: false,
          status: 'cancelled',
          text: last.text ? `${last.text}\n\n*(Generation stopped)*` : '*(Generation stopped)*',
        };
      }
      return copy;
    });
  }, []);

  // ─── Trigger Real-Time Streaming Generation ────────────────────────
  const triggerStreamingExplanation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setStatus('loading');
    setStreamingText('');
    setErrorMessage('');

    let currentAccumulated = '';

    streamExplanationFromBackend(
      currentContext,
      mode,
      {
        onStart: ({ provider, model }) => {
          setProviderInfo({ name: provider, model });
        },
        onDelta: (_delta, fullText) => {
          setStatus('streaming');
          currentAccumulated = fullText;
          setStreamingText(fullText);
        },
        onDone: async ({ provider, usage }) => {
          setStatus('completed');
          // Record concept in personal learning intelligence if saveHistory is enabled
          if (settings.saveHistory !== false) {
            try {
              const recorded = await recordConceptExploration(currentContext, {
                title: currentContext.selectedText,
                summary: currentAccumulated.slice(0, 300),
                mode,
              });
              if (recorded) {
                setLearningConcept(recorded);
                setBookmarked(recorded.isSaved);
              }
            } catch (err) {
              console.warn('[Curio] Failed to record learning concept:', err);
            }
          }
          // Auto-save bookmarks to vault if enabled in settings
          if (settings.autoSaveBookmarks) {
            try {
              const rawText = (currentContext.selectedText || currentContext.text || '').trim();
              if (rawText) {
                await saveVaultConcept({
                  id: learningConcept?.id,
                  title: currentContext.selectedText,
                  selectedText: rawText,
                  explanation: currentAccumulated,
                  category: currentContext.category || 'General',
                  pageTitle: currentContext.pageTitle || (typeof document !== 'undefined' ? document.title : '') || '',
                  pageUrl: currentContext.pageUrl || (typeof window !== 'undefined' ? window.location.href : '') || '',
                  understandingStatus: 'not_reviewed',
                });
                setBookmarked(true);
              }
            } catch (err) {
              console.warn('[Curio] Failed to auto-save concept:', err);
            }
          }
        },
        onError: (err) => {
          setStatus('error');
          setErrorMessage(err.message || 'Failed to generate explanation.');
        },
      },
      ac.signal
    );
  }, [currentContext, mode]);

  // ─── Trigger Explanation on Context or Mode Change ─────────────────
  useEffect(() => {
    triggerStreamingExplanation();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [triggerStreamingExplanation]);

  // ─── Global Keyboard Handling (Escape to Close) ────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [onClose]);

  // ─── Drag Handling ─────────────────────────────────────────────────
  const handleDragPointerDown = (e) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragOriginPosRef.current = { ...position };

    const handlePointerMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.x;
      const dy = moveEvent.clientY - dragStartRef.current.y;

      const rawPos = {
        top: dragOriginPosRef.current.top + dy,
        left: dragOriginPosRef.current.left + dx,
      };

      const clamped = clampDragPosition(rawPos, {
        width: cardRef.current?.offsetWidth || 450,
        height: cardRef.current?.offsetHeight || 500,
      });

      setPosition(clamped);
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // ─── Actions: Copy & Bookmark ──────────────────────────────────────
  const handleCopyAll = async () => {
    const textToCopy = streamingText || currentContext.selectedText;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  const handleToggleBookmark = async () => {
    const rawText = (currentContext.selectedText || currentContext.text || '').trim();
    if (!rawText) return;

    const newSaved = !bookmarked;
    setBookmarked(newSaved);

    if (newSaved) {
      await saveVaultConcept({
        id: learningConcept?.id,
        title: currentContext.selectedText,
        selectedText: rawText,
        explanation: streamingText,
        category: currentContext.category || learningConcept?.category || 'General',
        pageTitle: currentContext.pageTitle || (typeof document !== 'undefined' ? document.title : '') || '',
        pageUrl: currentContext.pageUrl || (typeof window !== 'undefined' ? window.location.href : '') || '',
        understandingStatus: 'not_reviewed',
        conversationHistory: thread.map((m) => ({
          role: m.role || (m.sender === 'user' ? 'user' : 'assistant'),
          content: m.text || m.content || '',
        })),
      });
    }

    if (learningConcept?.id) {
      await toggleSaveConcept(learningConcept.id);
      setLearningConcept((prev) => (prev ? { ...prev, isSaved: newSaved } : null));
    }
  };

  const handleSetUnderstanding = async (level) => {
    if (!learningConcept) return;
    const updated = await updateUnderstandingLevel(learningConcept.id, level);
    if (updated) {
      setLearningConcept(updated);
    }
    await updateVaultConcept(learningConcept.id, {
      understandingStatus: level,
    });
  };

  const recommendations = useMemo(() => {
    return getCuratedRecommendations(currentContext.selectedText || '');
  }, [currentContext.selectedText]);

  const handlePivotConcept = (relatedTerm) => {
    setThread([]);
    setCurrentContext((prev) => ({
      ...prev,
      selectedText: relatedTerm,
      contentType: 'general_text',
      nearestHeading: `Connected from "${currentContext.selectedText}"`,
    }));
  };

  // ─── Follow-Up Submission with Live Streaming ──────────────────────
  const handleFollowUpSubmit = async (questionText) => {
    const q = (questionText || questionInput).trim();
    if (!q || askingFollowUp) return;

    setQuestionInput('');
    setAskingFollowUp(true);

    const userMsg = { id: `u_${Date.now()}`, sender: 'user', role: 'user', text: q, timestamp: Date.now() };
    const curioMsg = { id: `c_${Date.now()}`, sender: 'curio', role: 'assistant', text: '', isStreaming: true, timestamp: Date.now(), status: 'streaming' };

    setThread((prev) => [...prev, userMsg, curioMsg]);

    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, 50);

    const followUpAc = new AbortController();
    followUpAbortRef.current = followUpAc;

    const bounded = getBoundedHistory(sessionRef.current, 6);
    let finalAnswer = '';

    await streamFollowUpFromBackend(
      {
        sessionId: sessionRef.current.sessionId,
        question: q,
        context: currentContext,
        previousExplanation: streamingText,
        conversationHistory: bounded.recentHistory,
        summary: bounded.summary,
        level: mode,
        provider: providerInfo.name || 'gemini',
        model: providerInfo.model || null,
      },
      {
        onStart: () => {},
        onDelta: (_delta, fullText) => {
          finalAnswer = fullText;
          setThread((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.sender === 'curio') {
              copy[copy.length - 1] = { ...last, text: fullText, isStreaming: true, status: 'streaming' };
            }
            return copy;
          });
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
        },
        onDone: () => {
          setThread((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.sender === 'curio') {
              copy[copy.length - 1] = { ...last, isStreaming: false, status: 'completed' };
            }
            return copy;
          });
          addSessionMessage(sessionRef.current, { role: 'user', content: q });
          if (finalAnswer) {
            addSessionMessage(sessionRef.current, { role: 'assistant', content: finalAnswer });
          }
          setAskingFollowUp(false);
          followUpAbortRef.current = null;
        },
        onError: (err) => {
          setThread((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.sender === 'curio') {
              copy[copy.length - 1] = {
                ...last,
                text: finalAnswer ? `${finalAnswer}\n\n⚠️ *${err.message || 'Stream interrupted.'}*` : `⚠️ ${err.message || 'Error generating answer.'}`,
                isStreaming: false,
                status: 'error',
                error: err.message,
              };
            }
            return copy;
          });
          setAskingFollowUp(false);
          followUpAbortRef.current = null;
        },
      },
      followUpAc.signal
    );
  };

  const handleRetryFollowUp = (userQuestionText, turnIndex) => {
    setThread((prev) => prev.slice(0, Math.max(0, turnIndex)));
    handleFollowUpSubmit(userQuestionText);
  };

  const handleCopyTurn = async (text, turnIndex) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTurnIndex(turnIndex);
      setTimeout(() => setCopiedTurnIndex(null), 2000);
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  const handleClearConversation = () => {
    if (followUpAbortRef.current) {
      followUpAbortRef.current.abort();
      followUpAbortRef.current = null;
    }
    setThread([]);
    setAskingFollowUp(false);
    setSession((prev) => ({
      ...prev,
      messages: [],
      summary: '',
    }));
  };

  // Content type badge color
  const contentTypeBadge = useMemo(() => {
    switch (currentContext.contentType) {
      case 'code':
      case 'programming_code':
        return {
          label: currentContext.language ? `Code: ${currentContext.language}` : 'Code',
          color: 'bg-purple-950/80 text-purple-300 border-purple-800/60',
        };
      case 'math':
      case 'mathematical_expression':
        return {
          label: 'Math / TeX',
          color: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60',
        };
      case 'technical_terminology':
        return {
          label: 'Term',
          color: 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60',
        };
      case 'abbreviation':
        return {
          label: 'Abbr',
          color: 'bg-pink-950/80 text-pink-300 border-pink-800/60',
        };
      case 'input':
        return {
          label: 'Input Field',
          color: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
        };
      default:
        return {
          label: 'Prose',
          color: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
        };
    }
  }, [currentContext.contentType, currentContext.language]);

  const previewSnippet = currentContext.selectedText || '';
  const isSnippetLong = previewSnippet.length > 90;

  const overlayWidthClass = useMemo(() => {
    switch (settings.overlayWidth) {
      case 'compact':
        return 'w-[380px]';
      case 'wide':
        return 'w-[540px]';
      case 'standard':
      default:
        return 'w-[450px]';
    }
  }, [settings.overlayWidth]);

  const fontSizeClass = useMemo(() => {
    switch (settings.fontSize) {
      case 'small':
        return 'text-[11px]';
      case 'large':
        return 'text-[14px]';
      case 'medium':
      default:
        return 'text-xs';
    }
  }, [settings.fontSize]);

  const animationClass = settings.animationPreference === 'disabled' ? '' : 'curio-animate-enter';

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-label="Curio AI Context Explanation"
      className={`curio-interactive fixed z-[2147483647] flex flex-col ${overlayWidthClass} max-w-[92vw] rounded-2xl bg-zinc-950/95 border border-zinc-800/90 shadow-2xl shadow-black/90 backdrop-blur-xl text-zinc-100 ${animationClass} ${fontSizeClass} overflow-hidden font-sans select-text`}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxHeight: `${Math.min(540, maxHeight)}px`,
      }}
    >
      {/* ─── Header Bar (Draggable) ─────────────────────────────────── */}
      <div
        onPointerDown={handleDragPointerDown}
        className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-900/60 border-b border-zinc-800/70 cursor-grab active:cursor-grabbing select-none"
      >
        {/* Left: Drag grip & Brand pill */}
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
          <div className="flex items-center gap-1.5">
            <img
              src={typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('icons/icon-16.png') : '/icons/icon-16.png'}
              alt="Curio logo"
              className="w-4 h-4 object-contain rounded-sm shadow-sm"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span className="text-xs font-semibold tracking-wider text-zinc-100 uppercase">
              Curio
            </span>
          </div>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono border ${contentTypeBadge.color}`}
          >
            {contentTypeBadge.label}
          </span>
          {learningConcept?.exploreCount > 1 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60">
              Explored {learningConcept.exploreCount}x
            </span>
          )}
        </div>

        {/* Right: Actions (Stop, Bookmark, Copy, Close) */}
        <div className="flex items-center gap-1">
          {(status === 'loading' || status === 'streaming' || askingFollowUp) && (
            <button
              onClick={handleCancel}
              title="Stop generation"
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>Stop</span>
            </button>
          )}

          <button
            onClick={handleToggleBookmark}
            title={bookmarked ? 'Saved in personal library' : 'Save for later'}
            className="p-1 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-zinc-800/80 transition-colors"
          >
            {bookmarked ? (
              <BookmarkCheck className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={handleCopyAll}
            title="Copy full explanation"
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          >
            {copiedAll ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={onClose}
            title="Close (Esc)"
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Selected Quote / Context Anchor ────────────────────────── */}
      <div className="px-3.5 py-2 bg-zinc-900/30 border-b border-zinc-800/50 text-xs">
        <div className="flex items-start justify-between gap-2">
          <div className="text-zinc-400 font-serif italic flex-1 leading-snug">
            “
            <span className="text-zinc-200 font-sans not-italic font-medium">
              {isSnippetLong && !quoteExpanded
                ? `${previewSnippet.slice(0, 85)}…`
                : previewSnippet}
            </span>
            ”
          </div>
          {isSnippetLong && (
            <button
              onClick={() => setQuoteExpanded(!quoteExpanded)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5 mt-0.5"
            >
              {quoteExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
        {currentContext.nearestHeading && (
          <div className="mt-1 text-[10px] text-zinc-500 truncate">
            under <span className="text-zinc-400">{currentContext.nearestHeading}</span>
          </div>
        )}
      </div>

      {/* ─── Mode Selector (Segmented Tabs) ─────────────────────────── */}
      <div className="px-3.5 pt-2.5 pb-1 bg-zinc-950">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-xs select-none">
          <button
            onClick={() => setMode('simple')}
            className={`py-1 rounded-lg text-center font-medium transition-all ${
              mode === 'simple'
                ? 'bg-zinc-800 text-brand-300 shadow-sm border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Simple
          </button>
          <button
            onClick={() => setMode('intermediate')}
            className={`py-1 rounded-lg text-center font-medium transition-all ${
              mode === 'intermediate'
                ? 'bg-zinc-800 text-brand-300 shadow-sm border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Intermediate
          </button>
          <button
            onClick={() => setMode('advanced')}
            className={`py-1 rounded-lg text-center font-medium transition-all ${
              mode === 'advanced'
                ? 'bg-zinc-800 text-brand-300 shadow-sm border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Advanced
          </button>
        </div>
      </div>

      {/* ─── Scrollable Content Body ─────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2.5 space-y-3 curio-scrollbar text-xs leading-relaxed"
      >
        {status === 'loading' && !streamingText ? (
          <LoadingSkeleton />
        ) : status === 'error' && !streamingText ? (
          <div className="p-4 my-2 rounded-xl bg-red-950/30 border border-red-900/50 text-red-200 space-y-2.5 curio-animate-enter">
            <div className="flex items-center gap-2 font-medium text-red-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>Explanation Unavailable</span>
            </div>
            <p className="text-[11px] text-red-200/90 leading-relaxed">{errorMessage}</p>
            <button
              onClick={triggerStreamingExplanation}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-900/40 hover:bg-red-800/60 border border-red-700/60 text-red-100 text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Generation</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3.5 curio-animate-enter">
            {status === 'streaming' && (
              <div className="flex items-center justify-between text-[10px] text-zinc-400 pb-1 border-b border-zinc-800/50">
                <div className="flex items-center gap-1.5 text-brand-300">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span className="font-medium">
                    Streaming from {providerInfo.name ? providerInfo.name.toUpperCase() : 'AI'}...
                  </span>
                </div>
                <button
                  onClick={handleCancel}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium"
                >
                  Stop
                </button>
              </div>
            )}

            {status === 'cancelled' && (
              <div className="px-2.5 py-1 rounded-lg bg-amber-950/30 border border-amber-900/40 text-amber-300 text-[11px] flex items-center justify-between">
                <span>Generation paused by user.</span>
                <button
                  onClick={triggerStreamingExplanation}
                  className="underline hover:text-amber-200 font-medium"
                >
                  Restart
                </button>
              </div>
            )}

            {/* Progressive Real-Time Streaming Markdown Content */}
            <MarkdownRenderer
              markdown={streamingText}
              isStreaming={status === 'streaming'}
            />

            {/* ─── Curated Next Steps & Recommendations ──────────────── */}
            {recommendations.length > 0 && (
              <div className="pt-2.5 pb-1 border-t border-zinc-800/60 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                    Recommended Next Steps
                  </span>
                  <span className="text-[9px] text-zinc-500 font-normal lowercase">learning path</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {recommendations.map((rec, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePivotConcept(rec.term)}
                      className="group flex flex-col p-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800/80 hover:border-brand-500/50 text-left transition-all"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-zinc-200 text-[11px] font-medium group-hover:text-brand-300">
                          {rec.action}
                        </span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                          {rec.relation}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                        {rec.reason}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Knowledge Connections (Concept Graph) ──────────────── */}
            {learningConcept?.relatedConcepts?.length > 0 && (
              <div className="pt-2.5 pb-1 border-t border-zinc-800/60 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  <GitFork className="w-3.5 h-3.5 text-brand-400" />
                  <span>Knowledge Connections</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {learningConcept.relatedConcepts.map((rel, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePivotConcept(rel.term)}
                      className="group flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800/80 hover:border-brand-500/50 text-left transition-all"
                      title={rel.label}
                    >
                      <span className="text-zinc-200 text-[11px] font-medium group-hover:text-brand-300">
                        {rel.term}
                      </span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-500 group-hover:text-zinc-300 font-mono">
                        {rel.relation}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Conversation Thread (Follow-ups) ───────────────────── */}
            {thread.length > 0 && (
              <div className="pt-3 border-t border-zinc-800/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3 text-zinc-400" />
                    Continuous Conversation
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-zinc-800 text-zinc-400 font-mono">
                      {Math.ceil(thread.length / 2)} turn{Math.ceil(thread.length / 2) === 1 ? '' : 's'}
                    </span>
                  </span>
                  <button
                    onClick={handleClearConversation}
                    title="Clear follow-up conversation history"
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Clear chat</span>
                  </button>
                </div>
                {thread.map((msg, i) => {
                  const isUser = msg.sender === 'user' || msg.role === 'user';
                  const isError = msg.status === 'error';
                  const isCancelled = msg.status === 'cancelled';
                  const prevUserMsg = !isUser && i > 0 ? (thread[i - 1].text || thread[i - 1].content) : '';

                  return (
                    <div
                      key={msg.id || i}
                      className={`p-2.5 rounded-xl text-xs relative group transition-all ${
                        isUser
                          ? 'bg-zinc-800/80 text-zinc-200 ml-4 border border-zinc-700/50'
                          : isError
                          ? 'bg-red-950/40 text-red-200 mr-2 border border-red-800/50'
                          : 'bg-zinc-900/90 text-zinc-300 mr-2 border border-zinc-800/70'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-semibold mb-1">
                        <span>{isUser ? 'You' : 'Curio'}</span>
                        {!isUser && !msg.isStreaming && (
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleCopyTurn(msg.text, i)}
                              title="Copy this response"
                              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
                            >
                              {copiedTurnIndex === i ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  <span className="text-[9px] text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {isUser ? (
                        <div className="whitespace-pre-line leading-relaxed">{msg.text}</div>
                      ) : (
                        <>
                          <MarkdownRenderer markdown={msg.text} isStreaming={msg.isStreaming} />
                          {(isError || isCancelled) && prevUserMsg && (
                            <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                              <span className="text-[10px] text-zinc-500">
                                {isCancelled ? 'Generation stopped.' : 'Answer interrupted.'}
                              </span>
                              <button
                                onClick={() => handleRetryFollowUp(prevUserMsg, i - 1)}
                                className="px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200 flex items-center gap-1 font-medium transition-colors"
                              >
                                <RefreshCw className="w-2.5 h-2.5 text-brand-400" />
                                <span>Retry question</span>
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {askingFollowUp && (
              <div className="p-2.5 rounded-xl bg-zinc-900/60 text-zinc-400 text-xs flex items-center justify-between border border-zinc-800/50">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3 h-3 animate-spin text-brand-400" />
                  <span>Synthesizing follow-up response...</span>
                </div>
                <button
                  onClick={handleCancelFollowUp}
                  className="px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>Stop</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Comprehension & Understanding Actions ──────────────────── */}
      {status !== 'loading' && learningConcept && (
        <div className="px-3.5 py-1.5 bg-zinc-900/60 border-t border-zinc-800/80 flex items-center justify-between text-xs select-none">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <Tag className="w-3 h-3 text-brand-400" />
            <span className="font-medium text-zinc-300">{learningConcept.category}</span>
            {learningConcept.exploreCount > 1 && (
              <span className="text-[10px] text-zinc-500">
                • {learningConcept.exploreCount} views
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleSetUnderstanding('understood')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                learningConcept.understandingLevel === 'understood' || learningConcept.understandingStatus === 'understood'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/80 shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-800'
              }`}
              title="Mark as understood"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Understood</span>
            </button>
            <button
              onClick={() => handleSetUnderstanding('learning')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                learningConcept.understandingLevel === 'learning' || learningConcept.understandingLevel === 'reviewing' || learningConcept.understandingStatus === 'learning'
                  ? 'bg-amber-950 text-amber-300 border border-amber-700/80 shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-800'
              }`}
              title="Actively learning this concept"
            >
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Learning</span>
            </button>
            <button
              onClick={() => handleSetUnderstanding('needs_revision')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                learningConcept.understandingLevel === 'needs_revision' || learningConcept.understandingLevel === 'need_explanation' || learningConcept.understandingStatus === 'needs_revision'
                  ? 'bg-rose-950 text-rose-300 border border-rose-700/80 shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-800'
              }`}
              title="Flag for revision"
            >
              <HelpCircle className="w-3 h-3 text-rose-400" />
              <span>Revision</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Suggested Prompt Chips ─────────────────────────────────── */}
      {status !== 'loading' && (
        <div className="px-3.5 py-1.5 bg-zinc-950/80 border-t border-zinc-900 flex items-center gap-1.5 overflow-x-auto curio-scrollbar select-none">
          <button
            onClick={() => handleFollowUpSubmit('Can you give a practical real-world example?')}
            className="px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-[10px] text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors shrink-0"
          >
            💡 Real-world example
          </button>
          <button
            onClick={() => handleFollowUpSubmit('What are common pitfalls or mistakes?')}
            className="px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-[10px] text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors shrink-0"
          >
            ⚠️ Common pitfalls
          </button>
          <button
            onClick={() => handleFollowUpSubmit('How does this compare to alternative approaches?')}
            className="px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-[10px] text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors shrink-0"
          >
            ⚖️ Alternatives
          </button>
        </div>
      )}

      {/* ─── Footer: Follow-up Input Field ──────────────────────────── */}
      <div className="p-2.5 bg-zinc-900/70 border-t border-zinc-800/80">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFollowUpSubmit();
          }}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            placeholder="Ask a follow-up question..."
            className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/50 transition-all placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={!questionInput.trim() || askingFollowUp}
            className="p-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-semibold transition-colors disabled:cursor-not-allowed"
            title="Send question (Enter)"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-600 px-1 select-none">
          <span>Press Enter to send</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}

