import { useAuth } from '@/contexts/AuthContext';
import { ShoppingBag, TrendingUp, LogOut, User } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: 'records' | 'market';
  onNavigate: (page: 'records' | 'market') => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛒</span>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">格價助手</h1>
              <p className="text-xs text-gray-400 leading-tight">Price Tracker</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? 'User'}
                className="w-8 h-8 rounded-full border border-gray-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <User className="w-4 h-4 text-indigo-600" />
              </div>
            )}
            <span className="text-sm text-gray-600 hidden sm:block">
              {user?.displayName ?? user?.email ?? 'User'}
            </span>
            <button
              onClick={signOut}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
              title="Sign out"
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
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30">
        <div className="max-w-5xl mx-auto flex">
          <button
            onClick={() => onNavigate('records')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              currentPage === 'records'
                ? 'text-indigo-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-xs font-medium">Records</span>
          </button>
          <button
            onClick={() => onNavigate('market')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              currentPage === 'market'
                ? 'text-indigo-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs font-medium">Market</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
