
'use client';

import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, loading: authLoading, isInitialized } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const wasHiddenRef = useRef(false); // To track if the page was ever hidden

  console.log(`AppLayout: Render - isInitialized: ${isInitialized}, authLoading (context.loading): ${authLoading}, currentUser: ${!!currentUser}, pathname: ${pathname}`);

  // Effect for redirection based on auth state
  useEffect(() => {
    console.log(`AppLayout useEffect for redirect check: isInitialized: ${isInitialized}, authLoading: ${authLoading}, currentUser: ${!!currentUser}, pathname: ${pathname}`);
    if (isInitialized && !authLoading && !currentUser && !pathname.startsWith('/auth')) {
      console.log('AppLayout: Redirecting to /auth/login because not initialized, no user, and not on auth page.');
      router.replace('/auth/login');
    }
  }, [currentUser, authLoading, isInitialized, router, pathname]);

  // Effect for reloading on tab refocus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab became hidden
        if (isInitialized) { // Only mark as hidden if app was already up
          wasHiddenRef.current = true;
          console.log('AppLayout: Tab became hidden.');
        }
      } else {
        // Tab became visible
        if (wasHiddenRef.current && isInitialized) {
          console.log('AppLayout: Tab became visible after being hidden. Reloading page.');
          window.location.reload();
        } else {
          console.log('AppLayout: Tab became visible (or was always visible/app not initialized for reload).');
        }
        // Reset wasHiddenRef whether reload happened or not for next hide cycle
        wasHiddenRef.current = false; 
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    console.log('AppLayout: Added visibilitychange listener.');

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      console.log('AppLayout: Removed visibilitychange listener.');
    };
  }, [isInitialized]); // Rerun if isInitialized changes, to correctly capture its state

  if (!isInitialized || authLoading) {
    console.log(`AppLayout: Showing main loader because !isInitialized (${!isInitialized}) OR authLoading (${authLoading})`);
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading Application...</p>
      </div>
    );
  }

  if (!currentUser && !pathname.startsWith('/auth')) {
    // This case should ideally be handled by the useEffect redirect,
    // but serves as a fallback if redirect hasn't happened yet.
    console.log("AppLayout: No current user and not on auth page after initialization. Showing redirecting message.");
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }
  
  console.log("AppLayout: Rendering main app content.");
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="flex flex-col">
          <AppHeader />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-background">
            {children}
          </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
    