/**
 * Curio — Centralized Settings & Personalization Interface (React)
 *
 * Provides a clean, category-organized settings interface:
 *  1. General Settings (Theme, Language, Default Level, Window Behavior, Animations)
 *  2. AI & Models (Gemini vs Groq, Allowed Models, Response Detail, Cancellation Behavior)
 *  3. Keyboard Shortcuts (Current Shortcut, Chrome Rebinding link)
 *  4. Privacy & Data (Save History, Retention, Clear Convos/Vault, Full Export & Delete)
 *  5. Appearance (Dark/Light/System, Compact Mode, Overlay Width & Font Scale)
 *
 * @module options/SettingsView
 */

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Cpu,
  Keyboard,
  ShieldCheck,
  Palette,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Download,
  Trash2,
  RefreshCw,
  RotateCcw,
  Save,
  Moon,
  Sun,
  Monitor,
  Zap,
  Clock,
  Layers,
  Database,
  Info,
  Check,
} from 'lucide-react';

import {
  getSettings,
  updateSettings,
  resetSettings,
  exportAllPersonalData,
  clearAllPersonalData,
  clearConversationHistory,
  clearSavedExplanations,
  ALLOWED_MODELS,
} from '../shared/services/settingsService.js';

import { DEFAULT_SETTINGS } from '../shared/types/index.js';

const SETTINGS_CATEGORIES = [
  { id: 'general', label: 'General', icon: Sliders },
  { id: 'ai', label: 'AI & Models', icon: Cpu },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'privacy', label: 'Privacy & Data', icon: ShieldCheck },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

const LANGUAGES = [
  { code: 'en', name: 'English (US)' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'hi', name: 'हिन्दी' },
];

export const SettingsView = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeCategory, setActiveCategory] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = async () => {
    setLoading(true);
    const data = await getSettings();
    setSettings(data);
    setLoading(false);
  };

  const handleFieldChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleProviderChange = (provider) => {
    const models = ALLOWED_MODELS[provider] || ALLOWED_MODELS.gemini;
    setSettings((prev) => ({
      ...prev,
      aiProvider: provider,
      model: models[0],
    }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    const updated = await updateSettings(settings);
    setSettings(updated);
    setSaving(false);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  const handleResetDefaults = async () => {
    const defaults = await resetSettings();
    setSettings(defaults);
    setStatusMessage('Settings reset to factory defaults.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleExportData = async () => {
    const jsonStr = await exportAllPersonalData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `curio-personal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusMessage('Personal data backup downloaded.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleClearConvos = async () => {
    await clearConversationHistory();
    setStatusMessage('Conversation memory cleared.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleClearVault = async () => {
    await clearSavedExplanations();
    setStatusMessage('Saved explanations and collections cleared.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleDeleteAll = async () => {
    await clearAllPersonalData();
    setShowDeleteConfirm(false);
    await loadSettingsData();
    setStatusMessage('All personal data wiped and settings reset.');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const openChromeShortcuts = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    } else {
      alert('Open chrome://extensions/shortcuts in your browser address bar to customize extension shortcuts.');
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-zinc-400 text-xs flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-brand-400" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header & Top Actions ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-800">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-brand-400" />
            Settings & Personalization
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configure AI models, explanation depth, keyboard hotkeys, and privacy boundaries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveToast && (
            <span className="px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-medium flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Settings Saved
            </span>
          )}
          <button
            onClick={handleResetDefaults}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            type="button"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-sm transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-brand-950/60 border border-brand-800/80 text-brand-300 text-xs flex items-center justify-between animate-in fade-in">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-zinc-400 hover:text-zinc-200">
            &times;
          </button>
        </div>
      )}

      {/* ─── Two-Column Layout: Sidebar Categories + Content ────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Category Navigation Pills */}
        <div className="space-y-1">
          {SETTINGS_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                  isActive
                    ? 'bg-zinc-850 text-brand-300 border border-zinc-700 shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-zinc-500'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Category Form Panel */}
        <div className="md:col-span-3 space-y-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
          {/* ═══════════════════════════════════════════════════════════ */}
          {/* CATEGORY 1: GENERAL SETTINGS                                */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeCategory === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">General Interface Settings</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Customize global language and overlay mechanics.</p>
              </div>

              {/* Theme Selector */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300">Interface Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'dark', label: 'Dark', icon: Moon },
                    { id: 'light', label: 'Light', icon: Sun },
                    { id: 'system', label: 'System', icon: Monitor },
                  ].map((t) => {
                    const Icon = t.icon;
                    const isSel = settings.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleFieldChange('theme', t.id)}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all ${
                          isSel
                            ? 'bg-brand-950/80 border-brand-500 text-brand-300 shadow-sm'
                            : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interface Language */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300">Interface Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => handleFieldChange('language', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-brand-500"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Default Explanation Level */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300">Default Explanation Depth</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'beginner', label: 'Beginner', desc: 'Intuitive ELI5 metaphors' },
                    { id: 'intermediate', label: 'Intermediate', desc: 'Practical mechanics & code' },
                    { id: 'advanced', label: 'Advanced', desc: 'Internal runtime & edge cases' },
                  ].map((lvl) => {
                    const isSel = settings.defaultLevel === lvl.id;
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => handleFieldChange('defaultLevel', lvl.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSel
                            ? 'bg-brand-950/80 border-brand-500 text-brand-300 shadow-sm'
                            : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="text-xs font-semibold">{lvl.label}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{lvl.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Window Behavior */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300">Default Explanation Window Behavior</label>
                <select
                  value={settings.windowBehavior}
                  onChange={(e) => handleFieldChange('windowBehavior', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="near_selection">Float Near Selection (Adaptive Viewport Clamping)</option>
                  <option value="remember_last">Remember Last Dragged Position</option>
                  <option value="top_right">Anchor Fixed Top-Right of Viewport</option>
                  <option value="center">Centered Viewport Modal</option>
                </select>
              </div>

              {/* Animation Preferences */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300">Animation Preference</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'full', label: 'Full Animations', desc: 'Fluid transitions' },
                    { id: 'reduced', label: 'Reduced Motion', desc: 'Minimal motion' },
                    { id: 'disabled', label: 'Disabled', desc: 'Zero animations' },
                  ].map((anim) => {
                    const isSel = settings.animationPreference === anim.id;
                    return (
                      <button
                        key={anim.id}
                        type="button"
                        onClick={() => handleFieldChange('animationPreference', anim.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSel
                            ? 'bg-brand-950/80 border-brand-500 text-brand-300 shadow-sm'
                            : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="text-xs font-medium">{anim.label}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{anim.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* CATEGORY 2: AI & INTELLIGENCE MODELS                        */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeCategory === 'ai' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">AI Provider & Model Configuration</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select your inference backend. API keys are safely configured on your server environment and never exposed in the browser.
                </p>
              </div>

              {/* Zero API Key Exposure Banner */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-zinc-100">Zero Credential Exposure Guarantee:</span>
                  <p className="text-zinc-400 text-[11px] mt-0.5">
                    Curio connects to your local Express AI backend. Provider API keys reside exclusively in your backend <code className="text-brand-300 font-mono">.env</code> file and are never sent to or stored within the browser extension.
                  </p>
                </div>
              </div>

              {/* Provider Selection */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300">Default AI Provider</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'gemini', name: 'Google Gemini', desc: 'Direct streaming & multimodal reasoning' },
                    { id: 'groq', name: 'Groq Cloud', desc: 'Ultra-low latency Llama-3.3 inference' },
                  ].map((prov) => {
                    const isSel = settings.aiProvider === prov.id;
                    return (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => handleProviderChange(prov.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          isSel
                            ? 'bg-brand-950/80 border-brand-500 text-brand-300 shadow-sm'
                            : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-100">{prov.name}</span>
                          {isSel && <Check className="w-3.5 h-3.5 text-brand-400" />}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-1">{prov.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Model Selection (Allowed Models Only) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">Allowed Inference Model</label>
                  <span className="text-[10px] text-zinc-500">Validated against server configuration</span>
                </div>
                <select
                  value={settings.model}
                  onChange={(e) => handleFieldChange('model', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-brand-500 font-mono"
                >
                  {(ALLOWED_MODELS[settings.aiProvider] || []).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Response Detail Preference */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300">Response Detail Preference</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'concise', label: 'Concise', desc: 'High-signal summaries' },
                    { id: 'standard', label: 'Standard', desc: 'Balanced mechanics & code' },
                    { id: 'comprehensive', label: 'Comprehensive', desc: 'In-depth architecture & edge cases' },
                  ].map((item) => {
                    const isSel = settings.responseDetail === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleFieldChange('responseDetail', item.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSel
                            ? 'bg-brand-950/80 border-brand-500 text-brand-300 shadow-sm'
                            : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="text-xs font-medium">{item.label}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{item.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generation Cancellation Behavior */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300">Generation Cancellation Behavior</label>
                <select
                  value={settings.cancellationBehavior}
                  onChange={(e) => handleFieldChange('cancellationBehavior', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="keep_partial">Keep Partial Output (Preserve generated text when cancelled)</option>
                  <option value="discard_cancelled">Discard Output (Clear streaming card when cancelled)</option>
                </select>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* CATEGORY 3: KEYBOARD SHORTCUTS                              */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeCategory === 'shortcuts' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">Global Keyboard Shortcuts</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Inspect and customize global hotkeys registered with Chrome.
                </p>
              </div>

              {/* Current Shortcut Display */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">Global Explain Shortcut</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Invokes Curio explanation over highlighted text in any active tab.
                    </div>
                  </div>

                  <kbd className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-brand-300 font-mono text-xs font-semibold shadow-inner">
                    {settings.shortcut || 'Alt+Shift+E'}
                  </kbd>
                </div>

                <div className="pt-3 border-t border-zinc-900 text-[11px] text-zinc-400 space-y-2">
                  <p>
                    <strong>Manifest V3 Hotkey Standard:</strong> Chrome security prohibits extensions from injecting custom global shortcut listeners that override website hotkeys. Shortcuts are managed directly by Chromium.
                  </p>
                  <p>
                    To rebind or change this shortcut (e.g. to <code className="text-zinc-300 font-mono">Option+E</code> or <code className="text-zinc-300 font-mono">Cmd+Shift+E</code>), open Chrome's Extension Shortcuts Manager.
                  </p>
                </div>

                <button
                  onClick={openChromeShortcuts}
                  type="button"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-200 transition-colors"
                >
                  <span>Open Chrome Shortcuts Settings</span>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* CATEGORY 4: PRIVACY & DATA RETENTION                        */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeCategory === 'privacy' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">Privacy, History & Data Sovereignty</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Control what data is stored locally and perform full export or erasure.
                </p>
              </div>

              {/* History Toggle */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-zinc-200">Save Exploration History</div>
                  <div className="text-[11px] text-zinc-400">
                    When enabled, explored concepts are saved locally in your personal learning glossary.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.saveHistory}
                  onChange={(e) => handleFieldChange('saveHistory', e.target.checked)}
                  className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                />
              </div>

              {/* Auto-save Bookmarks */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-zinc-200">Auto-Save Explanations to Vault</div>
                  <div className="text-[11px] text-zinc-400">
                    Automatically persist explanations to the Knowledge Vault without requiring manual bookmark click.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoSaveBookmarks}
                  onChange={(e) => handleFieldChange('autoSaveBookmarks', e.target.checked)}
                  className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                />
              </div>

              {/* Local Retention Window */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300">Local Knowledge Retention Window</label>
                <select
                  value={settings.localRetentionDays}
                  onChange={(e) => handleFieldChange('localRetentionDays', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-brand-500"
                >
                  <option value={0}>Indefinite (Keep until explicitly deleted)</option>
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                  <option value={365}>1 Year</option>
                </select>
              </div>

              {/* Data Actions (Clear & Export) */}
              <div className="space-y-3 pt-3 border-t border-zinc-850">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Data Management & Erasure
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={handleExportData}
                    type="button"
                    className="flex items-center gap-2 p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-left transition-all"
                  >
                    <Download className="w-4 h-4 text-brand-400 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-zinc-200">Export All Data</div>
                      <div className="text-[10px] text-zinc-400">Download formatted JSON backup</div>
                    </div>
                  </button>

                  <button
                    onClick={handleClearConvos}
                    type="button"
                    className="flex items-center gap-2 p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-left transition-all"
                  >
                    <RefreshCw className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-zinc-200">Clear Conversation Memory</div>
                      <div className="text-[10px] text-zinc-400">Reset active follow-up threads</div>
                    </div>
                  </button>

                  <button
                    onClick={handleClearVault}
                    type="button"
                    className="flex items-center gap-2 p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-left transition-all"
                  >
                    <Database className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-zinc-200">Clear Saved Vault</div>
                      <div className="text-[10px] text-zinc-400">Erase vault concepts & collections</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    type="button"
                    className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 hover:border-rose-700 text-left transition-all"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-rose-300">Wipe All Personal Data</div>
                      <div className="text-[10px] text-rose-400/80">Complete permanent erasure</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* CATEGORY 5: APPEARANCE & UI DENSITY                         */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeCategory === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">Appearance & Typography Density</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Tune font scale, padding density, and card geometry.
                </p>
              </div>

              {/* Compact Mode Toggle */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-zinc-200">Compact Interface Mode</div>
                  <div className="text-[11px] text-zinc-400">
                    Reduces padding and spacing across overlay and dashboard for higher information density.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.compactMode}
                  onChange={(e) => handleFieldChange('compactMode', e.target.checked)}
                  className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                />
              </div>

              {/* Overlay Width */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300">Floating Overlay Width</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'compact', label: 'Compact (380px)', desc: 'Minimal screen obstruction' },
                    { id: 'standard', label: 'Standard (450px)', desc: 'Balanced readability' },
                    { id: 'wide', label: 'Wide (540px)', desc: 'Optimal for code snippets' },
                  ].map((w) => {
                    const isSel = settings.overlayWidth === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => handleFieldChange('overlayWidth', w.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSel
                            ? 'bg-brand-950/80 border-brand-500 text-brand-300 shadow-sm'
                            : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="text-xs font-medium">{w.label}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{w.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Size Scaling */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300">Typography Base Size</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'small', label: 'Small (12px)', desc: 'High density' },
                    { id: 'medium', label: 'Medium (14px)', desc: 'Standard readable' },
                    { id: 'large', label: 'Large (16px)', desc: 'Enhanced clarity' },
                  ].map((fs) => {
                    const isSel = settings.fontSize === fs.id;
                    return (
                      <button
                        key={fs.id}
                        type="button"
                        onClick={() => handleFieldChange('fontSize', fs.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSel
                            ? 'bg-brand-950/80 border-brand-500 text-brand-300 shadow-sm'
                            : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="text-xs font-medium">{fs.label}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{fs.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Delete Confirmation Modal ─────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-zinc-950 border border-rose-900/80 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold text-zinc-100">Permanent Data Erasure</h3>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              This action will permanently delete all saved concepts, collections, personal notes, learning goals, and relationship graph edges from your browser. This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAll}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-colors"
              >
                Yes, Wipe All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
