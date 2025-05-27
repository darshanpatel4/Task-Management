
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter, SidebarContent, SidebarSeparator } from '@/components/ui/sidebar';
import { LayoutDashboard, ListChecks, Users, LogOut, FolderKanban, CheckCircle2, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { NavItem } from '@/types';
import { cn } from '@/lib/utils';


const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/admin/projects', label: 'Projects', icon: FolderKanban, adminOnly: true },
  { href: '/admin/users', label: 'User Management', icon: Users, adminOnly: true, activePathPrefix: '/admin/users' },
  { href: '/admin/approvals', label: 'Task Approvals', icon: CheckCircle2, adminOnly: true },
  // { href: '/ai-assigner', label: 'AI Assigner', icon: BrainCircuit, adminOnly: true }, // Removed AI Assigner
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
      .filter(item => isAdmin || !item.adminOnly) 
      .map((item) => {
        // Check if the item itself is active
        let isItemActive = pathname === item.href;
        
        // If it's a group and has an activePathPrefix, check if current path starts with it
        if (item.activePathPrefix && pathname.startsWith(item.activePathPrefix)) {
          isItemActive = true;
        }
        
        // Specific handling for /tasks to include /tasks/[id] and /tasks/edit/[id]
        if (item.href === '/tasks' && (pathname === '/tasks' || pathname.startsWith('/tasks/'))) {
          isItemActive = true;
        }
         // Specific handling for /admin/users to include /admin/users/create
        if (item.href === '/admin/users' && (pathname === '/admin/users' || pathname.startsWith('/admin/users/'))) {
            isItemActive = true;
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
