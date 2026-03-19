import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { signInWithGoogle, error } = useAuth();
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-2xl mb-6">
            <span className="text-4xl">🛒</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">格價助手</h1>
          <h2 className="text-xl text-gray-600 mb-1">Price Tracker</h2>
          <p className="text-gray-500 text-sm">
            Record purchases · Compare prices · Save money
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 text-center mb-6">
            Sign in to get started
          </h3>

          {error && (
            <div className="flex items-start gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
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
            {isSigningIn ? 'Signing in…' : 'Sign in with Google'}
          </button>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="flex-shrink-0">📝</span>
              <span>Record item prices from any store</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="flex-shrink-0">📸</span>
              <span>Scan receipts with your camera</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="flex-shrink-0">📊</span>
              <span>Browse today&apos;s HK market prices</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="flex-shrink-0">🔍</span>
              <span>Search & compare your purchase history</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Your data is securely stored and only accessible to you.
        </p>
      </div>
    </div>
  );
}
