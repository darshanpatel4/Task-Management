// src/ai/flows/suggest-task-assignee.ts
'use server';

/**
 * @fileOverview AI-powered task assignee suggestion flow.
 *
 * - suggestTaskAssignee - A function that suggests the best assignee for a given task.
 * - SuggestTaskAssigneeInput - The input type for the suggestTaskAssignee function.
 * - SuggestTaskAssigneeOutput - The return type for the suggestTaskAssignee function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTaskAssigneeInputSchema = z.object({
  taskTitle: z.string().describe('The title of the task.'),
  taskDescription: z.string().describe('A detailed description of the task.'),
  employeeList: z.array(z.string()).describe('A list of employee names.'),
});
export type SuggestTaskAssigneeInput = z.infer<typeof SuggestTaskAssigneeInputSchema>;

const SuggestTaskAssigneeOutputSchema = z.object({
  suggestedAssignee: z.string().describe('The name of the suggested assignee.'),
  reasoning: z.string().describe('The AI reasoning for the suggested assignee.'),
});
export type SuggestTaskAssigneeOutput = z.infer<typeof SuggestTaskAssigneeOutputSchema>;

export async function suggestTaskAssignee(input: SuggestTaskAssigneeInput): Promise<SuggestTaskAssigneeOutput> {
  return suggestTaskAssigneeFlow(input);
}

const suggestTaskAssigneePrompt = ai.definePrompt({
  name: 'suggestTaskAssigneePrompt',
  input: {schema: SuggestTaskAssigneeInputSchema},
  output: {schema: SuggestTaskAssigneeOutputSchema},
  prompt: `You are an AI assistant specializing in task assignment within IT companies. Given a task title, description, and a list of available employees, you must suggest the most suitable assignee and provide a concise reasoning for your choice.

Task Title: {{{taskTitle}}}
Task Description: {{{taskDescription}}}
Available Employees: {{#each employeeList}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

Based on the task requirements and employee list, who should be assigned to this task and why?`,
});

const suggestTaskAssigneeFlow = ai.defineFlow(
  {
    name: 'suggestTaskAssigneeFlow',
    inputSchema: SuggestTaskAssigneeInputSchema,
    outputSchema: SuggestTaskAssigneeOutputSchema,
  },
  async input => {
    const {output} = await suggestTaskAssigneePrompt(input);
    return output!;
  }
);
