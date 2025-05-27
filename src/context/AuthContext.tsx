
'use client';

import type { User, UserRole } from '@/types';
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js';

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  logout: () => Promise<void>;
  isAdmin: boolean;
  loading: boolean; // Reflects ongoing auth operations AFTER initialization
  isInitialized: boolean; // True after initial session check is complete
  session: Session | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser | null, profile: any | null): User | null => {
  if (!supabaseUser) return null;

  let role: UserRole = 'User'; // Default role
  if (profile && (profile.role === 'Admin' || profile.role === 'User')) {
    role = profile.role;
  } else if (profile && profile.role) {
    console.warn(`AuthContext: mapSupabaseUserToAppUser - Unknown role "${profile.role}" for user ${supabaseUser.id}. Defaulting to 'User'. Profile was:`, profile);
  } else if (!profile) {
    console.warn(`AuthContext: mapSupabaseUserToAppUser - No profile provided for user ${supabaseUser.id}. Defaulting to 'User' role.`);
  }


  return {
    id: supabaseUser.id,
    name: profile?.full_name || supabaseUser.email?.split('@')[0] || 'User',
    email: profile?.email || supabaseUser.email || '', // Prioritize profile email if available
    role: role,
    avatar: profile?.avatar_url || `https://placehold.co/100x100.png?u=${supabaseUser.id}`,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUserState, setCurrentUserStateInternal] = useState<User | null>(null);
  const [sessionState, setSessionStateInternal] = useState<Session | null>(null);
  const [loadingState, setLoadingStateInternal] = useState(true); 
  const [isInitializedState, setIsInitializedStateInternal] = useState(false);
  const isMountedRef = useRef(true);


  const setCurrentUser = useCallback((user: User | null) => {
    console.log("AuthContext: setCurrentUser (public) called with:", user ? `${user.email} (Role: ${user.role})` : 'null');
    if (isMountedRef.current) {
      setCurrentUserStateInternal(user);
    }
  }, []);

  const fetchProfileAndSetUser = useCallback(async (sbUser: SupabaseUser, operationTag: string): Promise<User | null> => {
    console.log(`AuthContext: ${operationTag} - fetchProfileAndSetUser called for user ID: ${sbUser.id}`);
    if (!supabase) {
      console.warn(`AuthContext: ${operationTag} - Supabase client not available during profile fetch. Mapping with minimal data.`);
      const mapped = mapSupabaseUserToAppUser(sbUser, null);
      if (isMountedRef.current) setCurrentUserStateInternal(mapped);
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

      if (!isMountedRef.current) {
        console.log(`AuthContext: ${operationTag} - fetchProfileAndSetUser - component unmounted after profile fetch, not setting state.`);
        return null; 
      }

      if (profileError) {
        console.error(`AuthContext: ${operationTag} - Error fetching profile for user ${sbUser.id}. Code: ${profileError.code}, Message: ${profileError.message}, Details: ${profileError.details}, Hint: ${profileError.hint}`);
        if (profileError.code === 'PGRST116') { // PGRST116 often means "Not found" (0 rows)
          console.warn(`AuthContext: ${operationTag} - Profile not found for user ${sbUser.id}. User might exist in auth.users but not in profiles.`);
        }
        const mapped = mapSupabaseUserToAppUser(sbUser, null); // Fallback to minimal user on error
        setCurrentUserStateInternal(mapped);
        return mapped;
      }
      
      const mapped = mapSupabaseUserToAppUser(sbUser, profile);
      setCurrentUserStateInternal(mapped);
      return mapped;

    } catch (e: any) {
      console.error(`AuthContext: ${operationTag} - EXCEPTION during profile fetch for ${sbUser.id}:`, e);
      if (!isMountedRef.current) {
        console.log(`AuthContext: ${operationTag} - fetchProfileAndSetUser (EXCEPTION path) - component unmounted, not setting state.`);
        return null;
      }
      const mapped = mapSupabaseUserToAppUser(sbUser, null);
      setCurrentUserStateInternal(mapped);
      return mapped;
    }
  }, [supabase]); 

  useEffect(() => {
    isMountedRef.current = true;
    console.log("AuthContext: Main useEffect mounting. isMountedRef set to true.");

    if (!supabase) {
      console.warn("AuthContext: Supabase client not initialized. Auth features disabled.");
      if (isMountedRef.current) {
        setLoadingStateInternal(false);
        setIsInitializedStateInternal(true);
      }
      return;
    }

    console.log("AuthContext: Starting initial session check (useEffect[]). Setting loading TRUE.");
    if (isMountedRef.current) setLoadingStateInternal(true);

    supabase.auth.getSession().then(async ({ data: { session: currentSession }, error: sessionError }) => {
      if (!isMountedRef.current) {
        console.log("AuthContext: Initial getSession - component unmounted before .then() completed.");
        return;
      }
      console.log("AuthContext: Initial getSession completed.", "Error:", sessionError, "Session User:", currentSession?.user?.id);

      if (sessionError) {
        console.error("AuthContext: Initial getSession error:", sessionError);
        setCurrentUserStateInternal(null);
        setSessionStateInternal(null);
      } else {
        setSessionStateInternal(currentSession);
        if (currentSession?.user) {
          console.log("AuthContext: Initial getSession - User found. Fetching profile...");
          await fetchProfileAndSetUser(currentSession.user, "initialSession");
        } else {
          console.log("AuthContext: Initial getSession - No user session. Setting currentUser null.");
          setCurrentUserStateInternal(null);
        }
      }
    }).catch(error => {
      if (!isMountedRef.current) {
        console.log("AuthContext: Initial getSession - component unmounted before .catch() completed.");
        return;
      }
      console.error("AuthContext: Initial getSession EXCEPTION:", error);
      setCurrentUserStateInternal(null);
      setSessionStateInternal(null);
    }).finally(() => {
      if (!isMountedRef.current) {
        console.log("AuthContext: Initial getSession - component unmounted before .finally() completed.");
        return;
      }
      console.log("AuthContext: Initial getSession FINALLY. Setting loading FALSE, initialized TRUE.");
      setLoadingStateInternal(false); 
      setIsInitializedStateInternal(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        const operationTag = `onAuthChange-${event}`;
        if (!isMountedRef.current) {
          console.log(`AuthContext: ${operationTag} - Component unmounted, skipping update.`);
          return;
        }
        console.log(`AuthContext: ${operationTag} - Event received. New session user ID: ${newSession?.user?.id || 'null'}`);
        
        setSessionStateInternal(newSession);

        if (newSession?.user) {
          console.log(`AuthContext: ${operationTag} - User detected. Setting loading TRUE before profile fetch.`);
          setLoadingStateInternal(true);
          try {
            await fetchProfileAndSetUser(newSession.user, operationTag);
          } catch (e) {
            console.error(`AuthContext: ${operationTag} - Error during/after fetchProfileAndSetUser in onAuthStateChange:`, e);
          } finally {
            if (isMountedRef.current) {
              console.log(`AuthContext: ${operationTag} - Profile fetch attempt FINALLY. Setting loading FALSE.`);
              setLoadingStateInternal(false);
            }
          }
        } else {
          console.log(`AuthContext: ${operationTag} - No user session. Setting currentUser null, loading FALSE.`);
          setCurrentUserStateInternal(null);
          setLoadingStateInternal(false);
        }
      }
    );
    console.log("AuthContext: onAuthStateChange listener subscribed.");

    return () => {
      isMountedRef.current = false;
      console.log("AuthContext: Main useEffect cleanup. Unsubscribing auth listener. isMountedRef set to false.");
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, fetchProfileAndSetUser, setCurrentUser]); 

  const logout = async () => {
    if (!isMountedRef.current) {
        console.log("AuthContext: logout - Component unmounted, skipping logout.");
        return;
    }
    if (!supabase) {
      console.warn("AuthContext: logout - Supabase client not available. Mock logout.");
      setCurrentUserStateInternal(null);
      setSessionStateInternal(null);
      setLoadingStateInternal(false);
      return;
    }
    
    console.log("AuthContext: logout - Initiating. Setting loading TRUE.");
    setLoadingStateInternal(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("AuthContext: logout - Error signing out:", error);
        if (isMountedRef.current) setLoadingStateInternal(false); // Fallback if onAuthStateChange doesn't fire quickly
      } else {
        console.log("AuthContext: logout - signOut successful. onAuthStateChange will handle state reset and loading.");
        // onAuthStateChange should set currentUser to null and loading to false.
      }
    } catch (e) {
        console.error("AuthContext: logout - EXCEPTION during signout:", e);
        if (isMountedRef.current) setLoadingStateInternal(false); 
    }
  };
  
  const isAdmin = currentUserState?.role === 'Admin';

  return (
    <AuthContext.Provider value={{ 
        currentUser: currentUserState, 
        setCurrentUser, 
        logout, 
        isAdmin, 
        loading: loadingState, 
        isInitialized: isInitializedState, 
        session: sessionState 
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
