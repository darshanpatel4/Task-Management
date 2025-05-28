'use client';

import type { User, UserRole } from '@/types';
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session, User as SupabaseUser, PostgrestError } from '@supabase/supabase-js';

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  logout: () => Promise<void>;
  isAdmin: boolean;
  loading: boolean;
  isInitialized: boolean;
  session: Session | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser | null, profile: any | null): User | null => {
  if (!supabaseUser) return null;

  let role: UserRole = 'User';
  if (profile && (profile.role === 'Admin' || profile.role === 'User')) {
    role = profile.role;
  } else if (profile && profile.role) {
    console.warn(`Unknown role "${profile.role}" for user ${supabaseUser.id}. Defaulting to 'User'.`);
  }

  return {
    id: supabaseUser.id,
    name: profile?.full_name || supabaseUser.email?.split('@')[0] || 'User',
    email: profile?.email || supabaseUser.email || '',
    role: role,
    avatar: profile?.avatar_url || `https://placehold.co/100x100.png?u=${supabaseUser.id}`,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUserStateInternal] = useState<User | null>(null);
  const [session, setSessionStateInternal] = useState<Session | null>(null);
  const [loading, setLoadingStateInternal] = useState(true);
  const [isInitialized, setIsInitializedStateInternal] = useState(false);

  const setCurrentUser = useCallback((user: User | null) => {
    setCurrentUserStateInternal(user);
  }, []);

  const fetchProfileAndSetUser = useCallback(async (sbUser: SupabaseUser, operationTag: string): Promise<User | null> => {
    // Skip if we already have this user's data
    if (currentUser?.id === sbUser.id) {
      console.log(`Profile for ${sbUser.id} already loaded, skipping fetch`);
      return currentUser;
    }

    if (!supabase) {
      console.warn('Supabase client not available during profile fetch');
      const mapped = mapSupabaseUserToAppUser(sbUser, null);
      setCurrentUserStateInternal(mapped);
      return mapped;
    }

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .eq('id', sbUser.id)
        .single();
      
      if (profileError) {
        console.error(`Error fetching profile: ${profileError.message}`);
        const mapped = mapSupabaseUserToAppUser(sbUser, null);
        setCurrentUserStateInternal(mapped);
        return mapped;
      }
      
      const mapped = mapSupabaseUserToAppUser(sbUser, profile);
      setCurrentUserStateInternal(mapped);
      return mapped;
    } catch (e: any) {
      console.error(`Exception during profile fetch: ${e.message}`);
      const mapped = mapSupabaseUserToAppUser(sbUser, null);
      setCurrentUserStateInternal(mapped);
      return mapped;
    }
  }, [currentUser]);

  useEffect(() => {
    if (!supabase) {
      console.warn("Supabase client not initialized. Auth features disabled.");
      setLoadingStateInternal(false);
      setIsInitializedStateInternal(true);
      return;
    }

    let isMounted = true;
    setLoadingStateInternal(true);

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: currentSession }, error: sessionError }) => {
      if (!isMounted) return;

      if (sessionError) {
        console.error("Initial getSession error:", sessionError);
        setCurrentUserStateInternal(null);
        setSessionStateInternal(null);
      } else {
        setSessionStateInternal(currentSession);
        if (currentSession?.user) {
          await fetchProfileAndSetUser(currentSession.user, "initialSession");
        } else {
          setCurrentUserStateInternal(null);
        }
      }
    }).catch(error => {
      if (!isMounted) return;
      console.error("Initial getSession exception:", error);
      setCurrentUserStateInternal(null);
      setSessionStateInternal(null);
    }).finally(() => {
      if (!isMounted) return;
      setLoadingStateInternal(false);
      setIsInitializedStateInternal(true);
    });

    // Auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        if (!isMounted) return;
        
        console.log(`Auth event: ${event}`);
        
        // Always update session state
        setSessionStateInternal(newSession);

        // Only handle specific events
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          if (newSession?.user) {
            setLoadingStateInternal(true);
            await fetchProfileAndSetUser(newSession.user, `onAuthChange-${event}`);
          }
        } 
        else if (event === 'SIGNED_OUT') {
          setCurrentUserStateInternal(null);
        }
        // Explicitly ignore TOKEN_REFRESHED events
        else if (event === 'TOKEN_REFRESHED') {
          console.log('Ignoring token refresh event');
          return;
        }
        
        setLoadingStateInternal(false);
      }
    );

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [fetchProfileAndSetUser]);

  const logout = async () => {
    if (!supabase) {
      console.warn("Supabase client not available. Mock logout.");
      setCurrentUserStateInternal(null);
      setSessionStateInternal(null);
      setLoadingStateInternal(false);
      return;
    }
    
    setLoadingStateInternal(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error signing out:", error);
      }
      // onAuthStateChange will handle the state reset
    } catch (e) {
      console.error("Exception during signout:", e);
      setLoadingStateInternal(false);
    }
  };
  
  const isAdmin = currentUser?.role === 'Admin';

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      setCurrentUser, 
      logout, 
      isAdmin, 
      loading, 
      isInitialized, 
      session 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};