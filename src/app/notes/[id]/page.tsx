
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Note, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, parseISO } from 'date-fns';
import { StickyNote, UserCircle, Loader2, AlertTriangle, Edit, ShieldQuestion, Send } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { requestNoteEditAccess } from '@/actions/noteActions';

const requestFormSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
});
type RequestFormValues = z.infer<typeof requestFormSchema>;

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

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: { name: '', email: '' },
  });

   const checkTokenAccess = useCallback(async () => {
    const editToken = sessionStorage.getItem(`note-edit-token-${noteId}`);
    if (editToken) {
        setHasEditAccess(true);
    }
   }, [noteId]);

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

        await checkTokenAccess();

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
  }, [noteId, checkTokenAccess]);

  useEffect(() => {
    fetchPublicNote();
  }, [fetchPublicNote]);
  
  async function onSubmit(values: RequestFormValues) {
    if (!noteId) return;
    setIsSubmitting(true);
    
    const result = await requestNoteEditAccess({
        noteId,
        name: values.name,
        email: values.email,
    });

    if (result.success) {
        toast({
            title: 'Request Sent!',
            description: result.message,
        });
        setDialogOpen(false);
        form.reset();
    } else {
        toast({
            title: 'Request Failed',
            description: result.message,
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
                        ) : (
                          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <ShieldQuestion className="mr-2 h-4 w-4" /> Request to Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Request Edit Access</DialogTitle>
                                <DialogDescription>
                                  To prevent spam, please provide your name and email. An administrator will review your request and may grant you access to edit this note.
                                </DialogDescription>
                              </DialogHeader>
                              <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                  <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Your Name</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Jane Doe" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                   <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Your Email</FormLabel>
                                        <FormControl>
                                          <Input type="email" placeholder="you@example.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    Send Request
                                  </Button>
                                </form>
                              </Form>
                            </DialogContent>
                          </Dialog>
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
