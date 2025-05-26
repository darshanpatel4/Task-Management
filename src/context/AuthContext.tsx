
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
  if (profile?.role === 'Admin' || profile?.role === 'User') {
    role = profile.role;
  } else if (profile?.role) {
    console.warn(`AuthContext: Unknown role "${profile.role}" for user ${supabaseUser.id}. Defaulting to 'User'.`);
  }

  return {
    id: supabaseUser.id,
    name: profile?.full_name || supabaseUser.email?.split('@')[0] || 'User',
    email: supabaseUser.email || '',
    role: role,
    avatar: profile?.avatar_url || `https://placehold.co/100x100.png?u=${supabaseUser.id}`,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const setCurrentUser = useCallback((user: User | null) => {
    console.log("AuthContext: setCurrentUser explicitly called with:", user ? `${user.email} (Role: ${user.role})` : 'null');
    setCurrentUserState(user);
  }, []);

  const fetchProfileAndSetUser = useCallback(async (sbUser: SupabaseUser) => {
    console.log(`AuthContext: fetchProfileAndSetUser called for user ID: ${sbUser.id}`);
    if (!supabase) {
      console.warn("AuthContext: Supabase client not available in fetchProfileAndSetUser.");
      setCurrentUserState(mapSupabaseUserToAppUser(sbUser, null));
      return;
    }

    try {
      console.log(`AuthContext: fetchProfileAndSetUser - BEFORE Supabase call to fetch profile for user ID: ${sbUser.id}`);
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .single();
      console.log(`AuthContext: fetchProfileAndSetUser - AFTER Supabase call for profile. Error:`, profileError, "Profile Data:", profile);

      if (profileError) {
        console.error(`AuthContext: Error fetching profile for user ${sbUser.id}. Code: ${profileError.code}, Message: ${profileError.message}, Details: ${profileError.details}, Hint: ${profileError.hint}`);
        if (profileError.code === 'PGRST116') {
          console.warn(`AuthContext: Profile not found for user ${sbUser.id}. User might exist in auth.users but not in profiles.`);
          setCurrentUserState(mapSupabaseUserToAppUser(sbUser, null)); // Use defaults if profile not found
        } else {
          setCurrentUserState(mapSupabaseUserToAppUser(sbUser, { full_name: 'Error User (Profile Fetch Failed)', role: 'User' as UserRole }));
        }
      } else if (profile) {
        console.log(`AuthContext: Profile fetched successfully for user ${sbUser.id}:`, profile.email, profile.role);
        setCurrentUserState(mapSupabaseUserToAppUser(sbUser, profile));
      } else {
        console.warn(`AuthContext: No profile data returned for user ${sbUser.id} (no error but no data). Using defaults.`);
        setCurrentUserState(mapSupabaseUserToAppUser(sbUser, null));
      }
    } catch (e: any) {
      console.error(`AuthContext: Unexpected exception fetching profile for user ${sbUser.id}:`, e);
      setCurrentUserState(mapSupabaseUserToAppUser(sbUser, { full_name: 'Error User (Exception)', role: 'User' as UserRole }));
    }
  }, [supabase, setCurrentUserState]); // Added supabase to dependency array

  useEffect(() => {
    console.log("AuthContext: Main useEffect init. Supabase client available?", !!supabase);
    if (!supabase) {
      console.warn("AuthContext: Supabase client not initialized. Auth will be disabled.");
      setLoading(false);
      setCurrentUserState(null);
      return;
    }

    console.log("AuthContext: Setting loading to true for initial session check.");
    setLoading(true);
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log("AuthContext: getSession() result. Session:", !!currentSession, "User in session:", !!currentSession?.user);
      setSession(currentSession);
      try {
        if (currentSession?.user) {
          console.log(`AuthContext: Initial session has user ID: ${currentSession.user.id}. Fetching profile.`);
          await fetchProfileAndSetUser(currentSession.user);
        } else {
          console.log("AuthContext: No active Supabase session found by getSession(). Setting current user to null.");
          setCurrentUserState(null);
        }
      } catch (e) {
        console.error("AuthContext: Error during initial profile fetch after getSession:", e);
        setCurrentUserState(null);
      }
      // The setLoading(false) for initial load is handled in the final .finally() block
    }).catch(error => {
        console.error("AuthContext: Error in getSession():", error);
        setCurrentUserState(null);
        // The setLoading(false) for initial load is handled in the final .finally() block
    }).finally(() => {
        console.log("AuthContext: Initial getSession() promise chain complete. Setting loading to false.");
        setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        console.log(`AuthContext: onAuthStateChange event: ${event}, session exists: ${!!newSession}, user in session: ${!!newSession?.user}, current currentUser ID: ${currentUser?.id}`);
        console.log("AuthContext: onAuthStateChange - Setting loading to true.");
        setLoading(true);
        setSession(newSession); // Update session state immediately

        try {
          if (newSession?.user) {
            console.log(`AuthContext: onAuthStateChange - User found (ID: ${newSession.user.id}). Fetching profile.`);
            await fetchProfileAndSetUser(newSession.user);
            console.log(`AuthContext: onAuthStateChange - Profile fetch process completed for user ID: ${newSession.user.id}.`);
          } else {
            console.log(`AuthContext: onAuthStateChange - No user in new session. Clearing current user state.`);
            setCurrentUserState(null);
          }
        } catch (error) {
            console.error(`AuthContext: Error during onAuthStateChange processing for event ${event}:`, error);
            setCurrentUserState(null);
        } finally {
            console.log(`AuthContext: onAuthStateChange finally block for event ${event}. Setting loading to false.`);
            setLoading(false);
        }
      }
    );

    return () => {
      console.log("AuthContext: Unsubscribing auth listener.");
      authListener?.subscription.unsubscribe();
    };
  }, [fetchProfileAndSetUser, supabase, currentUser?.id, setCurrentUserState]); // Added supabase, currentUser.id, setCurrentUserState to ensure effect reruns if these critical pieces change identities.

  useEffect(() => {
    console.log("AuthContext Guard: loading:", loading, "currentUser:", !!currentUser, "pathname:", pathname);
    if (!loading && !currentUser && !pathname.startsWith('/auth')) {
      console.log("AuthContext Guard: User not logged in and not on auth page. Redirecting to /auth/login.");
      router.push('/auth/login');
    }
  }, [currentUser, loading, pathname, router]);

  const logout = async () => {
    console.log("AuthContext: logout called.");
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('AuthContext: Error logging out with Supabase:', error);
      else console.log("AuthContext: Supabase signOut successful.");
    }
    // setCurrentUserState(null); // onAuthStateChange will handle this
    // setSession(null);        // onAuthStateChange will handle this
    // setLoading will be handled by onAuthStateChange
    console.log("AuthContext: Pushing to /auth/login after logout call.");
    router.push('/auth/login');
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

