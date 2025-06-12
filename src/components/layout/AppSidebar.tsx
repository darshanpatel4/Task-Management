
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter, SidebarContent, SidebarSeparator } from '@/components/ui/sidebar';
import { LayoutDashboard, ListChecks, Users as UsersIconLucide, LogOut, FolderKanban, CheckCircle2, StickyNote, BookUser, Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { NavItem } from '@/types';

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, teamViewable: true },
  { href: '/tasks', label: 'Tasks', icon: ListChecks, teamViewable: true, activePathPrefix: '/tasks' },
  { href: '/log-work', label: 'Log Work', icon: Clock, userSpecific: true, activePathPrefix: '/log-work' }, 
  { href: '/notes', label: 'My Notes', icon: BookUser, teamViewable: true, userSpecific: true, activePathPrefix: '/notes' },
  { href: '/members', label: 'Team Members', icon: UsersIconLucide, userSpecific: true, activePathPrefix: '/members' }, 
  { href: '/admin/projects', label: 'Projects', icon: FolderKanban, adminOnly: true, activePathPrefix: '/admin/projects' },
  { href: '/admin/users', label: 'User Management', icon: UsersIconLucide, adminOnly: true, activePathPrefix: '/admin/users' },
  { href: '/admin/approvals', label: 'Task Approvals', icon: CheckCircle2, adminOnly: true, activePathPrefix: '/admin/approvals' },
  { href: '/admin/notes', label: 'Manage Notes', icon: StickyNote, adminOnly: true, activePathPrefix: '/admin/notes' },
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
      .filter(item => {
        if (item.adminOnly) return isAdmin;
        if (item.userSpecific) return !isAdmin; // Show if userSpecific is true AND user is NOT admin
        return item.teamViewable || isAdmin; // Fallback for general team viewable items or admin view
      })
      .map((item) => {
        let isItemActive = pathname === item.href;
        if (item.activePathPrefix && pathname.startsWith(item.activePathPrefix)) {
            isItemActive = true;
        }
        if (pathname === item.href) {
            isItemActive = true;
        }
        
        // Special case for /tasks and /log-work. If on /tasks/create or /tasks/[id], /tasks should be active.
        // If on /log-work, /log-work should be active.
        if (item.href === '/tasks' && (pathname.startsWith('/tasks/') || pathname === '/log-work')) {
             // If current item is 'Tasks' and path is /log-work, 'Tasks' should NOT be active
            if (pathname === '/log-work') isItemActive = false;
        }
        if (item.href === '/log-work' && pathname === '/log-work') {
            isItemActive = true;
        }


        return (
          <SidebarMenuItem key={item.href + item.label + (item.userSpecific ? '-user' : '') + (item.adminOnly ? '-admin' : '')}>
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
                <p className="text-xs text-sidebar-foreground/70 capitalize">{currentUser.position || currentUser.role}</p>
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
