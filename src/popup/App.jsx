import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Settings,
  Keyboard,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Power,
  RefreshCw,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import { DEFAULT_SETTINGS } from '../shared/types/index.js';
import { getStoredSettings, saveStoredSettings } from '../shared/utils/storage.js';
import { sendToBackground } from '../shared/utils/messaging.js';
import { getLearningStats } from '../shared/services/learningService.js';

export const App = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [status, setStatus] = useState(null);
  const [learningStats, setLearningStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    setLoading(true);
    const [loadedSettings, statsData] = await Promise.all([
      getStoredSettings(),
      getLearningStats(),
    ]);
    setSettings(loadedSettings);
    setLearningStats(statsData);

    const statusResp = await sendToBackground({ type: 'GET_STATUS' });
    if (statusResp.success && statusResp.data) {
      setStatus(statusResp.data);
    }
    setLoading(false);
  };

  const handleToggleEnable = async () => {
    const updated = { ...settings, enabled: !settings.enabled };
    setSettings(updated);
    await saveStoredSettings({ enabled: updated.enabled });
  };

  const handleTriggerExplanation = async () => {
    setTriggering(true);
    setFeedback(null);

    const resp = await sendToBackground({ type: 'TRIGGER_SELECTION_FLOW' });
    if (resp.success) {
      setFeedback('Triggered context capture on active tab!');
    } else {
      setFeedback(resp.error || 'Failed to communicate with active tab');
    }

    setTriggering(false);
    setTimeout(() => setFeedback(null), 3000);
  };

  const openOptionsPage = (hash = '#settings') => {
    chrome.tabs.create({ url: chrome.runtime.getURL(`options.html${hash}`) });
  };

  const openShortcutsConfig = () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  };

  return (
    <div className="w-[360px] bg-slate-900 text-slate-100 font-sans p-4 shadow-xl select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center p-1 text-teal-400 overflow-hidden">
            <img
              src={typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('icons/icon-48.png') : '/icons/icon-48.png'}
              alt="Curio logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div>
            <h1 className="font-semibold text-sm leading-tight text-slate-100">Curio</h1>
            <p className="text-[11px] text-slate-400 leading-tight">In-Situ AI Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleEnable}
            title={settings.enabled ? 'Extension is Active' : 'Extension is Paused'}
            className={`p-1.5 rounded-md transition-colors ${
              settings.enabled
                ? 'text-teal-400 hover:bg-teal-500/10'
                : 'text-slate-500 hover:bg-slate-800'
            }`}
          >
            <Power className="w-4 h-4" />
          </button>

          <button
            onClick={openOptionsPage}
            title="Open Settings"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-4 space-y-3">
        {/* Status Card */}
        <div className="bg-slate-800/60 border border-slate-800 rounded-lg p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Content Script Status</span>
            {loading ? (
              <span className="text-slate-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Checking...
              </span>
            ) : status?.contentScriptInjected ? (
              <span className="text-teal-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready on Tab
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" /> Tab Not Connected
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-400 truncate">
            {status?.tabUrl ? (
              <span title={status.tabUrl}>Tab: {status.tabUrl.replace(/^https?:\/\//, '')}</span>
            ) : (
              'No active web page'
            )}
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={handleTriggerExplanation}
          disabled={triggering || !settings.enabled}
          className="w-full py-2.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-500 active:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs text-white shadow-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {triggering ? 'Capturing Context...' : 'Explain Current Selection'}
        </button>

        {feedback && (
          <div className="text-[11px] text-center text-teal-300 bg-teal-950/60 border border-teal-900 rounded p-1.5 animate-fade-in">
            {feedback}
          </div>
        )}

        {/* Personal Learning Intelligence Card */}
        <div className="bg-gradient-to-r from-teal-950/60 to-slate-900 border border-teal-900/60 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-teal-300 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Learning Hub
            </span>
            <span className="text-[11px] font-mono text-teal-400">
              {learningStats?.masteryPercentage || 0}% Mastery
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{learningStats?.totalConcepts || 0} explored</span>
            <span>•</span>
            <span className="text-emerald-400">{learningStats?.understoodCount || 0} understood</span>
            <span>•</span>
            <span className="text-purple-400">{learningStats?.savedCount || 0} saved</span>
          </div>

          <button
            onClick={() => openOptionsPage('#learning')}
            className="w-full mt-1 py-1.5 px-2 rounded-md bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
          >
            <span>Open Personal Glossary & History</span>
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </button>
        </div>

        {/* Shortcut Banner */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Keyboard className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-slate-300 font-medium">Shortcut</div>
              <div className="text-[10px] text-slate-500">Configured in Chrome</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 text-[11px] font-mono bg-slate-950 text-teal-400 rounded border border-slate-700 shadow-inner">
              {settings.shortcut || 'Alt+Shift+E'}
            </kbd>
            <button
              onClick={openShortcutsConfig}
              title="Customize Shortcut in Chrome Settings"
              className="p-1 text-slate-400 hover:text-teal-400 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
        <span>v{status?.version || '1.0.0'} (MV3 - JS)</span>
        <button
          onClick={openOptionsPage}
          className="text-teal-400 hover:text-teal-300 transition-colors"
        >
          Configure AI & Settings →
        </button>
      </div>
    </div>
  );
};

