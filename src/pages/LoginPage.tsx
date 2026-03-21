import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { languageNames, type Language } from '@/i18n';
import { LogIn, Loader2, AlertCircle, Globe, Moon, Sun } from 'lucide-react';

export default function LoginPage() {
  const { signInWithGoogle, error } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      // Error is handled and stored in AuthContext; reset button state
      setIsSigningIn(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      isDark
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'
        : 'bg-gradient-to-br from-indigo-50 via-white to-purple-50'
    }`}>
      {/* Top-right settings */}
      <div className="fixed top-4 right-4 flex items-center gap-2 z-10">
        <div className="flex items-center gap-1">
          <Globe className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className={`text-sm rounded-lg border px-2 py-1 outline-none ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white/80 border-gray-200 text-gray-700'
            }`}
          >
            {(Object.entries(languageNames) as [Language, string][]).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-lg transition-colors ${
            isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
          }`}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 ${isDark ? 'bg-indigo-900/50' : 'bg-indigo-100'}`}>
            <span className="text-4xl">🏠</span>
          </div>
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('appName')}</h1>
          <h2 className={`text-xl mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{t('appSubtitle')}</h2>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('appTagline')}
          </p>
        </div>

        <div className={`rounded-2xl shadow-lg p-8 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <h3 className={`text-lg font-semibold text-center mb-6 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
            {t('signInTitle')}
          </h3>

          {error && (
            <div className={`flex items-start gap-2 mb-4 p-3 rounded-xl text-sm ${isDark ? 'bg-red-900/30 border border-red-800 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-xl transition-colors duration-200 shadow-sm hover:shadow-md"
          >
            {isSigningIn ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <LogIn className="w-5 h-5" />
            )}
            {isSigningIn ? t('signingIn') : t('signIn')}
          </button>

          <div className="mt-6 space-y-3">
            <div className={`flex items-center gap-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="flex-shrink-0">📝</span>
              <span>{t('featureRecord')}</span>
            </div>
            <div className={`flex items-center gap-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="flex-shrink-0">📸</span>
              <span>{t('featureScan')}</span>
            </div>
            <div className={`flex items-center gap-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="flex-shrink-0">📊</span>
              <span>{t('featureMarket')}</span>
            </div>
            <div className={`flex items-center gap-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="flex-shrink-0">🔍</span>
              <span>{t('featureSearch')}</span>
            </div>
          </div>
        </div>

        <p className={`text-center text-xs mt-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {t('dataSecure')}
        </p>
      </div>
    </div>
  );
}
