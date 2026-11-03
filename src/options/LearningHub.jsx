/**
 * Curio — Personal Knowledge Vault Interface (React)
 *
 * Comprehensive local-first knowledge management dashboard:
 *  - Searchable personal library of concepts, explanations, and code examples
 *  - Custom Collections (notebooks/folders) with color coding
 *  - Interactive Tagging system (add/remove tags per concept)
 *  - User personal annotations & notes editor
 *  - Understanding mastery level tracking (Not Reviewed, Review Needed, Understood)
 *  - Safe Markdown explanation rendering & code syntax highlighting
 *  - Full JSON Export and Import with deduplication
 *  - Privacy-preserving complete local storage (chrome.storage.local)
 *
 * @module options/LearningHub
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Upload,
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
  Plus,
  Tag as TagIcon,
  Folder,
  FolderPlus,
  FolderOpen,
  Edit3,
  Save,
  RotateCcw,
  AlertTriangle,
  ArrowUpDown,
  MessageSquare,
} from 'lucide-react';

import {
  getVaultConcepts,
  saveVaultConcept,
  updateVaultConcept,
  deleteVaultConcept,
  getVaultCollections,
  createVaultCollection,
  updateVaultCollection,
  deleteVaultCollection,
  searchVaultConcepts,
  exportVaultData,
  importVaultData,
  clearVaultData,
} from '../shared/services/vaultStorage.js';

import { getLearningStats } from '../shared/services/learningService.js';
import { MarkdownRenderer } from '../content/overlay/markdownRenderer.jsx';

const PRESET_COLORS = [
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Sky', hex: '#0284c7' },
];

const CATEGORIES = [
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

export const LearningHub = () => {
  const [concepts, setConcepts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCollectionId, setActiveCollectionId] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTag, setSelectedTag] = useState('All');
  const [understandingFilter, setUnderstandingFilter] = useState('All');
  const [sortBy, setSortBy] = useState('recently_saved');

  // Modals & Drawers
  const [detailConcept, setDetailConcept] = useState(null);
  const [detailTab, setDetailTab] = useState('explanation'); // 'explanation' | 'code' | 'conversation' | 'notes'
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [newCollectionColor, setNewCollectionColor] = useState(PRESET_COLORS[0].hex);

  // Detail editing states
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSavedToast, setNotesSavedToast] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importNotice, setImportNotice] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    const [cols, st] = await Promise.all([
      getVaultCollections(),
      getLearningStats(),
    ]);
    setCollections(cols);
    setStats(st);
    await executeQuery();
    setLoading(false);
  };

  const executeQuery = async () => {
    const results = await searchVaultConcepts({
      query: searchQuery,
      category: selectedCategory,
      tag: selectedTag,
      collectionId: activeCollectionId,
      understandingStatus: understandingFilter,
      sortBy,
    });
    setConcepts(results);
  };

  // Re-run search whenever any filter or sorting criteria changes
  useEffect(() => {
    executeQuery();
  }, [searchQuery, activeCollectionId, selectedCategory, selectedTag, understandingFilter, sortBy]);

  // Aggregate all unique tags across all concepts for tag filter
  const allTags = React.useMemo(() => {
    const set = new Set();
    for (const c of concepts) {
      if (Array.isArray(c.tags)) {
        for (const t of c.tags) {
          if (t && t.trim()) set.add(t.trim());
        }
      }
    }
    return Array.from(set).sort();
  }, [concepts]);

  // ─── Concept Actions ────────────────────────────────────────────────

  const handleOpenDetail = (concept) => {
    setDetailConcept(concept);
    setNotesDraft(concept.userNotes || '');
    setDetailTab('explanation');
  };

  const handleCloseDetail = () => {
    setDetailConcept(null);
    setNotesSavedToast(false);
  };

  const handleSaveNotes = async () => {
    if (!detailConcept) return;
    const updated = await updateVaultConcept(detailConcept.id, { userNotes: notesDraft });
    if (updated) {
      setDetailConcept(updated);
      setNotesSavedToast(true);
      setTimeout(() => setNotesSavedToast(false), 2500);
      await executeQuery();
    }
  };

  const handleUpdateStatus = async (conceptId, status) => {
    const updated = await updateVaultConcept(conceptId, { understandingStatus: status });
    if (updated) {
      if (detailConcept && detailConcept.id === conceptId) {
        setDetailConcept(updated);
      }
      await executeQuery();
      const newStats = await getLearningStats();
      setStats(newStats);
    }
  };

  const handleAssignCollection = async (conceptId, collectionId) => {
    const colVal = collectionId === 'none' ? null : collectionId;
    const updated = await updateVaultConcept(conceptId, { collectionId: colVal });
    if (updated) {
      if (detailConcept && detailConcept.id === conceptId) {
        setDetailConcept(updated);
      }
      await executeQuery();
    }
  };

  const handleAddTag = async () => {
    if (!detailConcept || !tagInput.trim()) return;
    const cleanTag = tagInput.trim();
    const existing = detailConcept.tags || [];
    if (!existing.includes(cleanTag)) {
      const newTags = [...existing, cleanTag];
      const updated = await updateVaultConcept(detailConcept.id, { tags: newTags });
      if (updated) {
        setDetailConcept(updated);
        setTagInput('');
        await executeQuery();
      }
    } else {
      setTagInput('');
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    if (!detailConcept) return;
    const existing = detailConcept.tags || [];
    const newTags = existing.filter((t) => t !== tagToRemove);
    const updated = await updateVaultConcept(detailConcept.id, { tags: newTags });
    if (updated) {
      setDetailConcept(updated);
      await executeQuery();
    }
  };

  const handleDeleteConcept = async (conceptId) => {
    await deleteVaultConcept(conceptId);
    if (detailConcept && detailConcept.id === conceptId) {
      handleCloseDetail();
    }
    await executeQuery();
    const newStats = await getLearningStats();
    setStats(newStats);
  };

  // ─── Collection Actions ─────────────────────────────────────────────

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;

    await createVaultCollection({
      name: newCollectionName.trim(),
      description: newCollectionDesc.trim(),
      color: newCollectionColor,
    });

    setNewCollectionName('');
    setNewCollectionDesc('');
    setShowNewCollectionModal(false);

    const cols = await getVaultCollections();
    setCollections(cols);
  };

  const handleDeleteCollection = async (colId) => {
    if (confirm('Delete this collection? Concepts in this collection will remain safe.')) {
      await deleteVaultCollection(colId);
      if (activeCollectionId === colId) {
        setActiveCollectionId('All');
      }
      const cols = await getVaultCollections();
      setCollections(cols);
      await executeQuery();
    }
  };

  // ─── Export & Import ────────────────────────────────────────────────

  const handleExport = async () => {
    const jsonStr = await exportVaultData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `curio-knowledge-vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const res = await importVaultData(text, { merge: true });
      setImportNotice(
        `Successfully imported ${res.importedConcepts} new concepts, updated ${res.updatedConcepts} existing concepts, and imported ${res.importedCollections} collections!`
      );
      setTimeout(() => setImportNotice(null), 6000);
      await loadAllData();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearAll = async () => {
    await clearVaultData();
    setShowClearConfirm(false);
    await loadAllData();
  };

  const handleCopyCode = async (code, id) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2000);
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  return (
    <div className="space-y-6 select-text font-sans">
      {/* ─── Header & Analytics ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal-400" />
            Personal Knowledge Vault
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Your searchable local-first repository of saved concepts, explanations, and code.
          </p>
        </div>

        {/* Global Vault Action Buttons */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json,application/json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors"
            title="Import Knowledge Vault from JSON file"
          >
            <Upload className="w-3.5 h-3.5 text-teal-400" />
            <span>Import JSON</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors"
            title="Export complete vault as JSON backup"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
            title="Reset vault data"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Import Feedback Toast */}
      {importNotice && (
        <div className="p-3 rounded-xl bg-teal-950/80 border border-teal-700 text-teal-300 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-400" />
          <span>{importNotice}</span>
        </div>
      )}

      {/* ─── Metric KPI Badges ──────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] text-slate-400 mb-0.5">Total In Vault</div>
            <div className="text-xl font-bold text-slate-100">{concepts.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{collections.length} custom collections</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] text-slate-400 mb-0.5">Understood</div>
            <div className="text-xl font-bold text-emerald-400">
              {concepts.filter((c) => c.understandingStatus === 'understood').length}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Mastered concepts</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] text-slate-400 mb-0.5">Needs Review</div>
            <div className="text-xl font-bold text-amber-400">
              {concepts.filter((c) => c.understandingStatus === 'need_explanation').length}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Marked for review</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] text-slate-400 mb-0.5">Not Reviewed</div>
            <div className="text-xl font-bold text-slate-300">
              {concepts.filter((c) => !c.understandingStatus || c.understandingStatus === 'not_reviewed').length}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Freshly discovered</div>
          </div>
        </div>
      )}

      {/* ─── Collections Navigation Bar ─────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 curio-scrollbar">
        <button
          onClick={() => setActiveCollectionId('All')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeCollectionId === 'All'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Folder className="w-3.5 h-3.5" />
          <span>All Concepts</span>
        </button>

        <button
          onClick={() => setActiveCollectionId('none')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeCollectionId === 'none'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
          <span>Unassigned</span>
        </button>

        {collections.map((col) => {
          const count = concepts.filter((c) => c.collectionId === col.id).length;
          const isActive = activeCollectionId === col.id;
          return (
            <div
              key={col.id}
              className={`group flex items-center rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-slate-800 border-teal-500/80 text-teal-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <button
                onClick={() => setActiveCollectionId(col.id)}
                className="flex items-center gap-2 px-3 py-1.5"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: col.color || '#0d9488' }}
                />
                <span>{col.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/80 text-slate-400 font-mono">
                  {count}
                </span>
              </button>
              <button
                onClick={() => handleDeleteCollection(col.id)}
                className="pr-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete collection"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        <button
          onClick={() => setShowNewCollectionModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-slate-700 text-xs font-medium text-slate-400 hover:text-teal-400 hover:border-teal-500/60 whitespace-nowrap transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Collection</span>
        </button>
      </div>

      {/* ─── Search & Multi-Filter Controls ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
        {/* Search input */}
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search concepts, code, terms, notes..."
            className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/80"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="md:col-span-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-teal-500/80"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                Category: {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Tag filter */}
        <div className="md:col-span-2">
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="w-full py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-teal-500/80"
          >
            <option value="All">All Tags ({allTags.length})</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
        </div>

        {/* Understanding Status filter */}
        <div className="md:col-span-2">
          <select
            value={understandingFilter}
            onChange={(e) => setUnderstandingFilter(e.target.value)}
            className="w-full py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-teal-500/80"
          >
            <option value="All">Status: All</option>
            <option value="understood">Understood</option>
            <option value="need_explanation">Need Review</option>
            <option value="not_reviewed">Not Reviewed</option>
          </select>
        </div>

        {/* Sort by */}
        <div className="md:col-span-1">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full py-1.5 px-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-teal-500/80"
            title="Sort concepts"
          >
            <option value="recently_saved">Recent</option>
            <option value="recently_updated">Updated</option>
            <option value="title_asc">A-Z</option>
            <option value="understanding">Status</option>
          </select>
        </div>
      </div>

      {/* ─── Concepts Card Grid ─────────────────────────────────────── */}
      {concepts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-3">
          <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">No Concepts Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'All' || selectedTag !== 'All'
              ? 'No concepts matched your search and filter criteria. Try resetting filters.'
              : 'Your Knowledge Vault is empty. Select any word or code on a webpage and click the bookmark button to save it here!'}
          </p>
          {(searchQuery || selectedCategory !== 'All' || selectedTag !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSelectedTag('All');
                setUnderstandingFilter('All');
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-teal-400 font-medium transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {concepts.map((concept) => {
            const assignedCol = collections.find((col) => col.id === concept.collectionId);
            const status = concept.understandingStatus || concept.understandingLevel || 'not_reviewed';
            const codeCount = concept.codeExamples?.length || 0;

            const explanationSummary = typeof concept.explanation === 'string'
              ? concept.explanation.slice(0, 160)
              : concept.explanation?.summary || concept.explanation?.title || '';

            return (
              <div
                key={concept.id}
                onClick={() => handleOpenDetail(concept)}
                className="group relative flex flex-col justify-between p-4 rounded-xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                <div>
                  {/* Top row: Category, Collection, Status */}
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/60">
                        {concept.category || 'General'}
                      </span>
                      {assignedCol && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1"
                          style={{
                            backgroundColor: `${assignedCol.color}15`,
                            color: assignedCol.color,
                            border: `1px solid ${assignedCol.color}40`,
                          }}
                        >
                          <Folder className="w-2.5 h-2.5" />
                          <span>{assignedCol.name}</span>
                        </span>
                      )}
                    </div>

                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextStatus = status === 'understood'
                          ? 'need_explanation'
                          : status === 'need_explanation'
                          ? 'not_reviewed'
                          : 'understood';
                        handleUpdateStatus(concept.id, nextStatus);
                      }}
                      className="cursor-pointer"
                      title="Click to toggle understanding status"
                    >
                      {status === 'understood' && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-700/80">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Understood</span>
                        </span>
                      )}
                      {status === 'need_explanation' && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-950/80 text-amber-300 border border-amber-700/80">
                          <HelpCircle className="w-2.5 h-2.5 text-amber-400" />
                          <span>Review</span>
                        </span>
                      )}
                      {(!status || status === 'not_reviewed') && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/60">
                          <Clock className="w-2.5 h-2.5" />
                          <span>New</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Term */}
                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-teal-300 transition-colors line-clamp-1">
                    {concept.title || concept.selectedText}
                  </h3>
                  {concept.selectedText && concept.selectedText !== concept.title && (
                    <div className="text-[11px] font-mono text-teal-400/90 mb-1.5 line-clamp-1">
                      {concept.selectedText}
                    </div>
                  )}

                  {/* Excerpt */}
                  {explanationSummary && (
                    <p className="text-xs text-slate-400 line-clamp-3 mb-2.5 leading-relaxed">
                      {explanationSummary.replace(/```[\s\S]*?```/g, '[Code Example]').replace(/#{1,6}\s/g, '')}
                    </p>
                  )}

                  {/* Tags */}
                  {concept.tags && concept.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2.5">
                      {concept.tags.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.2 rounded text-[10px] bg-slate-950 text-slate-400 border border-slate-800"
                        >
                          #{t}
                        </span>
                      ))}
                      {concept.tags.length > 4 && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          +{concept.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer metadata */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                  <div className="flex items-center gap-2">
                    {codeCount > 0 && (
                      <span className="flex items-center gap-1 text-purple-400">
                        <Terminal className="w-3 h-3" />
                        <span>{codeCount} code</span>
                      </span>
                    )}
                    {concept.userNotes && (
                      <span className="flex items-center gap-1 text-slate-400" title="Has notes">
                        <Edit3 className="w-3 h-3 text-amber-400" />
                        <span>Notes</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConcept(concept.id);
                      }}
                      className="p-1 rounded text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete from vault"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Detail Slide-Over Modal ────────────────────────────────── */}
      {detailConcept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl max-h-[88vh] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-100">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-teal-300 border border-slate-700">
                    {detailConcept.category || 'General'}
                  </span>
                  {detailConcept.pageTitle && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <span>from</span>
                      <span className="text-slate-300 font-medium max-w-[200px] truncate">{detailConcept.pageTitle}</span>
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-slate-100">
                  {detailConcept.title || detailConcept.selectedText}
                </h2>
                {detailConcept.selectedText && detailConcept.selectedText !== detailConcept.title && (
                  <div className="text-xs font-mono text-teal-400 mt-0.5">
                    {detailConcept.selectedText}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {detailConcept.pageUrl && (
                  <a
                    href={detailConcept.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg text-slate-400 hover:text-teal-400 hover:bg-slate-800 transition-colors"
                    title="Open original webpage"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={handleCloseDetail}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDetailTab('explanation')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    detailTab === 'explanation'
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Explanation
                </button>
                {detailConcept.codeExamples?.length > 0 && (
                  <button
                    onClick={() => setDetailTab('code')}
                    className={`px-3 py-1 rounded-md font-medium flex items-center gap-1 transition-colors ${
                      detailTab === 'code'
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Code Examples</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-950 font-mono">
                      {detailConcept.codeExamples.length}
                    </span>
                  </button>
                )}
                <button
                  onClick={() => setDetailTab('notes')}
                  className={`px-3 py-1 rounded-md font-medium flex items-center gap-1 transition-colors ${
                    detailTab === 'notes'
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>My Notes</span>
                  {notesDraft && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                </button>
                {detailConcept.conversationHistory?.length > 0 && (
                  <button
                    onClick={() => setDetailTab('conversation')}
                    className={`px-3 py-1 rounded-md font-medium flex items-center gap-1 transition-colors ${
                      detailTab === 'conversation'
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Follow-Up Q&A</span>
                  </button>
                )}
              </div>

              {/* Status and Collection Controls */}
              <div className="flex items-center gap-2">
                <select
                  value={detailConcept.collectionId || 'none'}
                  onChange={(e) => handleAssignCollection(detailConcept.id, e.target.value)}
                  className="py-1 px-2 rounded-md bg-slate-950 border border-slate-800 text-[11px] text-slate-300"
                >
                  <option value="none">No Collection</option>
                  {collections.map((col) => (
                    <option key={col.id} value={col.id}>
                      Collection: {col.name}
                    </option>
                  ))}
                </select>

                <select
                  value={detailConcept.understandingStatus || 'not_reviewed'}
                  onChange={(e) => handleUpdateStatus(detailConcept.id, e.target.value)}
                  className="py-1 px-2 rounded-md bg-slate-950 border border-slate-800 text-[11px] text-slate-300"
                >
                  <option value="not_reviewed">Not Reviewed</option>
                  <option value="need_explanation">Need Review</option>
                  <option value="understood">Understood</option>
                </select>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 curio-scrollbar space-y-4">
              {/* Tags Section */}
              <div className="flex items-center flex-wrap gap-1.5 pb-3 border-b border-slate-800/80 text-xs">
                <TagIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                {(detailConcept.tags || []).map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-medium"
                  >
                    <span>#{t}</span>
                    <button
                      onClick={() => handleRemoveTag(t)}
                      className="text-slate-500 hover:text-red-400"
                      title="Remove tag"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1 ml-1">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="+ Add tag..."
                    className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/80"
                  />
                  {tagInput && (
                    <button
                      onClick={handleAddTag}
                      className="px-1.5 py-0.5 rounded bg-teal-600 text-[10px] text-white font-medium"
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>

              {/* Tab 1: Full Explanation */}
              {detailTab === 'explanation' && (
                <div className="space-y-4">
                  {typeof detailConcept.explanation === 'string' ? (
                    <MarkdownRenderer markdown={detailConcept.explanation} />
                  ) : (
                    <div className="space-y-3">
                      {detailConcept.explanation?.summary && (
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {detailConcept.explanation.summary}
                        </p>
                      )}
                      {detailConcept.explanation?.deepDive && (
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                          <span className="font-semibold text-teal-400 block mb-1">Deep Dive Mechanics</span>
                          {detailConcept.explanation.deepDive}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Code Examples */}
              {detailTab === 'code' && (
                <div className="space-y-3">
                  {detailConcept.codeExamples?.map((block, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 text-xs"
                    >
                      <div className="px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-slate-400">
                        <span className="font-mono text-[11px] text-purple-400">
                          {block.language || 'code'}
                        </span>
                        <button
                          onClick={() => handleCopyCode(block.code, idx)}
                          className="flex items-center gap-1 text-[11px] hover:text-slate-200 transition-colors"
                        >
                          {copiedCodeId === idx ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-3.5 overflow-x-auto font-mono text-[11px] text-slate-200 leading-relaxed">
                        <code>{block.code}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 3: Notes Editor */}
              {detailTab === 'notes' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Personal reflections, mental models & mnemonic notes:</span>
                    {notesSavedToast && (
                      <span className="text-teal-400 flex items-center gap-1 font-medium animate-fade-in">
                        <Check className="w-3 h-3" />
                        Notes saved!
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={8}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Write your personal notes or takeaways about this concept..."
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/80 leading-relaxed"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveNotes}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-xs font-semibold text-white shadow-sm transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Notes</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 4: Conversation History */}
              {detailTab === 'conversation' && (
                <div className="space-y-3">
                  {detailConcept.conversationHistory?.map((msg, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl text-xs ${
                        msg.role === 'user'
                          ? 'bg-slate-800/80 text-slate-200 ml-4 border border-slate-700/60'
                          : 'bg-slate-950 text-slate-300 mr-2 border border-slate-800'
                      }`}
                    >
                      <div className="text-[10px] text-slate-500 font-semibold mb-1">
                        {msg.role === 'user' ? 'You' : 'Curio'}
                      </div>
                      <div className="whitespace-pre-line leading-relaxed">
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Saved on {new Date(detailConcept.createdAt || Date.now()).toLocaleDateString()}</span>
              <button
                onClick={() => handleDeleteConcept(detailConcept.id)}
                className="flex items-center gap-1 text-slate-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Concept</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── New Collection Modal ───────────────────────────────────── */}
      {showNewCollectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-5 text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-teal-400" />
                Create New Collection
              </h3>
              <button
                onClick={() => setShowNewCollectionModal(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCollection} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Collection Name *</label>
                <input
                  type="text"
                  required
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="e.g. Python Fundamentals, React Internals"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/80"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={newCollectionDesc}
                  onChange={(e) => setNewCollectionDesc(e.target.value)}
                  placeholder="e.g. Core mechanics, async loops, and data structures"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/80"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Color Accent</label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setNewCollectionColor(c.hex)}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        newCollectionColor === c.hex ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCollectionModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newCollectionName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
                >
                  Create Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Clear All Confirmation Modal ───────────────────────────── */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-red-900/60 shadow-2xl p-5 text-slate-100 space-y-3">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Clear Entire Knowledge Vault?</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This action will permanently delete all saved concepts, custom collections, and personal notes. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white"
              >
                Yes, Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningHub;
