import { createContext, useContext, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

const TESTING_MODE_EMAIL = 'lamkikit123@gmail.com';
const STORAGE_KEY = 'kk-helper-testing-mode';

interface TestingModeContextType {
  isTestingMode: boolean;
  canEnableTestingMode: boolean;
  toggleTestingMode: () => void;
}

const TestingModeContext = createContext<TestingModeContextType | undefined>(undefined);

export function TestingModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const canEnableTestingMode = user?.email === TESTING_MODE_EMAIL;

  const [isTestingMode, setIsTestingMode] = useState(() => {
    if (!canEnableTestingMode) return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  const toggleTestingMode = () => {
    if (!canEnableTestingMode) return;
    setIsTestingMode((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <TestingModeContext.Provider value={{ isTestingMode: canEnableTestingMode && isTestingMode, canEnableTestingMode, toggleTestingMode }}>
      {children}
    </TestingModeContext.Provider>
  );
}

export function useTestingMode(): TestingModeContextType {
  const context = useContext(TestingModeContext);
  if (context === undefined) {
    throw new Error('useTestingMode must be used within a TestingModeProvider');
  }
  return context;
}
