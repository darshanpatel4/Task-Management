'use client';

import type { User } from '@/types';
import { mockUsers, getUserByEmail as findUserByEmail } from '@/lib/mock-data';
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  login: (email: string, name?: string) => User | null;
  logout: () => void;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const setCurrentUser = useCallback((user: User | null) => {
    setCurrentUserState(user);
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, []);
  
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        const parsedUser: User = JSON.parse(storedUser);
        setCurrentUserState(parsedUser);
      }
    } catch (error) {
      console.error("Error parsing stored user:", error);
      localStorage.removeItem('currentUser');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && !currentUser && !pathname.startsWith('/auth')) {
      router.push('/auth/login');
    }
  }, [currentUser, loading, pathname, router]);


  const login = (email: string, name?: string): User | null => {
    let user = findUserByEmail(email);
    
    if (!user && name) { // Simulate signup if name is provided and user not found
      const newUser: User = {
        id: `user${mockUsers.length + 1}`,
        name,
        email,
        role: email.includes('admin') ? 'Admin' : 'User', // Simple role assignment for demo
        avatar: `https://placehold.co/100x100.png?new=${mockUsers.length + 1}`
      };
      mockUsers.push(newUser); // Add to mock data (in a real app, this would be a DB call)
      user = newUser;
    } else if (!user) {
        // Fallback for login if user not explicitly found, useful for quick testing
        const isAdminAttempt = email.toLowerCase().includes('admin');
        if (isAdminAttempt) {
            user = mockUsers.find(u => u.role === 'Admin') || mockUsers[0];
        } else {
            user = mockUsers.find(u => u.role === 'User' && u.email.toLowerCase().includes('user')) || mockUsers[1] || mockUsers[0];
        }
    }

    if (user) {
      setCurrentUser(user);
      return user;
    }
    return null;
  };

  const logout = () => {
    setCurrentUser(null);
    router.push('/auth/login');
  };

  const isAdmin = currentUser?.role === 'Admin';

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, login, logout, isAdmin, loading }}>
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
