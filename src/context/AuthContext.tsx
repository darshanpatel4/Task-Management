
'use client';

import type { User, UserRole } from '@/types';
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session, User as SupabaseUser, PostgrestError } from '@supabase/supabase-js';

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void; // Kept for potential direct use, though usually managed by auth state
  logout: () => Promise<void>;
  isAdmin: boolean;
  loading: boolean; // Reflects ongoing auth operations AFTER initialization
  isInitialized: boolean; // True after initial session check is complete
  session: Session | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser | null, profile: any | null): User | null => {
  if (!supabaseUser) return null;

  let role: UserRole = 'User';
  if (profile && (profile.role === 'Admin' || profile.role === 'User')) {
    role = profile.role;
  } else if (profile && profile.role) {
    console.warn(`AuthContext: mapSupabaseUserToAppUser - Unknown role "${profile.role}" for user ${supabaseUser.id}. Defaulting to 'User'. Profile was:`, profile);
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
  const [loading, setLoadingStateInternal] = useState(true); // True initially, becomes false after initialization. Then used for subsequent ops.
  const [isInitialized, setIsInitializedStateInternal] = useState(false); // True after the *very first* session check completes.

  const setCurrentUser = useCallback((user: User | null) => {
    console.log("AuthContext: setCurrentUser (public) called with:", user ? `${user.email} (Role: ${user.role})` : 'null');
    setCurrentUserStateInternal(user);
  }, []);

  const fetchProfileAndSetUser = useCallback(async (sbUser: SupabaseUser, operationTag: string): Promise<User | null> => {
    console.log(`AuthContext: ${operationTag} - fetchProfileAndSetUser called for user ID: ${sbUser.id}`);
    if (!supabase) {
      console.warn(`AuthContext: ${operationTag} - Supabase client not available during profile fetch. Mapping with minimal data.`);
      const mapped = mapSupabaseUserToAppUser(sbUser, null);
      setCurrentUserStateInternal(mapped);
      return mapped;
    }

    console.log(`AuthContext: ${operationTag} - BEFORE Supabase call to fetch profile for ${sbUser.id}`);
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .eq('id', sbUser.id)
        .single();
      
      console.log(`AuthContext: ${operationTag} - AFTER Supabase call for profile ${sbUser.id}. ProfileError:`, profileError, "Profile:", profile);

      if (profileError) {
        console.error(`AuthContext: ${operationTag} - Error fetching profile for user ${sbUser.id}. Code: ${profileError.code}, Message: ${profileError.message}, Details: ${profileError.details}, Hint: ${profileError.hint}`);
        if (profileError.code === 'PGRST116') {
          console.warn(`AuthContext: ${operationTag} - Profile not found (PGRST116) for user ${sbUser.id}.`);
        }
        const mapped = mapSupabaseUserToAppUser(sbUser, null);
        setCurrentUserStateInternal(mapped);
        return mapped;
      }
      
      const mapped = mapSupabaseUserToAppUser(sbUser, profile);
      setCurrentUserStateInternal(mapped);
      return mapped;

    } catch (e: any) {
      console.error(`AuthContext: ${operationTag} - EXCEPTION during profile fetch for ${sbUser.id}:`, e);
      const mapped = mapSupabaseUserToAppUser(sbUser, null);
      setCurrentUserStateInternal(mapped);
      return mapped;
    }
  }, []); // supabase client is stable, mapSupabaseUserToAppUser is stable

  useEffect(() => {
    if (!supabase) {
      console.warn("AuthContext: Supabase client not initialized. Auth features disabled.");
      setLoadingStateInternal(false);
      setIsInitializedStateInternal(true); // Mark as initialized even if Supabase isn't there, to unblock UI.
      return;
    }

    let isMounted = true;
    console.log("AuthContext: useEffect[] - Starting initial session check and auth listener setup.");
    setLoadingStateInternal(true); // Loading is true during this initial setup

    supabase.auth.getSession().then(async ({ data: { session: currentSession }, error: sessionError }) => {
      if (!isMounted) return;
      console.log("AuthContext: Initial getSession completed.", "Error:", sessionError, "Session User:", currentSession?.user?.id);

      if (sessionError) {
        console.error("AuthContext: Initial getSession error:", sessionError);
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
      console.error("AuthContext: Initial getSession EXCEPTION:", error);
      setCurrentUserStateInternal(null);
      setSessionStateInternal(null);
    }).finally(() => {
      if (!isMounted) return;
      console.log("AuthContext: Initial getSession FINALLY. Setting loading FALSE, initialized TRUE.");
      setLoadingStateInternal(false); // Initial loading done
      setIsInitializedStateInternal(true); // Initialization complete
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        if (!isMounted) {
          console.log(`AuthContext: onAuthChange (${event}) - Component unmounted, skipping update.`);
          return;
        }
        const operationTag = `onAuthChange-${event}`;
        console.log(`AuthContext: ${operationTag} - Event received. New session user ID: ${newSession?.user?.id || 'null'}`);
        
        setSessionStateInternal(newSession);

        if (newSession?.user) {
          console.log(`AuthContext: ${operationTag} - User detected. Setting loading TRUE before profile fetch.`);
          setLoadingStateInternal(true); // Loading for this specific operation
          try {
            await fetchProfileAndSetUser(newSession.user, operationTag);
          } catch (e) {
            console.error(`AuthContext: ${operationTag} - Error after fetchProfileAndSetUser in onAuthStateChange:`, e);
          } finally {
            if (isMounted) {
              console.log(`AuthContext: ${operationTag} - Profile fetch attempt FINALLY. Setting loading FALSE.`);
              setLoadingStateInternal(false);
            }
          }
        } else {
          console.log(`AuthContext: ${operationTag} - No user session. Setting currentUser null, loading FALSE.`);
          setCurrentUserStateInternal(null);
          setLoadingStateInternal(false); // No user, so no ongoing loading operation here
        }
      }
    );

    return () => {
      console.log("AuthContext: useEffect[] - Unmounting. Cleaning up auth listener.");
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, fetchProfileAndSetUser, setCurrentUser]); // Dependencies are stable or memoized

  const logout = async () => {
    if (!supabase) {
      console.warn("AuthContext: logout - Supabase client not available. Mock logout.");
      setCurrentUserStateInternal(null);
      setSessionStateInternal(null);
      setLoadingStateInternal(false); // Ensure loading is false
      return;
    }
    
    console.log("AuthContext: logout - Initiating. Setting loading TRUE.");
    setLoadingStateInternal(true); // Indicate logout operation
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("AuthContext: logout - Error signing out:", error);
        // onAuthStateChange should still fire and set loading to false.
        // If it doesn't, this is a fallback:
        setLoadingStateInternal(false);
      } else {
        console.log("AuthContext: logout - signOut successful. onAuthStateChange will handle state reset and loading.");
        // onAuthStateChange will set currentUser to null and loading to false.
      }
    } catch (e) {
        console.error("AuthContext: logout - EXCEPTION during signout:", e);
        setLoadingStateInternal(false); // Fallback
    }
  };
  
  const isAdmin = currentUser?.role === 'Admin';

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, logout, isAdmin, loading, isInitialized, session }}>
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

    