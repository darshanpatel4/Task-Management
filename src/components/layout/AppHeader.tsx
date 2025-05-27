
'use client';

import Link from 'next/link';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { LogOut, UserCircle, Settings, Moon, Sun, Bell, Package, Briefcase, CheckCircle2 } from 'lucide-react'; // Added CheckCircle2
import { useRouter } from 'next/navigation';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import type { NotificationItem } from '@/types';
import { formatDistanceToNow } from 'date-fns';

// Mock notifications for demo
const initialNotifications: NotificationItem[] = [
  { id: '1', message: "Alice commented on 'Deploy new feature'", link: '/tasks/task1', createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), isRead: false, type: 'new_comment' },
  { id: '2', message: "Task 'Setup CI/CD' was approved", link: '/tasks/task2', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), isRead: false, type: 'task_approved' },
  { id: '3', message: "You were assigned to 'Design Homepage'", link: '/tasks/task3', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), isRead: true, type: 'task_assigned' },
];


export function AppHeader() {
  const { currentUser, logout } = useAuth();
  const router = useRouter();
  const { isMobile } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(initialNotifications.filter(n => !n.isRead).length);

  useEffect(() => {
    setMounted(true);
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (storedTheme) {
      setTheme(storedTheme);
      document.documentElement.classList.toggle('dark', storedTheme === 'dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    if (notification.link) {
      router.push(notification.link);
    }
    // Simulate marking as read - in a real app, this would update backend
    setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => prev > 0 ? prev -1 : 0); // Simplistic unread count update
  };
  
  const handleOpenNotifications = (open: boolean) => {
    if (open) {
      // Simulate marking all as read when dropdown is opened for this demo
      // In a real app, you might mark them as read on click or have a "Mark all as read" button
      // For simplicity, we'll just clear the visual badge count here.
      // Actual 'isRead' state of individual notifications would need more robust handling.
      setUnreadCount(0); 
    }
  };


  if (!mounted) {
    // Render a placeholder or skeleton for the header during SSR or initial mount
    // to avoid layout shifts and ensure consistent height.
    return <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6"></div>;
  }

  const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'new_comment': return <Briefcase className="h-4 w-4 text-blue-500" />;
      case 'task_assigned': return <UserCircle className="h-4 w-4 text-green-500" />;
      case 'task_approved': return <CheckCircle2 className="h-4 w-4 text-purple-500" />;
      default: return <Package className="h-4 w-4 text-gray-500" />;
    }
  };


  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6">
      <div className="flex items-center gap-2">
        {isMobile && <SidebarTrigger />}
        <Link href="/dashboard" className="text-xl font-bold text-primary">
          TaskFlow AI
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </Button>

        {currentUser && (
          <DropdownMenu onOpenChange={handleOpenNotifications}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 w-4 min-w-4 p-0 flex items-center justify-center text-xs rounded-full"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 md:w-96" align="end">
              <DropdownMenuLabel className="flex justify-between items-center">
                <span>Notifications</span>
                 {/* <Button variant="link" size="sm" className="p-0 h-auto text-xs">Mark all as read</Button> */}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <DropdownMenuItem disabled className="text-center text-muted-foreground py-4">No new notifications</DropdownMenuItem>
              ) : (
                <DropdownMenuGroup className="max-h-80 overflow-y-auto">
                  {notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`cursor-pointer ${!notification.isRead ? 'font-semibold' : ''}`}
                    >
                      <div className="flex items-start gap-2 py-1">
                        <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                        <div className="flex-1">
                          <p className="text-sm leading-snug">{notification.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              )}
               <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/notifications')} className="justify-center text-sm text-primary hover:underline">
                  View all notifications
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {currentUser ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9" data-ai-hint="profile avatar">
                  <AvatarImage src={currentUser.avatar || `https://placehold.co/100x100.png`} alt={currentUser.name} />
                  <AvatarFallback>{currentUser.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{currentUser.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {currentUser.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/profile')}>
                <UserCircle className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button onClick={() => router.push('/auth/login')}>Login</Button>
        )}
      </div>
    </header>
  );
}
