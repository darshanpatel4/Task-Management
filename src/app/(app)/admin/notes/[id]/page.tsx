
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { Note, User, NoteCategory } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';
import { StickyNote, CalendarDays, Users, UserCircle, Loader2, AlertTriangle, ArrowLeft, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

interface ProfileMap {
  [userId: string]: Pick<User, 'id' | 'name' | 'avatar'>;
}

export default function AdminNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, isAdmin } = useAuth();
  const { toast } = useToast();

  const [note, setNote] = useState<Note | null>(null);
  const [profilesMap, setProfilesMap] = useState<ProfileMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const noteId = params.id as string;

  const fetchNoteDetails = useCallback(async () => {
    if (!noteId || !supabase || !isAdmin) {
      setError(isAdmin ? (supabase ? 'Note ID is missing.' : 'Supabase client not available.') : "Access Denied.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('notes')
        .select('id, title, content, admin_id, recipient_user_ids, created_at, updated_at, category')
        .eq('id', noteId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') setError('Note not found.');
        else throw fetchError;
        setNote(null);
      } else if (data) {
        const allUserIds = new Set<string>([data.admin_id, ...(data.recipient_user_ids || [])]);
        let newProfilesMap: ProfileMap = {};

        if (allUserIds.size > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', Array.from(allUserIds));
          if (profilesError) console.warn('Error fetching profiles for note detail:', profilesError);
          else (profilesData || []).forEach(p => { newProfilesMap[p.id] = { id: p.id, name: p.full_name || 'N/A', avatar: p.avatar_url }; });
        }
        setProfilesMap(newProfilesMap);
        
        const fetchedNote: Note = {
          id: data.id,
          title: data.title,
          content: data.content,
          admin_id: data.admin_id,
          admin_name: newProfilesMap[data.admin_id]?.name || 'Unknown Admin',
          recipient_user_ids: data.recipient_user_ids || [],
          recipient_names: (data.recipient_user_ids || []).map(id => newProfilesMap[id]?.name || 'Unknown User'),
          created_at: data.created_at,
          updated_at: data.updated_at,
          category: data.category as NoteCategory || 'General',
        };
        setNote(fetchedNote);
      } else {
        setError('Note not found.');
        setNote(null);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load note details.');
      toast({ title: 'Error Fetching Note', description: e.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [noteId, isAdmin, toast]);

  useEffect(() => {
    fetchNoteDetails();
  }, [fetchNoteDetails]);


  if (!isLoading && !isAdmin) {
    return (
      <Card className="w-full max-w-md mx-auto mt-10">
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to view this page.</p></CardContent>
      </Card>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" /> Loading note details...
      </div>
    );
  }

  if (error && !note) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Note</h2>
        <p>{error}</p>
        <Button variant="outline" onClick={() => router.push('/admin/notes')} className="mt-4">Back to Notes List</Button>
      </div>
    );
  }
  
  if (!note) {
     return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <StickyNote className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Note Not Found</h2>
        <Button variant="outline" onClick={() => router.push('/admin/notes')} className="mt-4">Back to Notes List</Button>
      </div>
    );
  }

  const adminProfile = profilesMap[note.admin_id];

  const getCategoryBadgeVariant = (category?: NoteCategory | null): "default" | "secondary" | "destructive" | "outline" => {
    switch (category) {
      case 'Important': return 'destructive';
      case 'Credentials': return 'default';
      case 'Improvement': return 'secondary';
      case 'Action Required': return 'destructive';
      case 'General': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
       <Button variant="outline" onClick={() => router.push('/admin/notes')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Notes List
      </Button>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start">
            <div className="flex-1">
                <CardTitle className="text-2xl md:text-3xl mb-1 sm:mb-0 flex items-center">
                    <StickyNote className="w-7 h-7 mr-2 text-primary flex-shrink-0" />
                    {note.title}
                </CardTitle>
                <Badge variant={getCategoryBadgeVariant(note.category)} className="capitalize mt-1.5">
                    <Tag className="mr-1.5 h-3 w-3" /> {note.category || 'General'}
                </Badge>
            </div>
            <Badge variant="outline" className="mt-2 sm:mt-1 text-xs self-start sm:self-auto">
                Last updated: {note.updated_at ? format(parseISO(note.updated_at), 'MMM d, yyyy HH:mm') : 'N/A'}
            </Badge>
          </div>
          <CardDescription className="pt-2">
            <div className="flex flex-col space-y-1 sm:flex-row sm:space-y-0 sm:space-x-2 sm:items-center text-sm text-muted-foreground">
                <div className="flex items-center">
                    <UserCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
                    Sent by:
                    <Avatar className="h-5 w-5 ml-1.5 mr-1" data-ai-hint="admin avatar small">
                        <AvatarImage src={adminProfile?.avatar || `https://placehold.co/20x20.png`} />
                        <AvatarFallback className="text-xs">{adminProfile?.name?.substring(0,1) || 'A'}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{adminProfile?.name || 'Unknown Admin'}</span>
                </div>
                <span className="mx-1.5 hidden sm:inline">|</span>
                <div className="flex items-center">
                    <CalendarDays className="w-4 h-4 mr-1.5 flex-shrink-0" /> 
                    Created: {note.created_at ? format(parseISO(note.created_at), 'PPP') : 'N/A'}
                </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Separator />
             <div>
                <h4 className="font-semibold mb-2 text-sm flex items-center">
                    <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                    Recipients:
                </h4>
                <div className="flex flex-wrap gap-2">
                {(note.recipient_user_ids || []).map(userId => {
                    const recipientProfile = profilesMap[userId];
                    return (
                    <Badge key={userId} variant="secondary" className="flex items-center gap-1.5 py-1 px-2.5">
                        <Avatar className="h-5 w-5" data-ai-hint="recipient avatar small">
                            <AvatarImage src={recipientProfile?.avatar || `https://placehold.co/20x20.png`} />
                            <AvatarFallback className="text-xs">{recipientProfile?.name?.substring(0,1) || 'U'}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{recipientProfile?.name || 'Unknown User'}</span>
                    </Badge>
                    );
                })}
                {(note.recipient_user_ids || []).length === 0 && <span className="text-sm text-muted-foreground italic">No recipients specified.</span>}
                </div>
            </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-2 text-sm">Content:</h4>
            <div className="prose prose-sm dark:prose-invert max-w-none p-3 bg-muted/30 rounded-md"
                 dangerouslySetInnerHTML={{ __html: note.content || 'No content provided.' }} />
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4">
            {/* Future actions like Edit button for Admins can go here */}
            {/* <Button variant="outline" disabled>Edit Note (Not Implemented)</Button> */}
        </CardFooter>
      </Card>
    </div>
  );
}
