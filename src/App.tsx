import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LoginPage from '@/pages/LoginPage';
import RecordsPage from '@/pages/RecordsPage';
import MarketPricePage from '@/pages/MarketPricePage';
import UnitPriceCalculatorPage from '@/pages/UnitPriceCalculatorPage';
import ProfilePage from '@/pages/ProfilePage';
import BloodPressurePage from '@/pages/BloodPressurePage';
import Layout from '@/components/Layout';

export default function App() {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [currentPage, setCurrentPage] = useState<'records' | 'market' | 'calculator' | 'bloodPressure' | 'profile'>('records');

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
          <p className={`mt-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('loading')}</p>
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
      {currentPage === 'calculator' && <UnitPriceCalculatorPage />}
      {currentPage === 'bloodPressure' && <BloodPressurePage />}
      {currentPage === 'profile' && <ProfilePage />}
    </Layout>
  );
}
