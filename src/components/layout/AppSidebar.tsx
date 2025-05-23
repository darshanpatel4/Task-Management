
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter, SidebarContent, SidebarSeparator } from '@/components/ui/sidebar'; // Removed SidebarGroup, SidebarGroupLabel
import { LayoutDashboard, ListChecks, Users, Settings, BrainCircuit, LogOut, FolderKanban, CheckCircle2, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { NavItem } from '@/types';
import { cn } from '@/lib/utils';

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: ListChecks }, // For all users (non-admin too)
  // Admin-specific top-level items:
  { href: '/admin/users', label: 'User Management', icon: Users, adminOnly: true },
  { href: '/admin/users/create', label: 'Create New User', icon: UserPlus, adminOnly: true },
  { href: '/admin/approvals', label: 'Task Approvals', icon: CheckCircle2, adminOnly: true },
  { href: '/admin/projects', label: 'Project Management', icon: FolderKanban, adminOnly: true },
  { href: '/ai-assigner', label: 'AI Assigner', icon: BrainCircuit, adminOnly: true },
  // General settings, available to all logged-in users
  // If settings should also be admin only, add adminOnly: true
  // { href: '/settings', label: 'Settings', icon: Settings }, 
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
      .filter(item => isAdmin || !item.adminOnly) // Filter based on admin status
      .map((item) => {
        // Determine if the current item or any of its children is active
        const isItemActive = pathname.startsWith(item.href);
        
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
            {/* Child rendering logic removed as we flatten admin items */}
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
