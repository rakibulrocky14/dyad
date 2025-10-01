import { EventEmitter } from "node:events";
import { BackgroundTask, TaskStatus } from "./TaskTypes";
import { TaskDatabase } from "./TaskDatabase";
import { WorkerPool } from "./WorkerPool";

/**
 * TaskManager orchestrates persistence and execution of background tasks. The
 * implementation here focuses on queueing and basic life cycle management so
 * unit tests can exercise the scheduling logic.
 */
export class TaskManager extends EventEmitter {
  constructor(
    private db: TaskDatabase,
    private pool: WorkerPool,
  ) {
    super();
  }

  /**
   * Add a new task to the queue and persist it in the database.
   */
  addTask(task: BackgroundTask) {
    this.db.createTask(task);
    this.emit("taskQueued", task);
    this.schedule(task);
  }

  private schedule(task: BackgroundTask) {
    this.pool.run(async () => {
      this.updateStatus(task.id, "running");
      this.emit("taskStarted", task);
      // Simulated work: in a real implementation the worker would execute
      // different logic depending on task.type. Here we simply wait.
      await new Promise((r) => setTimeout(r, 10));
      this.updateStatus(task.id, "completed");
      this.emit("taskCompleted", { ...task, status: "completed" });
    });
  }

  private updateStatus(id: string, status: TaskStatus) {
    const task = this.db.getTask(id);
    if (!task) return;
    this.db.updateTask(id, {
      status,
      progress: status === "completed" ? 100 : task.progress,
      startedAt:
        task.startedAt ?? (status === "running" ? new Date() : task.startedAt),
      completedAt:
        status === "completed" || status === "failed"
          ? new Date()
          : task.completedAt,
    });
  }

  getTask(id: string) {
    return this.db.getTask(id);
  }

  listQueued() {
    return this.db.listQueued();
  }
}
