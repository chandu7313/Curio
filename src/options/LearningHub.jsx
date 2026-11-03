/**
 * Curio — Personal Learning Hub & Glossary Dashboard (React)
 *
 * Provides:
 *  - Categorized Personal Glossary
 *  - Multi-criteria Search & Filtering
 *  - Comprehension & Mastery Level Tracking
 *  - Revisit Saved Explanations & Code Blocks
 *  - Connected Technical Concepts (Knowledge Graph)
 *  - Export Data (JSON) & Privacy Consent Controls
 *
 * @module options/LearningHub
 */

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Clock,
  Bookmark,
  BookmarkCheck,
  Trash2,
  Download,
  ExternalLink,
  GitFork,
  ChevronDown,
  ChevronUp,
  FileText,
  BarChart3,
  Filter,
  Check,
  Copy,
  Terminal,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  getGlossary,
  searchGlossary,
  updateUnderstandingLevel,
  toggleSaveConcept,
  updateConceptNotes,
  deleteConcept,
  getLearningStats,
  exportLearningData,
  clearLearningData,
} from '../shared/services/learningService.js';

export const LearningHub = () => {
  const [concepts, setConcepts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [understandingFilter, setUnderstandingFilter] = useState('All');
  const [savedOnly, setSavedOnly] = useState(false);

  // Detail & Edit state
  const [expandedId, setExpandedId] = useState(null);
  const [editingNotesId, setEditingNotesId] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [revisitModalItem, setRevisitModalItem] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [glossaryList, learningStats] = await Promise.all([
      getGlossary(),
      getLearningStats(),
    ]);
    setConcepts(glossaryList);
    setStats(learningStats);
    setLoading(false);
  };

  // Run search & filters when criteria change
  useEffect(() => {
    let active = true;
    searchGlossary(searchQuery, {
      category: selectedCategory,
      understandingLevel: understandingFilter,
      savedOnly,
    }).then((results) => {
      if (active) setConcepts(results);
    });
    return () => {
      active = false;
    };
  }, [searchQuery, selectedCategory, understandingFilter, savedOnly]);

  // ─── Actions ───────────────────────────────────────────────────────

  const handleSetUnderstanding = async (id, level) => {
    await updateUnderstandingLevel(id, level);
    await loadData();
  };

  const handleToggleSave = async (id) => {
    await toggleSaveConcept(id);
    await loadData();
  };

  const handleStartEditNotes = (concept) => {
    setEditingNotesId(concept.id);
    setNotesDraft(concept.notes || '');
  };

  const handleSaveNotes = async (id) => {
    await updateConceptNotes(id, notesDraft);
    setEditingNotesId(null);
    await loadData();
  };

  const handleDelete = async (id) => {
    await deleteConcept(id);
    await loadData();
  };

  const handleExportJson = async () => {
    const jsonStr = await exportLearningData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `curio-learning-glossary-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = async () => {
    await clearLearningData();
    setShowClearConfirm(false);
    await loadData();
  };

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  // List of available categories
  const categories = [
    'All',
    'React',
    'Python',
    'JavaScript',
    'Architecture',
    'Algorithms',
    'Security',
    'Web Standards',
    'General',
  ];

  return (
    <div className="space-y-6">
      {/* ─── Learning Analytics Overview ────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Total Explored</span>
              <BookOpen className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{stats.totalConcepts}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Tracked concepts</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Mastery Rate</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {stats.masteryPercentage}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {stats.understoodCount} marked understood
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Need Review</span>
              <HelpCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400">
              {stats.needExplanationCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Flagged for revisiting</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Saved for Later</span>
              <Bookmark className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-400">{stats.savedCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Bookmarked in library</div>
          </div>
        </div>
      )}

      {/* ─── Search & Filtering Toolbar ─────────────────────────────── */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Free Text Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts, definitions, notes, keywords..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Understanding Filter */}
          <select
            value={understandingFilter}
            onChange={(e) => setUnderstandingFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-teal-500"
          >
            <option value="All">All Comprehension Levels</option>
            <option value="understood">✓ Understood Only</option>
            <option value="need_explanation">❓ Needs Review</option>
            <option value="reviewing">⏳ In Progress</option>
          </select>

          {/* Saved Only Filter */}
          <button
            onClick={() => setSavedOnly(!savedOnly)}
            className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              savedOnly
                ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Only</span>
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 curio-scrollbar">
          <span className="text-[11px] text-slate-500 font-medium mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Topic:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Personal Glossary List ─────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>{concepts.length} concepts found</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1 text-teal-400 hover:text-teal-300 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1 text-red-400/80 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <Sparkles className="w-4 h-4 animate-spin text-teal-400 mx-auto mb-2" />
            Loading Personal Knowledge Base...
          </div>
        ) : concepts.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-dashed border-slate-800 space-y-3">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No concepts match your filter</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Select any unfamiliar term, code snippet, or math formula on any webpage and press Alt+Shift+E to start building your personal learning library!
            </p>
          </div>
        ) : (
          concepts.map((item) => {
            const isExpanded = expandedId === item.id;
            const isEditingNotes = editingNotesId === item.id;

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
              >
                {/* Item Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-100">{item.term}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {item.category}
                      </span>
                      {item.exploreCount > 1 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-teal-950/80 text-teal-300 border border-teal-800/60">
                          {item.exploreCount}x views
                        </span>
                      )}
                      {item.understandingLevel === 'understood' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Understood
                        </span>
                      ) : item.understandingLevel === 'need_explanation' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                          <HelpCircle className="w-2.5 h-2.5" /> Review
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> In Progress
                        </span>
                      )}
                    </div>

                    {/* Source link */}
                    {item.pageTitle && (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <span>Source:</span>
                        <span className="text-slate-400 truncate max-w-md">{item.pageTitle}</span>
                        {item.pageUrl && (
                          <a
                            href={item.pageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-teal-400 hover:underline inline-flex items-center"
                          >
                            <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Top Right Quick Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleSave(item.id)}
                      title={item.isSaved ? 'Saved in library' : 'Save for later'}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        item.isSaved
                          ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                          : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      {item.isSaved ? (
                        <BookmarkCheck className="w-4 h-4 fill-purple-400/20" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => setRevisitModalItem(item)}
                      title="Revisit full explanation"
                      className="px-2.5 py-1 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 text-xs font-medium flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Revisit</span>
                    </button>

                    <button
                      onClick={() => handleDelete(item.id)}
                      title="Delete from glossary"
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Explanation Summary */}
                {item.explanation?.summary && (
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {item.explanation.summary}
                  </p>
                )}

                {/* Knowledge Connections (Related Concepts) */}
                {item.relatedConcepts?.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                      <GitFork className="w-3 h-3 text-teal-400" /> Connected:
                    </span>
                    {item.relatedConcepts.map((rel, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[11px] text-slate-300"
                        title={rel.label}
                      >
                        <span className="font-medium text-slate-200">{rel.term}</span>
                        <span className="text-[9px] text-slate-500 font-mono">
                          ({rel.relation})
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Comprehension Status Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Your understanding:</span>
                    <button
                      onClick={() => handleSetUnderstanding(item.id, 'understood')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        item.understandingLevel === 'understood'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      ✓ Understood
                    </button>
                    <button
                      onClick={() => handleSetUnderstanding(item.id, 'need_explanation')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        item.understandingLevel === 'need_explanation'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      ❓ Needs Review
                    </button>
                  </div>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    <span>{isExpanded ? 'Hide Details' : 'Notes & Code'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Expanded Notes & Code Drawer */}
                {isExpanded && (
                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    {/* Code snippet if present */}
                    {item.explanation?.codeExample && (
                      <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-xs font-mono">
                        <div className="flex items-center justify-between text-slate-400 pb-2 mb-2 border-b border-slate-800/80">
                          <span className="uppercase text-[10px] font-semibold text-teal-400">
                            {item.explanation.codeExample.language || 'Code'}
                          </span>
                          <button
                            onClick={() => handleCopyCode(item.explanation.codeExample.code)}
                            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                          >
                            {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <pre className="text-slate-200 overflow-x-auto whitespace-pre">
                          {item.explanation.codeExample.code}
                        </pre>
                      </div>
                    )}

                    {/* Personal Notes Section */}
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <FileText className="w-3 h-3 text-teal-400" />
                          Personal Notes
                        </span>
                        {!isEditingNotes && (
                          <button
                            onClick={() => handleStartEditNotes(item)}
                            className="text-[11px] text-teal-400 hover:underline"
                          >
                            {item.notes ? 'Edit Notes' : '+ Add Notes'}
                          </button>
                        )}
                      </div>

                      {isEditingNotes ? (
                        <div className="space-y-2">
                          <textarea
                            value={notesDraft}
                            onChange={(e) => setNotesDraft(e.target.value)}
                            placeholder="Add your takeaways, real-world nuances, or edge cases..."
                            rows={3}
                            className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-teal-500"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingNotesId(null)}
                              className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-slate-200"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveNotes(item.id)}
                              className="px-3 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
                            >
                              Save Note
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          {item.notes || 'No personal notes added yet. Click "+ Add Notes" to record your insights.'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ─── Revisit Explanation Modal ──────────────────────────────── */}
      {revisitModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <h3 className="font-semibold text-sm">
                  {revisitModalItem.explanation?.title || revisitModalItem.term}
                </h3>
              </div>
              <button
                onClick={() => setRevisitModalItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs curio-scrollbar">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 italic text-slate-400">
                "{revisitModalItem.selectedText}"
              </div>

              <div className="space-y-2">
                <span className="font-semibold uppercase tracking-wider text-[10px] text-teal-400">
                  Concept Summary
                </span>
                <p className="text-slate-300 leading-relaxed">
                  {revisitModalItem.explanation?.summary}
                </p>
              </div>

              {revisitModalItem.explanation?.keyPoints?.length > 0 && (
                <div className="space-y-2">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-teal-400">
                    Key Insights
                  </span>
                  <ul className="space-y-1.5 pl-2">
                    {revisitModalItem.explanation.keyPoints.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 shrink-0" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {revisitModalItem.explanation?.codeExample && (
                <div className="space-y-1.5">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-teal-400">
                    Code Reference ({revisitModalItem.explanation.codeExample.language})
                  </span>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto">
                    {revisitModalItem.explanation.codeExample.code}
                  </pre>
                </div>
              )}

              {revisitModalItem.explanation?.deepDive && (
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-900/40 text-purple-200 text-xs">
                  <span className="font-semibold text-purple-300 block mb-1">Internal Mechanics:</span>
                  {revisitModalItem.explanation.deepDive}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
              <button
                onClick={() => setRevisitModalItem(null)}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Clear Data Confirmation Modal ──────────────────────────── */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-semibold text-slate-100">Clear Learning History?</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This will permanently delete all {concepts.length} concepts, understanding ratings, and personal notes stored in your local extension glossary. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
              >
                Yes, Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

