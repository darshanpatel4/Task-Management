
'use client';

import type { User, UserRole } from '@/types';
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session, User as SupabaseUser, PostgrestError } from '@supabase/supabase-js';

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  logout: () => Promise<void>;
  isAdmin: boolean;
  loading: boolean;
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
  const [currentUserState, setCurrentUserStateInternal] = useState<User | null>(null);
  const [sessionState, setSessionStateInternal] = useState<Session | null>(null);
  const [loadingState, setLoadingStateInternal] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const setCurrentUser = useCallback((user: User | null) => {
    console.log("AuthContext: setCurrentUser PUBLIC explicit call with:", user ? `${user.email} (Role: ${user.role})` : 'null');
    setCurrentUserStateInternal(user);
  }, []);

  const setSession = useCallback((newSession: Session | null) => {
    console.log("AuthContext: setSession PUBLIC explicit call with:", newSession ? `Session for ${newSession.user.id}` : 'null');
    setSessionStateInternal(newSession);
  }, []);

  const fetchProfileAndSetUser = useCallback(async (sbUser: SupabaseUser, operationTag: string) => {
    console.log(`AuthContext: ${operationTag} - fetchProfileAndSetUser called for user ID: ${sbUser.id}`);
    if (!supabase) {
      console.warn(`AuthContext: ${operationTag} - Supabase client not available in fetchProfileAndSetUser.`);
      setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, null));
      return;
    }

    let profile = null;
    let profileError: PostgrestError | null = null;
    console.log(`AuthContext: ${operationTag} - fetchProfileAndSetUser - BEFORE Supabase call to fetch profile for user ID: ${sbUser.id}`);
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
      profileError = e as PostgrestError;
    }
    console.log(`AuthContext: ${operationTag} - fetchProfileAndSetUser - AFTER Supabase call. Error:`, profileError, "Profile Data:", profile);

    if (profileError) {
      console.error(`AuthContext: ${operationTag} - Error fetching profile for user ${sbUser.id}. Code: ${profileError.code}, Message: ${profileError.message}, Details: ${profileError.details}, Hint: ${profileError.hint}`);
      if (profileError.code === 'PGRST116') { // "Not found"
        console.warn(`AuthContext: ${operationTag} - Profile not found for user ${sbUser.id}. User might exist in auth.users but not in profiles.`);
        setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, null));
      } else {
        setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, { full_name: 'Error Profile', role: 'User' as UserRole, email: sbUser.email || '' }));
      }
    } else if (profile) {
      setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, profile));
    } else {
      console.warn(`AuthContext: ${operationTag} - No profile data returned for user ${sbUser.id} (no error but no data). Using defaults.`);
      setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, null));
    }
  }, [supabase, setCurrentUserStateInternal]);

  useEffect(() => {
    const initialLoadTag = "initialLoad";
    if (!supabase) {
      console.warn("AuthContext: Supabase client not initialized during effect setup. Auth will be disabled.");
      setLoadingStateInternal(false);
      setCurrentUserStateInternal(null);
      setSessionStateInternal(null);
      return;
    }

    console.log(`AuthContext: ${initialLoadTag} - Setting loading to TRUE for initial session check.`);
    setLoadingStateInternal(true);
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log(`AuthContext: ${initialLoadTag} - getSession() result. Session:`, !!currentSession, "User in session:", !!currentSession?.user?.id);
      setSessionStateInternal(currentSession);
      if (currentSession?.user) {
        await fetchProfileAndSetUser(currentSession.user, `${initialLoadTag}-profileFetch`);
      } else {
        setCurrentUserStateInternal(null);
      }
    }).catch(error => {
      console.error(`AuthContext: ${initialLoadTag} - Error in getSession():`, error);
      setCurrentUserStateInternal(null);
    }).finally(() => {
      console.log(`AuthContext: ${initialLoadTag} - Initial getSession() promise chain FINALLY. Setting loading to FALSE.`);
      setLoadingStateInternal(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        const authEventTag = `onAuthChange-${event}`;
        console.log(`AuthContext: ${authEventTag} - Event received. New session user ID: ${newSession?.user?.id || 'null'}`);
        setSessionStateInternal(newSession);

        if (newSession?.user) {
          console.log(`AuthContext: ${authEventTag} - User detected. Setting loading to TRUE before profile fetch.`);
          setLoadingStateInternal(true);
          try {
            await fetchProfileAndSetUser(newSession.user, `${authEventTag}-profileFetch`);
          } catch (error) {
            console.error(`AuthContext: ${authEventTag} - Error in onAuthStateChange profile fetch block for user ${newSession.user.id}:`, error);
            setCurrentUserStateInternal(null); // Clear user on error during profile fetch
          } finally {
            console.log(`AuthContext: ${authEventTag} (user detected path) FINALLY block. Setting loading to FALSE.`);
            setLoadingStateInternal(false);
          }
        } else {
          console.log(`AuthContext: ${authEventTag} - No user in new session. Clearing user state.`);
          setCurrentUserStateInternal(null);
          console.log(`AuthContext: ${authEventTag} - No user session. Setting loading to FALSE.`);
          setLoadingStateInternal(false); // Ensure loading is false if session becomes null
        }
      }
    );

    return () => {
      console.log("AuthContext: Unsubscribing auth listener.");
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, fetchProfileAndSetUser, setCurrentUserStateInternal, setSessionStateInternal]); // Removed setLoadingStateInternal from deps

  useEffect(() => {
    // This effect handles redirection based on auth state
    // It runs AFTER the loading state has been potentially set by the above effect
    console.log(`AuthContextGuard: Current state - loading: ${loadingState}, currentUser: ${!!currentUserState}, pathname: ${pathname}`);
    if (!loadingState && !currentUserState && !pathname.startsWith('/auth')) {
      console.log("AuthContextGuard: Redirecting to /auth/login. Conditions met.");
      router.push('/auth/login');
    }
  }, [currentUserState, loadingState, pathname, router]);

  const logout = async () => {
    const logoutTag = "logout";
    if (!supabase) {
      console.log(`AuthContext: ${logoutTag} - Supabase client not available. Mock logout.`);
      setCurrentUserStateInternal(null);
      setSessionStateInternal(null);
      setLoadingStateInternal(false); // Ensure loading is false
      return;
    }
    
    console.log(`AuthContext: ${logoutTag} - Setting loading to TRUE before signOut.`);
    setLoadingStateInternal(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error(`AuthContext: ${logoutTag} - Error logging out with Supabase:`, error);
      // onAuthStateChange should handle setting user to null and loading to false.
      // As a fallback if onAuthStateChange doesn't fire quickly or correctly after a signOut error:
      setLoadingStateInternal(false);
    } else {
      console.log(`AuthContext: ${logoutTag} - Supabase signOut successful. onAuthStateChange will handle state update.`);
      // onAuthStateChange will eventually set currentUser to null and loading to false.
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
