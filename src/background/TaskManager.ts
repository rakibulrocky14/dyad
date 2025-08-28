import { Worker } from 'node:worker_threads';
import path from 'node:path';
import log from 'electron-log';
import { db } from '../db';
import { background_tasks } from '../db/schema';
import { eq } from 'drizzle-orm';
import { TaskWorkerInput, TaskWorkerOutput } from '../../workers/background/task_worker';
import { mainWindow } from '../main';

const logger = log.scope('TaskManager');

class TaskManager {
  private activeWorkers: Map<string, Worker> = new Map();

  public async startTask(taskId: string) {
    if (this.activeWorkers.has(taskId)) {
      logger.warn(`Task ${taskId} is already running.`);
      return;
    }

    const task = await db.query.background_tasks.findFirst({
      where: eq(background_tasks.id, taskId),
    });

    if (!task) {
      logger.error(`Task ${taskId} not found in database.`);
      return;
    }

    // In production, the worker file will be in the same directory as the main script.
    // In development, Vite handles this. The path needs to be absolute.
    const workerPath = path.resolve(__dirname, './background.js');
    logger.info(`Spawning worker for task ${taskId} from path: ${workerPath}`);

    const worker = new Worker(workerPath);

    this.activeWorkers.set(taskId, worker);

    worker.on('message', (output: TaskWorkerOutput) => {
      this.handleWorkerMessage(output);
    });

    worker.on('error', (error) => {
      logger.error(`Worker for task ${taskId} threw an error:`, error);
      this.updateTaskStatus(taskId, 'failed', { error: error.message });
      this.activeWorkers.delete(taskId);
    });

    worker.on('exit', (code) => {
      logger.info(`Worker for task ${taskId} exited with code ${code}.`);
      this.activeWorkers.delete(taskId);
      // Optionally, check if the task was completed before exit.
      // If not, mark as failed.
    });

    const workerInput: TaskWorkerInput = {
      taskId: task.id,
      type: task.type,
      payload: task.payload,
    };
    worker.postMessage(workerInput);
  }

  private async handleWorkerMessage(output: TaskWorkerOutput) {
    switch (output.type) {
      case 'status_update':
        await this.updateTaskStatus(output.taskId, output.status, {
          result: output.result,
          error: output.error,
        });
        break;
      case 'log':
        // In a future step, we can append this to a log field in the DB.
        logger.info(`[Task ${output.taskId}]: ${output.message}`);
        break;
      case 'progress_update':
        const [updatedTask] = await db
          .update(background_tasks)
          .set({ progress: output.progress })
          .where(eq(background_tasks.id, output.taskId))
          .returning();
        mainWindow?.webContents.send('bg-task-updated', updatedTask);
        break;
    }
  }

  private async updateTaskStatus(
    taskId: string,
    status: 'running' | 'completed' | 'failed',
    data: { result?: any; error?: string },
  ) {
    try {
      const valuesToUpdate: Partial<typeof background_tasks.$inferInsert> = { status };
      if (status === 'running') {
        valuesToUpdate.startedAt = new Date();
      }
      if (status === 'completed' || status === 'failed') {
        valuesToUpdate.completedAt = new Date();
      }
      if (data.result) {
        valuesToUpdate.result = data.result;
      }
      if (data.error) {
        valuesToUpdate.error = data.error;
      }

      const [updatedTask] = await db
        .update(background_tasks)
        .set(valuesToUpdate)
        .where(eq(background_tasks.id, taskId))
        .returning();

      // Notify the UI
      if (mainWindow && updatedTask) {
        mainWindow.webContents.send('bg-task-updated', updatedTask);
      }
    } catch (error) {
      logger.error(`Failed to update task ${taskId} status to ${status}:`, error);
    }
  }
}

export const taskManager = new TaskManager();
