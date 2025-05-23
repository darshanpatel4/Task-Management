
'use client';

import type { User } from '@/types';
// import { mockUsers, getUserByEmail as findUserByEmailMock } from '@/lib/mock-data'; // Mock data not primary focus now
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

  return {
    id: supabaseUser.id,
    name: profile?.full_name || supabaseUser.email?.split('@')[0] || 'User',
    email: supabaseUser.email || '',
    role: profile?.role || 'User',
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
    console.log("AuthContext: setCurrentUser explicitly called with:", user);
    setCurrentUserState(user);
    // if (!user) localStorage.removeItem('currentUser'); // Example for mock data, less relevant now
  }, []);

  const fetchProfileAndSetUser = useCallback(async (sbUser: SupabaseUser) => {
    console.log(`AuthContext: Attempting to fetch profile for user ${sbUser.id}`);
    if (!supabase) {
      console.warn("AuthContext: Supabase client not available while trying to fetch profile.");
      setCurrentUserState(mapSupabaseUserToAppUser(sbUser, null)); // Basic user from auth
      setLoading(false);
      return;
    }

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .single();

      if (profileError) {
        console.error(`AuthContext: Error fetching profile for user ${sbUser.id}. Code: ${profileError.code}, Message: ${profileError.message}, Details: ${profileError.details}, Hint: ${profileError.hint}`);
        if (profileError.code === 'PGRST116') { // PGRST116 often means "Not found" (0 rows)
          console.warn(`AuthContext: Profile not found for user ${sbUser.id}. User might exist in auth.users but not in profiles.`);
          setCurrentUserState(mapSupabaseUserToAppUser(sbUser, null)); // User exists in auth, but no profile yet
        } else {
          // Other error (like RLS, network), treat as if profile couldn't be determined
          setCurrentUserState(mapSupabaseUserToAppUser(sbUser, { full_name: 'Error User (Profile Fetch Failed)', role: 'User' }));
        }
      } else if (profile) {
        console.log(`AuthContext: Profile fetched successfully for user ${sbUser.id}:`, profile);
        setCurrentUserState(mapSupabaseUserToAppUser(sbUser, profile));
      } else {
        // This case (no error, no profile) should ideally be caught by .single() if PGRST116 is handled
        console.warn(`AuthContext: No profile data returned for user ${sbUser.id}, though no explicit error. Using defaults.`);
        setCurrentUserState(mapSupabaseUserToAppUser(sbUser, null));
      }
    } catch (e: any) {
      console.error(`AuthContext: Unexpected exception fetching profile for user ${sbUser.id}:`, e);
      setCurrentUserState(mapSupabaseUserToAppUser(sbUser, { full_name: 'Error User (Exception)', role: 'User' }));
    }
  }, []);


  useEffect(() => {
    console.log("AuthContext: Initial effect. Supabase client available?", !!supabase);
    if (!supabase) {
      console.warn("AuthContext: Supabase client not initialized. Auth will not function correctly.");
      setLoading(false);
      setCurrentUserState(null); // No Supabase, no user
      return;
    }

    setLoading(true);
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log("AuthContext: getSession() result. Session:", currentSession);
      setSession(currentSession);
      if (currentSession?.user) {
        await fetchProfileAndSetUser(currentSession.user);
      } else {
        console.log("AuthContext: No active Supabase session found by getSession().");
        setCurrentUserState(null);
      }
      setLoading(false);
    }).catch(error => {
        console.error("AuthContext: Error in getSession():", error);
        setCurrentUserState(null);
        setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        console.log("AuthContext: onAuthStateChange event:", event, "session:", newSession);
        setSession(newSession);
        setLoading(true);

        if (newSession?.user) {
          console.log(`AuthContext: onAuthStateChange - user detected (event: ${event}). Fetching profile.`);
          await fetchProfileAndSetUser(newSession.user);
        } else {
          console.log(`AuthContext: onAuthStateChange - no user in session (event: ${event}). Clearing current user.`);
          setCurrentUserState(null);
        }
        setLoading(false);
      }
    );

    return () => {
      console.log("AuthContext: Unsubscribing auth listener.");
      authListener?.subscription.unsubscribe();
    };
  }, [fetchProfileAndSetUser]);

  useEffect(() => {
    console.log("AuthContext State Change: loading:", loading, "currentUser:", !!currentUser, "pathname:", pathname);
    if (!loading && !currentUser && !pathname.startsWith('/auth')) {
      console.log("AuthContext: Not loading, no current user, and not on auth page. Redirecting to /auth/login.");
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
    setCurrentUserState(null);
    setSession(null);
    console.log("AuthContext: Redirecting to /auth/login after logout.");
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
