import React, { useEffect, useState } from 'react';
import {
  Sliders,
  BookOpen,
} from 'lucide-react';
import { LearningHub } from './LearningHub.jsx';
import { SettingsView } from './SettingsView.jsx';

export const App = () => {
  const [activeTab, setActiveTab] = useState(
    typeof window !== 'undefined' && window.location.hash === '#settings' ? 'settings' : 'learning'
  );

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#settings') setActiveTab('settings');
      else if (window.location.hash === '#learning') setActiveTab('learning');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500/20">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shadow-sm p-1 overflow-hidden">
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
                if (typeof window !== 'undefined') window.location.hash = '#learning';
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'learning'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Knowledge Vault</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('settings');
                if (typeof window !== 'undefined') window.location.hash = '#settings';
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
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {activeTab === 'learning' ? (
          <LearningHub />
        ) : (
          <SettingsView />
        )}
      </main>
    </div>
  );
};
