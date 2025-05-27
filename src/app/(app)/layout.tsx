
'use client'; // This layout uses client-side hooks like useAuth and useSidebar

import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { SidebarProvider, SidebarInset, Sidebar, SidebarRail } from '@/components/ui/sidebar';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation'; // Added usePathname
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname(); // Get current pathname

  // Log the loading state received by AppLayout
  console.log(`AppLayout: Received loading state: ${loading}, currentUser: ${!!currentUser}`);

  useEffect(() => {
    // This effect is primarily for redirection, AuthContext handles its internal loading state
    // and will trigger re-renders here when its loading state or currentUser changes.
    console.log(`AppLayout useEffect: loading: ${loading}, currentUser: ${!!currentUser}, pathname: ${pathname}`);
    if (!loading && !currentUser && !pathname.startsWith('/auth')) {
      console.log('AppLayout: Redirecting to /auth/login due to no user and not on auth page.');
      router.replace('/auth/login');
    }
  }, [currentUser, loading, router, pathname]);

  if (loading) { // Check loading first
    console.log("AppLayout: Rendering loader because loading is true.");
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) {
    // This case should ideally be caught by the useEffect redirect if not on an auth page.
    // If we reach here and are not on an auth page, it's a brief moment before redirect.
    // Or, if we ARE on an auth page, this prevents rendering app layout for auth pages.
    console.log("AppLayout: Rendering null/redirecting because no currentUser and loading is false.");
    // The useEffect above should handle the redirect.
    // Returning null or a minimal loader here might be appropriate if not on an auth path.
    // For now, rely on the useEffect to redirect. If on /auth/*, this layout shouldn't be active anyway.
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Redirecting...</p>
      </div>
    );
  }
  
  // If loading is false AND currentUser exists, render the app
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
