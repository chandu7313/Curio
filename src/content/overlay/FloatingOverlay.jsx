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
} from 'lucide-react';
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
  const [currentContext, setCurrentContext] = useState(context);

  useEffect(() => {
    setCurrentContext(context);
  }, [context]);
  const [mode, setMode] = useState('intermediate');
  const [status, setStatus] = useState('loading'); // 'loading' | 'streaming' | 'completed' | 'error' | 'cancelled'
  const [streamingText, setStreamingText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [providerInfo, setProviderInfo] = useState({ name: '', model: '' });
  const [bookmarked, setBookmarked] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [quoteExpanded, setQuoteExpanded] = useState(false);
  const [learningConcept, setLearningConcept] = useState(null);

  const abortControllerRef = useRef(null);

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

  // ─── Initial Position Calculation ──────────────────────────────────
  useEffect(() => {
    const rect = currentContext.boundingBox || currentContext.selectionRect || currentContext.rect;
    const coords = calculateOverlayPosition(rect, {
      width: 450,
      height: 520,
    });
    setPosition({ top: coords.top, left: coords.left });
    setMaxHeight(coords.maxHeight);
  }, [currentContext]);

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
    setStatus('cancelled');
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
          // Record concept in personal learning intelligence
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
    if (!learningConcept) return;
    const nowSaved = await toggleSaveConcept(learningConcept.id);
    setBookmarked(nowSaved);
    setLearningConcept((prev) => (prev ? { ...prev, isSaved: nowSaved } : null));
  };

  const handleSetUnderstanding = async (level) => {
    if (!learningConcept) return;
    const updated = await updateUnderstandingLevel(learningConcept.id, level);
    if (updated) {
      setLearningConcept(updated);
    }
  };

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

    const userMsg = { sender: 'user', text: q, timestamp: Date.now() };
    const curioMsg = { sender: 'curio', text: '', isStreaming: true, timestamp: Date.now() };

    setThread((prev) => [...prev, userMsg, curioMsg]);

    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, 50);

    const followUpAc = new AbortController();

    await streamFollowUpFromBackend(
      {
        question: q,
        context: currentContext,
        previousExplanation: streamingText,
        conversationHistory: thread,
        level: mode,
      },
      {
        onStart: () => {},
        onDelta: (_delta, fullText) => {
          setThread((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.sender === 'curio') {
              copy[copy.length - 1] = { ...last, text: fullText, isStreaming: true };
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
              copy[copy.length - 1] = { ...last, isStreaming: false };
            }
            return copy;
          });
          setAskingFollowUp(false);
        },
        onError: (err) => {
          setThread((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.sender === 'curio') {
              copy[copy.length - 1] = {
                ...last,
                text: `⚠️ ${err.message || 'Error generating answer.'}`,
                isStreaming: false,
              };
            }
            return copy;
          });
          setAskingFollowUp(false);
        },
      },
      followUpAc.signal
    );
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

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-label="Curio AI Context Explanation"
      className="curio-interactive fixed z-[2147483647] flex flex-col w-[450px] max-w-[92vw] rounded-2xl bg-zinc-950/95 border border-zinc-800/90 shadow-2xl shadow-black/90 backdrop-blur-xl text-zinc-100 curio-animate-enter overflow-hidden font-sans select-text"
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
            <span className="w-2 h-2 rounded-full bg-brand-400 curio-pulse-glow" />
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
          {(status === 'loading' || status === 'streaming') && (
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
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-zinc-400" />
                  Follow-Up Discussion
                </span>
                {thread.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-xl text-xs ${
                      msg.sender === 'user'
                        ? 'bg-zinc-800/80 text-zinc-200 ml-4 border border-zinc-700/50'
                        : 'bg-zinc-900/90 text-zinc-300 mr-2 border border-zinc-800/70'
                    }`}
                  >
                    <div className="text-[10px] text-zinc-500 font-semibold mb-1">
                      {msg.sender === 'user' ? 'You' : 'Curio'}
                    </div>
                    {msg.sender === 'user' ? (
                      <div className="whitespace-pre-line leading-relaxed">{msg.text}</div>
                    ) : (
                      <MarkdownRenderer markdown={msg.text} isStreaming={msg.isStreaming} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {askingFollowUp && (
              <div className="p-2.5 rounded-xl bg-zinc-900/60 text-zinc-400 text-xs flex items-center gap-2">
                <RefreshCw className="w-3 h-3 animate-spin text-brand-400" />
                <span>Thinking through follow-up...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Comprehension & Understanding Actions ──────────────────── */}
      {!loading && learningConcept && (
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
                learningConcept.understandingLevel === 'understood'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/80 shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-800'
              }`}
              title="Mark as understood"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Understood</span>
            </button>
            <button
              onClick={() => handleSetUnderstanding('need_explanation')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                learningConcept.understandingLevel === 'need_explanation'
                  ? 'bg-amber-950 text-amber-300 border border-amber-700/80 shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-800'
              }`}
              title="Need more explanation (flag for review)"
            >
              <HelpCircle className="w-3 h-3 text-amber-400" />
              <span>Review</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Suggested Prompt Chips ─────────────────────────────────── */}
      {!loading && (
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

