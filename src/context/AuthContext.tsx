
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
    setCurrentUserState(user);
    // localStorage for currentUser is now managed implicitly by Supabase session persistence
  }, []);

  useEffect(() => {
    if (!supabase) {
      // Supabase client not initialized, fall back to mock data for initial load
      console.log("AuthContext: Supabase not initialized, attempting mock user load.");
      try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          const parsedUser: User = JSON.parse(storedUser);
          setCurrentUserState(parsedUser);
        }
      } catch (error) {
        console.error("Error parsing stored mock user:", error);
        localStorage.removeItem('currentUser');
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user) {
        // Fetch user profile from your 'profiles' table
        const { data: profile, error }_ = await supabase
          .from('profiles') // Ensure you have a 'profiles' table
          .select('*')
          .eq('id', currentSession.user.id)
          .single();
        
        if (profile) {
          setCurrentUserState(mapSupabaseUserToAppUser(currentSession.user, profile));
        } else if (_) {
            console.error('Error fetching profile for Supabase user:', _);
            // Potentially sign out user or handle as anonymous/incomplete profile
            setCurrentUserState(mapSupabaseUserToAppUser(currentSession.user, {})); // Fallback minimal user
        } else {
            // No profile found, but user is authenticated.
            // This might be a new user post-signup before profile creation, or an issue.
            console.warn(`No profile found for user ${currentSession.user.id}. Creating a default one.`);
            // For now, create a default local user object
            setCurrentUserState(mapSupabaseUserToAppUser(currentSession.user, { role: 'User', full_name: currentSession.user.email?.split('@')[0] }));
        }

      } else {
        setCurrentUserState(null);
      }
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        setSession(newSession);
        if (event === 'SIGNED_IN' && newSession?.user) {
          setLoading(true);
          // Fetch user profile from your 'profiles' table
          const { data: profile, error }_ = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newSession.user.id)
            .single();
          
          if (profile) {
            setCurrentUserState(mapSupabaseUserToAppUser(newSession.user, profile));
          } else if (_) {
            console.error('Error fetching profile on SIGNED_IN:', _);
            setCurrentUserState(mapSupabaseUserToAppUser(newSession.user, {})); // Fallback
          } else {
             console.warn(`No profile found for user ${newSession.user.id} on SIGNED_IN. Creating a default one.`);
             setCurrentUserState(mapSupabaseUserToAppUser(newSession.user, { role: 'User', full_name: newSession.user.email?.split('@')[0] }));
          }
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUserState(null);
        } else if (event === 'USER_UPDATED' && newSession?.user) {
            // Handle user updates if profile might change
            const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newSession.user.id)
            .single();
            if (profile) {
                 setCurrentUserState(mapSupabaseUserToAppUser(newSession.user, profile));
            }
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router]); // Add router to dependencies if it's used in profile fetching logic for redirects

  useEffect(() => {
    if (!loading && !currentUser && !pathname.startsWith('/auth')) {
      router.push('/auth/login');
    }
  }, [currentUser, loading, pathname, router]);

  const logout = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Error logging out:', error);
    }
    setCurrentUserState(null); // Ensure local state is cleared
    setSession(null);
    localStorage.removeItem('currentUser'); // Clear mock user if it was set
    router.push('/auth/login');
  };
  
  // Mock login for fallback if Supabase is not configured
  const mockLogin = (email: string, name?: string): User | null => {
    console.log("Using mock login for:", email);
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
      setCurrentUser(user); // Uses the useCallback version
      localStorage.setItem('currentUser', JSON.stringify(user)); // Persist mock user
      return user;
    }
    return null;
  };
  
  // Expose mockLogin for forms to use as fallback
  (AuthContext as any).mockLogin = mockLogin; 


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
  // Expose mockLogin through useAuth if needed, or forms can access it via context directly if made public
  return { ...context, mockLogin: (AuthContext as any).mockLogin };
};
