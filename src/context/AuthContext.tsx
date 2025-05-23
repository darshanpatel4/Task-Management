
'use client';

import type { User } from '@/types';
import { mockUsers, getUserByEmail as findUserByEmailMock } from '@/lib/mock-data';
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client
import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js';

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void; // Kept for potential direct use, though Supabase handles session
  logout: () => Promise<void>;
  isAdmin: boolean;
  loading: boolean;
  session: Session | null; // Expose Supabase session
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to map Supabase user and profile to your app's User type
const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser, profile: any): User => {
  return {
    id: supabaseUser.id, // Use Supabase user ID
    name: profile?.full_name || supabaseUser.email?.split('@')[0] || 'User',
    email: supabaseUser.email || '',
    role: profile?.role || 'User', // Get role from your 'profiles' table
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
    console.log("AuthContext: setCurrentUser called with:", user);
    setCurrentUserState(user);
  }, []);

  useEffect(() => {
    console.log("AuthContext: Initial effect running. Supabase client available?", !!supabase);
    if (!supabase) {
      console.warn("AuthContext: Supabase client not initialized. Attempting mock user load.");
      setLoading(true); // Start loading
      try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          const parsedUser: User = JSON.parse(storedUser);
          console.log("AuthContext: Loaded mock user from localStorage:", parsedUser);
          setCurrentUserState(parsedUser);
        } else {
          console.log("AuthContext: No mock user in localStorage.");
          setCurrentUserState(null);
        }
      } catch (error) {
        console.error("AuthContext: Error parsing stored mock user:", error);
        localStorage.removeItem('currentUser');
        setCurrentUserState(null);
      }
      setLoading(false); // Finish loading
      return;
    }

    console.log("AuthContext: Supabase client is available. Setting up auth listener and getSession.");
    setLoading(true);
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log("AuthContext: getSession() returned, session:", currentSession);
      setSession(currentSession);
      if (currentSession?.user) {
        console.log("AuthContext: User found in session. Fetching profile for user ID:", currentSession.user.id);
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentSession.user.id)
          .single();
        
        if (profileError) {
            console.error('AuthContext: Error fetching profile for Supabase user:', profileError);
            // Potentially sign out user or handle as anonymous/incomplete profile
            setCurrentUserState(mapSupabaseUserToAppUser(currentSession.user, { full_name: 'Error User', role: 'User' })); // Fallback minimal user on error
        } else if (profile) {
          console.log("AuthContext: Profile fetched successfully:", profile);
          setCurrentUserState(mapSupabaseUserToAppUser(currentSession.user, profile));
        } else {
            console.warn(`AuthContext: No profile found for user ${currentSession.user.id}. Using default user object.`);
            setCurrentUserState(mapSupabaseUserToAppUser(currentSession.user, { role: 'User', full_name: currentSession.user.email?.split('@')[0] || 'Guest' }));
        }
      } else {
        console.log("AuthContext: No active Supabase session found.");
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
        setLoading(true); // Set loading true while processing auth change

        if (event === 'SIGNED_IN' && newSession?.user) {
          console.log("AuthContext: SIGNED_IN. Fetching profile for user ID:", newSession.user.id);
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newSession.user.id)
            .single();
          
          if (profileError) {
            console.error('AuthContext: Error fetching profile on SIGNED_IN:', profileError);
            setCurrentUserState(mapSupabaseUserToAppUser(newSession.user, { full_name: 'Error User', role: 'User' })); // Fallback
          } else if (profile) {
             console.log("AuthContext: Profile fetched successfully on SIGNED_IN:", profile);
             setCurrentUserState(mapSupabaseUserToAppUser(newSession.user, profile));
          } else {
             console.warn(`AuthContext: No profile found for user ${newSession.user.id} on SIGNED_IN. Using default.`);
             setCurrentUserState(mapSupabaseUserToAppUser(newSession.user, { role: 'User', full_name: newSession.user.email?.split('@')[0] || 'Guest' }));
          }
        } else if (event === 'SIGNED_OUT') {
          console.log("AuthContext: SIGNED_OUT.");
          setCurrentUserState(null);
        } else if (event === 'USER_UPDATED' && newSession?.user) {
            console.log("AuthContext: USER_UPDATED. Fetching profile for user ID:", newSession.user.id);
            const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newSession.user.id)
            .single();
            if (profileError) {
                console.error('AuthContext: Error fetching profile on USER_UPDATED:', profileError);
                // Potentially keep existing user data or map with defaults
                if(currentUser?.id === newSession.user.id) { // only update if it's the same user being updated
                    setCurrentUserState(mapSupabaseUserToAppUser(newSession.user, currentUser)); // try to preserve some old details
                } else {
                    setCurrentUserState(mapSupabaseUserToAppUser(newSession.user, { full_name: 'Updated User', role: 'User' }));
                }
            } else if (profile) {
                 console.log("AuthContext: Profile fetched successfully on USER_UPDATED:", profile);
                 setCurrentUserState(mapSupabaseUserToAppUser(newSession.user, profile));
            } else {
                // User exists, but profile not found.
                 console.warn(`AuthContext: No profile found for user ${newSession.user.id} on USER_UPDATED. Using default.`);
                 setCurrentUserState(mapSupabaseUserToAppUser(newSession.user, { role: 'User', full_name: newSession.user.email?.split('@')[0] || 'Guest' }));
            }
        } else if (event === 'INITIAL_SESSION') {
            // This event often fires along with getSession, handled above.
            // If no user in newSession, it means no active session.
            if (!newSession?.user) {
                console.log("AuthContext: INITIAL_SESSION with no user.");
                setCurrentUserState(null);
            }
        }
        setLoading(false); // Finish loading after handling the auth event
      }
    );

    return () => {
      console.log("AuthContext: Unsubscribing auth listener.");
      authListener?.subscription.unsubscribe();
    };
  }, [router, setCurrentUser]); // Added setCurrentUser to dependency array

  useEffect(() => {
    console.log("AuthContext: Current state - loading:", loading, "currentUser:", !!currentUser, "pathname:", pathname);
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
    setCurrentUserState(null); // Ensure local state is cleared
    setSession(null);
    localStorage.removeItem('currentUser'); // Clear mock user if it was set
    console.log("AuthContext: Redirecting to /auth/login after logout.");
    router.push('/auth/login');
  };
  
  const mockLogin = (email: string, name?: string): User | null => {
    console.warn("AuthContext: Using MOCK LOGIN for:", email);
    let user = findUserByEmailMock(email);
    if (!user && name) { 
      const newUser: User = {
        id: `user${mockUsers.length + 1}`, name, email,
        role: email.includes('admin') ? 'Admin' : 'User',
        avatar: `https://placehold.co/100x100.png?new=${mockUsers.length + 1}`
      };
      mockUsers.push(newUser); user = newUser;
    } else if (!user) {
        const isAdminAttempt = email.toLowerCase().includes('admin');
        user = isAdminAttempt ? (mockUsers.find(u => u.role === 'Admin') || mockUsers[0])
                              : (mockUsers.find(u => u.role === 'User' && u.email.toLowerCase().includes('user')) || mockUsers[1] || mockUsers[0]);
    }
    if (user) {
      setCurrentUser(user); 
      localStorage.setItem('currentUser', JSON.stringify(user));
      console.log("AuthContext: Mock login successful for:", user);
      return user;
    }
    console.log("AuthContext: Mock login failed for:", email);
    return null;
  };
  
  (AuthContext as any).mockLogin = mockLogin; 


  const isAdmin = currentUser?.role === 'Admin';
  console.log("AuthContext: isAdmin determined as:", isAdmin, "currentUser role:", currentUser?.role);

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
  return { ...context, mockLogin: (AuthContext as any).mockLogin };
};

