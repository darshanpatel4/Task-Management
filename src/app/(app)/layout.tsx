
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

  console.log(`AppLayout: Render - isInitialized: ${isInitialized}, authLoading (context.loading): ${authLoading}, currentUser: ${!!currentUser}, pathname: ${pathname}`);

  useEffect(() => {
    console.log(`AppLayout useEffect for redirect check: isInitialized: ${isInitialized}, authLoading: ${authLoading}, currentUser: ${!!currentUser}, pathname: ${pathname}`);
    if (isInitialized && !authLoading && !currentUser && !pathname.startsWith('/auth')) {
      console.log('AppLayout: Redirecting to /auth/login because not initialized, no user, and not on auth page.');
      router.replace('/auth/login');
    }
  }, [currentUser, authLoading, isInitialized, router, pathname]);

  if (!isInitialized || authLoading) {
    console.log(`AppLayout: Showing main loader because !isInitialized (${!isInitialized}) OR authLoading (${authLoading})`);
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading Application...</p>
      </div>
    );
  }

  // This case should ideally be handled by the useEffect redirect or covered by the above.
  // If isInitialized is true, and authLoading is false, but there's still no currentUser, redirect.
  if (isInitialized && !authLoading && !currentUser && !pathname.startsWith('/auth')) {
    console.log("AppLayout: Rendering redirecting message (should be caught by useEffect redirect).");
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

    