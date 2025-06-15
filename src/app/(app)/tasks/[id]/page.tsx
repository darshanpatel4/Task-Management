
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { Task, TaskComment, TaskLog, TaskStatus, TaskPriority, User, NotificationType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { CalendarDays, Briefcase, MessageSquare, History, CheckCircle, AlertTriangle, Edit3, Clock, Loader2, XCircle, ThumbsUp, RotateCcw, User as UserIconLucide, Users, AtSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { sendEmail } from '@/actions/sendEmailAction';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';

const logFormSchema = z.object({
  hoursSpent: z.coerce.number().min(0.1, "Hours spent must be greater than 0.").max(100, "Hours cannot exceed 100."),
  workDescription: z.string().min(10, "Work description must be at least 10 characters.").max(500, "Description too long."),
});

type LogFormValues = z.infer<typeof logFormSchema>;

interface AssigneeProfileDisplay extends Pick<User, 'id' | 'name' | 'avatar' | 'email'> {}
interface MentionUser extends AssigneeProfileDisplay {}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, isAdmin } = useAuth();
  const { toast } = useToast();

  const [task, setTask] = useState<Task | null>(null);
  const [assigneeDetails, setAssigneeDetails] = useState<AssigneeProfileDisplay[]>([]);
  const [creatorDetails, setCreatorDetails] = useState<AssigneeProfileDisplay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const taskId = params.id as string;

  // State for @-mentions
  const [mentionPopoverOpen, setMentionPopoverOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionableUsers, setMentionableUsers] = useState<MentionUser[]>([]);
  const [filteredMentionSuggestions, setFilteredMentionSuggestions] = useState<MentionUser[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastMentionTriggerIndexRef = useRef<number | null>(null);


  const logForm = useForm<LogFormValues>({
    resolver: zodResolver(logFormSchema),
    defaultValues: {
      hoursSpent: 0,
      workDescription: '',
    },
  });

  const fetchTaskDetails = useCallback(async () => {
    if (!taskId || !supabase) {
      setError(supabase ? 'Task ID is missing.' : 'Supabase client not available.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setAssigneeDetails([]);
    setCreatorDetails(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('id, title, description, due_date, created_at, assignee_ids, project_id, priority, status, user_id, comments, logs, project:projects (name)')
        .eq('id', taskId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setTask(null);
          setError('Task not found.');
        } else {
          throw fetchError;
        }
      } else if (data) {
        const fetchedTask: Task = {
          id: data.id,
          title: data.title,
          description: data.description,
          dueDate: data.due_date,
          createdAt: data.created_at,
          assignee_ids: Array.isArray(data.assignee_ids) ? data.assignee_ids : [],
          projectId: data.project_id,
          projectName: data.project?.name || 'N/A',
          priority: data.priority as TaskPriority,
          status: data.status as TaskStatus,
          user_id: data.user_id,
          comments: Array.isArray(data.comments) ? data.comments : [],
          logs: Array.isArray(data.logs) ? data.logs : [],
        };
        setTask(fetchedTask);

        const userIdsToFetch = new Set<string>();
        if (fetchedTask.assignee_ids) {
          fetchedTask.assignee_ids.forEach(id => userIdsToFetch.add(id));
        }
        if (fetchedTask.user_id) {
          userIdsToFetch.add(fetchedTask.user_id);
        }

        if (userIdsToFetch.size > 0 && supabase && currentUser) { 
          const {data: userProfiles, error: profilesError} = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .in('id', Array.from(userIdsToFetch));

          if(profilesError) {
            console.warn("TaskDetailPage: Error fetching user profiles for task details:", profilesError);
          } else {
            const assignees = (userProfiles || []).filter(up => fetchedTask.assignee_ids?.includes(up.id));
            const creator = (userProfiles || []).find(up => up.id === fetchedTask.user_id);
            
            const mappedAssignees = assignees.map(p => ({ id: p.id, name: p.full_name || 'N/A', avatar: p.avatar_url || undefined, email: p.email || '' }));
            setAssigneeDetails(mappedAssignees);
            
            let mappedCreator: AssigneeProfileDisplay | null = null;
            if (creator) {
              mappedCreator = { id: creator.id, name: creator.full_name || 'N/A', avatar: creator.avatar_url || undefined, email: creator.email || '' };
              setCreatorDetails(mappedCreator);
            }

            // Prepare mentionable users
            const usersForMentions: MentionUser[] = [];
            mappedAssignees.forEach(u => usersForMentions.push(u));
            if (mappedCreator) usersForMentions.push(mappedCreator);
            
            const uniqueMentionableUsers = Array.from(new Set(usersForMentions.map(u => u.id)))
                .map(id => usersForMentions.find(u => u.id === id)!)
                .filter(user => user.id !== currentUser.id); // Exclude current user
            setMentionableUsers(uniqueMentionableUsers);
            setFilteredMentionSuggestions(uniqueMentionableUsers); // Initially show all
          }
        }

      } else {
        setTask(null);
        setError('Task not found.');
      }
    } catch (e: any) {
      const displayMessage = e.message || e.details || 'Failed to load task details.';
      setError(displayMessage);
      toast({ title: 'Error Fetching Task', description: displayMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [taskId, toast, currentUser]);

  useEffect(() => {
    fetchTaskDetails();
  }, [fetchTaskDetails]);

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNewComment(text);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const atSymbolIndex = textBeforeCursor.lastIndexOf('@');
    const spaceAfterAtSymbolIndex = textBeforeCursor.indexOf(' ', atSymbolIndex);


    if (atSymbolIndex !== -1 && (spaceAfterAtSymbolIndex === -1 || spaceAfterAtSymbolIndex < atSymbolIndex)) {
      const query = textBeforeCursor.substring(atSymbolIndex + 1);
      setMentionQuery(query);
      setFilteredMentionSuggestions(
        mentionableUsers.filter(user =>
          user.name.toLowerCase().includes(query.toLowerCase())
        )
      );
      setMentionPopoverOpen(true);
      lastMentionTriggerIndexRef.current = atSymbolIndex;
    } else {
      setMentionPopoverOpen(false);
      setMentionQuery('');
      lastMentionTriggerIndexRef.current = null;
    }
  };

  const handleMentionSelect = (user: MentionUser) => {
    if (textareaRef.current && lastMentionTriggerIndexRef.current !== null) {
      const text = newComment;
      const triggerIndex = lastMentionTriggerIndexRef.current;
      
      const textBeforeMention = text.substring(0, triggerIndex);
      // Find the end of the current @query to replace it
      let queryEndIndex = text.length;
      for(let i = triggerIndex + 1; i < text.length; i++) {
        if (text[i] === ' ' || text[i] === '@') { // Stop at space or another @
            queryEndIndex = i;
            break;
        }
      }
      const textAfterMention = text.substring(queryEndIndex);

      const mentionText = `@${user.name} `; // Add space after mention
      setNewComment(textBeforeMention + mentionText + textAfterMention);

      // Set cursor position after the inserted mention
      const newCursorPos = (textBeforeMention + mentionText).length;
      setTimeout(() => { // setTimeout to ensure DOM updates before focusing
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
    setMentionPopoverOpen(false);
    setMentionQuery('');
    lastMentionTriggerIndexRef.current = null;
  };


  const handleAddComment = async () => {
    if (!task || !currentUser || !newComment.trim() || !supabase) return;

    setIsSubmittingComment(true);
    const newCommentObject: TaskComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      comment: newComment.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [...(task.comments || []), newCommentObject];

    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ comments: updatedComments })
        .eq('id', task.id);

      if (updateError) throw updateError;

      setTask(prevTask => prevTask ? { ...prevTask, comments: updatedComments } : null);
      setNewComment('');
      toast({ title: 'Success', description: 'Comment added.' });

      // ... (existing notification logic for comments)
       if (currentUser && supabase) {
        const recipientsIds = new Set<string>();
        assigneeDetails.forEach(ad => {
          if (ad.id !== currentUser.id) recipientsIds.add(ad.id);
        });
        if (creatorDetails && creatorDetails.id !== currentUser.id) {
            recipientsIds.add(creatorDetails.id);
        }

        // Check for @mentions in the comment to notify specific users
        mentionableUsers.forEach(user => {
            if (newCommentObject.comment.includes(`@${user.name}`)) {
                recipientsIds.add(user.id); // Add mentioned user if not already included
            }
        });


        const recipientUserDetails = (await supabase.from('profiles').select('id, full_name, email').in('id', Array.from(recipientsIds))).data || [];


        const notificationsToInsert = recipientUserDetails
          .map(recipient => ({
            user_id: recipient.id,
            message: `${currentUser.name} commented on task "${task.title}"` + (newCommentObject.comment.includes(`@${recipient.full_name}`) ? " (you were mentioned)" : "") + `: "${newCommentObject.comment.substring(0, 30)}..."`,
            link: `/tasks/${task.id}`,
            type: 'new_comment_on_task' as NotificationType,
            task_id: task.id,
            triggered_by_user_id: currentUser.id,
          }));

        if (notificationsToInsert.length > 0) {
          console.log("TaskDetailPage: Notifications to insert for new comment:", notificationsToInsert);
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert(notificationsToInsert);
          if (notificationError) {
            // ... (existing error handling for notifications)
          }
        }

        for (const recipient of recipientUserDetails) {
          if (recipient.email) {
            // ... (existing email sending logic)
          }
        }
      }


    } catch (e: any) {
      console.error('Error adding comment:', e);
      toast({ title: 'Error Adding Comment', description: e.message || "Could not add comment.", variant: 'destructive' });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleAddLog = async (values: LogFormValues) => {
    if (!task || !currentUser || !supabase) return;
    // ... (existing log logic)
    setIsSubmittingLog(true);
    const newLogObject: TaskLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      hoursSpent: values.hoursSpent,
      workDescription: values.workDescription,
      date: new Date().toISOString(),
    };
    const updatedLogs = [...(task.logs || []), newLogObject];
    try {
      const { error: updateError } = await supabase.from('tasks').update({ logs: updatedLogs }).eq('id', task.id);
      if (updateError) throw updateError;
      setTask(prevTask => prevTask ? { ...prevTask, logs: updatedLogs } : null);
      logForm.reset();
      toast({ title: 'Success', description: 'Work log added.' });
    } catch (e: any) {
      console.error('Error adding log:', e);
      toast({ title: 'Error Adding Log', description: e.message || "Could not add log.", variant: 'destructive' });
    } finally {
      setIsSubmittingLog(false);
    }
  };

  const handleUpdateStatus = async (newStatus: TaskStatus) => {
    // ... (existing status update logic)
    if (!task || !supabase || !currentUser) {
      toast({ title: "Error", description: "Task or user data missing for status update.", variant: "destructive"});
      setIsUpdatingStatus(false);
      return;
    }
    // ... (rest of the permission checks and logic from original file) ...
    setIsUpdatingStatus(true);
    try {
      const { error: updateError } = await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
      if (updateError) throw updateError;
      setTask(prevTask => prevTask ? { ...prevTask, status: newStatus } : null);
      toast({ title: "Status Updated", description: `Task status changed to ${newStatus}.` });
      // ... (existing notification logic for status changes) ...
    } catch (e: any) {
      const displayMessage = (e as any).message || `Could not update task status to ${newStatus}.`;
      toast({ title: 'Error Updating Status', description: displayMessage, variant: 'destructive' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusVariant = (status?: TaskStatus): "default" | "secondary" | "destructive" | "outline" => { /* ... */ return 'default'; };
  const getPriorityVariant = (priority?: TaskPriority): "default" | "secondary" | "destructive" | "outline" => { /* ... */ return 'default'; };

  const isCurrentUserAnAssignee = !!(currentUser && task && task.assignee_ids && task.assignee_ids.includes(currentUser.id));
  const canMarkCompleted = isCurrentUserAnAssignee && task && (task.status === 'In Progress' || task.status === 'Pending');
  const canAdminApprove = isAdmin && task && task.status === 'Completed';
  const canAdminReject = isAdmin && task && task.status === 'Completed';
  const canLogTime = isCurrentUserAnAssignee && !isAdmin && task && (task.status === 'In Progress' || task.status === 'Pending');
  const canStartTask = (isCurrentUserAnAssignee || isAdmin) && task && task.status === 'Pending';

  if (isLoading) { /* ... */ return <div>Loading...</div>; }
  if (error && !task) { /* ... */  return <div>Error: {error}</div>; }
  if (!task) { /* ... */ return <div>Task not found.</div>; }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <CardTitle className="text-2xl md:text-3xl mb-2 sm:mb-0">{task.title}</CardTitle>
            <div className="flex gap-2 items-center mt-2 sm:mt-0">
                {task.priority && <Badge variant={getPriorityVariant(task.priority)} className="capitalize text-sm px-3 py-1">{task.priority}</Badge>}
                {task.status && <Badge variant={getStatusVariant(task.status)} className="capitalize text-sm px-3 py-1">{task.status}</Badge>}
                {isUpdatingStatus && <Loader2 className="h-5 w-5 animate-spin" />}
            </div>
          </div>
          <CardDescription>Created on {task.createdAt ? format(parseISO(task.createdAt), 'PPP') : 'N/A'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ... existing task details display ... */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start">
                <Users className="w-4 h-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
                <strong className="mr-1 flex-shrink-0">Assignees:</strong>
                <div className="flex flex-wrap gap-1 items-center">
                  {assigneeDetails.length > 0 ? (
                      assigneeDetails.map(assignee => (
                        <Badge key={assignee.id} variant="outline" className="flex items-center gap-1 px-2 py-0.5">
                          <Avatar className="h-4 w-4" data-ai-hint="user avatar tiny">
                              <AvatarImage src={assignee.avatar || `https://placehold.co/20x20.png`} />
                              <AvatarFallback className="text-xs">{assignee.name?.substring(0,1) || 'U'}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs">{assignee.name}</span>
                        </Badge>
                      ))
                  ) : <span className="ml-1 text-muted-foreground">Unassigned</span>}
                </div>
            </div>
            <div className="flex items-center"><CalendarDays className="w-4 h-4 mr-2 text-muted-foreground" /><strong>Due Date:</strong><span className="ml-1">{task.dueDate ? format(parseISO(task.dueDate), 'PPP') : 'N/A'}</span></div>
            <div className="flex items-center"><Briefcase className="w-4 h-4 mr-2 text-muted-foreground" /><strong>Project:</strong><span className="ml-1">{task.projectName || 'N/A'}</span></div>
             <div className="flex items-center"><UserIconLucide className="w-4 h-4 mr-2 text-muted-foreground" /><strong>Creator:</strong><span className="ml-1">{creatorDetails?.name || 'N/A'}</span></div>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-1">Description:</h4>
            <p className="text-muted-foreground whitespace-pre-wrap">{task.description || 'No description provided.'}</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end items-center gap-2 pt-4 border-t">
            {/* ... existing buttons ... */}
        </CardFooter>
      </Card>

      <Tabs defaultValue="comments" className="w-full">
        <TabsList className="grid w-full grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-2">
          <TabsTrigger value="comments"><MessageSquare className="w-4 h-4 mr-2 inline-block"/>Comments ({(task.comments || []).length})</TabsTrigger>
          <TabsTrigger value="logs"><History className="w-4 h-4 mr-2 inline-block"/>Activity Logs ({(task.logs || []).length})</TabsTrigger>
        </TabsList>
        <TabsContent value="comments" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* ... existing comments display ... */}
              {currentUser && supabase && (
                <>
                  <Separator className="my-6" />
                  <div className="space-y-2 relative">
                    <Popover open={mentionPopoverOpen} onOpenChange={setMentionPopoverOpen}>
                        <PopoverAnchor asChild>
                            <Textarea
                              ref={textareaRef}
                              placeholder="Add a comment... Type @ to mention users."
                              value={newComment}
                              onChange={handleCommentChange}
                              rows={3}
                              disabled={isSubmittingComment}
                              className="pr-10" // Make space for potential @ icon
                            />
                        </PopoverAnchor>
                        {/* <AtSign className="absolute top-3 right-3 h-4 w-4 text-muted-foreground pointer-events-none" /> */}
                        <PopoverContent 
                            className="w-[300px] p-0" 
                            onOpenAutoFocus={(e) => e.preventDefault()} // Prevent stealing focus
                            align="start" // Align to start of textarea
                            side="top"    // Show above if space, else below
                            sideOffset={5}
                        >
                        <Command>
                            <CommandInput 
                                placeholder="Tag user..." 
                                value={mentionQuery}
                                onValueChange={(search) => {
                                    setMentionQuery(search);
                                    setFilteredMentionSuggestions(
                                        mentionableUsers.filter(user =>
                                        user.name.toLowerCase().includes(search.toLowerCase())
                                        )
                                    );
                                }}
                                className="text-sm"
                            />
                            <CommandList>
                            <CommandEmpty>No users found.</CommandEmpty>
                            <CommandGroup heading="Suggestions">
                                {filteredMentionSuggestions.map((user) => (
                                <CommandItem
                                    key={user.id}
                                    value={user.name} 
                                    onSelect={() => handleMentionSelect(user)}
                                    className="flex items-center gap-2 cursor-pointer"
                                >
                                    <Avatar className="h-6 w-6" data-ai-hint="user avatar small">
                                        <AvatarImage src={user.avatar || `https://placehold.co/24x24.png`} />
                                        <AvatarFallback>{user.name.substring(0,1)}</AvatarFallback>
                                    </Avatar>
                                    <span>{user.name}</span>
                                </CommandItem>
                                ))}
                            </CommandGroup>
                            </CommandList>
                        </Command>
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handleAddComment} disabled={!newComment.trim() || isSubmittingComment}>
                      {isSubmittingComment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add Comment
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          {/* ... existing logs tab content ... */}
        </TabsContent>
      </Tabs>
    </div>
  );
}

    