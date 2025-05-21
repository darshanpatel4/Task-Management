'use client';

import { useAuth } from '@/context/AuthContext';
import { mockTasks, mockUsers, mockProjects } from '@/lib/mock-data';
import type { Task, User, Project } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Users, ListChecks, CheckCircle2, FolderKanban } from 'lucide-react';
import { format } from 'date-fns';

// Helper function to get initials
const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

export default function DashboardPage() {
  const { currentUser, isAdmin } = useAuth();

  if (!currentUser) {
    return <p>Loading...</p>; // Or a redirect, though layout should handle this
  }

  const userTasks = mockTasks.filter(task => task.assigneeId === currentUser.id);
  const pendingApprovalTasks = isAdmin ? mockTasks.filter(task => task.status === 'Completed') : [];

  const getStatusVariant = (status: Task['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Pending': return 'secondary';
      case 'In Progress': return 'default';
      case 'Completed': return 'outline';
      case 'Approved': return 'default'; // Using 'default' which is primary based theme for approved
      default: return 'secondary';
    }
  };
  
  const getPriorityVariant = (priority: Task['priority']): "default" | "secondary" | "destructive" | "outline" => {
    switch (priority) {
      case 'High': return 'destructive';
      case 'Medium': return 'default'; // Using 'default' (primary) for medium
      case 'Low': return 'secondary';
      default: return 'secondary';
    }
  };


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {currentUser.name}!</h1>
          <p className="text-muted-foreground">Here&apos;s your overview for today.</p>
        </div>
        {isAdmin && (
          <Link href="/tasks/create">
            <Button className="mt-4 sm:mt-0">Create New Task</Button>
          </Link>
        )}
      </div>

      {/* Admin Specific Dashboard */}
      {isAdmin && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockUsers.length}</div>
              <p className="text-xs text-muted-foreground">Manage all registered users</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <ListChecks className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockTasks.length}</div>
              <p className="text-xs text-muted-foreground">Across all projects</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingApprovalTasks.length}</div>
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
              <div className="text-2xl font-bold">{mockProjects.length}</div>
               <Link href="/projects" className="text-xs text-primary hover:underline">
                Manage projects
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User & Admin: Assigned Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>{isAdmin ? 'Recently Active Tasks' : 'Your Assigned Tasks'}</CardTitle>
          <CardDescription>
            {isAdmin ? 'Overview of tasks being actively worked on.' : 'Tasks assigned to you. Stay on top of your work!'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(isAdmin ? mockTasks.slice(0,5) : userTasks).length > 0 ? (
            <ul className="space-y-4">
              {(isAdmin ? mockTasks.slice(0,5).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : userTasks).map((task) => (
                <li key={task.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border hover:shadow-md transition-shadow">
                  <div className="flex-1 mb-2 sm:mb-0">
                    <Link href={`/tasks/${task.id}`} className="font-semibold text-primary hover:underline">
                      {task.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      Project: {task.projectName || 'N/A'} - Due: {format(new Date(task.dueDate), 'PPP')}
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
          ) : (
            <p className="text-muted-foreground">
              {isAdmin ? 'No tasks found.' : 'You have no tasks assigned. Great job, or time to ask for more!'}
            </p>
          )}
        </CardContent>
      </Card>
      
      {/* More sections can be added here, e.g., recent activity, project summaries */}
    </div>
  );
}
