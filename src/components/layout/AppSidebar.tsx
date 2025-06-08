
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter, SidebarContent, SidebarSeparator } from '@/components/ui/sidebar';
import { LayoutDashboard, ListChecks, Users as UsersIconLucide, LogOut, FolderKanban, CheckCircle2, StickyNote, BookUser } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { NavItem } from '@/types';

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, teamViewable: true },
  { href: '/tasks', label: 'Tasks', icon: ListChecks, teamViewable: true },
  { href: '/notes', label: 'My Notes', icon: BookUser, teamViewable: true, userSpecific: true, activePathPrefix: '/notes' },
  { href: '/members', label: 'Team Members', icon: UsersIconLucide, userSpecific: true, activePathPrefix: '/members' }, // Show for non-admins
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
        if (item.userSpecific) return !isAdmin; // Handles "My Notes" and "Team Members" for non-admins
        return item.teamViewable || isAdmin; // Default visibility for other items
      })
      .map((item) => {
        let isItemActive = pathname === item.href;
        if (item.activePathPrefix && pathname.startsWith(item.activePathPrefix)) {
          isItemActive = true;
        }

        // Specific handling for /tasks to include /tasks/[id] and /tasks/edit/[id] etc.
        if (item.href === '/tasks' && (pathname === '/tasks' || pathname.startsWith('/tasks/'))) {
          isItemActive = true;
        }
        // Specific handling for /admin/users to include sub-routes
        if (item.href === '/admin/users' && (pathname === '/admin/users' || pathname.startsWith('/admin/users/'))) {
            isItemActive = true;
        }
        // Specific handling for /admin/projects to include sub-routes
        if (item.href === '/admin/projects' && (pathname === '/admin/projects' || pathname.startsWith('/admin/projects/'))) {
            isItemActive = true;
        }
        // Specific handling for /admin/notes to include sub-routes
        if (item.href === '/admin/notes' && (pathname === '/admin/notes' || pathname.startsWith('/admin/notes/'))) {
            isItemActive = true;
        }
        // Specific handling for /notes (user's notes)
        if (item.href === '/notes' && (pathname === '/notes' || pathname.startsWith('/notes/'))) {
            isItemActive = true;
        }
         // Specific handling for /members (user's view)
        if (item.href === '/members' && (pathname === '/members' || pathname.startsWith('/members/'))) {
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

