
'use client'; // This layout uses client-side hooks like useAuth and useSidebar

import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { SidebarProvider, SidebarInset, Sidebar, SidebarRail } from '@/components/ui/sidebar';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react'; // Added useRef
import { Loader2 } from 'lucide-react';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, loading: authLoading, isInitialized } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const wasHiddenRef = useRef(typeof document !== 'undefined' ? document.hidden : false);

  // Log the loading state received by AppLayout
  console.log(`AppLayout: Received states - isInitialized: ${isInitialized}, authLoading: ${authLoading}, currentUser: ${!!currentUser}`);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        console.warn('AppLayout: Tab refocused after being hidden. Reloading page as a workaround for potential stuck loading state.');
        window.location.reload();
      }
      wasHiddenRef.current = document.hidden;
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      // Set initial state of wasHiddenRef based on current visibility
      wasHiddenRef.current = document.hidden;
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []); // Empty dependency array, so it runs once on mount and cleans up on unmount

  useEffect(() => {
    console.log(`AppLayout useEffect for redirect check: isInitialized: ${isInitialized}, authLoading: ${authLoading}, currentUser: ${!!currentUser}, pathname: ${pathname}`);
    if (isInitialized && !authLoading && !currentUser && !pathname.startsWith('/auth')) {
      console.log('AppLayout: Redirecting to /auth/login due to no user and not on auth page after initialization.');
      router.replace('/auth/login');
    }
  }, [currentUser, authLoading, isInitialized, router, pathname]);

  if (!isInitialized || authLoading) {
    console.log("AppLayout: Rendering main loader because app is not initialized or auth is loading.");
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading Application...</p>
      </div>
    );
  }

  if (!currentUser && !pathname.startsWith('/auth')) {
    // This case should ideally be caught by the useEffect redirect.
    // If we reach here, it's a brief moment before redirect or if the redirect logic fails.
    console.log("AppLayout: No current user and not on auth path, rendering redirecting message (should be temporary).");
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }
  
  // If initialized, not authLoading, AND currentUser exists (or on an auth page), render the app
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
      <SidebarRail />
    </SidebarProvider>
  );
}
