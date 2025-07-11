
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Note, User, NoteCategory } from '@/types';
import { noteCategories } from '@/types'; // Import categories
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, AlertTriangle, Inbox, UserCircle, Tag, Search, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface ProfileMap {
  [userId: string]: Pick<User, 'id' | 'name' | 'avatar'>;
}

export default function MyNotesPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [notes, setNotes] = useState<Note[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<ProfileMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NoteCategory | 'all'>('all');

  const fetchMyNotes = useCallback(async () => {
    if (!currentUser || !supabase) {
      setIsLoading(false);
      setError(currentUser ? "Supabase client not available." : "You must be logged in to view notes.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('notes')
        .select('id, title, content, admin_id, created_at, category')
        .contains('recipient_user_ids', [currentUser.id])
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.ilike('title', `%${searchTerm}%`);
      }
      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      const { data: notesData, error: notesError } = await query;

      if (notesError) throw notesError;

      const adminIds = new Set<string>();
      (notesData || []).forEach(note => adminIds.add(note.admin_id));

      let fetchedAdminProfiles: ProfileMap = {};
      if (adminIds.size > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', Array.from(adminIds));

        if (profilesError) {
          console.warn('Could not fetch admin profiles for notes page:', profilesError);
        } else {
          (profilesData || []).forEach(profile => {
            fetchedAdminProfiles[profile.id] = { id: profile.id, name: profile.full_name || 'Admin', avatar: profile.avatar_url };
          });
        }
      }
      setAdminProfiles(fetchedAdminProfiles);

      const mappedNotes: Note[] = (notesData || []).map(note => ({
        id: note.id,
        title: note.title,
        content: note.content,
        admin_id: note.admin_id,
        admin_name: fetchedAdminProfiles[note.admin_id]?.name || 'Admin',
        recipient_user_ids: [currentUser.id], // Assuming we only care about current user as recipient here
        created_at: note.created_at,
        updated_at: note.created_at, // Assuming updated_at is same as created_at for simplicity
        category: note.category as NoteCategory || 'General',
      }));
      setNotes(mappedNotes);

    } catch (e: any) {
      console.error('Error fetching your notes:', e);
      setError(e.message || 'Failed to load your notes.');
      toast({ title: 'Error', description: e.message || 'Could not load your notes.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast, searchTerm, selectedCategory]);

  useEffect(() => {
    fetchMyNotes();
  }, [fetchMyNotes]);

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
  
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
  };

  const hasActiveFilters = searchTerm !== '' || selectedCategory !== 'all';

  if (!currentUser && !isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto mt-10">
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You must be logged in to view your notes.</p></CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <CardTitle className="text-3xl flex items-center">
                    <Inbox className="mr-3 h-8 w-8 text-primary" /> My Notes
                </CardTitle>
                <CardDescription>Notes sent to you by administrators. Filter and search below.</CardDescription>
            </div>
            {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={handleResetFilters} disabled={isLoading}>
                    Reset Filters
                </Button>
            )}
          </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by note title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full"
                disabled={isLoading}
              />
            </div>
            <Select 
              value={selectedCategory} 
              onValueChange={(value) => setSelectedCategory(value as NoteCategory | 'all')}
              disabled={isLoading}
            >
              <SelectTrigger>
                <div className="flex items-center">
                    <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Filter by category" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {noteCategories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading your notes...</p>
            </div>
          )}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error Loading Notes</p>
              <p className="text-sm">{error}</p>
               <Button variant="outline" size="sm" className="mt-4" onClick={fetchMyNotes} disabled={!supabase}>
                Try Again
              </Button>
            </div>
          )}
          {!isLoading && !error && notes.length === 0 && (
            <p className="text-center text-muted-foreground py-12">
              {hasActiveFilters ? 'No notes match your current filters.' : 'You have no notes.'}
            </p>
          )}
          {!isLoading && !error && notes.length > 0 && (
            <div className="space-y-4">
              {notes.map((note) => (
                <Card key={note.id} id={`note-${note.id}`} className="overflow-hidden hover:shadow-md transition-shadow duration-200">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div className="flex-1">
                             <CardTitle className="text-xl mb-1 sm:mb-0">{note.title}</CardTitle>
                             <Badge variant={getCategoryBadgeVariant(note.category)} className="capitalize mt-1 text-xs">
                                <Tag className="mr-1.5 h-3 w-3" /> {note.category || 'General'}
                             </Badge>
                        </div>
                        <Badge variant="outline" className="text-xs mt-2 sm:mt-0 self-start sm:self-auto">
                            Received: {note.created_at ? format(parseISO(note.created_at), 'MMM d, yyyy HH:mm') : 'N/A'}
                        </Badge>
                    </div>
                     <CardDescription className="flex items-center text-xs pt-1.5">
                        <UserCircle className="h-3 w-3 mr-1" /> Sent by: {note.admin_name || 'Admin'}
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none"
                         dangerouslySetInnerHTML={{ __html: note.content || '' }} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
