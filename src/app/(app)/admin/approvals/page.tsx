'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { mockTasks, mockUsers, mockProjects } from '@/lib/mock-data';
import type { Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';


export default function ApprovalsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  // Local state to manage tasks for this demo page
  const [tasks, setTasks] = useState<Task[]>(mockTasks);

  const pendingApprovalTasks = useMemo(() => {
    return tasks.filter(task => task.status === 'Completed').sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tasks]);


  if (!isAdmin) {
     return (
      <div className="flex items-center justify-center h-full">
          <Card className="w-full max-w-md">
              <CardHeader>
                  <CardTitle>Access Denied</CardTitle>
                  <CardDescription>You do not have permission to view this page.</CardDescription>
              </CardHeader>
              <CardContent>
                  <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
              </CardContent>
          </Card>
      </div>
    );
  }
  
  const handleApprove = (taskId: string) => {
    setTasks(prevTasks => prevTasks.map(task => 
      task.id === taskId ? { ...task, status: 'Approved' } : task
    ));
    // Also update the global mockTasks array for consistency across the app in this demo
    const taskIndex = mockTasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) mockTasks[taskIndex].status = 'Approved';
    toast({ title: "Task Approved", description: `Task ID ${taskId} has been approved.`});
  };

  const handleReject = (taskId: string) => {
     setTasks(prevTasks => prevTasks.map(task => 
      task.id === taskId ? { ...task, status: 'In Progress' } : task // Or 'Pending' / new status 'Rejected'
    ));
    const taskIndex = mockTasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) mockTasks[taskIndex].status = 'In Progress';
    toast({ title: "Task Rejected", description: `Task ID ${taskId} has been sent back to 'In Progress'.`, variant: "destructive"});
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Task Approvals</h1>
        <p className="text-muted-foreground">Review and approve tasks marked as completed.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Approval Queue</CardTitle>
          <CardDescription>{pendingApprovalTasks.length > 0 ? `There are ${pendingApprovalTasks.length} tasks awaiting your approval.` : 'No tasks are currently pending approval.'}</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingApprovalTasks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Completed On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApprovalTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                       <Link href={`/tasks/${task.id}`} className="hover:underline text-primary">{task.title}</Link>
                    </TableCell>
                    <TableCell>{task.assigneeName || 'N/A'}</TableCell>
                    <TableCell>{task.projectName || 'N/A'}</TableCell>
                    <TableCell>{format(new Date(task.dueDate), 'MMM d, yyyy')}</TableCell> {/* Assuming dueDate is completion date for now */}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/tasks/${task.id}`}>
                          <Button variant="ghost" size="icon" aria-label="View task details">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={() => handleApprove(task.id)} aria-label="Approve task">
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleReject(task.id)} aria-label="Reject task">
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">All caught up! No tasks to approve.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
