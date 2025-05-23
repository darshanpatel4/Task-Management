
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Task, User, Project } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Users, ListChecks, CheckCircle2, FolderKanban, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  totalUsers: number;
  totalTasks: number;
  pendingApprovals: number;
  activeProjects: number;
}

export default function DashboardPage() {
  const { currentUser, isAdmin } = useAuth();
  const { toast } = useToast();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [displayedTasks, setDisplayedTasks] = useState<Task[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || !supabase) {
      console.log("Dashboard: currentUser or Supabase client not available. Skipping data fetch.", { hasCurrentUser: !!currentUser, hasSupabase: !!supabase });
      setIsLoadingStats(false);
      setIsLoadingTasks(false);
      if (!currentUser && !pathname.startsWith('/auth')) router.push('/auth/login'); // Redirect if not logged in
      return;
    }

    async function fetchDashboardData() {
      console.log("Dashboard: Starting data fetch.");
      setIsLoadingStats(true);
      setIsLoadingTasks(true);
      setError(null);

      try {
        // Fetch Stats
        if (isAdmin) {
          console.log("Dashboard: Admin detected, fetching all stats.");
          const [
            { count: totalUsersCount, error: usersError },
            { count: totalTasksCount, error: tasksError },
            { count: pendingApprovalsCount, error: approvalsError },
            { count: activeProjectsCount, error: projectsError },
          ] = await Promise.all([
            supabase.from('profiles').select('*', { count: 'exact', head: true }),
            supabase.from('tasks').select('*', { count: 'exact', head: true }),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'Completed'),
            supabase.from('projects').select('*', { count: 'exact', head: true }),
          ]);

          if (usersError) { console.error('Dashboard: Error fetching users count:', usersError); throw new Error(`Users count: ${usersError.message}`); }
          if (tasksError) { console.error('Dashboard: Error fetching tasks count:', tasksError); throw new Error(`Tasks count: ${tasksError.message}`); }
          if (approvalsError) { console.error('Dashboard: Error fetching approvals count:', approvalsError); throw new Error(`Approvals count: ${approvalsError.message}`); }
          if (projectsError) { console.error('Dashboard: Error fetching projects count:', projectsError); throw new Error(`Projects count: ${projectsError.message}`); }
          
          console.log("Dashboard: Stats fetched.", { totalUsersCount, totalTasksCount, pendingApprovalsCount, activeProjectsCount });
          setStats({
            totalUsers: totalUsersCount || 0,
            totalTasks: totalTasksCount || 0,
            pendingApprovals: pendingApprovalsCount || 0,
            activeProjects: activeProjectsCount || 0,
          });
        }
        setIsLoadingStats(false);

        // Fetch Tasks
        console.log("Dashboard: Fetching tasks.");
        let tasksQuery = supabase
          .from('tasks')
          .select('*, project:projects(name), assignee:profiles(full_name, avatar_url)')
          .order('created_at', { ascending: false });

        if (isAdmin) {
          tasksQuery = tasksQuery.limit(5);
          console.log("Dashboard: Admin task query (limit 5).");
        } else {
          tasksQuery = tasksQuery.eq('assignee_id', currentUser.id);
          console.log(`Dashboard: User task query for assignee_id: ${currentUser.id}.`);
        }

        const { data: tasksData, error: tasksFetchError } = await tasksQuery;

        if (tasksFetchError) {
          console.error('Dashboard: Error fetching tasks:', tasksFetchError);
          throw new Error(`Tasks fetch: ${tasksFetchError.message}`);
        }

        const mappedTasks: Task[] = tasksData?.map(task => ({
          ...task,
          id: task.id,
          title: task.title,
          description: task.description,
          dueDate: task.due_date,
          createdAt: task.created_at,
          assigneeName: task.assignee?.full_name || 'N/A',
          assigneeId: task.assignee_id,
          projectName: task.project?.name || 'N/A',
          projectId: task.project_id,
          priority: task.priority as TaskPriority,
          status: task.status as TaskStatus,
          project: undefined, 
          assignee: undefined,
        })) || [];
        
        console.log("Dashboard: Tasks mapped.", { count: mappedTasks.length });
        setDisplayedTasks(mappedTasks);

      } catch (e: any) {
        console.error('Dashboard: Overall fetch error:', e);
        setError(e.message || 'Could not load dashboard data.');
        toast({ title: 'Error Loading Dashboard', description: e.message || 'Could not load dashboard data.', variant: 'destructive' });
      } finally {
        console.log("Dashboard: Fetch attempt finished.");
        setIsLoadingStats(false);
        setIsLoadingTasks(false);
      }
    }

    fetchDashboardData();
  }, [currentUser, isAdmin, toast]); // Removed router and pathname as they are not direct dependencies for fetching data

  const getStatusVariant = (status?: Task['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Pending': return 'secondary';
      case 'In Progress': return 'default';
      case 'Completed': return 'outline';
      case 'Approved': return 'default';
      default: return 'secondary';
    }
  };
  
  const getPriorityVariant = (priority?: Task['priority']): "default" | "secondary" | "destructive" | "outline" => {
    switch (priority) {
      case 'High': return 'destructive';
      case 'Medium': return 'default';
      case 'Low': return 'secondary';
      default: return 'secondary';
    }
  };

  // Ensure router and pathname are defined if used outside useEffect or for Auth guard-like behavior.
  // However, the primary data loading doesn't depend on them directly changing.
  const router = useRouter();
  const pathname = usePathname();


  if (isLoadingStats || isLoadingTasks) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Dashboard</h2>
        <p>{error}</p>
         <Button variant="outline" onClick={() => { /* Re-trigger fetch or use a dedicated function */ 
            if (currentUser && supabase) {
                setIsLoadingStats(true); setIsLoadingTasks(true); setError(null);
                // Re-call an effect-like function here if needed or manage state to re-trigger useEffect
                 useEffect(() => { // This is a conceptual re-trigger, actual re-fetch needs state change
                    // ... fetch logic
                 }, []); // This example is illustrative, a state change is better
            }
         }} disabled={!currentUser || !supabase}>Try Again</Button>
      </div>
    );
  }
  
  if (!currentUser) { // Fallback, AuthContext should handle redirects
    return <p>Please log in to view the dashboard.</p>;
  }


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {currentUser?.name}!</h1>
          <p className="text-muted-foreground">Here&apos;s your overview for today.</p>
        </div>
        {isAdmin && (
          <Link href="/tasks/create">
            <Button className="mt-4 sm:mt-0">Create New Task</Button>
          </Link>
        )}
      </div>

      {isAdmin && stats && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <Link href="/admin/users" className="text-xs text-primary hover:underline">
                Manage users
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <ListChecks className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTasks}</div>
              <Link href="/tasks" className="text-xs text-primary hover:underline">
                View all tasks
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
              <Link href="/admin/approvals" className="text-xs text-primary hover:underline">
                View approval queue
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeProjects}</div>
               <Link href="/admin/projects" className="text-xs text-primary hover:underline">
                Manage projects
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isAdmin ? 'Recently Active Tasks' : 'Your Assigned Tasks'}</CardTitle>
          <CardDescription>
            {isAdmin ? 'Overview of tasks being actively worked on.' : 'Tasks assigned to you. Stay on top of your work!'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTasks && !error && <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /> <span className="ml-2">Loading tasks...</span></div>}
          {!isLoadingTasks && !error && displayedTasks.length === 0 && (
             <p className="text-muted-foreground text-center py-4">
              {isAdmin ? 'No recent tasks found.' : 'You have no tasks assigned.'}
            </p>
          )}
          {!isLoadingTasks && !error && displayedTasks.length > 0 && (
            <ul className="space-y-4">
              {displayedTasks.map((task) => (
                <li key={task.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border hover:shadow-md transition-shadow">
                  <div className="flex-1 mb-2 sm:mb-0">
                    <Link href={`/tasks/${task.id}`} className="font-semibold text-primary hover:underline">
                      {task.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      Project: {task.projectName || 'N/A'} - Due: {task.dueDate ? format(new Date(task.dueDate), 'PPP') : 'N/A'}
                    </p>
                    {isAdmin && <p className="text-xs text-muted-foreground">Assigned to: {task.assigneeName}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getPriorityVariant(task.priority)} className="capitalize">{task.priority}</Badge>
                    <Badge variant={getStatusVariant(task.status)} className="capitalize">{task.status}</Badge>
                    <Link href={`/tasks/${task.id}`}>
                      <Button variant="ghost" size="sm">
                        View <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
