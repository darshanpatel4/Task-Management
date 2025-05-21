import type { User, Project, Task } from '@/types';

export const mockUsers: User[] = [
  { id: 'user1', name: 'Alice Wonderland', email: 'admin@taskflow.ai', role: 'Admin', avatar: 'https://placehold.co/100x100.png?a=1' },
  { id: 'user2', name: 'Bob The Builder', email: 'user@taskflow.ai', role: 'User', avatar: 'https://placehold.co/100x100.png?b=2' },
  { id: 'user3', name: 'Charlie Chaplin', email: 'charlie@taskflow.ai', role: 'User', avatar: 'https://placehold.co/100x100.png?c=3' },
  { id: 'user4', name: 'Diana Prince', email: 'diana@taskflow.ai', role: 'User', avatar: 'https://placehold.co/100x100.png?d=4' },
];

export const mockProjects: Project[] = [
  { id: 'proj1', name: 'Phoenix Project', description: 'Migrate legacy system to cloud infrastructure.' },
  { id: 'proj2', name: 'Dragon Initiative', description: 'Develop new AI-powered analytics feature.' },
  { id: 'proj3', name: 'Unicorn TaskForce', description: 'Complete redesign of the customer-facing portal.' },
];

const now = new Date();
const oneDay = 24 * 60 * 60 * 1000;

export const mockTasks: Task[] = [
  {
    id: 'task1',
    title: 'Setup CI/CD Pipeline for Phoenix',
    description: 'Implement a full CI/CD pipeline for the Phoenix Project using GitHub Actions. Ensure automated testing and deployment to staging.',
    assigneeId: 'user2',
    assigneeName: 'Bob The Builder',
    dueDate: new Date(now.getTime() + 7 * oneDay).toISOString(),
    priority: 'High',
    projectId: 'proj1',
    projectName: 'Phoenix Project',
    status: 'In Progress',
    createdAt: new Date(now.getTime() - 2 * oneDay).toISOString(),
    comments: [
      { id: 'comment1', userId: 'user1', userName: 'Alice Wonderland', userAvatar: mockUsers[0].avatar, comment: 'Great progress, Bob! Keep it up.', createdAt: new Date(now.getTime() - 1 * oneDay).toISOString() },
      { id: 'comment2', userId: 'user2', userName: 'Bob The Builder', userAvatar: mockUsers[1].avatar, comment: 'Thanks Alice! Running into a small issue with deployment scripts, will update soon.', createdAt: new Date(now.getTime() - 0.5 * oneDay).toISOString() }
    ],
    logs: [
      { id: 'log1', userId: 'user2', userName: 'Bob The Builder', hoursSpent: 4, workDescription: 'Initial setup and research on GitHub Actions secrets.', date: new Date(now.getTime() - 1.5 * oneDay).toISOString() },
      { id: 'log2', userId: 'user2', userName: 'Bob The Builder', hoursSpent: 3, workDescription: 'Implemented build and test stages.', date: new Date(now.getTime() - 1 * oneDay).toISOString() }
    ]
  },
  {
    id: 'task2',
    title: 'Design User Interface for Dragon AI',
    description: 'Create mockups and wireframes for the new AI analytics dashboard. Focus on usability and data visualization.',
    assigneeId: 'user3',
    assigneeName: 'Charlie Chaplin',
    dueDate: new Date(now.getTime() + 14 * oneDay).toISOString(),
    priority: 'Medium',
    projectId: 'proj2',
    projectName: 'Dragon Initiative',
    status: 'Pending',
    createdAt: new Date(now.getTime() - 1 * oneDay).toISOString(),
  },
  {
    id: 'task3',
    title: 'User Persona Development for Unicorn',
    description: 'Conduct user interviews and develop detailed user personas for the Unicorn TaskForce project.',
    assigneeId: 'user4',
    assigneeName: 'Diana Prince',
    dueDate: new Date(now.getTime() + 5 * oneDay).toISOString(),
    priority: 'High',
    projectId: 'proj3',
    projectName: 'Unicorn TaskForce',
    status: 'Completed',
    createdAt: new Date(now.getTime() - 10 * oneDay).toISOString(),
  },
  {
    id: 'task4',
    title: 'Approve Unicorn User Personas',
    description: 'Review and approve the user personas developed by Diana for the Unicorn project.',
    assigneeId: 'user1',
    assigneeName: 'Alice Wonderland',
    dueDate: new Date(now.getTime() + 2 * oneDay).toISOString(),
    priority: 'Medium',
    projectId: 'proj3',
    projectName: 'Unicorn TaskForce',
    status: 'Pending', // Pending approval by Admin
    createdAt: new Date(now.getTime() - 0.5 * oneDay).toISOString(),
  },
   {
    id: 'task5',
    title: 'Backend API for Task Logs',
    description: 'Develop the backend API endpoints for creating, reading, updating, and deleting task logs.',
    assigneeId: 'user2',
    assigneeName: 'Bob The Builder',
    dueDate: new Date(now.getTime() + 10 * oneDay).toISOString(),
    priority: 'High',
    projectId: 'proj1',
    projectName: 'Phoenix Project',
    status: 'Pending',
    createdAt: new Date(now.getTime() - 0.2 * oneDay).toISOString(),
  }
];

export function getTaskById(id: string): Task | undefined {
  return mockTasks.find(task => task.id === id);
}

export function getProjectById(id: string): Project | undefined {
  return mockProjects.find(project => project.id === id);
}

export function getUserByEmail(email: string): User | undefined {
  return mockUsers.find(user => user.email === email);
}

export function getUserById(id: string): User | undefined {
  return mockUsers.find(user => user.id === id);
}
