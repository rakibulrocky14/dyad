export type TaskStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskType =
  | "code_generation"
  | "app_scaffolding"
  | "code_refactoring"
  | "testing_suite"
  | "build_optimization"
  | "deployment_prep"
  | "documentation"
  | "code_analysis"
  | "feature_enhancement"
  | "bug_fixing"
  | "full_stack_complete";

export interface BackgroundTask {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  priority: 1 | 2 | 3 | 4 | 5;
  status: TaskStatus;
  progress: number;
  estimatedDuration: number;
  dependencies: string[];
  payload: any;
  result?: any;
  error?: string;
  logs: string[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  aiModel: string;
  projectPath: string;
  rules: string;
}
