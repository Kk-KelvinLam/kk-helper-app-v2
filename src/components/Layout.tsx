import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { languageNames, type Language } from '@/i18n';
import { ShoppingBag, TrendingUp, Calculator, LogOut, User, Moon, Sun, Globe, Settings, X } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: 'records' | 'market' | 'calculator';
  onNavigate: (page: 'records' | 'market' | 'calculator') => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Top Navigation */}
      <header className={`border-b sticky top-0 z-30 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛒</span>
            <div>
              <h1 className={`text-lg font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>格價助手</h1>
              <p className={`text-xs leading-tight ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>Price Tracker</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}
              title={t('settings')}
            >
              <Settings className="w-5 h-5" />
            </button>

            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? 'User'}
                className={`w-8 h-8 rounded-full border ${isDark ? 'border-gray-600' : 'border-gray-200'}`}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-indigo-900' : 'bg-indigo-100'}`}>
                <User className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
              </div>
            )}
            <span className={`text-sm hidden sm:block ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              {user?.displayName ?? user?.email ?? 'User'}
            </span>
            <button
              onClick={signOut}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}
              title={t('signOut')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className={`fixed bottom-0 left-0 right-0 border-t z-30 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <div className="max-w-5xl mx-auto flex">
          <button
            onClick={() => onNavigate('records')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              currentPage === 'records'
                ? 'text-indigo-600 dark:text-indigo-400'
                : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-xs font-medium">{t('navRecords')}</span>
          </button>
          <button
            onClick={() => onNavigate('market')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              currentPage === 'market'
                ? 'text-indigo-600 dark:text-indigo-400'
                : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs font-medium">{t('navMarket')}</span>
          </button>
          <button
            onClick={() => onNavigate('calculator')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              currentPage === 'calculator'
                ? 'text-indigo-600 dark:text-indigo-400'
                : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Calculator className="w-5 h-5" />
            <span className="text-xs font-medium">{t('navCalculator')}</span>
          </button>
        </div>
      </nav>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl max-w-sm w-full p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('settings')}
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Language Setting */}
              <div className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  <Globe className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    {t('language')}
                  </span>
                </div>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className={`text-sm rounded-lg border px-3 py-1.5 outline-none ${
                    isDark
                      ? 'bg-gray-600 border-gray-500 text-white'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  {(Object.entries(languageNames) as [Language, string][]).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dark Mode Setting */}
              <div className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  {isDark ? (
                    <Moon className="w-5 h-5 text-indigo-400" />
                  ) : (
                    <Sun className="w-5 h-5 text-amber-500" />
                  )}
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    {t('darkMode')}
                  </span>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isDark ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isDark ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
