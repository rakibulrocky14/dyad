import { IpcMainInvokeEvent, ipcMain } from 'electron';
import { db } from '../../db';
import { background_tasks } from '../../db/schema';
import { taskManager } from '../../background/TaskManager';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';

const logger = log.scope('background_task_handlers');

export function registerBackgroundTaskHandlers() {
  // Handler to get all background tasks for a given app
  ipcMain.handle('bg-tasks:get-all', async (_event: IpcMainInvokeEvent, { appId }: { appId: number }) => {
    if (!appId) {
      return [];
    }
    try {
      const tasks = await db.query.background_tasks.findMany({
        where: eq(background_tasks.appId, appId),
        orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
      });
      return tasks;
    } catch (error) {
      logger.error(`Error fetching background tasks for appId ${appId}:`, error);
      return [];
    }
  });

  // Handler to create a new background task
  ipcMain.handle(
    'bg-tasks:create',
    async (
      _event: IpcMainInvokeEvent,
      {
        appId,
        type,
        title,
        description,
        priority,
        payload,
      }: {
        appId: number;
        type: "code_generation" | "app_scaffolding" | "code_refactoring" | "testing_suite" | "build_optimization" | "deployment_prep" | "documentation" | "code_analysis" | "feature_enhancement" | "bug_fixing" | "full_stack_complete";
        title: string;
        description?: string;
        priority?: number;
        payload?: any;
      },
    ) => {
      const taskId = uuidv4();
      try {
        const [newTask] = await db
          .insert(background_tasks)
          .values({
            id: taskId,
            appId,
            type,
            title,
            description,
            priority: priority ?? 3,
            payload,
            status: 'queued',
          })
          .returning();

      logger.info(`Task ${taskId} created. Starting worker...`);
      taskManager.startTask(taskId);

        return newTask;
      } catch (error) {
        logger.error(`Error creating background task:`, error);
        throw error; // Re-throw the error to be caught by the frontend
      }
    },
  );
}
