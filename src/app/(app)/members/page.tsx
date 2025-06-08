
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { User } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, AlertTriangle, Users, Mail, Award, Search } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function MembersPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMembers = useCallback(async () => {
    if (!supabase) {
      setError("Supabase client is not available.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url, position')
        .order('full_name', { ascending: true });

      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,position.ilike.%${searchTerm}%`);
      }

      const { data, error: supabaseError } = await query;

      if (supabaseError) throw supabaseError;

      const mappedMembers: User[] = (data || []).map(profile => ({
        id: profile.id,
        name: profile.full_name || 'N/A',
        email: profile.email || 'N/A',
        role: profile.role as User['role'] || 'User',
        avatar: profile.avatar_url || undefined,
        position: profile.position || 'N/A',
      }));
      setMembers(mappedMembers);
    } catch (e: any) {
      console.error('Error fetching members:', e);
      setError('Failed to fetch members. ' + e.message);
      toast({
        title: 'Error Fetching Members',
        description: e.message || 'Could not load members.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, searchTerm]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  if (!currentUser) {
    // This should ideally be handled by the layout, but as a fallback:
    return (
        <div className="flex items-center justify-center h-full">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Access Denied</CardTitle>
                    <CardDescription>You must be logged in to view members.</CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className="mb-4 sm:mb-0">
                <CardTitle className="text-3xl flex items-center">
                    <Users className="mr-3 h-8 w-8 text-primary" /> Team Members
                </CardTitle>
                <CardDescription>Browse the list of all team members.</CardDescription>
            </div>
            <div className="relative w-full sm:w-auto sm:max-w-xs">
                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-full"
                    disabled={isLoading}
                />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading members...</p>
            </div>
          )}
          {error && !isLoading && (
             <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error Loading Members</p>
              <p className="text-sm">{error}</p>
            </div>
          )}
          {!isLoading && !error && members.length === 0 && (
            <p className="text-center text-muted-foreground py-12">
              {searchTerm ? 'No members match your search.' : 'No members found.'}
            </p>
          )}
          {!isLoading && !error && members.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {members.map((member) => (
                <Card key={member.id} className="flex flex-col">
                  <CardHeader className="items-center text-center pb-4">
                    <Avatar className="h-20 w-20 mb-3" data-ai-hint="user avatar large">
                      <AvatarImage src={member.avatar || `https://placehold.co/100x100.png?text=${member.name.substring(0,1)}`} alt={member.name} />
                      <AvatarFallback className="text-2xl">{member.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-xl">{member.name}</CardTitle>
                    <CardDescription className="flex items-center justify-center">
                        <Award className="mr-1.5 h-4 w-4 text-muted-foreground" />
                        {member.position || <span className="italic">Position not set</span>}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground text-center flex-grow">
                    <div className="flex items-center justify-center">
                        <Mail className="mr-1.5 h-4 w-4" />
                        <a href={`mailto:${member.email}`} className="hover:underline hover:text-primary truncate" title={member.email}>
                            {member.email}
                        </a>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 justify-center">
                     <Badge variant={member.role === 'Admin' ? 'default' : 'secondary'} className="capitalize">
                       {member.role}
                     </Badge>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
