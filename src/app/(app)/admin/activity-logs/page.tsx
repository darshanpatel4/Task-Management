
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Task, TaskLog, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, History, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AggregatedLog extends TaskLog {
  taskTitle: string;
  taskId: string;
  projectName: string;
}

export default function ActivityLogsPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [logs, setLogs] = useState<AggregatedLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllLogs = useCallback(async () => {
    if (!isAdmin) {
      setError("Access Denied. You must be an admin to view this page.");
      setIsLoading(false);
      return;
    }
    if (!supabase) {
      setError("Supabase client not available.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { data: tasksWithLogs, error: fetchError } = await supabase
        .from('tasks')
        .select('id, title, logs, project:projects (name)')
        .not('logs', 'is', null) // Only fetch tasks that have logs
        .neq('logs', '{}') // Ensure logs array is not empty
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      const allLogs: AggregatedLog[] = [];
      tasksWithLogs.forEach(task => {
        if (task.logs && Array.isArray(task.logs)) {
          task.logs.forEach((log: TaskLog) => {
            allLogs.push({
              ...log,
              taskId: task.id,
              taskTitle: task.title,
              projectName: task.project?.name || 'N/A',
            });
          });
        }
      });
      
      // Sort all logs by date in descending order
      allLogs.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
      
      setLogs(allLogs);

    } catch (e: any) {
      console.error('Error fetching activity logs:', e);
      setError(e.message || 'Failed to load activity logs.');
      toast({ title: 'Error', description: e.message || 'Could not load logs.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, toast]);

  useEffect(() => {
    fetchAllLogs();
  }, [fetchAllLogs]);
  
  if (!isLoading && !isAdmin) {
    return (
      <Card className="w-full max-w-md mx-auto mt-10">
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to view this page.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <div>
          <h1 className="text-3xl font-bold tracking-tight">All Activity Logs</h1>
          <p className="text-muted-foreground">A centralized view of all work logged across all tasks.</p>
        </div>
         <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
                {isLoading ? 'Loading...' : `Showing ${logs.length} log entries from all projects.`}
            </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading all activity...</p>
            </div>
          )}
          {error && !isLoading && (
            <div className="text-destructive text-center py-12">
              <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
              <p className="font-semibold">{error}</p>
            </div>
          )}
          {!isLoading && !error && logs.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
                 <History className="mx-auto h-12 w-12 mb-4" />
                 <p className="font-semibold">No Activity Logs Found</p>
                 <p>There are no work logs recorded on any tasks yet.</p>
            </div>
          )}
           {!isLoading && !error && logs.length > 0 && (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="p-4 border rounded-md hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div className="flex-1 mb-2 sm:mb-0">
                        <p className="text-sm font-semibold">{log.userName} logged {log.hoursSpent} hour(s)</p>
                        <p className="text-xs text-muted-foreground">
                            on <Link href={`/tasks/${log.taskId}`} className="text-primary hover:underline font-medium">{log.taskTitle}</Link> in project "{log.projectName}"
                        </p>
                    </div>
                    <p className="text-xs text-muted-foreground self-start sm:self-center">{format(parseISO(log.date), 'MMM d, yyyy - HH:mm')}</p>
                  </div>
                  <p className="mt-2 text-sm bg-muted/50 p-2 rounded-md">{log.workDescription}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
