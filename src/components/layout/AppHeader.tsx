
'use client';

import Link from 'next/link';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { LogOut, UserCircle, Moon, Sun, Bell, Package, Briefcase, CheckCircle2, Check, MessageSquare, History } from 'lucide-react'; // Removed Settings icon
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
import { useState, useEffect, useCallback } from 'react';
import type { NotificationItem, NotificationType } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

export function AppHeader() {
  const { currentUser, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { isMobile } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser || !supabase) {
      console.log("AppHeader: Fetch notifications skipped - no current user or supabase client.");
      return;
    }
    setIsLoadingNotifications(true);
    try {
      const { data, error, count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(10); 

      if (error) throw error;
      
      console.log("AppHeader: Fetched notifications:", data);
      setNotifications(data || []);
      const currentUnread = (data || []).filter(n => !n.is_read).length;
      setUnreadCount(currentUnread);
      console.log("AppHeader: Unread count set to:", currentUnread);

    } catch (err: any) {
      console.error('AppHeader: Error fetching notifications. Code:', err.code, 'Message:', err.message, 'Details:', err.details, 'Hint:', err.hint, 'Full Error:', err);
      toast({ title: 'Error', description: 'Could not fetch notifications.', variant: 'destructive' });
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
    }
  }, [currentUser, fetchNotifications]);

  useEffect(() => {
    if (!currentUser || !supabase) return;
    const channel = supabase
      .channel(`notifications:${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` },
        (payload) => {
          console.log('AppHeader: New notification received via realtime:', payload.new);
          // Add to start of notifications list & update unread count
          setNotifications(prev => [payload.new as NotificationItem, ...prev.slice(0,9)]); // Keep list to 10
          setUnreadCount(prev => prev + 1);
          toast({title: "New Notification", description: (payload.new as NotificationItem).message});
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('AppHeader: Subscribed to notifications channel for user:', currentUser.id);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('AppHeader: Error subscribing to notifications channel. Status:', status, 'Error:', err);
        }
      });
    return () => {
      console.log('AppHeader: Unsubscribing from notifications channel for user:', currentUser.id);
      supabase.removeChannel(channel);
    };
  }, [currentUser, toast]);


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

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!supabase) return;
    
    if (!notification.is_read) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);

      if (error) {
        console.error('AppHeader: Error marking notification as read. Code:', error.code, 'Message:', error.message, 'Details:', error.details, 'Hint:', error.hint, 'Full Error:', error);
        toast({ title: 'Error', description: 'Could not mark notification as read.', variant: 'destructive' });
      } else {
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
    
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser || !supabase || notifications.filter(n => !n.is_read).length === 0) return;

    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds)
      .eq('user_id', currentUser.id);

    if (error) {
      console.error('AppHeader: Error marking all notifications as read. Code:', error.code, 'Message:', error.message, 'Details:', error.details, 'Hint:', error.hint, 'Full Error:', error);
      toast({ title: 'Error', description: 'Could not mark all notifications as read.', variant: 'destructive' });
    } else {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast({ title: 'Success', description: 'All notifications marked as read.'});
    }
  };

  if (!mounted) {
    return <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6"></div>;
  }

  const getNotificationIcon = (type?: NotificationType) => {
    switch (type) {
      case 'new_comment': return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'task_assigned': return <UserCircle className="h-4 w-4 text-green-500" />;
      case 'task_approved': return <CheckCircle2 className="h-4 w-4 text-purple-500" />;
      case 'task_completed_for_approval': return <CheckCircle2 className="h-4 w-4 text-orange-500" />;
      case 'new_log': return <History className="h-4 w-4 text-indigo-500" />;
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
          <DropdownMenu onOpenChange={(open) => { if(open) fetchNotifications(); }}>
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
                 {notifications.filter(n => !n.is_read).length > 0 && (
                    <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={handleMarkAllAsRead} disabled={isLoadingNotifications}>
                        <Check className="mr-1 h-3 w-3"/> Mark all as read
                    </Button>
                 )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isLoadingNotifications ? (
                 <DropdownMenuItem disabled className="flex justify-center text-muted-foreground py-4">Loading...</DropdownMenuItem>
              ) : notifications.length === 0 ? (
                <DropdownMenuItem disabled className="text-center text-muted-foreground py-4">No new notifications</DropdownMenuItem>
              ) : (
                <DropdownMenuGroup className="max-h-80 overflow-y-auto">
                  {notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`cursor-pointer ${!notification.is_read ? 'font-semibold bg-accent/20 hover:bg-accent/40' : 'hover:bg-accent/10'}`}
                    >
                      <div className="flex items-start gap-2 py-1 w-full">
                        <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                        <div className="flex-1">
                          <p className="text-sm leading-snug whitespace-normal">{notification.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                         {!notification.is_read && (
                            <div className="ml-auto flex-shrink-0 self-center">
                                <div className="h-2 w-2 rounded-full bg-primary"></div>
                            </div>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              )}
               <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="justify-center text-sm text-muted-foreground cursor-default">
                  {/* Link to a full notifications page could go here if implemented */}
                  {/* View all notifications */}
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
              {/* Settings link removed from here */}
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
