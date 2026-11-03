/**
 * Curio — Safe Progressive Markdown & Syntax Highlighter Component
 *
 * Renders streaming Markdown progressively without external heavy libraries,
 * ensuring zero raw HTML execution hazards (XSS immunity).
 *
 * Supports:
 *   - Fenced code blocks with syntax highlighting, line numbers, and copy actions
 *   - Headings (H1, H2, H3, H4)
 *   - Unordered and ordered lists
 *   - Blockquotes / deep-dive callout boxes
 *   - Inline code, bold, italic, and safe links
 *   - Streaming cursor indicator during generation
 *
 * @module overlay/markdownRenderer
 */

import React, { useMemo, useState } from 'react';
import { Terminal, Copy, Check } from 'lucide-react';

/**
 * Lightweight Code Block with syntax highlighting and copy button.
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

  const lines = useMemo(() => (code || '').trimEnd().split('\n'), [code]);

  const highlightLine = (line) => {
    const parts = line.split(
      /(\b(?:const|let|var|function|return|async|await|import|export|from|class|if|else|try|catch|new|typeof|def|val|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE)\b|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`|\/\/.+$|#.+|\b\d+\b)/g
    );
    return parts.map((part, idx) => {
      if (
        /^\b(?:const|let|var|function|return|async|await|import|export|from|class|if|else|try|catch|new|typeof|def|val|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE)\b$/.test(
          part
        )
      ) {
        return (
          <span key={idx} className="text-purple-400 font-semibold">
            {part}
          </span>
        );
      }
      if (/^["'`].*["'`]$/.test(part)) {
        return (
          <span key={idx} className="text-emerald-300">
            {part}
          </span>
        );
      }
      if (/^(?:\/\/|#).+$/.test(part)) {
        return (
          <span key={idx} className="text-zinc-500 italic">
            {part}
          </span>
        );
      }
      if (/^\b\d+\b$/.test(part)) {
        return (
          <span key={idx} className="text-amber-300">
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div className="my-3 rounded-xl border border-zinc-800/80 bg-zinc-900/90 overflow-hidden shadow-inner text-xs font-mono">
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

      <div className="p-3 overflow-x-auto curio-scrollbar text-zinc-200 leading-relaxed font-mono">
        <table className="border-collapse w-full">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-zinc-800/30 transition-colors">
                <td className="pr-3 text-right select-none text-zinc-600 text-[10px] align-top w-6">
                  {idx + 1}
                </td>
                <td className="whitespace-pre">{highlightLine(line)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Format inline markdown tokens (bold, italic, inline code).
 * Strictly avoids dangerous innerHTML injection.
 */
function renderInline(text) {
  if (!text) return null;

  // Split by inline code, bold, and italic
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return tokens.map((tok, idx) => {
    if (tok.startsWith('`') && tok.endsWith('`') && tok.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-brand-300 font-mono text-[11px]"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-zinc-100">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith('*') && tok.endsWith('*') && tok.length > 2) {
      return (
        <em key={idx} className="italic text-zinc-200">
          {tok.slice(1, -1)}
        </em>
      );
    }
    return <span key={idx}>{tok}</span>;
  });
}

/**
 * Progressive Markdown Renderer component.
 *
 * @param {Object} props
 * @param {string} props.markdown - Full or streaming markdown text
 * @param {boolean} [props.isStreaming] - Whether generation is actively in progress
 */
export function MarkdownRenderer({ markdown, isStreaming = false }) {
  const blocks = useMemo(() => {
    if (!markdown) return [];

    const raw = markdown.trim();
    const result = [];
    const lines = raw.split('\n');

    let inCodeBlock = false;
    let codeLanguage = '';
    let codeBuffer = [];

    let currentList = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code block start / end
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLanguage = line.trim().slice(3).trim();
          codeBuffer = [];
        } else {
          inCodeBlock = false;
          result.push({
            type: 'code',
            language: codeLanguage,
            content: codeBuffer.join('\n'),
          });
          codeBuffer = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Check for headings
      const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        if (currentList) {
          result.push({ type: 'list', items: currentList });
          currentList = null;
        }
        result.push({
          type: 'heading',
          level: headingMatch[1].length,
          content: headingMatch[2].trim(),
        });
        continue;
      }

      // Check for blockquotes
      if (line.startsWith('>')) {
        if (currentList) {
          result.push({ type: 'list', items: currentList });
          currentList = null;
        }
        result.push({
          type: 'blockquote',
          content: line.replace(/^>\s*/, '').trim(),
        });
        continue;
      }

      // Check for list items
      const listMatch = line.match(/^[-*•]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
      if (listMatch) {
        if (!currentList) currentList = [];
        currentList.push(listMatch[1].trim());
        continue;
      }

      // Non-list line: flush existing list
      if (currentList && line.trim() === '') {
        result.push({ type: 'list', items: currentList });
        currentList = null;
        continue;
      }

      // Paragraph text
      if (line.trim().length > 0) {
        if (currentList) {
          result.push({ type: 'list', items: currentList });
          currentList = null;
        }
        result.push({ type: 'paragraph', content: line.trim() });
      }
    }

    // Flush any pending open code block (during active streaming)
    if (inCodeBlock && codeBuffer.length > 0) {
      result.push({
        type: 'code',
        language: codeLanguage,
        content: codeBuffer.join('\n'),
        unclosed: true,
      });
    }

    if (currentList && currentList.length > 0) {
      result.push({ type: 'list', items: currentList });
    }

    return result;
  }, [markdown]);

  return (
    <div className="space-y-3 text-zinc-300 text-xs leading-relaxed select-text">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            if (block.level <= 2) {
              return (
                <h3
                  key={idx}
                  className="pt-2 text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                  {renderInline(block.content)}
                </h3>
              );
            }
            return (
              <h4
                key={idx}
                className="pt-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300"
              >
                {renderInline(block.content)}
              </h4>
            );
          }

          case 'code':
            return (
              <CodeBlock
                key={idx}
                code={block.content}
                language={block.language}
                caption={block.unclosed ? 'Generating...' : null}
              />
            );

          case 'blockquote':
            return (
              <div
                key={idx}
                className="my-2 p-2.5 rounded-xl bg-purple-950/30 border border-purple-900/40 text-purple-200 text-[11px] leading-relaxed"
              >
                {renderInline(block.content)}
              </div>
            );

          case 'list':
            return (
              <ul key={idx} className="space-y-1.5 pl-1 my-2">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2 text-zinc-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                    <span>{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            );

          case 'paragraph':
          default:
            return (
              <p key={idx} className="text-zinc-300 leading-relaxed">
                {renderInline(block.content)}
              </p>
            );
        }
      })}

      {/* Streaming blinking cursor */}
      {isStreaming && (
        <span className="inline-block w-2 h-3.5 ml-1 bg-brand-400 animate-pulse rounded-sm align-middle" />
      )}
    </div>
  );
}

export default MarkdownRenderer;

