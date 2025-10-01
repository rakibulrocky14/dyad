import { describe, expect, it } from "vitest";
import { TaskDatabase } from "./TaskDatabase";
import { TaskManager } from "./TaskManager";
import { WorkerPool } from "./WorkerPool";
import { BackgroundTask } from "./TaskTypes";
import { randomUUID } from "node:crypto";

function createTask(overrides: Partial<BackgroundTask> = {}): BackgroundTask {
  return {
    id: randomUUID(),
    type: "code_generation",
    title: "test",
    description: "",
    priority: 3,
    status: "queued",
    progress: 0,
    estimatedDuration: 1,
    dependencies: [],
    payload: null,
    logs: [],
    createdAt: new Date(),
    aiModel: "",
    projectPath: "",
    rules: "",
    ...overrides,
  };
}

describe("TaskManager", () => {
  it("executes queued tasks", async () => {
    const db = new TaskDatabase();
    const pool = new WorkerPool(1);
    const manager = new TaskManager(db, pool);
    const task = createTask();
    manager.addTask(task);

    // wait for execution
    await new Promise((r) => setTimeout(r, 30));

    const stored = manager.getTask(task.id)!;
    expect(stored.status).toBe("completed");
    expect(stored.progress).toBe(100);
  });
});
