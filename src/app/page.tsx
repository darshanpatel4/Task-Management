'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext'; // Assuming AuthContext is created
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { currentUser, setCurrentUser } = useAuth(); // Use a loading state if AuthContext provides one

  useEffect(() => {
    // Attempt to load from localStorage, AuthProvider does this too but good for direct nav
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            if(currentUser === null) { // only set if not already set by AuthProvider
                setCurrentUser(parsedUser);
            }
            router.replace('/dashboard');
        } catch (error) {
            console.error("Failed to parse stored user", error);
            localStorage.removeItem('currentUser');
            router.replace('/auth/login');
        }
    } else if (currentUser) {
      router.replace('/dashboard');
    } else {
      router.replace('/auth/login');
    }
  }, [currentUser, router, setCurrentUser]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
