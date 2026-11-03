import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Key,
  Keyboard,
  Sliders,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  ShieldAlert,
  Save,
  Activity,
  Cpu,
  BookOpen,
} from 'lucide-react';
import { DEFAULT_SETTINGS } from '../shared/types/index.js';
import { getStoredSettings, saveStoredSettings } from '../shared/utils/storage.js';
import { sendToBackground } from '../shared/utils/messaging.js';
import { LearningHub } from './LearningHub.jsx';

const MODEL_OPTIONS = {
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
};

export const App = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [diagMessage, setDiagMessage] = useState(null);
  const [activeTab, setActiveTab] = useState(
    window.location.hash === '#settings' ? 'settings' : 'learning'
  );

  useEffect(() => {
    loadSettings();

    const handleHash = () => {
      if (window.location.hash === '#settings') setActiveTab('settings');
      else if (window.location.hash === '#learning') setActiveTab('learning');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const stored = await getStoredSettings();
    setSettings(stored);
    setLoading(false);
  };

  const handleProviderChange = (provider) => {
    const defaultModel = MODEL_OPTIONS[provider][0];
    setSettings((prev) => ({
      ...prev,
      aiProvider: provider,
      model: defaultModel,
    }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    const success = await saveStoredSettings(settings);
    setSaving(false);

    if (success) {
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    }
  };

  const openShortcutsConfig = () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  };

  const testDiagnosticPing = async () => {
    setDiagMessage('Testing service worker communication...');
    const start = performance.now();
    const resp = await sendToBackground({
      type: 'PING',
      timestamp: Date.now(),
    });
    const duration = Math.round(performance.now() - start);

    if (resp.success) {
      setDiagMessage(`Service Worker OK (Latency: ${duration}ms, Version: ${resp.data?.version || '1.0.0'})`);
    } else {
      setDiagMessage(`Service Worker Error: ${resp.error}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm text-slate-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4 animate-spin text-teal-400" />
          Loading Curio Settings...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500/20">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-base text-slate-100">Curio</h1>
              <p className="text-xs text-slate-400">Personal Learning Assistant & In-Situ AI</p>
            </div>
          </div>

          {/* Main Tab Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setActiveTab('learning');
                window.location.hash = '#learning';
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'learning'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Learning Hub & Glossary</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('settings');
                window.location.hash = '#settings';
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'settings'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'settings' && (
              <>
                {saveToast && (
                  <span className="text-xs text-teal-400 flex items-center gap-1.5 bg-teal-950/80 border border-teal-800 px-3 py-1.5 rounded-lg animate-fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Settings Saved
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={saving}
                  className="py-2 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 active:bg-teal-700 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-2 shadow-sm transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Form */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {activeTab === 'learning' ? (
          <LearningHub />
        ) : (
          <div className="space-y-8">
        {/* Section 1: AI Provider & Credentials */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
            <Cpu className="w-5 h-5 text-teal-400" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100">AI Provider & Intelligence Model</h2>
              <p className="text-xs text-slate-400">Configure your LLM backend for contextual explanations</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Provider Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                AI Service Provider
              </label>
              <div className="grid grid-cols-4 gap-2">
                {['gemini', 'groq', 'openai', 'anthropic'].map((prov) => (
                  <button
                    key={prov}
                    type="button"
                    onClick={() => handleProviderChange(prov)}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-medium capitalize transition-all ${
                      settings.aiProvider === prov
                        ? 'border-teal-500 bg-teal-500/10 text-teal-300'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {prov === 'gemini' ? 'Gemini' : prov}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Active Model
              </label>
              <select
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              >
                {(MODEL_OPTIONS[settings.aiProvider] || []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-300">
                API Key for {settings.aiProvider.toUpperCase()}
              </label>
              <span className="text-[11px] text-slate-500">Stored in local storage only</span>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Key className="w-4 h-4" />
              </div>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                placeholder={`Enter your ${settings.aiProvider} API key...`}
                className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-start gap-2 bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-[11px] text-slate-400">
              <ShieldAlert className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <span>
                <strong>Zero Leakage Guarantee:</strong> Curio stores API credentials exclusively in your browser’s private <code className="text-teal-400 font-mono">chrome.storage.local</code>. Keys are never transmitted to external analytics, proxies, or intermediate sync servers.
              </span>
            </div>
          </div>

          {/* Explanation Style */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Default Explanation Depth
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'concise', label: 'Concise', desc: 'Direct, focused summaries' },
                { id: 'detailed', label: 'Detailed', desc: 'In-depth with examples' },
                { id: 'simple', label: 'ELI5 (Simple)', desc: 'Simplified terminology' },
              ].map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setSettings({ ...settings, explanationStyle: style.id })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    settings.explanationStyle === style.id
                      ? 'border-teal-500 bg-teal-500/10'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`text-xs font-medium ${
                      settings.explanationStyle === style.id ? 'text-teal-300' : 'text-slate-300'
                    }`}
                  >
                    {style.label}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{style.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Section 2: Keyboard Shortcut & Invocation */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
            <Keyboard className="w-5 h-5 text-teal-400" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Keyboard Shortcut & Triggering</h2>
              <p className="text-xs text-slate-400">Configure global activation hotkeys</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-950 border border-slate-800 rounded-lg">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-200">Global Trigger Shortcut</div>
              <p className="text-[11px] text-slate-400">
                In Manifest V3, global shortcuts are managed at the Chromium browser level to prevent website collision.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <kbd className="px-3 py-1.5 text-xs font-mono font-semibold bg-slate-900 text-teal-400 rounded-md border border-slate-700 shadow-inner">
                {settings.shortcut || 'Alt+Shift+E'}
              </kbd>

              <button
                type="button"
                onClick={openShortcutsConfig}
                className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                <span>Rebind in Chrome</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>
        </section>

        {/* Section 3: Context Extraction Preferences */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
            <Sliders className="w-5 h-5 text-teal-400" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Context Extraction Parameters</h2>
              <p className="text-xs text-slate-400">Fine-tune surrounding text extraction</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Surrounding Text Window Size</span>
                <span className="text-teal-400 font-mono">{settings.contextWindowSize} chars</span>
              </div>
              <input
                type="range"
                min="100"
                max="1000"
                step="50"
                value={settings.contextWindowSize}
                onChange={(e) =>
                  setSettings({ ...settings, contextWindowSize: Number(e.target.value) })
                }
                className="w-full accent-teal-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Controls how much preceding and following paragraph text is provided to the LLM to disambiguate pronouns, variables, and context.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-200">Show Floating Action Button</div>
                <div className="text-[11px] text-slate-400">Display mini Curio indicator when text is highlighted</div>
              </div>
              <input
                type="checkbox"
                checked={settings.showFloatingButton}
                onChange={(e) => setSettings({ ...settings, showFloatingButton: e.target.checked })}
                className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </section>

        {/* Section 4: System Diagnostics */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-400" />
              <h2 className="text-xs font-semibold text-slate-200">System Diagnostics & Health</h2>
            </div>
            <button
              type="button"
              onClick={testDiagnosticPing}
              className="py-1 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium transition-colors border border-slate-700"
            >
              Test Service Worker
            </button>
          </div>

          {diagMessage && (
            <div className="text-xs font-mono p-2.5 rounded bg-slate-950 border border-slate-800 text-teal-300">
              {diagMessage}
            </div>
          )}
        </section>
      </div>
    )}
  </main>
</div>
  );
};

