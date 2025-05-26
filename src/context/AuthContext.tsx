
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
  // Check if profile and profile.role exist and are valid
  if (profile && (profile.role === 'Admin' || profile.role === 'User')) {
    role = profile.role;
  } else if (profile && profile.role) {
    console.warn(`AuthContext: Unknown role "${profile.role}" for user ${supabaseUser.id}. Defaulting to 'User'.`);
  } else {
    // If profile is null or profile.role is missing, default to 'User'
    // console.log(`AuthContext: Profile role not found for user ${supabaseUser.id}. Defaulting to 'User'.`);
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
  const [currentUser, setCurrentUserStateInternal] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true); // Initialize to true
  const router = useRouter();
  const pathname = usePathname();

  const setCurrentUser = useCallback((user: User | null) => {
    console.log("AuthContext: setCurrentUser explicitly called with:", user ? `${user.email} (Role: ${user.role})` : 'null');
    setCurrentUserStateInternal(user);
  }, []);

  const fetchProfileAndSetUser = useCallback(async (sbUser: SupabaseUser) => {
    console.log(`AuthContext: fetchProfileAndSetUser called for user ID: ${sbUser.id}`);
    if (!supabase) {
      console.warn("AuthContext: Supabase client not available in fetchProfileAndSetUser.");
      setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, null));
      return; // Let the caller handle setLoading(false)
    }

    console.log(`AuthContext: fetchProfileAndSetUser - BEFORE Supabase call to fetch profile for user ID: ${sbUser.id}`);
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .single();
      console.log(`AuthContext: fetchProfileAndSetUser - AFTER Supabase call for profile. Error:`, profileError, "Profile Data:", profile);

      if (profileError) {
        console.error(`AuthContext: Error fetching profile for user ${sbUser.id}. Code: ${profileError.code}, Message: ${profileError.message}, Details: ${profileError.details}, Hint: ${profileError.hint}`);
        console.error('AuthContext: Full profileError object:', profileError);
        
        if (profileError.code === 'PGRST116') { // PGRST116 often means "Not found" (0 rows)
          console.warn(`AuthContext: Profile not found for user ${sbUser.id}. User might exist in auth.users but not in profiles.`);
          setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, null)); // Use defaults
        } else { // Other errors
          setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, { full_name: 'Error User (Profile Fetch Failed)', role: 'User' as UserRole, email: sbUser.email || '' }));
        }
      } else if (profile) {
        console.log(`AuthContext: Profile fetched successfully for user ${sbUser.id}:`, profile.email, profile.role);
        setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, profile));
      } else { // No error, but no profile data
        console.warn(`AuthContext: No profile data returned for user ${sbUser.id} (no error but no data). Using defaults.`);
        setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, null));
      }
    } catch (e: any) { // Catch unexpected errors during the fetch logic itself
      console.error(`AuthContext: Unexpected exception fetching profile for user ${sbUser.id}:`, e);
      setCurrentUserStateInternal(mapSupabaseUserToAppUser(sbUser, { full_name: 'Error User (Exception)', role: 'User' as UserRole, email: sbUser.email || '' }));
    }
  }, [supabase, setCurrentUserStateInternal]); // setCurrentUserStateInternal from useState is stable

  // Initial session check and auth state listener setup
  useEffect(() => {
    console.log("AuthContext: Main useEffect init. Supabase client available?", !!supabase);
    if (!supabase) {
      console.warn("AuthContext: Supabase client not initialized. Auth will be disabled.");
      setLoading(false);
      setCurrentUserStateInternal(null);
      return;
    }

    console.log("AuthContext: Initial session check - Setting loading to true.");
    setLoading(true); // Set loading true for this async operation

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log("AuthContext: getSession() result. Session:", !!currentSession, "User in session:", !!currentSession?.user);
      setSession(currentSession); // Update session state
      if (currentSession?.user) {
        console.log(`AuthContext: Initial session has user ID: ${currentSession.user.id}. Fetching profile.`);
        await fetchProfileAndSetUser(currentSession.user);
      } else {
        console.log("AuthContext: No active Supabase session found by getSession(). Setting current user to null.");
        setCurrentUserStateInternal(null);
      }
    }).catch(error => {
      console.error("AuthContext: Error in getSession():", error);
      setCurrentUserStateInternal(null);
    }).finally(() => {
      console.log("AuthContext: Initial getSession() promise chain complete. Setting loading to false.");
      setLoading(false); // Critical: ensure loading is set to false
    });

    // Auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        console.log(`AuthContext: onAuthStateChange event: ${event}, newSession user ID: ${newSession?.user?.id || 'null'}`);
        setSession(newSession);

        if (newSession?.user) {
          console.log("AuthContext: onAuthStateChange - User detected. Setting loading to true and fetching profile.");
          setLoading(true); // Set loading true for profile fetch operation
          try {
            await fetchProfileAndSetUser(newSession.user);
          } catch (error) { // This catch might be redundant if fetchProfileAndSetUser handles its own errors
            console.error(`AuthContext: Error during fetchProfileAndSetUser in onAuthStateChange for event ${event}:`, error);
            setCurrentUserStateInternal(null); // Fallback on error
          } finally {
            console.log(`AuthContext: onAuthStateChange (user detected path) finally block. Setting loading to false.`);
            setLoading(false); // Critical: ensure loading is set to false after profile fetch attempt
          }
        } else { // No user in newSession (e.g., sign out, token revoked)
          console.log("AuthContext: onAuthStateChange - No user in new session. Setting current user to null. Setting loading to false.");
          setCurrentUserStateInternal(null);
          setLoading(false); // Set loading false as this path is synchronous and user is cleared
        }
      }
    );

    return () => {
      console.log("AuthContext: Unsubscribing auth listener.");
      authListener?.subscription.unsubscribe();
    };
    // Simplified dependencies: these functions/values are stable or their changes are what this effect should react to.
  }, [supabase, fetchProfileAndSetUser, setCurrentUser, setSession]); // Removed setLoading from deps as it's a setState func

  // Navigation guard
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
      setLoading(true); // Indicate loading during logout
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('AuthContext: Error logging out with Supabase:', error);
        setLoading(false); // Reset loading even if signOut errors
      } else {
        console.log("AuthContext: Supabase signOut successful.");
        // setCurrentUserStateInternal(null); // onAuthStateChange will handle this
        // setSession(null); // onAuthStateChange will handle this
        // setLoading(false) will be handled by onAuthStateChange after session becomes null
      }
    } else {
       setCurrentUserStateInternal(null);
       setSession(null);
       setLoading(false);
    }
    // No need to push to /auth/login here if onAuthStateChange handles it,
    // but doing so ensures immediate redirect attempt.
    // However, the guard effect will also handle this if currentUser becomes null.
    // router.push('/auth/login'); // Let the guard handle this to avoid race conditions
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

