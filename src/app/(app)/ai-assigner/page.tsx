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
import { mockUsers } from '@/lib/mock-data';
import type { User } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, UserCheck, Info } from 'lucide-react';
import { useState } from 'react';
import { suggestTaskAssignee, type SuggestTaskAssigneeInput, type SuggestTaskAssigneeOutput } from '@/ai/flows/suggest-task-assignee';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  taskTitle: z.string().min(3, { message: 'Task title must be at least 3 characters.' }),
  taskDescription: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  employeeList: z.array(z.string()).min(1, { message: 'At least one employee must be selected.' }),
});

export default function AiAssignerPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestTaskAssigneeOutput | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      taskTitle: '',
      taskDescription: '',
      employeeList: [],
    },
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You do not have permission to use the AI Assigner tool.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setSuggestion(null);
    try {
      const selectedEmployeeNames = values.employeeList.map(id => mockUsers.find(u => u.id === id)?.name || '').filter(name => name);
      const input: SuggestTaskAssigneeInput = {
        taskTitle: values.taskTitle,
        taskDescription: values.taskDescription,
        employeeList: selectedEmployeeNames,
      };
      const result = await suggestTaskAssignee(input);
      setSuggestion(result);
      toast({
        title: 'Suggestion Ready!',
        description: 'AI has suggested an assignee for your task.',
      });
    } catch (error) {
      console.error('Error suggesting assignee:', error);
      toast({
        title: 'Error',
        description: 'Could not get AI suggestion. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Wand2 className="mr-2 h-6 w-6 text-primary" />
            AI Task Assigner
          </CardTitle>
          <CardDescription>
            Let AI help you find the best person for the job. Provide task details and a list of employees.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="taskTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Title</FormLabel>
                    <FormControl><Input placeholder="e.g., Develop new login page" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="taskDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Description</FormLabel>
                    <FormControl><Textarea placeholder="Describe the task requirements, skills needed, etc." {...field} rows={5} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employeeList"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Employees</FormLabel>
                    <FormDescription>Select employees for AI consideration. (Multiple selection is not standard for Select, this is a simplified representation)</FormDescription>
                     <Select onValueChange={(value) => field.onChange(value ? [value] : [])} > {/* Simplified: single select for demo, GenAI flow expects array */}
                      <FormControl><SelectTrigger><SelectValue placeholder="Select an employee (AI will consider this list)" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {mockUsers.map((user: User) => (
                          <SelectItem key={user.id} value={user.id}>{user.name} ({user.role})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    <FormDescription className="text-xs">Note: For a real multi-select, a different component (e.g., custom or from a library) would be used.</FormDescription>
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Get AI Suggestion
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {suggestion && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <UserCheck className="mr-2 h-5 w-5 text-green-600" />
              AI Suggestion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle className="font-semibold">Suggested Assignee: {suggestion.suggestedAssignee}</AlertTitle>
              <AlertDescription>
                <strong>Reasoning:</strong> {suggestion.reasoning}
              </AlertDescription>
            </Alert>
             <Button onClick={() => {
                const suggestedUser = mockUsers.find(u => u.name === suggestion.suggestedAssignee);
                if (suggestedUser) {
                    // Example: navigate to create task page with assignee pre-filled
                    router.push(`/tasks/create?assigneeId=${suggestedUser.id}&title=${form.getValues("taskTitle")}`);
                    toast({ title: "Action", description: `Proceeding to create task for ${suggestedUser.name}` });
                } else {
                    toast({ title: "User not found", description: `Could not find ${suggestion.suggestedAssignee} in employee list.`});
                }
             }}>
                Create Task with {suggestion.suggestedAssignee}
             </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
