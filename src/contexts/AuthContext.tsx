import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '@/lib/firebase';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

// Exported for use in useAuth hook
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapUser(firebaseUser: FirebaseUser): User {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
  };
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    switch (code) {
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized for sign-in. Please contact the developer.';
      case 'auth/redirect-cancelled-by-user':
        return 'Sign-in was cancelled. Please try again.';
      case 'auth/redirect-operation-pending':
        return 'A sign-in is already in progress. Please wait.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      default:
        return 'Failed to sign in with Google. Please try again.';
    }
  }
  return 'Failed to sign in with Google. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    // Handle the result when the user returns from the Google sign-in redirect
    getRedirectResult(auth).catch((redirectError) => {
      console.error('Redirect sign-in error:', redirectError);
      setError(getErrorMessage(redirectError));
    });

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (firebaseUser) {
          setUser(mapUser(firebaseUser));
        } else {
          setUser(null);
        }
        setLoading(false);
      },
      (authError) => {
        console.error('Auth state change error:', authError);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      setError(null);
      await signInWithRedirect(auth, googleProvider);
    } catch (signInError) {
      console.error('Sign in error:', signInError);
      const message = getErrorMessage(signInError);
      setError(message);
      throw signInError;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (signOutError) {
      console.error('Sign out error:', signOutError);
      throw signOutError;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
