
'use client';

import type { User, UserRole } from '@/types';
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session, User as SupabaseUser, PostgrestError } from '@supabase/supabase-js';

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void; // Keep this for potential direct use if needed
  logout: () => Promise<void>;
  isAdmin: boolean;
  loading: boolean;
  session: Session | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOADING_TIMEOUT_DURATION = 15000; // 15 seconds

const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser | null, profile: any | null): User | null => {
  if (!supabaseUser) return null;

  let role: UserRole = 'User';
  if (profile && (profile.role === 'Admin' || profile.role === 'User')) {
    role = profile.role;
  } else if (profile && profile.role) {
    console.warn(`AuthContext: mapSupabaseUserToAppUser - Unknown role "${profile.role}" for user ${supabaseUser.id}. Defaulting to 'User'.`);
  } else {
    // console.log(`AuthContext: mapSupabaseUserToAppUser - No profile role found for user ${supabaseUser.id}. Defaulting to 'User'. Profile was:`, profile);
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
  const [currentUserState, setCurrentUserStateInternal] = useState<User | null>(null);
  const [sessionState, setSessionStateInternal] = useState<Session | null>(null);
  const [loadingState, setLoadingStateInternal] = useState(true); // Initialize true for initial load
  const router = useRouter();
  const pathname = usePathname();
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearLoadingTimeout = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
      // console.log("AuthContext: Cleared loading timeout.");
    }
  }, []);

  const startLoadingWithTimeout = useCallback((operationTag: string) => {
    console.log(`AuthContext: ${operationTag} - Setting loading to TRUE.`);
    setLoadingStateInternal(true);
    clearLoadingTimeout(); // Clear any existing timeout before starting a new one
    loadingTimeoutRef.current = setTimeout(() => {
      console.warn(`AuthContext: LOADING TIMEOUT for operation [${operationTag}]! Forcing loading to false.`);
      setLoadingStateInternal(false);
      loadingTimeoutRef.current = null; // Ensure ref is cleared
    }, LOADING_TIMEOUT_DURATION);
  }, [clearLoadingTimeout]);

  const stopLoading = useCallback((operationTag: string) => {
    console.log(`AuthContext: ${operationTag} - Setting loading to FALSE.`);
    clearLoadingTimeout();
    setLoadingStateInternal(false);
  }, [clearLoadingTimeout]);

  const setCurrentUser = useCallback((user: User | null) => {
    // console.log("AuthContext: setCurrentUser explicitly called with:", user ? `${user.email} (Role: ${user.role})` : 'null');
    setCurrentUserStateInternal(user);
  }, []);

  const setSession = useCallback((newSession: Session | null) => {
    // console.log("AuthContext: setSession called with:", newSession ? `Session for ${newSession.user.id}` : 'null');
    setSessionStateInternal(newSession);
  }, []);


  const fetchProfileAndSetUser = useCallback(async (sbUser: SupabaseUser, operationTag: string) => {
    console.log(`AuthContext: ${operationTag} - fetchProfileAndSetUser called for user ID: ${sbUser.id}`);
    if (!supabase) {
      console.warn(`AuthContext: ${operationTag} - Supabase client not available in fetchProfileAndSetUser.`);
      setCurrentUser(mapSupabaseUserToAppUser(sbUser, null));
      return;
    }

    console.log(`AuthContext: ${operationTag} - fetchProfileAndSetUser - BEFORE Supabase call to fetch profile for user ID: ${sbUser.id}`);
    let profile = null;
    let profileError: PostgrestError | null = null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .eq('id', sbUser.id)
        .single();
      profile = data;
      profileError = error;
    } catch (e: any) {
      console.error(`AuthContext: ${operationTag} - fetchProfileAndSetUser - EXCEPTION during Supabase call:`, e);
      profileError = e as PostgrestError; // Or create a custom error object
    }
    console.log(`AuthContext: ${operationTag} - fetchProfileAndSetUser - AFTER Supabase call. Error:`, profileError, "Profile Data:", profile);

    if (profileError) {
      console.error(`AuthContext: ${operationTag} - Error fetching profile for user ${sbUser.id}. Code: ${profileError.code}, Message: ${profileError.message}, Details: ${profileError.details}, Hint: ${profileError.hint}`);
      if (profileError.code === 'PGRST116') {
        console.warn(`AuthContext: ${operationTag} - Profile not found for user ${sbUser.id}. User might exist in auth.users but not in profiles.`);
        setCurrentUser(mapSupabaseUserToAppUser(sbUser, null)); // Use defaults if profile not found
      } else {
        setCurrentUser(mapSupabaseUserToAppUser(sbUser, { full_name: 'Error Profile', role: 'User' as User['role'], email: sbUser.email || '' })); // Fallback on other errors
      }
    } else if (profile) {
      // console.log(`AuthContext: ${operationTag} - Profile fetched successfully for user ${sbUser.id}:`, profile.email, profile.role);
      setCurrentUser(mapSupabaseUserToAppUser(sbUser, profile));
    } else {
      console.warn(`AuthContext: ${operationTag} - No profile data returned for user ${sbUser.id} (no error but no data). Using defaults.`);
      setCurrentUser(mapSupabaseUserToAppUser(sbUser, null));
    }
  }, [supabase, setCurrentUser]);


  useEffect(() => {
    const initialLoadTag = "initialLoad";
    if (!supabase) {
      console.warn("AuthContext: Supabase client not initialized during effect setup. Auth will be disabled.");
      stopLoading(`${initialLoadTag}-noSupabaseClient`);
      setCurrentUser(null);
      setSession(null);
      return;
    }

    startLoadingWithTimeout(`${initialLoadTag}-getSessionStart`);
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log(`AuthContext: ${initialLoadTag} - getSession() result. Session:`, !!currentSession, "User in session:", !!currentSession?.user);
      setSession(currentSession);
      if (currentSession?.user) {
        console.log(`AuthContext: ${initialLoadTag} - Initial session has user ID: ${currentSession.user.id}. Fetching profile.`);
        await fetchProfileAndSetUser(currentSession.user, `${initialLoadTag}-profileFetch`);
      } else {
        console.log(`AuthContext: ${initialLoadTag} - No active Supabase session by getSession(). Setting current user to null.`);
        setCurrentUser(null);
      }
    }).catch(error => {
      console.error(`AuthContext: ${initialLoadTag} - Error in getSession():`, error);
      setCurrentUser(null);
    }).finally(() => {
      console.log(`AuthContext: ${initialLoadTag} - Initial getSession() promise chain complete.`);
      stopLoading(`${initialLoadTag}-getSessionFinally`);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        const authEventTag = `onAuthChange-${event}`;
        console.log(`AuthContext: ${authEventTag} - Event: ${event}, newSession user ID: ${newSession?.user?.id || 'null'}`);
        setSession(newSession);

        if (newSession?.user) {
          startLoadingWithTimeout(`${authEventTag}-profileFetchStart`);
          try {
            await fetchProfileAndSetUser(newSession.user, `${authEventTag}-profileFetch`);
          } catch (error) {
            console.error(`AuthContext: ${authEventTag} - Error in onAuthStateChange block for user ${newSession.user.id}:`, error);
            setCurrentUser(null);
          } finally {
            console.log(`AuthContext: ${authEventTag} (user detected path) finally block.`);
            stopLoading(`${authEventTag}-profileFetchFinally`);
          }
        } else {
          console.log(`AuthContext: ${authEventTag} - No user in new session. Clearing user state.`);
          setCurrentUser(null);
          stopLoading(`${authEventTag}-noUserSession`);
        }
      }
    );

    return () => {
      console.log("AuthContext: Unsubscribing auth listener.");
      authListener?.subscription.unsubscribe();
      clearLoadingTimeout(); // Clear timeout on cleanup
    };
  }, [supabase, fetchProfileAndSetUser, setCurrentUser, setSession, startLoadingWithTimeout, stopLoading, clearLoadingTimeout]);

  useEffect(() => {
    if (!loadingState && !currentUserState && !pathname.startsWith('/auth')) {
      console.log("AuthContext Guard: Not loading, no user, not on auth page. Redirecting to /auth/login. Current path:", pathname);
      router.push('/auth/login');
    }
  }, [currentUserState, loadingState, pathname, router]);

  const logout = async () => {
    const logoutTag = "logout";
    startLoadingWithTimeout(`${logoutTag}-start`);
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error(`AuthContext: ${logoutTag} - Error logging out with Supabase:`, error);
        // onAuthStateChange should ideally handle setting loading to false
        // but as a fallback if it doesn't fire due to signOut error:
        stopLoading(`${logoutTag}-signOutError`);
      } else {
        console.log(`AuthContext: ${logoutTag} - Supabase signOut successful. onAuthStateChange will handle state.`);
        // onAuthStateChange will call stopLoading
      }
    } else {
      console.log(`AuthContext: ${logoutTag} - Supabase client not available. Mock logout.`);
      setCurrentUser(null);
      setSession(null);
      stopLoading(`${logoutTag}-mockLogout`);
    }
  };
  
  const isAdmin = currentUserState?.role === 'Admin';

  return (
    <AuthContext.Provider value={{ currentUser: currentUserState, setCurrentUser, logout, isAdmin, loading: loadingState, session: sessionState }}>
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

