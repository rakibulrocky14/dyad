import Database from "better-sqlite3";
import { BackgroundTask } from "./TaskTypes";

/**
 * Simple SQLite backed task database. It lazily creates tables if they do not
 * yet exist. The database stores tasks and their dependencies.
 */
export class TaskDatabase {
  private db: Database.Database;

  constructor(path = ":memory:") {
    this.db = new Database(path);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS background_tasks (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority INTEGER DEFAULT 3,
        status TEXT DEFAULT 'queued',
        progress REAL DEFAULT 0,
        estimated_duration INTEGER,
        payload TEXT,
        result TEXT,
        error TEXT,
        logs TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        ai_model TEXT,
        project_path TEXT,
        rules TEXT
      );

      CREATE TABLE IF NOT EXISTS task_dependencies (
        task_id TEXT,
        depends_on TEXT,
        FOREIGN KEY (task_id) REFERENCES background_tasks(id),
        FOREIGN KEY (depends_on) REFERENCES background_tasks(id)
      );
    `);
  }

  createTask(task: BackgroundTask) {
    const stmt = this.db.prepare(`INSERT INTO background_tasks (
      id, type, title, description, priority, status, progress, estimated_duration,
      payload, result, error, logs, created_at, started_at, completed_at,
      ai_model, project_path, rules
    ) VALUES (@id, @type, @title, @description, @priority, @status, @progress, @estimatedDuration,
      @payload, @result, @error, @logs, @createdAt, @startedAt, @completedAt,
      @aiModel, @projectPath, @rules)`);
    stmt.run({
      ...task,
      payload: JSON.stringify(task.payload ?? null),
      result: JSON.stringify(task.result ?? null),
      error: task.error ?? null,
      logs: JSON.stringify(task.logs ?? []),
      createdAt: task.createdAt.toISOString(),
      startedAt: task.startedAt?.toISOString(),
      completedAt: task.completedAt?.toISOString(),
    });

    // dependencies
    const depStmt = this.db.prepare(
      `INSERT INTO task_dependencies (task_id, depends_on) VALUES (?, ?)`,
    );
    for (const dep of task.dependencies) {
      depStmt.run(task.id, dep);
    }
  }

  getTask(id: string): BackgroundTask | null {
    const row = this.db
      .prepare(`SELECT * FROM background_tasks WHERE id = ?`)
      .get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      progress: row.progress,
      estimatedDuration: row.estimated_duration,
      dependencies: this.getDependencies(row.id),
      payload: JSON.parse(row.payload ?? "null"),
      result: JSON.parse(row.result ?? "null"),
      error: row.error ?? undefined,
      logs: JSON.parse(row.logs ?? "[]"),
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      aiModel: row.ai_model ?? "",
      projectPath: row.project_path ?? "",
      rules: row.rules ?? "",
    };
  }

  updateTask(id: string, updates: Partial<BackgroundTask>) {
    const current = this.getTask(id);
    if (!current) return;
    const updated = { ...current, ...updates } as BackgroundTask;
    const stmt = this.db.prepare(`UPDATE background_tasks SET
      type=@type,
      title=@title,
      description=@description,
      priority=@priority,
      status=@status,
      progress=@progress,
      estimated_duration=@estimatedDuration,
      payload=@payload,
      result=@result,
      error=@error,
      logs=@logs,
      created_at=@createdAt,
      started_at=@startedAt,
      completed_at=@completedAt,
      ai_model=@aiModel,
      project_path=@projectPath,
      rules=@rules
      WHERE id=@id`);
    stmt.run({
      ...updated,
      payload: JSON.stringify(updated.payload ?? null),
      result: JSON.stringify(updated.result ?? null),
      error: updated.error ?? null,
      logs: JSON.stringify(updated.logs ?? []),
      createdAt: updated.createdAt.toISOString(),
      startedAt: updated.startedAt?.toISOString(),
      completedAt: updated.completedAt?.toISOString(),
    });
  }

  private getDependencies(id: string): string[] {
    const rows = this.db
      .prepare(`SELECT depends_on FROM task_dependencies WHERE task_id = ?`)
      .all(id) as any[];
    return rows.map((r) => r.depends_on);
  }

  listQueued(): BackgroundTask[] {
    const rows = this.db
      .prepare(
        `SELECT id FROM background_tasks WHERE status = 'queued' ORDER BY priority ASC`,
      )
      .all() as any[];
    return rows.map((r) => this.getTask(r.id)!) as BackgroundTask[];
  }
}
