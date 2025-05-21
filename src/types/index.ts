
export type UserRole = 'Admin' | 'User';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string; // URL to avatar image
}

export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Approved';
export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string; // User ID
  assigneeName?: string; // Denormalized for easy display
  dueDate: string; // ISO date string
  priority: TaskPriority;
  projectId: string;
  projectName?: string; // Denormalized for easy display
  status: TaskStatus;
  createdAt: string; // ISO date string
  logs?: TaskLog[];
  comments?: TaskComment[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
}

export interface TaskLog {
  id: string;
  userId: string;
  userName?: string; // Denormalized
  hoursSpent: number;
  workDescription: string;
  date: string; // ISO date string
}

export interface TaskComment {
  id: string;
  userId: string;
  userName?: string; // Denormalized
  userAvatar?: string; // Denormalized
  comment: string;
  createdAt: string; // ISO date string
}

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  children?: NavItem[];
}
