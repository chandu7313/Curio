/**
 * Curio — Adaptive Learning Intelligence & Personal Knowledge Vault
 *
 * Comprehensive learning dashboard featuring:
 *  - Searchable personal library of concepts, explanations, and code examples
 *  - Adaptive Learning Intelligence Dashboard:
 *      * Knowledge Gap Detection Center (Repeated explores, revision flags, missing prerequisites, goal milestones)
 *      * User-selected Learning Goals with progress tracking and milestone suggestions
 *      * Related Concept Groups (Semantic clusters)
 *      * Frequently explored and revision topics
 *  - Interactive Local Concept Graph (Nodes & Edges, relationship editor, zoom/pan)
 *  - Custom Collections (notebooks/folders) with color coding
 *  - Interactive Tagging system (add/remove tags per concept)
 *  - User personal annotations & notes editor
 *  - 4-Tier Understanding Tracking (Not Reviewed, Learning, Understood, Needs Revision)
 *  - Full JSON Export and Import with deduplication
 *  - Privacy-preserving complete local storage (chrome.storage.local)
 *
 * @module options/LearningHub
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Share2,
  Target,
  Network,
  Activity,
  Compass,
  Layers,
  Lightbulb,
  Zap,
  CheckSquare,
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
  normalizeUnderstandingStatus,
} from '../shared/services/vaultStorage.js';

import {
  getRelatedConcepts,
  getCuratedRecommendations,
  groupRelatedConcepts,
  getPrerequisiteChain,
  VALID_RELATIONSHIPS,
  normalizeRelationType,
  validateRelationship,
} from '../shared/services/knowledgeGraph.js';

import {
  getGraphEdges,
  saveGraphEdge,
  updateGraphEdge,
  deleteGraphEdge,
  getUnifiedConceptGraph,
} from '../shared/services/graphStorage.js';

import {
  getLearningGoals,
  createLearningGoal,
  updateLearningGoal,
  deleteLearningGoal,
  detectKnowledgeGaps,
  calculateGoalProgress,
  PRESET_LEARNING_GOALS,
} from '../shared/services/learningGoalsService.js';

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
  // Main view navigation
  const [activeTab, setActiveTab] = useState('vault'); // 'vault' | 'intelligence' | 'graph'

  // Concepts & Collections State
  const [concepts, setConcepts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Learning Goals & Knowledge Gaps State
  const [goals, setGoals] = useState([]);
  const [knowledgeGaps, setKnowledgeGaps] = useState([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDesc, setNewGoalDesc] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState('General');
  const [newGoalConcepts, setNewGoalConcepts] = useState('');

  // Knowledge Graph State
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [showAddEdgeModal, setShowAddEdgeModal] = useState(false);
  const [newEdgeSource, setNewEdgeSource] = useState('');
  const [newEdgeTarget, setNewEdgeTarget] = useState('');
  const [newEdgeRelation, setNewEdgeRelation] = useState('prerequisite');
  const [newEdgeLabel, setNewEdgeLabel] = useState('');
  const [edgeError, setEdgeError] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCollectionId, setActiveCollectionId] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTag, setSelectedTag] = useState('All');
  const [understandingFilter, setUnderstandingFilter] = useState('All');
  const [sortBy, setSortBy] = useState('recently_saved');

  // Modals & Drawers
  const [detailConcept, setDetailConcept] = useState(null);
  const [detailTab, setDetailTab] = useState('explanation'); // 'explanation' | 'code' | 'conversation' | 'notes' | 'connections'
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
    const [cols, st, gl, allConcepts] = await Promise.all([
      getVaultCollections(),
      getLearningStats(),
      getLearningGoals(),
      getVaultConcepts(),
    ]);

    setCollections(cols);
    setStats(st);
    setGoals(gl);

    // Compute Knowledge Gaps
    const detected = detectKnowledgeGaps(allConcepts, gl);
    setKnowledgeGaps(detected);

    // Compute Unified Graph
    const unifiedGraph = await getUnifiedConceptGraph(allConcepts);
    setGraphData(unifiedGraph);

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

  useEffect(() => {
    executeQuery();
  }, [searchQuery, activeCollectionId, selectedCategory, selectedTag, understandingFilter, sortBy]);

  // Aggregate all unique tags across all concepts for tag filter
  const allTags = useMemo(() => {
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

  // Concept clusters
  const conceptClusters = useMemo(() => {
    return groupRelatedConcepts(concepts);
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
      const allC = await getVaultConcepts();
      setKnowledgeGaps(detectKnowledgeGaps(allC, goals));
      const newStats = await getLearningStats();
      setStats(newStats);
      const graph = await getUnifiedConceptGraph(allC);
      setGraphData(graph);
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
    await loadAllData();
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
    if (activeCollectionId === colId) {
      setActiveCollectionId('All');
    }
    await deleteVaultCollection(colId);
    const cols = await getVaultCollections();
    setCollections(cols);
    await executeQuery();
  };

  // ─── Learning Goal Actions ──────────────────────────────────────────

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;

    const targetList = newGoalConcepts
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await createLearningGoal({
      title: newGoalTitle.trim(),
      description: newGoalDesc.trim(),
      category: newGoalCategory,
      targetConcepts: targetList,
    });

    setNewGoalTitle('');
    setNewGoalDesc('');
    setNewGoalConcepts('');
    setShowGoalModal(false);
    const gl = await getLearningGoals();
    setGoals(gl);
    const allC = await getVaultConcepts();
    setKnowledgeGaps(detectKnowledgeGaps(allC, gl));
  };

  const handleAdoptPresetGoal = async (preset) => {
    await createLearningGoal(preset);
    const gl = await getLearningGoals();
    setGoals(gl);
    const allC = await getVaultConcepts();
    setKnowledgeGaps(detectKnowledgeGaps(allC, gl));
  };

  const handleDeleteGoal = async (goalId) => {
    await deleteLearningGoal(goalId);
    const gl = await getLearningGoals();
    setGoals(gl);
    const allC = await getVaultConcepts();
    setKnowledgeGaps(detectKnowledgeGaps(allC, gl));
  };

  // ─── Graph Edge Actions ─────────────────────────────────────────────

  const handleAddGraphEdge = async (e) => {
    e.preventDefault();
    setEdgeError('');

    try {
      await saveGraphEdge({
        sourceTerm: newEdgeSource.trim(),
        targetTerm: newEdgeTarget.trim(),
        relation: newEdgeRelation,
        label: newEdgeLabel.trim(),
        confirmed: true,
        isInferred: false,
      });

      setShowAddEdgeModal(false);
      setNewEdgeSource('');
      setNewEdgeTarget('');
      setNewEdgeLabel('');
      const allC = await getVaultConcepts();
      const updatedGraph = await getUnifiedConceptGraph(allC);
      setGraphData(updatedGraph);
    } catch (err) {
      setEdgeError(err.message);
    }
  };

  const handleDeleteGraphEdge = async (edgeId) => {
    await deleteGraphEdge(edgeId);
    const allC = await getVaultConcepts();
    const updatedGraph = await getUnifiedConceptGraph(allC);
    setGraphData(updatedGraph);
  };

  // ─── Export & Import ────────────────────────────────────────────────

  const handleExport = async () => {
    const jsonStr = await exportVaultData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `curio-knowledge-vault-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importVaultData(text, { merge: true });
      setImportNotice({
        type: 'success',
        message: `Imported ${result.importedConcepts} new concepts, updated ${result.updatedConcepts} existing, and added ${result.importedCollections} collections.`,
      });
      await loadAllData();
    } catch (err) {
      setImportNotice({
        type: 'error',
        message: `Import failed: ${err.message}`,
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setImportNotice(null), 5000);
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

  // Helper for status badges
  const getStatusBadge = (status) => {
    const norm = normalizeUnderstandingStatus(status);
    switch (norm) {
      case 'understood':
        return {
          label: 'Understood',
          bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
          dot: 'bg-emerald-400',
          icon: CheckCircle2,
        };
      case 'learning':
        return {
          label: 'Learning',
          bg: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
          dot: 'bg-amber-400',
          icon: Clock,
        };
      case 'needs_revision':
        return {
          label: 'Needs Revision',
          bg: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
          dot: 'bg-rose-400',
          icon: AlertTriangle,
        };
      case 'not_reviewed':
      default:
        return {
          label: 'Not Reviewed',
          bg: 'bg-zinc-900 text-zinc-400 border-zinc-800',
          dot: 'bg-zinc-500',
          icon: HelpCircle,
        };
    }
  };

  const getRelationColor = (relation) => {
    const norm = normalizeRelationType(relation);
    switch (norm) {
      case 'prerequisite':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/70';
      case 'advanced':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/70';
      case 'alternative':
        return 'bg-teal-950/80 text-teal-300 border-teal-800/70';
      case 'confused_with':
        return 'bg-rose-950/80 text-rose-300 border-rose-800/70';
      case 'related':
      default:
        return 'bg-blue-950/80 text-blue-300 border-blue-800/70';
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Top Level Tab Navigation ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-brand-400" />
            Curio Adaptive Learning Intelligence
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Personal knowledge library, relationship graph, and adaptive gap detection engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Main View Mode Selector */}
          <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
            <button
              onClick={() => setActiveTab('vault')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'vault'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Knowledge Vault
            </button>
            <button
              onClick={() => setActiveTab('intelligence')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'intelligence'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-brand-300" />
              Learning Intelligence
              {knowledgeGaps.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-zinc-950 font-bold">
                  {knowledgeGaps.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('graph')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'graph'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              Concept Graph
            </button>
          </div>

          {/* Import / Export Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExport}
              title="Export complete knowledge library as JSON"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <label
              title="Import JSON knowledge backup"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Import</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* ─── Live Notification Banner ──────────────────────────────── */}
      {importNotice && (
        <div
          className={`p-3.5 rounded-xl border text-sm flex items-center justify-between animate-in fade-in ${
            importNotice.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800/80 text-rose-300'
          }`}
        >
          <span>{importNotice.message}</span>
          <button
            onClick={() => setImportNotice(null)}
            className="text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── Overview KPI Metric Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-zinc-100">
              {stats?.totalConcepts || concepts.length}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">Total in Vault</div>
          </div>
          <Bookmark className="w-8 h-8 text-brand-400/30" />
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-emerald-400">
              {stats?.understoodCount || 0}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">Understood</div>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-400/30" />
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-amber-400">
              {stats?.reviewingCount || 0}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">Currently Learning</div>
          </div>
          <Clock className="w-8 h-8 text-amber-400/30" />
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-rose-400">
              {stats?.needExplanationCount || 0}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">Needs Revision</div>
          </div>
          <AlertTriangle className="w-8 h-8 text-rose-400/30" />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VIEW 1: KNOWLEDGE VAULT (CONCEPTS & COLLECTIONS)                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'vault' && (
        <div className="space-y-6">
          {/* Collections Horizontal Carousel & Manager */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 curio-scrollbar select-none">
            <button
              onClick={() => setActiveCollectionId('All')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all ${
                activeCollectionId === 'All'
                  ? 'bg-zinc-100 text-zinc-900 font-semibold shadow-sm'
                  : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-400 border border-zinc-800'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>All Concepts</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
                {concepts.length}
              </span>
            </button>

            {collections.map((col) => {
              const count = concepts.filter((c) => c.collectionId === col.id).length;
              return (
                <div
                  key={col.id}
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 border transition-all ${
                    activeCollectionId === col.id
                      ? 'bg-zinc-850 text-zinc-100 border-zinc-700 shadow-sm'
                      : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-400 border-zinc-800'
                  }`}
                >
                  <button
                    onClick={() => setActiveCollectionId(col.id)}
                    className="flex items-center gap-2"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: col.color || '#0d9488' }}
                    />
                    <span>{col.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
                      {count}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCollection(col.id);
                    }}
                    title="Delete collection"
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 transition-opacity ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            <button
              onClick={() => setShowNewCollectionModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 bg-zinc-900/80 hover:bg-zinc-850 text-brand-400 border border-brand-900/60 hover:border-brand-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Collection</span>
            </button>
          </div>

          {/* Search & Multi-Attribute Filters Toolbar */}
          <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search title, selected text, code snippets, notes, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                {/* Category Dropdown */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-brand-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      Category: {cat}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={understandingFilter}
                  onChange={(e) => setUnderstandingFilter(e.target.value)}
                  className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-brand-500"
                >
                  <option value="All">Status: All</option>
                  <option value="understood">Understood</option>
                  <option value="learning">Learning</option>
                  <option value="needs_revision">Needs Revision</option>
                  <option value="not_reviewed">Not Reviewed</option>
                </select>

                {/* Sort Order */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-brand-500"
                >
                  <option value="recently_saved">Recently Saved</option>
                  <option value="recently_updated">Recently Updated</option>
                  <option value="title_asc">Title (A-Z)</option>
                  <option value="title_desc">Title (Z-A)</option>
                  <option value="understanding">Needs Revision First</option>
                </select>
              </div>
            </div>

            {/* Tag Pills Filter */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-zinc-800/60">
                <span className="text-[11px] text-zinc-500 mr-1 flex items-center gap-1">
                  <TagIcon className="w-3 h-3" />
                  Tags:
                </span>
                <button
                  onClick={() => setSelectedTag('All')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                    selectedTag === 'All'
                      ? 'bg-brand-600 text-white'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  All Tags
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag === selectedTag ? 'All' : tag)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                      selectedTag === tag
                        ? 'bg-brand-600 text-white'
                        : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ─── Concept Card Grid ───────────────────────────────────── */}
          {concepts.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30 space-y-3">
              <Bookmark className="w-10 h-10 text-zinc-600 mx-auto" />
              <h3 className="text-base font-semibold text-zinc-200">No concepts found</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Highlight any text on a webpage and click the bookmark action to save explanations,
                code examples, and notes to your vault.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {concepts.map((concept) => {
                const statusMeta = getStatusBadge(concept.understandingStatus || concept.understandingLevel);
                const colObj = collections.find((c) => c.id === concept.collectionId);
                const codeCount = concept.codeExamples?.length || 0;
                const recs = getCuratedRecommendations(concept.selectedText || concept.term || '');

                return (
                  <div
                    key={concept.id}
                    onClick={() => handleOpenDetail(concept)}
                    className="group p-4 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850/90 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      {/* Card Header: Category & Collection */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                            {concept.category || 'General'}
                          </span>
                          {colObj && (
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1"
                              style={{
                                backgroundColor: `${colObj.color}20`,
                                color: colObj.color,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: colObj.color }}
                              />
                              {colObj.name}
                            </span>
                          )}
                        </div>

                        {/* Status Pill */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border flex items-center gap-1 ${statusMeta.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                          {statusMeta.label}
                        </span>
                      </div>

                      {/* Title & Selected Text */}
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-brand-300 transition-colors line-clamp-1">
                          {concept.title}
                        </h4>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5 line-clamp-1">
                          "{concept.selectedText}"
                        </p>
                      </div>

                      {/* User Notes Preview */}
                      {concept.userNotes && (
                        <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/60 text-[11px] text-zinc-300 italic line-clamp-2">
                          "{concept.userNotes}"
                        </div>
                      )}

                      {/* Tags */}
                      {concept.tags && concept.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {concept.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400"
                            >
                              #{tag}
                            </span>
                          ))}
                          {concept.tags.length > 3 && (
                            <span className="text-[10px] text-zinc-500">
                              +{concept.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                      <div className="flex items-center gap-2">
                        {codeCount > 0 && (
                          <span className="flex items-center gap-1 text-zinc-400">
                            <Terminal className="w-3 h-3 text-purple-400" />
                            {codeCount} {codeCount === 1 ? 'example' : 'examples'}
                          </span>
                        )}
                        {recs.length > 0 && (
                          <span className="flex items-center gap-1 text-zinc-400">
                            <Sparkles className="w-3 h-3 text-brand-400" />
                            {recs.length} next steps
                          </span>
                        )}
                      </div>

                      <span title={new Date(concept.createdAt).toLocaleString()}>
                        {new Date(concept.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VIEW 2: ADAPTIVE LEARNING INTELLIGENCE DASHBOARD                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'intelligence' && (
        <div className="space-y-6">
          {/* Knowledge Gap Detection Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-900 border border-amber-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-zinc-100">
                  Knowledge Gap Detection Center
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {knowledgeGaps.length} suggestions
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 italic hidden sm:inline">
                *Inferred suggestions based on learning activity, not confirmed weaknesses.
              </span>
            </div>

            {knowledgeGaps.length === 0 ? (
              <p className="text-xs text-zinc-400">
                No active knowledge gaps detected! Keep exploring concepts on websites and marking your understanding.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                {knowledgeGaps.slice(0, 6).map((gap) => (
                  <div
                    key={gap.id}
                    className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-amber-700/50 transition-all flex flex-col justify-between space-y-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-amber-950 text-amber-300 border border-amber-800/60 uppercase">
                          {gap.type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Inferred Suggestion
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-zinc-100 line-clamp-1">
                        {gap.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 line-clamp-2">
                        {gap.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-xs">
                      <button
                        onClick={() => {
                          const target = concepts.find(
                            (c) => (c.selectedText && c.selectedText.toLowerCase() === gap.term.toLowerCase()) ||
                                   (c.title && c.title.toLowerCase() === gap.term.toLowerCase())
                          );
                          if (target) handleOpenDetail(target);
                        }}
                        className="text-brand-400 hover:text-brand-300 text-[11px] font-medium flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3" />
                        {gap.action}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User-Selected Learning Goals */}
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <Target className="w-5 h-5 text-brand-400" />
                  Active Learning Goals
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Curate learning milestones and track mastery towards technical objectives.
                </p>
              </div>

              <button
                onClick={() => setShowGoalModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Goal</span>
              </button>
            </div>

            {goals.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-zinc-800 rounded-xl space-y-3">
                <Target className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">
                  No learning goals set yet. Adopt a curated goal below to kickstart structured learning:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto pt-2">
                  {PRESET_LEARNING_GOALS.slice(0, 2).map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAdoptPresetGoal(preset)}
                      className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-brand-500 text-left transition-all"
                    >
                      <div className="text-xs font-semibold text-zinc-200">{preset.title}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {goals.map((goal) => {
                  const progress = calculateGoalProgress(goal, concepts);
                  return (
                    <div
                      key={goal.id}
                      className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                            {goal.category}
                          </span>
                          <h4 className="text-sm font-semibold text-zinc-100 mt-1">
                            {goal.title}
                          </h4>
                          {goal.description && (
                            <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                              {goal.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteGoal(goal.id)}
                          title="Delete goal"
                          className="text-zinc-500 hover:text-rose-400 transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                          <span>Mastery Progress</span>
                          <span className="font-semibold text-zinc-200">
                            {progress.completed}/{progress.total} concepts ({progress.progressPct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${progress.progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Milestone Target Chips */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {goal.targetConcepts.map((term) => {
                          const norm = term.toLowerCase().trim();
                          const isMastered = concepts.some(
                            (c) => (c.selectedText && c.selectedText.toLowerCase().trim() === norm) &&
                                   (c.understandingStatus === 'understood' || c.understandingLevel === 'understood')
                          );
                          return (
                            <span
                              key={term}
                              className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                isMastered
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                              }`}
                            >
                              {isMastered && <Check className="w-2.5 h-2.5" />}
                              {term}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Related Concept Groups (Semantic Clusters) */}
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-brand-400" />
              Related Concept Groups & Learning Paths
            </h3>

            {conceptClusters.length === 0 ? (
              <p className="text-xs text-zinc-400">
                Save concepts to generate semantic relationship clusters and paths.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {conceptClusters.map((cluster) => {
                  const pct = cluster.totalCount > 0 ? Math.round((cluster.understoodCount / cluster.totalCount) * 100) : 0;
                  return (
                    <div
                      key={cluster.category}
                      className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-zinc-100">
                            {cluster.groupName}
                          </h4>
                          <span className="text-xs text-zinc-400">
                            {cluster.understoodCount} of {cluster.totalCount} understood ({pct}%)
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                          {cluster.category}
                        </span>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-brand-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {cluster.concepts.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => handleOpenDetail(c)}
                            className="px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[11px] text-zinc-300 transition-colors"
                          >
                            {c.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VIEW 3: INTERACTIVE CONCEPT KNOWLEDGE GRAPH                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'graph' && (
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Network className="w-5 h-5 text-brand-400" />
                Local Concept Knowledge Graph
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Inspect nodes (concepts) and directed edges (relationships). Edit or delete connections freely.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddEdgeModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Relationship</span>
              </button>
            </div>
          </div>

          {/* Interactive Concept Map Canvas */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 min-h-[420px] flex flex-col justify-between">
            {graphData.nodes.length === 0 ? (
              <div className="m-auto text-center p-8 text-zinc-500 text-xs">
                No concepts in graph yet. Save concepts in the vault to populate nodes and relationships!
              </div>
            ) : (
              <div className="space-y-4">
                {/* Node Cloud with Understanding Status Indicator */}
                <div className="flex flex-wrap gap-2.5 items-center justify-center py-6">
                  {graphData.nodes.map((node) => {
                    const statusMeta = getStatusBadge(node.understandingStatus);
                    const isSelected = selectedNode?.term === node.term;

                    return (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-zinc-800 text-white border-brand-400 shadow-lg scale-105'
                            : `${statusMeta.bg} hover:border-zinc-500`
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
                        <span>{node.term}</span>
                        {node.isSuggested && (
                          <span className="text-[9px] px-1 rounded bg-zinc-800 text-zinc-400 font-mono">
                            suggested
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Node Inspector Drawer */}
                {selectedNode && (
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-zinc-100">
                          {selectedNode.term}
                        </h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                          {selectedNode.category}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedNode(null)}
                        className="text-zinc-500 hover:text-zinc-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Prerequisite Chain */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                        Prerequisite Learning Chain
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-300 flex-wrap">
                        {getPrerequisiteChain(selectedNode.term).length === 0 ? (
                          <span className="text-zinc-500 text-[11px]">Foundational concept (no prior prerequisite required)</span>
                        ) : (
                          getPrerequisiteChain(selectedNode.term).map((step, idx) => (
                            <span key={idx} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800">
                              <span className="text-amber-400">Prereq:</span> {step.term}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Outgoing & Inferred Relationships */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                        Relationships Connected
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {graphData.edges
                          .filter(
                            (e) => e.sourceTerm.toLowerCase() === selectedNode.term.toLowerCase() ||
                                   e.targetTerm.toLowerCase() === selectedNode.term.toLowerCase()
                          )
                          .map((edge) => (
                            <div
                              key={edge.id}
                              className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-zinc-200">
                                    {edge.sourceTerm} → {edge.targetTerm}
                                  </span>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono border ${getRelationColor(edge.relation)}`}>
                                    {edge.relation}
                                  </span>
                                </div>
                                {edge.label && (
                                  <div className="text-[10px] text-zinc-400 line-clamp-1">{edge.label}</div>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteGraphEdge(edge.id)}
                                title="Delete relationship edge"
                                className="text-zinc-500 hover:text-rose-400 p-1"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Graph Legend */}
            <div className="pt-3 border-t border-zinc-900 flex items-center justify-between text-[11px] text-zinc-500 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-zinc-400">Status:</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Understood</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Learning</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" /> Needs Revision</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-500" /> Not Reviewed</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-zinc-400">Relations:</span>
                <span className="text-amber-400">prerequisite</span>
                <span className="text-blue-400">related</span>
                <span className="text-purple-400">advanced</span>
                <span className="text-teal-400">alternative</span>
                <span className="text-rose-400">confused_with</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* DETAIL SLIDE-OVER DRAWER                                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {detailConcept && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div className="w-full max-w-2xl bg-zinc-950 border-l border-zinc-800 h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-zinc-800 space-y-3 bg-zinc-900/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                    {detailConcept.category}
                  </span>
                  {detailConcept.pageUrl && (
                    <a
                      href={detailConcept.pageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
                      title={detailConcept.pageTitle || detailConcept.pageUrl}
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span className="max-w-[180px] truncate">
                        {detailConcept.pageTitle || 'Source Webpage'}
                      </span>
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDeleteConcept(detailConcept.id)}
                    title="Delete concept from vault"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCloseDetail}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-zinc-100">
                  {detailConcept.title}
                </h2>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  "{detailConcept.selectedText}"
                </p>
              </div>

              {/* Status Segmented Controller */}
              <div className="flex items-center gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                <button
                  onClick={() => handleUpdateStatus(detailConcept.id, 'not_reviewed')}
                  className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                    normalizeUnderstandingStatus(detailConcept.understandingStatus) === 'not_reviewed'
                      ? 'bg-zinc-800 text-zinc-200 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Not Reviewed
                </button>
                <button
                  onClick={() => handleUpdateStatus(detailConcept.id, 'learning')}
                  className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                    normalizeUnderstandingStatus(detailConcept.understandingStatus) === 'learning'
                      ? 'bg-amber-950 text-amber-300 font-semibold border border-amber-800'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Learning
                </button>
                <button
                  onClick={() => handleUpdateStatus(detailConcept.id, 'understood')}
                  className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                    normalizeUnderstandingStatus(detailConcept.understandingStatus) === 'understood'
                      ? 'bg-emerald-950 text-emerald-300 font-semibold border border-emerald-800'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Understood
                </button>
                <button
                  onClick={() => handleUpdateStatus(detailConcept.id, 'needs_revision')}
                  className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                    normalizeUnderstandingStatus(detailConcept.understandingStatus) === 'needs_revision'
                      ? 'bg-rose-950 text-rose-300 font-semibold border border-rose-800'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Needs Revision
                </button>
              </div>

              {/* Drawer Tabs */}
              <div className="flex items-center gap-2 border-b border-zinc-850 pt-1 text-xs">
                <button
                  onClick={() => setDetailTab('explanation')}
                  className={`pb-2 px-1 font-medium transition-colors ${
                    detailTab === 'explanation'
                      ? 'text-brand-400 border-b-2 border-brand-400'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Explanation
                </button>
                <button
                  onClick={() => setDetailTab('code')}
                  className={`pb-2 px-1 font-medium transition-colors ${
                    detailTab === 'code'
                      ? 'text-brand-400 border-b-2 border-brand-400'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Code ({detailConcept.codeExamples?.length || 0})
                </button>
                <button
                  onClick={() => setDetailTab('connections')}
                  className={`pb-2 px-1 font-medium transition-colors ${
                    detailTab === 'connections'
                      ? 'text-brand-400 border-b-2 border-brand-400'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Connections & Next Steps
                </button>
                <button
                  onClick={() => setDetailTab('notes')}
                  className={`pb-2 px-1 font-medium transition-colors ${
                    detailTab === 'notes'
                      ? 'text-brand-400 border-b-2 border-brand-400'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Notes
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 curio-scrollbar">
              {detailTab === 'explanation' && (
                <div className="space-y-4">
                  <div className="prose prose-invert max-w-none text-sm text-zinc-300">
                    <MarkdownRenderer
                      markdown={
                        typeof detailConcept.explanation === 'string'
                          ? detailConcept.explanation
                          : detailConcept.explanation?.summary || JSON.stringify(detailConcept.explanation, null, 2)
                      }
                    />
                  </div>
                </div>
              )}

              {detailTab === 'code' && (
                <div className="space-y-3">
                  {(!detailConcept.codeExamples || detailConcept.codeExamples.length === 0) ? (
                    <div className="p-8 text-center text-zinc-500 text-xs">
                      No code examples attached to this explanation.
                    </div>
                  ) : (
                    detailConcept.codeExamples.map((block, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden"
                      >
                        <div className="px-3 py-1.5 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between text-xs">
                          <span className="font-mono text-zinc-400">
                            {block.language || 'code'}
                          </span>
                          <button
                            onClick={() => handleCopyCode(block.code, `code_${idx}`)}
                            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                          >
                            {copiedCodeId === `code_${idx}` ? (
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
                        <pre className="p-3.5 text-xs font-mono text-zinc-200 overflow-x-auto curio-scrollbar">
                          <code>{block.code}</code>
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              )}

              {detailTab === 'connections' && (
                <div className="space-y-4">
                  {/* Curated Recommendations */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                      Recommended Next Learning Steps
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {getCuratedRecommendations(detailConcept.selectedText || detailConcept.term || '').map((rec, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-zinc-200">{rec.action}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono border ${getRelationColor(rec.relation)}`}>
                                {rec.relation}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">{rec.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Connected Concept Relationships */}
                  <div className="space-y-2 pt-2 border-t border-zinc-850">
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <GitFork className="w-3.5 h-3.5 text-brand-400" />
                      Knowledge Graph Connections
                    </h4>
                    <div className="space-y-2">
                      {getRelatedConcepts(detailConcept.selectedText || detailConcept.term || '').map((rel, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-zinc-200">{rel.term}</span>
                            <span className="text-zinc-500 text-[11px] ml-2">({rel.label})</span>
                          </div>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono border ${getRelationColor(rel.relation)}`}>
                            {rel.relation}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'notes' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Personal Annotations:</span>
                    {notesSavedToast && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Saved
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={8}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Add your takeaways, edge cases, mental models..."
                    className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand-500"
                  />
                  <button
                    onClick={handleSaveNotes}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Notes
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: New Learning Goal ──────────────────────────────── */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateGoal}
            className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Target className="w-4 h-4 text-brand-400" />
                Create Learning Goal
              </h3>
              <button
                type="button"
                onClick={() => setShowGoalModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Goal Title</label>
              <input
                type="text"
                required
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                placeholder="e.g. Master Modern Python Concurrency"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Category</label>
              <select
                value={newGoalCategory}
                onChange={(e) => setNewGoalCategory(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand-500"
              >
                {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Target Milestone Concepts (comma-separated)</label>
              <input
                type="text"
                value={newGoalConcepts}
                onChange={(e) => setNewGoalConcepts(e.target.value)}
                placeholder="Iterables, Iterators, Generators, Lazy evaluation"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGoalModal(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-sm transition-colors"
              >
                Create Goal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Modal: Add Graph Edge ─────────────────────────────────── */}
      {showAddEdgeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddGraphEdge}
            className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Network className="w-4 h-4 text-brand-400" />
                Add Concept Relationship
              </h3>
              <button
                type="button"
                onClick={() => setShowAddEdgeModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {edgeError && (
              <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
                {edgeError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Source Concept</label>
              <input
                type="text"
                required
                value={newEdgeSource}
                onChange={(e) => setNewEdgeSource(e.target.value)}
                placeholder="e.g. Iterables"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Target Concept</label>
              <input
                type="text"
                required
                value={newEdgeTarget}
                onChange={(e) => setNewEdgeTarget(e.target.value)}
                placeholder="e.g. Iterators"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Relationship Type</label>
              <select
                value={newEdgeRelation}
                onChange={(e) => setNewEdgeRelation(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand-500"
              >
                <option value="prerequisite">prerequisite (Must learn before)</option>
                <option value="related">related (Used together / connected)</option>
                <option value="advanced">advanced (Deeper topic)</option>
                <option value="alternative">alternative (Alternative approach)</option>
                <option value="confused_with">confused_with (Frequently confused)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Description / Reason</label>
              <input
                type="text"
                value={newEdgeLabel}
                onChange={(e) => setNewEdgeLabel(e.target.value)}
                placeholder="e.g. Iterables produce iterators via __iter__"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddEdgeModal(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-sm transition-colors"
              >
                Save Relationship
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Modal: New Collection ─────────────────────────────────── */}
      {showNewCollectionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCollection}
            className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-brand-400" />
                Create Collection
              </h3>
              <button
                type="button"
                onClick={() => setShowNewCollectionModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Collection Name</label>
              <input
                type="text"
                required
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="e.g. Python Mastery"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Description (Optional)</label>
              <input
                type="text"
                value={newCollectionDesc}
                onChange={(e) => setNewCollectionDesc(e.target.value)}
                placeholder="e.g. Memory models, iterables, and generator internals"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Accent Color</label>
              <div className="flex items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setNewCollectionColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      newCollectionColor === c.hex
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-110'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewCollectionModal(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-sm transition-colors"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default LearningHub;
