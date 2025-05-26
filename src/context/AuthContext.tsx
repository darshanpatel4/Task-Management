
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
  session: Session | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser | null, profile: any | null): User | null => {
  if (!supabaseUser) return null;

  let role: UserRole = 'User';
  if (profile && (profile.role === 'Admin' || profile.role === 'User')) {
    role = profile.role;
  } else if (profile && profile.role) {
    console.warn(`AuthContext: mapSupabaseUserToAppUser - Unknown role "${profile.role}" for user ${supabaseUser.id}. Defaulting to 'User'.`);
  }

  return {
    id: supabaseUser.id,
    name: profile?.full_name || supabaseUser.email?.split('@')[0] || 'User',
    email: profile?.email || supabaseUser.email || '', // Prefer email from profile if available
    role: role,
    avatar: profile?.avatar_url || `https://placehold.co/100x100.png?u=${supabaseUser.id}`,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUserStateInternal] = useState<User | null>(null);
  const [session, setSessionState] = useState<Session | null>(null);
  const [loading, setLoadingState] = useState(true); // Initialize true for initial load
  const router = useRouter();
  const pathname = usePathname();

  const setCurrentUser = useCallback((user: User | null) => {
    console.log("AuthContext: setCurrentUser explicitly called with:", user ? `${user.email} (Role: ${user.role})` : 'null');
    setCurrentUserStateInternal(user);
  }, []); // setCurrentUserStateInternal is stable

  const setSession = useCallback((newSession: Session | null) => {
    console.log("AuthContext: setSession called with:", newSession ? `Session for ${newSession.user.id}` : 'null');
    setSessionState(newSession);
  }, []); // setSessionState is stable

  const fetchProfileAndSetUser = useCallback(async (sbUser: SupabaseUser, operationTag: string) => {
    console.log(`AuthContext: ${operationTag} - fetchProfileAndSetUser called for user ID: ${sbUser.id}`);
    if (!supabase) {
      console.warn(`AuthContext: ${operationTag} - Supabase client not available in fetchProfileAndSetUser.`);
      setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, null));
      return; // Exit early
    }

    console.log(`AuthContext: ${operationTag} - BEFORE Supabase call to fetch profile for user ID: ${sbUser.id}`);
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .eq('id', sbUser.id)
        .single();

      console.log(`AuthContext: ${operationTag} - AFTER Supabase call for profile. Error:`, profileError, "Profile Data:", profile);

      if (profileError) {
        console.error(`AuthContext: ${operationTag} - Error fetching profile for user ${sbUser.id}. Code: ${profileError.code}, Message: ${profileError.message}, Details: ${profileError.details}, Hint: ${profileError.hint}`, profileError);
        if (profileError.code === 'PGRST116') {
          console.warn(`AuthContext: ${operationTag} - Profile not found for user ${sbUser.id}. User might exist in auth.users but not in profiles.`);
          setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, null));
        } else {
          setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, { full_name: 'Error (Profile Fetch)', role: 'User' as User['role'], email: sbUser.email || '' }));
        }
      } else if (profile) {
        console.log(`AuthContext: ${operationTag} - Profile fetched successfully for user ${sbUser.id}:`, profile.email, profile.role);
        setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, profile));
      } else {
        console.warn(`AuthContext: ${operationTag} - No profile data returned for user ${sbUser.id} (no error but no data). Using defaults.`);
        setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, null));
      }
    } catch (e: any) {
      console.error(`AuthContext: ${operationTag} - Unexpected exception fetching profile for user ${sbUser.id}:`, e);
      setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, { full_name: 'Error (Exception)', role: 'User' as User['role'], email: sbUser.email || '' }));
    }
  }, [supabase, setCurrentUserStateInternal]); // Dependencies for useCallback

  useEffect(() => {
    console.log("AuthContext: Main useEffect for session and auth state listener. Supabase available?", !!supabase);
    if (!supabase) {
      console.warn("AuthContext: Supabase client not initialized. Auth will be disabled.");
      setLoadingState(false); // Directly set state
      setCurrentUser(null);
      setSession(null);
      return;
    }

    const initialLoadTag = "initialLoad";
    console.log(`AuthContext: ${initialLoadTag} - Setting loading to true.`);
    setLoadingState(true); // Directly set state

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
      console.log(`AuthContext: ${initialLoadTag} - Initial getSession() promise chain complete. Setting loading to false.`);
      setLoadingState(false); // Directly set state
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        const authEventTag = `onAuthChange-${event}`;
        console.log(`AuthContext: ${authEventTag} - Event: ${event}, newSession user ID: ${newSession?.user?.id || 'null'}`);
        setSession(newSession);

        if (newSession?.user) {
          console.log(`AuthContext: ${authEventTag} - User detected. Setting loading to true before profile fetch.`);
          setLoadingState(true); // Directly set state
          try {
            await fetchProfileAndSetUser(newSession.user, `${authEventTag}-profileFetch`);
          } catch (error) { // This catch is for errors *within* the try block, not fetchProfileAndSetUser's internal errors
            console.error(`AuthContext: ${authEventTag} - Error in onAuthStateChange block for user ${newSession.user.id}:`, error);
            setCurrentUser(null); // Fallback on error
          } finally {
            console.log(`AuthContext: ${authEventTag} (user detected path) finally block. Setting loading to false.`);
            setLoadingState(false); // Directly set state
          }
        } else { // No user in newSession (e.g., sign out, token revoked)
          console.log(`AuthContext: ${authEventTag} - No user in new session. Clearing user state.`);
          setCurrentUser(null);
          console.log(`AuthContext: ${authEventTag} - No user session. Setting loading to false.`);
          setLoadingState(false); // Directly set state
        }
      }
    );

    return () => {
      console.log("AuthContext: Unsubscribing auth listener.");
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, fetchProfileAndSetUser, setCurrentUser, setSession]); // Removed setLoadingState as it's internal

  useEffect(() => {
    // This guard runs whenever currentUser, loading, pathname, or router changes.
    // console.log("AuthContext Guard: loading:", loading, "currentUser:", !!currentUser, "pathname:", pathname);
    if (!loading && !currentUser && !pathname.startsWith('/auth')) {
      console.log("AuthContext Guard: User not logged in and not on auth page. Redirecting to /auth/login. Current path:", pathname);
      router.push('/auth/login');
    }
  }, [currentUser, loading, pathname, router]);

  const logout = async () => {
    const logoutTag = "logout";
    console.log(`AuthContext: ${logoutTag} - logout called.`);
    if (supabase) {
      console.log(`AuthContext: ${logoutTag} - Setting loading to true.`);
      setLoadingState(true); // Directly set state
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error(`AuthContext: ${logoutTag} - Error logging out with Supabase:`, error);
        // setLoadingState(false) will be handled by onAuthStateChange when session becomes null
      } else {
        console.log(`AuthContext: ${logoutTag} - Supabase signOut successful. onAuthStateChange will handle state update and loading state.`);
      }
      // Regardless of error, onAuthStateChange should fire with a null session, which will set loading to false.
      // If signOut errors severely and onAuthStateChange doesn't fire, we might get stuck.
      // However, usually signOut will lead to onAuthStateChange. If not, then:
      if (error) setLoadingState(false); // Only set false here if signOut errors and onAuthStateChange might not fire.
    } else {
      console.log(`AuthContext: ${logoutTag} - Supabase client not available. Mock logout.`);
      setCurrentUser(null);
      setSession(null);
      console.log(`AuthContext: ${logoutTag} - Mock logout. Setting loading to false.`);
      setLoadingState(false); // Directly set state
    }
  };
  
  const isAdmin = currentUser?.role === 'Admin';

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, logout, isAdmin, loading, session }}>
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
