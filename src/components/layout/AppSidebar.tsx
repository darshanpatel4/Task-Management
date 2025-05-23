
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter, SidebarContent, SidebarSeparator } from '@/components/ui/sidebar';
import { LayoutDashboard, ListChecks, Users, Settings, BrainCircuit, LogOut, FolderKanban, CheckCircle2, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { NavItem } from '@/types';
import { cn } from '@/lib/utils';

// Define navigation items
// "Create New User" is now a button on the User Management page itself, so it's removed from direct sidebar nav.
const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  // Admin-specific items
  { href: '/admin/projects', label: 'Projects', icon: FolderKanban, adminOnly: true },
  { href: '/admin/users', label: 'User Management', icon: Users, adminOnly: true },
  { href: '/admin/approvals', label: 'Task Approvals', icon: CheckCircle2, adminOnly: true },
  { href: '/ai-assigner', label: 'AI Assigner', icon: BrainCircuit, adminOnly: true },
  // { href: '/settings', label: 'Settings', icon: Settings }, // General settings if needed, currently commented out
];


export function AppSidebar() {
  const pathname = usePathname();
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };
  
  const renderNavItems = (items: NavItem[]) => {
    return items
      .filter(item => isAdmin || !item.adminOnly) // Filter out adminOnly items if user is not admin
      .map((item) => {
        // Determine if the item or any of its children (if it's a group) is active
        let isItemActive = pathname === item.href;
        if (!isItemActive && item.href !== '/') {
             // Check if current path starts with item's href (for parent items of nested routes)
            isItemActive = pathname.startsWith(item.href + (item.href.endsWith('/') ? '' : '/'));
        }
        // Special handling for dashboard to not be active if on deeper paths
        if (item.href === '/dashboard' && pathname !== '/dashboard') {
            isItemActive = false;
        }
         // Exact match for tasks page
        if (item.href === '/tasks' && pathname !== '/tasks' && !pathname.startsWith('/tasks/')) {
             isItemActive = false;
        }
        if (item.href === '/tasks' && (pathname === '/tasks' || pathname.startsWith('/tasks/'))) {
            isItemActive = true;
        }


        // For admin items, ensure more specific paths correctly highlight the parent
        if (item.adminOnly) {
            if (item.href === '/admin/users' && (pathname.startsWith('/admin/users/create'))) {
                isItemActive = true;
            }
             if (item.href === '/admin/projects' && (pathname.startsWith('/admin/projects/create') /* || pathname.startsWith('/admin/projects/edit') */)) {
                isItemActive = true;
            }
        }
        
        return (
          <SidebarMenuItem key={item.href + item.label}>
            <SidebarMenuButton
              asChild
              isActive={isItemActive}
              tooltip={{ children: item.label, hidden: false }}
            >
              <Link href={item.href}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      });
  }

  return (
    <Sidebar variant="inset" collapsible="icon" side="left">
      <SidebarContent className="flex flex-col">
        {currentUser && (
          <SidebarHeader className="items-center text-center group-data-[collapsible=icon]:hidden">
              <Avatar className="h-16 w-16 mt-2" data-ai-hint="profile avatar">
                <AvatarImage src={currentUser.avatar || `https://placehold.co/100x100.png`} alt={currentUser.name} />
                <AvatarFallback>{currentUser.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="mt-2">
                <p className="font-semibold text-sidebar-foreground">{currentUser.name}</p>
                <p className="text-xs text-sidebar-foreground/70">{currentUser.role}</p>
              </div>
          </SidebarHeader>
        )}
        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
        <SidebarMenu className="flex-1 px-2">
            {renderNavItems(navItems)}
        </SidebarMenu>
        <SidebarSeparator />
        <SidebarFooter className="p-2">
          <SidebarMenuButton
            onClick={handleLogout}
            tooltip={{ children: 'Log Out', hidden: false}}
          >
            <LogOut />
            <span>Log Out</span>
          </SidebarMenuButton>
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
