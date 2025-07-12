
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
  mockLogin: (email: string, name?: string) => User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const generateInitials = (name: string | undefined | null): string => {
  if (!name) return 'U';
  const nameParts = name.split(' ');
  let initials = (nameParts[0]?.[0] || '');
  if (nameParts.length > 1 && nameParts[1]?.[0]) {
    initials += nameParts[1][0];
  }
  return initials.toUpperCase() || 'U';
};

const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser | null, profile: any | null): User | null => {
  if (!supabaseUser) return null;

  let role: UserRole = 'User';
  if (profile && (profile.role === 'Admin' || profile.role === 'User')) {
    role = profile.role;
  } else if (profile && profile.role) {
    // Original line with template literal that caused parsing error:
    // console.warn(`Unknown role "${profile.role}" for user ${supabaseUser.id}. Defaulting to 'User'.`);
    // Rewritten line using string concatenation:
    console.warn("Unknown role \"" + profile.role + "\" for user " + supabaseUser.id + ". Defaulting to 'User'.");
  }

  const name = profile?.full_name || supabaseUser.email?.split('@')[0] || 'User';
  const initials = generateInitials(name);
  // If profile.avatar_url is null, undefined, or an empty string, use placeholder
  const avatarUrl = profile?.avatar_url && profile.avatar_url.trim() !== '' ? profile.avatar_url : `https://placehold.co/100x100.png?text=${initials}`;


  return {
    id: supabaseUser.id,
    name: name,
    email: profile?.email || supabaseUser.email || '', // Ensure email is present
    role: role,
    avatar: avatarUrl,
    position: profile?.position || null,
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
      console.log(`AuthContext: Profile for ${sbUser.id} likely already loaded or being loaded, skipping redundant fetch from ${operationTag}. Current user name: ${currentUserState.name}`);
      if (isMountedRef.current) { 
         // setLoadingStateInternal(false); 
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
        .select('id, full_name, email, role, avatar_url, position')
        .eq('id', sbUser.id)
        .single();
      console.log(`AuthContext: AFTER Supabase call for profile ${sbUser.id} from ${operationTag}. Profile:`, profile, "Error:", profileError);

      if (profileError) {
        console.error(`AuthContext: Error fetching profile for ${sbUser.id} from ${operationTag}: ${profileError.message}. Code: ${profileError.code}`);
        if (profileError.code === 'PGRST116' && operationTag !== 'initialSession') { 
          console.warn(`AuthContext: Profile not found for ${sbUser.id}, possibly a new user. Trigger should create it.`);
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
  }, [currentUserState]); 

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
             console.warn(`AuthContext: SIGNED_IN event but no user in session. Resetting currentUser.`);
             if(isMountedRef.current) setCurrentUserStateInternal(null);
          }
        } else if (event === 'SIGNED_OUT') {
          if (isMountedRef.current) {
            setCurrentUserStateInternal(null);
          }
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('AuthContext: Token refreshed. Session updated.');
        }
        
         if (isMountedRef.current && !isInitializedState) { 
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
  }, [fetchProfileAndSetUser, setCurrentUser, isInitializedState]); 

  const logout = async () => {
    if (!supabase) {
      console.warn("AuthContext: Supabase client not available. Mock logout.");
      if (isMountedRef.current) {
        setCurrentUserStateInternal(null);
        setSessionStateInternal(null);
        setLoadingStateInternal(false); 
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
      console.log("AuthContext: Sign out successful (or error handled by onAuthStateChange).");
    } catch (e) {
      console.error("AuthContext: Exception during signout:", e);
    }
  };
  
  const mockLogin = (email: string, name?: string): User | null => {
    if (email === 'admin@taskflow.ai') {
      const adminUser: User = { id: 'mock-admin-id', name: name || 'Mock Admin', email, role: 'Admin', avatar: `https://placehold.co/100x100.png?text=A` };
      setCurrentUser(adminUser);
      return adminUser;
    }
    if (email.endsWith('@taskflow.ai')) {
      const user: User = { id: 'mock-user-id', name: name || 'Mock User', email, role: 'User', avatar: `https://placehold.co/100x100.png?text=U` };
      setCurrentUser(user);
      return user;
    }
    return null;
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
      session: sessionState,
      mockLogin
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
