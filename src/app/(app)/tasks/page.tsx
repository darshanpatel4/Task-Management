
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import type { Task, TaskStatus, TaskPriority, Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, Edit3, Trash2, Eye, Loader2, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

const statusOptions: TaskStatus[] = ['Pending', 'In Progress', 'Completed', 'Approved'];
const priorityOptions: TaskPriority[] = ['Low', 'Medium', 'High'];

export default function TasksPage() {
  const { currentUser, isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState<string | 'all'>('all');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectsForFilter, setProjectsForFilter] = useState<Pick<Project, 'id' | 'name'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigneeDetailsMap, setAssigneeDetailsMap] = useState<Record<string, { name: string }>>({});


  const fetchTasksAndRelatedData = useCallback(async () => {
    if (authLoading || !currentUser || !supabase) {
      setIsLoading(false);
      if (!authLoading && !currentUser) setError("User not authenticated.");
      else if (!supabase) setError("Supabase client not available.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isAdmin) {
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('id, name')
          .order('name', { ascending: true });
        if (projectError) throw projectError;
        setProjectsForFilter(projectData || []);
      }

      let query = supabase
        .from('tasks')
        .select('id, title, description, due_date, created_at, assignee_ids, project_id, priority, status, user_id, project:projects!inner(name)')
        .order('created_at', { ascending: false });

      if (!isAdmin && currentUser?.id) {
        query = query.filter('assignee_ids', 'cs', `{${currentUser.id}}`); // Use contains for array
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }
      if (projectFilter !== 'all' && isAdmin) {
        query = query.eq('project_id', projectFilter);
      }
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      const { data: tasksData, error: tasksError } = await query;

      if (tasksError) throw tasksError;

      const mappedTasks: Task[] = tasksData?.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.due_date,
        createdAt: task.created_at,
        assignee_ids: task.assignee_ids || [], // Ensure it's an array
        projectId: task.project_id,
        projectName: task.project?.name || 'N/A',
        priority: task.priority as TaskPriority,
        status: task.status as TaskStatus,
        user_id: task.user_id,
      })) || [];
      setTasks(mappedTasks);

      if (isAdmin && mappedTasks.length > 0) {
        const allAssigneeIds = [...new Set(mappedTasks.flatMap(t => t.assignee_ids || []).filter(id => id))] as string[];
        if (allAssigneeIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', allAssigneeIds);
          
          if (profilesError) {
            console.error('TasksPage: Error fetching assignee names:', profilesError);
          } else {
            const namesMap: Record<string, { name: string }> = {};
            profilesData?.forEach(p => { namesMap[p.id] = { name: p.full_name || 'N/A' }; });
            setAssigneeDetailsMap(namesMap);
          }
        }
      }


    } catch (e: any) {
      console.error('Error fetching tasks or projects:', e);
      setError(e.message || 'Failed to load data.');
      toast({ title: 'Error', description: e.message || 'Could not load data.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, isAdmin, searchTerm, statusFilter, priorityFilter, projectFilter, toast, authLoading]);

  useEffect(() => {
    if (!authLoading) {
        fetchTasksAndRelatedData();
    }
  }, [authLoading, fetchTasksAndRelatedData]);


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

  const handleDeleteTask = async (taskId: string) => {
    if (!supabase) {
        toast({ title: "Supabase Not Configured", description: `Cannot delete task ${taskId}.`, variant: "destructive" });
        return;
    }
    if (confirm(`Are you sure you want to delete task ${taskId}? This action cannot be undone.`)) {
        try {
            setIsLoading(true); 
            const { error: deleteError } = await supabase.from('tasks').delete().match({ id: taskId });
            if (deleteError) throw deleteError;
            toast({ title: "Task Deleted", description: `Task ${taskId} has been deleted.` });
            fetchTasksAndRelatedData(); 
        } catch (e: any) {
            toast({ title: "Error Deleting Task", description: e.message || "Could not delete task.", variant: "destructive" });
        } finally {
            if (isLoading) setIsLoading(false);
        }
    }
  };

  const displayAssignees = (assigneeIds?: string[] | null) => {
    if (!assigneeIds || assigneeIds.length === 0) return 'Unassigned';
    if (assigneeIds.length === 1) return assigneeDetailsMap[assigneeIds[0]]?.name || 'Loading...';
    return `${assigneeIds.length} Assignees`;
  };


  if (authLoading) {
      return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Authenticating...</p>
        </div>
    );
  }


  if (!currentUser && !isLoading) { 
      return <p>Redirecting to login...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Management</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Oversee and manage all tasks.' : 'View and manage your assigned tasks.'}
          </p>
        </div>
        {isAdmin && (
          <Link href="/tasks/create">
            <Button className="mt-4 sm:mt-0" disabled={isLoading || !supabase}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create Task
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full"
                disabled={isLoading}
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatus | 'all')} disabled={isLoading}>
              <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as TaskPriority | 'all')} disabled={isLoading}>
              <SelectTrigger><SelectValue placeholder="Filter by priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {priorityOptions.map(priority => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Select value={projectFilter} onValueChange={(value) => setProjectFilter(value as string | 'all')} disabled={isLoading || projectsForFilter.length === 0}>
                <SelectTrigger><SelectValue placeholder="Filter by project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projectsForFilter.map(project => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading tasks...</p>
            </div>
          )}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error Loading Tasks</p>
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchTasksAndRelatedData} disabled={!supabase}>
                Try Again
              </Button>
            </div>
          )}
          {!isLoading && !error && tasks.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No tasks match your criteria.</p>
          )}
          {!isLoading && !error && tasks.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  {isAdmin && <TableHead>Assignees</TableHead>}
                  <TableHead>Project</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                      <Link href={`/tasks/${task.id}`} className="hover:underline text-primary">{task.title}</Link>
                    </TableCell>
                    {isAdmin && <TableCell>{displayAssignees(task.assignee_ids)}</TableCell>}
                    <TableCell>{task.projectName || 'N/A'}</TableCell>
                    <TableCell>{task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy') : 'N/A'}</TableCell>
                    <TableCell><Badge variant={getPriorityVariant(task.priority)} className="capitalize">{task.priority}</Badge></TableCell>
                    <TableCell><Badge variant={getStatusVariant(task.status)} className="capitalize">{task.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/tasks/${task.id}`}>
                          <Button variant="ghost" size="icon" aria-label="View task">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {isAdmin && (
                          <>
                            <Link href={`/tasks/edit/${task.id}`}> 
                              <Button variant="ghost" size="icon" aria-label="Edit task" disabled={!supabase || isLoading}>
                                <Edit3 className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:text-destructive" 
                              aria-label="Delete task" 
                              onClick={() => handleDeleteTask(task.id)}
                              disabled={!supabase || isLoading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
