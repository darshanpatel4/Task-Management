
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
  loading: boolean;
  isInitialized: boolean;
  session: Session | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser | null, profile: any | null): User | null => {
  if (!supabaseUser) return null;

  let role: UserRole = 'User';
  if (profile && (profile.role === 'Admin' || profile.role === 'User')) {
    role = profile.role;
  } else if (profile && profile.role) {
    console.warn(`Unknown role "${profile.role}" for user ${supabaseUser.id}. Defaulting to 'User'.`);
  }

  return {
    id: supabaseUser.id,
    name: profile?.full_name || supabaseUser.email?.split('@')[0] || 'User',
    email: profile?.email || supabaseUser.email || '',
    role: role,
    avatar: profile?.avatar_url || `https://placehold.co/100x100.png?u=${supabaseUser.id}`,
    position: profile?.position || null, // Include position
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUserState, setCurrentUserStateInternal] = useState<User | null>(null);
  const [sessionState, setSessionStateInternal] = useState<Session | null>(null);
  const [loadingState, setLoadingStateInternal] = useState(true);
  const [isInitializedState, setIsInitializedStateInternal] = useState(false);
  const isMountedRef = useRef(false);


  const setCurrentUser = useCallback((user: User | null) => {
    if (isMountedRef.current) {
      setCurrentUserStateInternal(user);
    }
  }, []);

  const fetchProfileAndSetUser = useCallback(async (sbUser: SupabaseUser, operationTag: string): Promise<User | null> => {
    console.log(`AuthContext: fetchProfileAndSetUser called for ${sbUser.id} from ${operationTag}`);
    if (currentUserState?.id === sbUser.id && currentUserState?.email === sbUser.email && currentUserState.name !== 'User' && sbUser.email) {
      // Check if essential profile data likely already exists to avoid unnecessary fetches.
      // This check needs to be robust; for example, if name is still default, profile might not be fully loaded.
      console.log(`AuthContext: Profile for ${sbUser.id} likely already loaded or being loaded, skipping redundant fetch from ${operationTag}. Current user name: ${currentUserState.name}`);
      if (isMountedRef.current) { // Ensure loading is set to false if we skip
         // setLoadingStateInternal(false); // This might be too aggressive, only set if truly done
      }
      return currentUserState;
    }

    if (!supabase) {
      console.warn('AuthContext: Supabase client not available during profile fetch.');
      const mapped = mapSupabaseUserToAppUser(sbUser, null);
      if (isMountedRef.current) setCurrentUserStateInternal(mapped);
      return mapped;
    }

    console.log(`AuthContext: BEFORE Supabase call for profile ${sbUser.id} from ${operationTag}`);
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url, position') // Select position
        .eq('id', sbUser.id)
        .single();
      console.log(`AuthContext: AFTER Supabase call for profile ${sbUser.id} from ${operationTag}. Profile:`, profile, "Error:", profileError);

      if (profileError) {
        console.error(`AuthContext: Error fetching profile for ${sbUser.id} from ${operationTag}: ${profileError.message}. Code: ${profileError.code}`);
        if (profileError.code === 'PGRST116' && operationTag !== 'initialSession') { // PGRST116: 0 rows
          console.warn(`AuthContext: Profile not found for ${sbUser.id}, possibly a new user. Trigger should create it.`);
           // For a very new user, the trigger might not have finished. We'll rely on onAuthStateChange or next fetch.
           // Don't nullify currentUserState here if it was already set by a previous successful SIGNED_IN.
           const mappedWithoutProfile = mapSupabaseUserToAppUser(sbUser, null);
           if(isMountedRef.current) setCurrentUserStateInternal(mappedWithoutProfile);
           return mappedWithoutProfile;
        }
        const mapped = mapSupabaseUserToAppUser(sbUser, null);
        if (isMountedRef.current) setCurrentUserStateInternal(mapped);
        return mapped;
      }
      
      const mapped = mapSupabaseUserToAppUser(sbUser, profile);
      if (isMountedRef.current) setCurrentUserStateInternal(mapped);
      return mapped;
    } catch (e: any) {
      console.error(`AuthContext: Exception during profile fetch for ${sbUser.id} from ${operationTag}: ${e.message}`);
      const mapped = mapSupabaseUserToAppUser(sbUser, null);
      if (isMountedRef.current) setCurrentUserStateInternal(mapped);
      return mapped;
    }
  }, [currentUserState]); // Added supabase as dependency, as fetchProfileAndSetUser uses it.

  useEffect(() => {
    isMountedRef.current = true;
    console.log("AuthContext: Component mounted. isMountedRef set to true.");

    if (!supabase) {
      console.warn("AuthContext: Supabase client not initialized. Auth features may be limited or use mocks.");
      if (isMountedRef.current) {
        setLoadingStateInternal(false);
        setIsInitializedStateInternal(true);
      }
      return () => { isMountedRef.current = false; console.log("AuthContext: Component unmounted. isMountedRef set to false."); };
    }

    console.log("AuthContext: Initializing auth state...");
    if (isMountedRef.current) setLoadingStateInternal(true);

    supabase.auth.getSession().then(async ({ data: { session: currentSession }, error: sessionError }) => {
      console.log("AuthContext: Initial getSession completed. isMountedRef:", isMountedRef.current);
      if (!isMountedRef.current) {
        console.log("AuthContext: Initial getSession result ignored, component unmounted.");
        return;
      }

      if (sessionError) {
        console.error("AuthContext: Initial getSession error:", sessionError);
        setCurrentUserStateInternal(null);
        setSessionStateInternal(null);
      } else {
        console.log("AuthContext: Initial session data:", currentSession);
        setSessionStateInternal(currentSession);
        if (currentSession?.user) {
          console.log("AuthContext: User found in initial session, fetching profile...");
          await fetchProfileAndSetUser(currentSession.user, "initialSession");
        } else {
          console.log("AuthContext: No user in initial session.");
          setCurrentUserStateInternal(null);
        }
      }
    }).catch(error => {
      if (!isMountedRef.current) return;
      console.error("AuthContext: Initial getSession exception:", error);
      setCurrentUserStateInternal(null);
      setSessionStateInternal(null);
    }).finally(() => {
      if (!isMountedRef.current) return;
      console.log("AuthContext: Initial auth setup finished. Setting loading to false, initialized to true.");
      setLoadingStateInternal(false);
      setIsInitializedStateInternal(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        if (!isMountedRef.current) {
          console.log(`AuthContext: onAuthStateChange event '${event}' ignored, component unmounted.`);
          return;
        }
        console.log(`AuthContext: onAuthStateChange event: ${event}, session:`, newSession);
        
        if (isMountedRef.current) setSessionStateInternal(newSession);

        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
          if (newSession?.user) {
            if (isMountedRef.current) setLoadingStateInternal(true);
            await fetchProfileAndSetUser(newSession.user, `onAuthChange-${event}`);
            if (isMountedRef.current) setLoadingStateInternal(false);
          } else if (event === 'SIGNED_IN' && !newSession?.user) {
             // This can happen if token is invalid or user removed during an active session attempt
             console.warn(`AuthContext: SIGNED_IN event but no user in session. Resetting currentUser.`);
             if(isMountedRef.current) setCurrentUserStateInternal(null);
          }
        } else if (event === 'SIGNED_OUT') {
          if (isMountedRef.current) {
            setCurrentUserStateInternal(null);
            // setSessionStateInternal(null); // Already handled by the line above
          }
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('AuthContext: Token refreshed. Session updated. User profile fetch not typically needed unless other user details changed.');
          // If user data might change with token refresh (unlikely for profile details usually), uncomment:
          // if (newSession?.user) {
          //   setLoadingStateInternal(true);
          //   await fetchProfileAndSetUser(newSession.user, "onAuthChange-TOKEN_REFRESHED");
          //   setLoadingStateInternal(false);
          // }
        }
        // Ensure loading is false after handling, unless it's an unhandled case that might need it true
        if (isMountedRef.current && (event !== 'SIGNED_IN' && event !== 'USER_UPDATED' && event !== 'INITIAL_SESSION')) {
            // setLoadingStateInternal(false); // Potentially problematic if another async op is pending
        }
         if (isMountedRef.current && !isInitializedState) { // Ensure initialized is set true after first event if not by getSession
            setIsInitializedStateInternal(true);
         }
      }
    );
    console.log("AuthContext: onAuthStateChange listener subscribed.");

    return () => {
      isMountedRef.current = false;
      console.log("AuthContext: Component unmounted. Unsubscribing onAuthStateChange listener. isMountedRef set to false.");
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, fetchProfileAndSetUser, setCurrentUser, isInitializedState]); // Added supabase, fetchProfileAndSetUser, setCurrentUser

  const logout = async () => {
    if (!supabase) {
      console.warn("AuthContext: Supabase client not available. Mock logout.");
      if (isMountedRef.current) {
        setCurrentUserStateInternal(null);
        setSessionStateInternal(null);
        setLoadingStateInternal(false); // Ensure loading is false on mock logout
      }
      return;
    }
    
    if (isMountedRef.current) setLoadingStateInternal(true);
    try {
      console.log("AuthContext: Signing out...");
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("AuthContext: Error signing out:", error);
      }
      // onAuthStateChange will handle setting currentUser and session to null
      console.log("AuthContext: Sign out successful (or error handled by onAuthStateChange).");
    } catch (e) {
      console.error("AuthContext: Exception during signout:", e);
    } finally {
       if (isMountedRef.current) {
        // State resets are handled by onAuthStateChange, but ensure loading is false
        // setLoadingStateInternal(false); // This might be set by onAuthStateChange too.
       }
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
