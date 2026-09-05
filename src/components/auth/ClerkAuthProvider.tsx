import React, { createContext, useContext, useState } from 'react';
import { ClerkProvider, useUser } from '@clerk/clerk-react';
import { lifeOpsClerkAppearance } from './clerkTheme';

interface AuthContextType {
  isClerkConfigured: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'signIn' | 'signUp';
  openSignIn: () => void;
  openSignUp: () => void;
  closeAuthModal: () => void;
}

interface ActiveUserContextType {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: any;
  userId: string;
}

const AuthContext = createContext<AuthContextType>({
  isClerkConfigured: false,
  isAuthModalOpen: false,
  authModalMode: 'signIn',
  openSignIn: () => {},
  openSignUp: () => {},
  closeAuthModal: () => {},
});

const ActiveUserContext = createContext<ActiveUserContextType>({
  isLoaded: true,
  isSignedIn: false,
  user: null,
  userId: 'default_user',
});

export const useAuthModal = () => useContext(AuthContext);
export const useActiveUser = () => useContext(ActiveUserContext);

interface ClerkAuthProviderProps {
  children: React.ReactNode;
}

const ClerkUserSync: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded, isSignedIn, user } = useUser();
  const value: ActiveUserContextType = {
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    user,
    userId: isSignedIn && user?.id ? user.id : 'default_user',
  };
  return (
    <ActiveUserContext.Provider value={value}>
      {children}
    </ActiveUserContext.Provider>
  );
};

export const ClerkAuthProvider: React.FC<ClerkAuthProviderProps> = ({ children }) => {
  const publishableKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();
  const isClerkConfigured = Boolean(publishableKey && publishableKey.startsWith('pk_'));

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signIn' | 'signUp'>('signIn');

  const openSignIn = () => {
    setAuthModalMode('signIn');
    setIsAuthModalOpen(true);
  };

  const openSignUp = () => {
    setAuthModalMode('signUp');
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const contextValue: AuthContextType = {
    isClerkConfigured,
    isAuthModalOpen,
    authModalMode,
    openSignIn,
    openSignUp,
    closeAuthModal,
  };

  const fallbackUserValue: ActiveUserContextType = {
    isLoaded: true,
    isSignedIn: false,
    user: null,
    userId: 'default_user',
  };

  if (isClerkConfigured) {
    return (
      <ClerkProvider publishableKey={publishableKey} appearance={lifeOpsClerkAppearance}>
        <AuthContext.Provider value={contextValue}>
          <ClerkUserSync>
            {children}
          </ClerkUserSync>
        </AuthContext.Provider>
      </ClerkProvider>
    );
  }

  // Graceful fallback when Clerk publishable key is not yet set in .env
  return (
    <AuthContext.Provider value={contextValue}>
      <ActiveUserContext.Provider value={fallbackUserValue}>
        {children}
      </ActiveUserContext.Provider>
    </AuthContext.Provider>
  );
};
