'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { mockTasks, mockUsers, mockProjects } from '@/lib/mock-data';
import type { Task, TaskStatus, TaskPriority } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, Edit3, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const statusOptions: TaskStatus[] = ['Pending', 'In Progress', 'Completed', 'Approved'];
const priorityOptions: TaskPriority[] = ['Low', 'Medium', 'High'];

export default function TasksPage() {
  const { currentUser, isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState<string | 'all'>('all');

  const tasksToShow = useMemo(() => {
    let tasks = isAdmin ? mockTasks : mockTasks.filter(task => task.assigneeId === currentUser?.id);

    if (searchTerm) {
      tasks = tasks.filter(task =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (statusFilter !== 'all') {
      tasks = tasks.filter(task => task.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
      tasks = tasks.filter(task => task.priority === priorityFilter);
    }
    if (projectFilter !== 'all') {
      tasks = tasks.filter(task => task.projectId === projectFilter);
    }
    return tasks.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [isAdmin, currentUser?.id, searchTerm, statusFilter, priorityFilter, projectFilter]);

  const getStatusVariant = (status: Task['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Pending': return 'secondary';
      case 'In Progress': return 'default';
      case 'Completed': return 'outline';
      case 'Approved': return 'default'; 
      default: return 'secondary';
    }
  };
  
  const getPriorityVariant = (priority: Task['priority']): "default" | "secondary" | "destructive" | "outline" => {
    switch (priority) {
      case 'High': return 'destructive';
      case 'Medium': return 'default'; 
      case 'Low': return 'secondary';
      default: return 'secondary';
    }
  };

  if (!currentUser) return <p>Loading...</p>;

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
            <Button className="mt-4 sm:mt-0">
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
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatus | 'all')}>
              <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as TaskPriority | 'all')}>
              <SelectTrigger><SelectValue placeholder="Filter by priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {priorityOptions.map(priority => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Select value={projectFilter} onValueChange={(value) => setProjectFilter(value as string | 'all')}>
                <SelectTrigger><SelectValue placeholder="Filter by project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {mockProjects.map(project => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {tasksToShow.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  {isAdmin && <TableHead>Assignee</TableHead>}
                  <TableHead>Project</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasksToShow.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                      <Link href={`/tasks/${task.id}`} className="hover:underline text-primary">{task.title}</Link>
                    </TableCell>
                    {isAdmin && <TableCell>{task.assigneeName || 'N/A'}</TableCell>}
                    <TableCell>{task.projectName || 'N/A'}</TableCell>
                    <TableCell>{format(new Date(task.dueDate), 'MMM d, yyyy')}</TableCell>
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
                            <Link href={`/tasks/edit/${task.id}`}> {/* Placeholder for edit page */}
                              <Button variant="ghost" size="icon" aria-label="Edit task">
                                <Edit3 className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Delete task" onClick={() => alert(`Delete task ${task.id}? (mock)`)}>
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
          ) : (
            <p className="text-center text-muted-foreground py-8">No tasks match your criteria.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
