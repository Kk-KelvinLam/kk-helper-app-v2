import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/pages/LoginPage';
import RecordsPage from '@/pages/RecordsPage';
import MarketPricePage from '@/pages/MarketPricePage';
import Layout from '@/components/Layout';

export default function App() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<'records' | 'market'>('records');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {currentPage === 'records' && <RecordsPage />}
      {currentPage === 'market' && <MarketPricePage />}
    </Layout>
  );
}
