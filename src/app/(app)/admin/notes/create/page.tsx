
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import type { User, NotificationType, NoteCategory } from '@/types';
import { noteCategories } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, Users, ChevronDown, Send, Tag } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sendEmail, wrapHtmlContent } from '@/actions/sendEmailAction';

const noteFormSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }).max(150, { message: 'Title too long.'}),
  content: z.string().min(10, { message: 'Note content must be at least 10 characters.' }),
  recipient_user_ids: z.array(z.string()).min(1, { message: 'At least one recipient must be selected.' }),
  category: z.enum(noteCategories, { required_error: 'Note category is required.' }),
});

type NoteFormValues = z.infer<typeof noteFormSchema>;

export default function CreateNotePage() {
  const { currentUser, isAdmin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [allUsers, setAllUsers] = useState<Pick<User, 'id' | 'name' | 'email'>[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      title: '',
      content: '',
      recipient_user_ids: [],
      category: 'General',
    },
  });

  useEffect(() => {
    async function fetchUsers() {
      if (!supabase || !isAdmin) {
        setIsLoadingData(false);
        setDataError(isAdmin ? "Supabase client not available." : "Access Denied.");
        return;
      }
      setIsLoadingData(true);
      setDataError(null);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .order('full_name', { ascending: true });
        if (error) throw error;
        setAllUsers(data?.map(u => ({ id: u.id, name: u.full_name || 'Unnamed User', email: u.email || '' })) || []);
      } catch (error: any) {
        setDataError(error.message || 'Failed to load users.');
        toast({ title: 'Error Loading Users', description: error.message, variant: 'destructive' });
      } finally {
        setIsLoadingData(false);
      }
    }
    fetchUsers();
  }, [isAdmin, toast]);

  const getRecipientButtonLabel = (selectedIds: string[]) => {
    if (selectedIds.length === 0) return "Select recipients";
    if (selectedIds.length === 1) {
      const user = allUsers.find(u => u.id === selectedIds[0]);
      return user ? user.name : "1 user selected";
    }
    return \`\${selectedIds.length} users selected\`;
  };

  async function onSubmit(values: NoteFormValues) {
    if (!currentUser || !supabase || !isAdmin) {
      toast({ title: 'Error', description: 'Action not permitted or client not ready.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const noteToInsert = {
        title: values.title,
        content: values.content,
        admin_id: currentUser.id,
        recipient_user_ids: values.recipient_user_ids,
        category: values.category,
      };

      const { data: createdNote, error: noteInsertError } = await supabase
        .from('notes')
        .insert([noteToInsert])
        .select()
        .single();

      if (noteInsertError) throw noteInsertError;

      let toastDescription = \`Note "\${values.title}" has been successfully sent.\`;
      
      if (createdNote && values.recipient_user_ids.length > 0) {
        const recipientUserDetails = allUsers.filter(u => values.recipient_user_ids.includes(u.id));

        const notificationsToInsert = recipientUserDetails.map(recipient => ({
          user_id: recipient.id,
          message: \`You have received a new note from \${currentUser.name}: "\${values.title.substring(0, 50)}..."\`,
          link: \`/notes#note-\${createdNote.id}\`, 
          type: 'new_note_received' as NotificationType,
          task_id: null, 
          project_id: null, 
          note_id: createdNote.id,
          triggered_by_user_id: currentUser.id,
        }));
        
        if (notificationsToInsert.length > 0) {
            const { error: notificationError } = await supabase
                .from('notifications')
                .insert(notificationsToInsert);
            
            if (notificationError) {
                 console.error(
                    "Error creating 'new_note_received' notifications. Raw Error Object:", notificationError,
                    "Code:", (notificationError as any)?.code, 
                    "Message:", (notificationError as any)?.message, 
                    "Details:", (notificationError as any)?.details,
                    "Hint:", (notificationError as any)?.hint
                );

                let specificErrorMsg = "Failed to send notifications to recipients.";
                if ((notificationError as any)?.code === '42501') {
                    specificErrorMsg = "Failed to send notifications due to database permissions (RLS). Please check 'notifications' table policies for admin inserts of type 'new_note_received'.";
                } else if ((notificationError as any)?.message?.includes("column \\"note_id\\" of relation \\"notifications\\" does not exist")) {
                    specificErrorMsg = "Failed to send notifications: The 'note_id' column is missing in the 'notifications' table. Please run the database migration to add it.";
                }
                 else if ((notificationError as any)?.message) {
                    specificErrorMsg += \` Error: \${(notificationError as any).message}\`;
                }
                
                toastDescription += \` \${specificErrorMsg}\`;
                toast({
                    title: "Notification Issue",
                    description: specificErrorMsg,
                    variant: "destructive",
                    duration: 7000
                });
            } else {
              toastDescription += \` Recipients have been notified.\`;
            }
        }

        for (const recipient of recipientUserDetails) {
            if (recipient.email) {
               const emailHtmlContent = \`
                  <p>Hello \${recipient.name || 'User'},</p>
                  <p>You have received a new note from <strong>\${currentUser.name}</strong> regarding: "<strong>\${values.title}</strong>"</p>
                  <p><strong>Category:</strong> \${values.category}</p>
                  <p><strong>Content:</strong></p>
                  <div style="padding: 10px; border: 1px solid #eee; background: #f9f9f9; border-radius: 4px; margin-top: 5px;">
                    <pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">\${values.content}</pre>
                  </div>
                  <p>You can view this note in the TaskFlow AI application by clicking the button below:</p>
                  <a href="\${process.env.NEXT_PUBLIC_APP_URL}/notes#note-\${createdNote.id}" class="button">View Note</a>
                \`;
              await sendEmail({
                to: recipient.email,
                recipientName: recipient.name,
                subject: \`New Note from \${currentUser.name}: \${values.title}\`,
                htmlBody: wrapHtmlContent(emailHtmlContent, \`New Note: \${values.title}\`),
              });
            }
        }
      }

      toast({ title: 'Note Sent', description: toastDescription });
      router.push('/admin/notes');

    } catch (error: any) {
      console.error('Error creating note:', error);
      toast({ title: 'Error Sending Note', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (!isLoadingData && !isAdmin) {
    return (
      <Card className="w-full max-w-md mx-auto mt-10">
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to create notes.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Create New Note</CardTitle>
        <CardDescription>Compose and send a note to selected users.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingData && (
          <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-8 w-8 animate-spin" />Loading users...</div>
        )}
        {dataError && !isLoadingData && (
          <div className="flex flex-col items-center justify-center py-10 text-destructive">
            <AlertTriangle className="mr-2 h-8 w-8" />
            <p className="font-semibold">Error loading data: {dataError}</p>
          </div>
        )}
        {!isLoadingData && !dataError && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note Title</FormLabel>
                    <FormControl><Input placeholder="Enter note title" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                        <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
                        Category
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select note category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {noteCategories.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note Content</FormLabel>
                    <FormControl><Textarea placeholder="Write your note here..." {...field} rows={8} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="recipient_user_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                      Recipients
                    </FormLabel>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {getRecipientButtonLabel(field.value || [])}
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                        <DropdownMenuLabel>Select Recipients</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <ScrollArea className="h-48">
                          {allUsers.length > 0 ? allUsers.map((user) => (
                            <DropdownMenuCheckboxItem
                              key={user.id}
                              checked={(field.value || []).includes(user.id)}
                              onCheckedChange={(checked) => {
                                const currentIds = field.value || [];
                                const newIds = checked
                                  ? [...currentIds, user.id]
                                  : currentIds.filter((id) => id !== user.id);
                                field.onChange(newIds);
                              }}
                              onSelect={(e) => e.preventDefault()}
                            >
                              {user.name}
                            </DropdownMenuCheckboxItem>
                          )) : <DropdownMenuCheckboxItem disabled>No users available</DropdownMenuCheckboxItem>}
                        </ScrollArea>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <FormDescription>Select users who will receive this note.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting || isLoadingData}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send Note
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

