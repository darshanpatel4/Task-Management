
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

  // Ensure role is always one of the defined UserRole types
  let role: UserRole = 'User'; // Default role
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
  const [loading, setLoading] = useState(true); // Initialize to true
  const router = useRouter();
  const pathname = usePathname();

  const setCurrentUser = useCallback((user: User | null) => {
    console.log("AuthContext: setCurrentUser explicitly called with:", user ? user.email : 'null');
    setCurrentUserState(user);
  }, []);

  const fetchProfileAndSetUser = useCallback(async (sbUser: SupabaseUser) => {
    console.log(`AuthContext: Attempting to fetch profile for user ${sbUser.id}`);
    if (!supabase) {
      console.warn("AuthContext: Supabase client not available while trying to fetch profile.");
      setCurrentUserState(mapSupabaseUserToAppUser(sbUser, null)); // Basic user from auth
      return; // No further loading state change here, as caller manages it.
    }

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .single();

      if (profileError) {
        // Log more detailed error information
        console.error(`AuthContext: Error fetching profile for user ${sbUser.id}. Code: ${profileError.code}, Message: ${profileError.message}, Details: ${profileError.details}, Hint: ${profileError.hint}`, profileError);
        if (profileError.code === 'PGRST116') { // PGRST116 often means "Not found" (0 rows)
          console.warn(`AuthContext: Profile not found for user ${sbUser.id}. User might exist in auth.users but not in profiles.`);
          // Handle as a user with no profile data yet, or prompt for profile creation
          setCurrentUserState(mapSupabaseUserToAppUser(sbUser, null));
        } else {
          // Other error (like RLS, network), treat as if profile couldn't be determined
          setCurrentUserState(mapSupabaseUserToAppUser(sbUser, { full_name: 'Error User (Profile Fetch Failed)', role: 'User' as UserRole })); // Fallback minimal user on error
        }
      } else if (profile) {
        console.log(`AuthContext: Profile fetched successfully for user ${sbUser.id}:`, profile.email, profile.role);
        setCurrentUserState(mapSupabaseUserToAppUser(sbUser, profile));
      } else {
        // This case (no error, no profile) should ideally be caught by .single() if PGRST116 is handled
        console.warn(`AuthContext: No profile data returned for user ${sbUser.id}, though no explicit error. Using defaults.`);
        setCurrentUserState(mapSupabaseUserToAppUser(sbUser, null));
      }
    } catch (e: any) {
      console.error(`AuthContext: Unexpected exception fetching profile for user ${sbUser.id}:`, e);
      setCurrentUserState(mapSupabaseUserToAppUser(sbUser, { full_name: 'Error User (Exception)', role: 'User' as UserRole }));
    }
  }, []);


  useEffect(() => {
    console.log("AuthContext: Initial effect. Supabase client available?", !!supabase);
    if (!supabase) {
      console.warn("AuthContext: Supabase client not initialized. Auth will not function correctly.");
      setLoading(false); // Ensure loading is false if no Supabase
      setCurrentUserState(null);
      return;
    }

    console.log("AuthContext: Setting loading to true for initial session check.");
    setLoading(true);
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log("AuthContext: getSession() result. Session:", !!currentSession);
      setSession(currentSession);
      if (currentSession?.user) {
        await fetchProfileAndSetUser(currentSession.user);
      } else {
        console.log("AuthContext: No active Supabase session found by getSession().");
        setCurrentUserState(null);
      }
    }).catch(error => {
        console.error("AuthContext: Error in getSession():", error);
        setCurrentUserState(null);
    }).finally(() => {
        console.log("AuthContext: Initial session check finished. Setting loading to false.");
        setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        console.log("AuthContext: onAuthStateChange event:", event, "session:", !!newSession);
        setSession(newSession);
        console.log(`AuthContext: onAuthStateChange - Setting loading to true (event: ${event})`);
        setLoading(true);
        try {
          if (newSession?.user) {
            console.log(`AuthContext: onAuthStateChange - user detected (event: ${event}). Fetching profile.`);
            await fetchProfileAndSetUser(newSession.user);
          } else {
            console.log(`AuthContext: onAuthStateChange - no user in session (event: ${event}). Clearing current user.`);
            setCurrentUserState(null);
          }
        } catch (error) {
            console.error("AuthContext: Error inside onAuthStateChange's async processing:", error);
            setCurrentUserState(null); // Fallback on error
        } finally {
            console.log(`AuthContext: onAuthStateChange - Processing finished for event ${event}. Setting loading to false.`);
            setLoading(false);
        }
      }
    );

    return () => {
      console.log("AuthContext: Unsubscribing auth listener.");
      authListener?.subscription.unsubscribe();
    };
  }, [fetchProfileAndSetUser]); // fetchProfileAndSetUser is stable due to useCallback([])

  useEffect(() => {
    // This effect handles redirection based on auth state.
    // It's important that `loading` is accurately managed by the effect above.
    console.log("AuthContext Guard: loading:", loading, "currentUser:", !!currentUser, "pathname:", pathname);
    if (!loading && !currentUser && !pathname.startsWith('/auth')) {
      console.log("AuthContext Guard: Redirecting to /auth/login.");
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
    // No need to set loading here, onAuthStateChange will handle it.
    console.log("AuthContext: Pushing to /auth/login after logout.");
    router.push('/auth/login'); // onAuthStateChange will eventually set loading states
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
