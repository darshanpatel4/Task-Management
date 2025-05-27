
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
    console.warn(`AuthContext: mapSupabaseUserToAppUser - Unknown role "${profile.role}" for user ${supabaseUser.id}. Defaulting to 'User'. Profile was:`, profile);
  } else {
    // Fallback if profile is null or profile.role is missing
    console.warn(`AuthContext: mapSupabaseUserToAppUser - Profile or role missing for user ${supabaseUser.id}. Defaulting role to 'User'. SupabaseUser email: ${supabaseUser.email}`);
  }


  return {
    id: supabaseUser.id,
    name: profile?.full_name || supabaseUser.email?.split('@')[0] || 'User',
    email: profile?.email || supabaseUser.email || '', // Prefer profile email if available
    role: role,
    avatar: profile?.avatar_url || `https://placehold.co/100x100.png?u=${supabaseUser.id}`,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUserStateInternal] = useState<User | null>(null);
  const [session, setSessionStateInternal] = useState<Session | null>(null);
  const [loading, setLoadingStateInternal] = useState(true); 

  const router = useRouter();
  const pathname = usePathname();

  const setCurrentUser = useCallback((user: User | null) => {
    console.log("AuthContext: setCurrentUser (public) called with:", user ? `${user.email} (Role: ${user.role})` : 'null');
    setCurrentUserStateInternal(user);
  }, []);

  const fetchProfileAndSetUser = useCallback(async (sbUser: SupabaseUser, operationTag: string): Promise<User | null> => {
    console.log(`AuthContext: ${operationTag} - fetchProfileAndSetUser called for user ID: ${sbUser.id}`);
    if (!supabase) {
      console.warn(`AuthContext: ${operationTag} - Supabase client not available. Mapping with minimal data.`);
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
      console.log(`AuthContext: ${operationTag} - AFTER Supabase call for profile ${sbUser.id}. Error:`, profileError, "Profile:", profile);

      if (profileError) {
        console.error(`AuthContext: ${operationTag} - Error fetching profile for user ${sbUser.id}. Code: ${profileError.code}, Message: ${profileError.message}, Details: ${profileError.details}, Hint: ${profileError.hint}`);
        if (profileError.code === 'PGRST116') { // PGRST116 often means "Not found" (0 rows)
          console.warn(`AuthContext: ${operationTag} - Profile not found for user ${sbUser.id}. User might exist in auth.users but not in profiles.`);
        }
        const mapped = mapSupabaseUserToAppUser(sbUser, null); // Map with default/fallback data
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
  }, [supabase]); // Added supabase as dependency as it's used

  useEffect(() => {
    if (!supabase) {
      console.warn("AuthContext: Supabase client not initialized. Auth disabled. Setting loading FALSE.");
      setLoadingStateInternal(false);
      return;
    }

    let isMounted = true;
    console.log("AuthContext: useEffect[] - Mounting. Setting loading TRUE (initial).");
    setLoadingStateInternal(true);

    const checkInitialSession = async () => {
      const operationTag = "initialSession";
      try {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (sessionError) {
          console.error(`AuthContext: ${operationTag} - Error in getSession:`, sessionError);
          setCurrentUserStateInternal(null);
          setSessionStateInternal(null);
          return;
        }

        console.log(`AuthContext: ${operationTag} - getSession done. User: ${currentSession?.user?.id || 'null'}`);
        setSessionStateInternal(currentSession);
        if (currentSession?.user) {
          await fetchProfileAndSetUser(currentSession.user, operationTag);
        } else {
          setCurrentUserStateInternal(null);
        }
      } catch (error) {
        if (!isMounted) return;
        console.error(`AuthContext: ${operationTag} - EXCEPTION during initial session check:`, error);
        setCurrentUserStateInternal(null);
        setSessionStateInternal(null);
      } finally {
        if (isMounted) {
          console.log(`AuthContext: ${operationTag} - FINALLY. Setting loading FALSE.`);
          setLoadingStateInternal(false);
        }
      }
    };

    checkInitialSession();

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
          setLoadingStateInternal(true);
          try {
            await fetchProfileAndSetUser(newSession.user, operationTag);
          } catch (e) {
            console.error(`AuthContext: ${operationTag} - Error after fetchProfileAndSetUser in onAuthStateChange:`, e);
            // CurrentUser already set to fallback by fetchProfileAndSetUser's internal catch
          } finally {
            if (isMounted) {
              console.log(`AuthContext: ${operationTag} - User path FINALLY. Setting loading FALSE.`);
              setLoadingStateInternal(false);
            }
          }
        } else {
          console.log(`AuthContext: ${operationTag} - No user session. Setting currentUser null & loading FALSE.`);
          setCurrentUserStateInternal(null);
          setLoadingStateInternal(false); // Directly set loading false if no user
        }
      }
    );

    return () => {
      console.log("AuthContext: useEffect[] - Unmounting. Cleaning up auth listener.");
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, fetchProfileAndSetUser, setCurrentUser]); // Dependencies for the main effect

  // Effect for redirection based on auth state - this depends on the *state values*
  useEffect(() => {
    console.log(`AuthContextGuard: State for redirect check - loading: ${loading}, currentUser: ${!!currentUser}, pathname: ${pathname}`);
    if (!loading && !currentUser && !pathname.startsWith('/auth')) {
      console.log("AuthContextGuard: Redirecting to /auth/login because no user and not on auth page.");
      router.push('/auth/login');
    }
  }, [currentUser, loading, pathname, router]);

  const logout = async () => {
    if (!supabase) {
      console.warn("AuthContext: logout - Supabase client not available. Mock logout.");
      setCurrentUserStateInternal(null);
      setSessionStateInternal(null);
      setLoadingStateInternal(false);
      return;
    }
    
    console.log("AuthContext: logout - Initiating. Setting loading TRUE.");
    setLoadingStateInternal(true);
    const { error } = await supabase.auth.signOut();
    
    // onAuthStateChange should handle resetting currentUser and session.
    // setLoadingStateInternal(false) will be handled by onAuthStateChange when session becomes null.
    if (error) {
      console.error("AuthContext: logout - Error signing out:", error);
      // If onAuthStateChange doesn't fire or fails, ensure loading is false as a fallback
      if (isMounted) { // Check if component is still mounted
        console.log("AuthContext: logout - Error path. Setting loading FALSE as fallback.");
        setLoadingStateInternal(false);
      }
    } else {
      console.log("AuthContext: logout - signOut successful. onAuthStateChange will handle state reset.");
      // Explicitly set current user to null here to speed up UI reaction if needed,
      // though onAuthStateChange is the primary mechanism.
      // setCurrentUserStateInternal(null); 
      // setSessionStateInternal(null);
    }
  };
  
  const isAdmin = currentUser?.role === 'Admin';

  // This local `isMounted` is for the logout function's async nature
  let isMounted = true;
  useEffect(() => {
    isMounted = true;
    return () => {
      isMounted = false;
    };
  }, []);

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
