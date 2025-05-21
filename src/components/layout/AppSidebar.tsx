'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarSeparator } from '@/components/ui/sidebar';
import { LayoutDashboard, ListChecks, Users, Settings, BrainCircuit, LogOut, Briefcase, FolderKanban, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { NavItem } from '@/types';
import { cn } from '@/lib/utils';

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/projects', label: 'Projects', icon: FolderKanban, adminOnly: true },
  { href: '/ai-assigner', label: 'AI Assigner', icon: BrainCircuit, adminOnly: true },
  { 
    href: '/admin', 
    label: 'Admin Panel', 
    icon: Settings, 
    adminOnly: true,
    children: [
        { href: '/admin/users', label: 'User Management', icon: Users, adminOnly: true },
        { href: '/admin/approvals', label: 'Task Approvals', icon: CheckCircle2, adminOnly: true },
    ]
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { currentUser, isAdmin, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };
  
  const renderNavItems = (items: NavItem[], isSubmenu = false) => {
    return items.filter(item => isAdmin || !item.adminOnly).map((item) => (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          asChild
          isActive={pathname.startsWith(item.href)}
          tooltip={{ children: item.label, hidden: false }}
          className={cn(isSubmenu && "pl-8")}
        >
          <Link href={item.href}>
            <item.icon />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
        {item.children && item.children.length > 0 && pathname.startsWith(item.href) && (
            <SidebarMenu className="pl-4">
                {renderNavItems(item.children, true)}
            </SidebarMenu>
        )}
      </SidebarMenuItem>
    ));
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
