
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Note, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';
import { StickyNote, UserCircle, Loader2, AlertTriangle, Edit, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { verifyNotePassword } from '@/actions/noteActions';


const passwordFormSchema = z.object({
  password: z.string().min(1, 'Password cannot be empty.'),
});
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export default function PublicNotePage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;
  const { toast } = useToast();

  const [note, setNote] = useState<Note | null>(null);
  const [adminProfile, setAdminProfile] = useState<Pick<User, 'id' | 'name' | 'avatar'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasEditAccess, setHasEditAccess] = useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { password: '' },
  });

  const fetchPublicNote = useCallback(async () => {
    if (!noteId) {
      setError('Note ID is missing.');
      setIsLoading(false);
      return;
    }
     if (!supabase) {
      setError('Database connection is not available.');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('notes')
        .select('id, title, content, admin_id, created_at, category, visibility, security_key')
        .eq('id', noteId)
        .eq('visibility', 'public')
        .single();

      if (fetchError || !data) {
        if (fetchError?.code === 'PGRST116' || !data) {
            setError('This note was not found or is not available for public viewing.');
        } else {
            throw fetchError;
        }
        setNote(null);
      } else {
        const fetchedNote: Note = {
            id: data.id,
            title: data.title,
            content: data.content,
            admin_id: data.admin_id,
            recipient_user_ids: [], 
            created_at: data.created_at,
            updated_at: data.created_at,
            category: data.category as Note['category'],
            visibility: data.visibility as Note['visibility'],
            security_key: data.security_key,
        };
        setNote(fetchedNote);

        // Check for session storage token
        const editToken = sessionStorage.getItem(`note-edit-token-${noteId}`);
        if(editToken) {
            const { success } = await verifyNotePassword({ noteId, password: editToken, isToken: true });
            if (success) {
                setHasEditAccess(true);
            } else {
                sessionStorage.removeItem(`note-edit-token-${noteId}`);
            }
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', data.admin_id)
          .single();

        if (profileError) {
          console.warn('Could not fetch admin profile for public note:', profileError);
          setAdminProfile({ id: data.admin_id, name: 'Admin', avatar: '' });
        } else {
          setAdminProfile({
            id: profileData.id,
            name: profileData.full_name || 'Admin',
            avatar: profileData.avatar_url || '',
          });
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load the note.');
      console.error('Error fetching public note:', e);
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    fetchPublicNote();
  }, [fetchPublicNote]);
  
  async function onSubmit(values: PasswordFormValues) {
    if (!noteId) return;
    setIsSubmitting(true);
    const result = await verifyNotePassword({
      noteId,
      password: values.password,
    });

    if (result.success && result.token) {
      toast({
        title: 'Access Granted!',
        description: 'You can now edit this note.',
      });
      sessionStorage.setItem(`note-edit-token-${noteId}`, result.token);
      setDialogOpen(false);
      form.reset();
      router.push(`/notes/${noteId}/edit`);
    } else {
      toast({
        title: 'Access Denied',
        description: result.message || 'The password was incorrect.',
        variant: 'destructive',
      });
    }
    setIsSubmitting(false);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
        <p>Loading note...</p>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background text-destructive p-4">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Could Not Load Note</h2>
        <p className="text-center">{error || 'An unknown error occurred.'}</p>
        <Button variant="outline" asChild className="mt-4">
            <Link href="/">Back to Home</Link>
        </Button>
      </div>
    );
  }
  
  const canEdit = hasEditAccess || (note.security_key === null); // Allow edit if no password is set

  return (
    <div className="flex justify-center bg-background py-8 sm:py-12 md:py-16">
        <div className="max-w-4xl w-full mx-auto space-y-6 px-4">
            <Card className="shadow-lg">
                <CardHeader className="border-b">
                <div className="flex flex-col sm:flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl md:text-3xl flex items-center">
                            <StickyNote className="w-7 h-7 mr-3 text-primary flex-shrink-0" />
                            {note.title}
                        </CardTitle>
                    </div>
                    <div className="flex flex-col items-end gap-2 mt-2 sm:mt-0">
                      <p className="text-xs text-muted-foreground pt-1">
                        Published on {note.created_at ? format(parseISO(note.created_at), 'PPP') : 'N/A'}
                      </p>
                      
                       {hasEditAccess ? (
                          <Button asChild size="sm">
                              <Link href={`/notes/${noteId}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit Note</Link>
                          </Button>
                        ) : note.security_key ? (
                          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Edit className="mr-2 h-4 w-4" /> Edit with Password
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Enter Password to Edit</DialogTitle>
                                <DialogDescription>
                                  This note is password-protected. Please enter the password to gain edit access.
                                </DialogDescription>
                              </DialogHeader>
                              <Form {...form}>
                                <form action={form.handleSubmit(onSubmit)} className="space-y-4">
                                  <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className='flex items-center'><Lock className="mr-2 h-4 w-4"/> Password</FormLabel>
                                        <FormControl>
                                          <Input type="password" placeholder="Enter edit password" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Unlock & Edit
                                  </Button>
                                </form>
                              </Form>
                            </DialogContent>
                          </Dialog>
                        ) : (
                           <Button asChild size="sm">
                              <Link href={`/notes/${noteId}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit Note</Link>
                           </Button>
                        )
                       }
                    </div>
                </div>
                {adminProfile && (
                     <CardDescription className="pt-2">
                        <div className="flex items-center text-sm text-muted-foreground">
                            <UserCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
                            Published by:
                            <Avatar className="h-5 w-5 ml-1.5 mr-1" data-ai-hint="admin avatar small">
                                <AvatarImage src={adminProfile.avatar || `https://placehold.co/20x20.png`} />
                                <AvatarFallback className="text-xs">{adminProfile.name?.substring(0,1) || 'A'}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{adminProfile.name}</span>
                        </div>
                    </CardDescription>
                )}
                </CardHeader>
                <CardContent className="pt-6">
                <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: note.content || 'No content provided.' }} />
                </CardContent>
                 <CardFooter className="bg-muted/50 p-4 text-center text-xs text-muted-foreground justify-center">
                   <p>&copy; {new Date().getFullYear()} TaskFlow AI. All rights reserved.</p>
                </CardFooter>
            </Card>
             <div className="text-center">
                <Button asChild>
                    <Link href="/auth/login">Return to TaskFlow AI</Link>
                </Button>
            </div>
        </div>
    </div>
  );
}
