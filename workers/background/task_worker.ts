import { parentPort } from 'node:worker_threads';
import log from 'electron-log';

const logger = log.scope('task_worker');

export interface TaskWorkerInput {
  taskId: string;
  type: string;
  payload: any;
}

export type TaskWorkerOutput =
  | {
      type: 'status_update';
      taskId: string;
      status: 'running' | 'completed' | 'failed';
      result?: any;
      error?: string;
    }
  | {
      type: 'log';
      taskId: string;
      message: string;
    }
  | {
      type: 'progress_update';
      taskId: string;
      progress: number;
    };

// Simple sleep function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function executeTask(input: TaskWorkerInput) {
  logger.info(`Worker received task: ${input.taskId}`);

  // 1. Notify main thread that task is running
  parentPort?.postMessage({
    type: 'status_update',
    taskId: input.taskId,
    status: 'running',
  } as TaskWorkerOutput);

  // 2. Simulate doing work
  parentPort?.postMessage({
    type: 'log',
    taskId: input.taskId,
    message: 'Starting simulated work...',
  } as TaskWorkerOutput);
  await sleep(2000);

  parentPort?.postMessage({
    type: 'progress_update',
    taskId: input.taskId,
    progress: 50,
  } as TaskWorkerOutput);

  parentPort?.postMessage({
    type: 'log',
    taskId: input.taskId,
    message: '...still working...',
  } as TaskWorkerOutput);
  await sleep(2000);

  parentPort?.postMessage({
    type: 'log',
    taskId: input.taskId,
    message: 'Simulated work finished.',
  } as TaskWorkerOutput);

  parentPort?.postMessage({
    type: 'progress_update',
    taskId: input.taskId,
    progress: 100,
  } as TaskWorkerOutput);

  // 3. Notify main thread that task is complete
  parentPort?.postMessage({
    type: 'status_update',
    taskId: input.taskId,
    status: 'completed',
    result: { message: 'Task completed successfully' },
  } as TaskWorkerOutput);
}

// Listen for messages from the main thread
parentPort?.on('message', async (input: TaskWorkerInput) => {
  try {
    await executeTask(input);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error executing task ${input.taskId}:`, error);
    parentPort?.postMessage({
      type: 'status_update',
      taskId: input.taskId,
      status: 'failed',
      error: errorMessage,
    } as TaskWorkerOutput);
  }
});

logger.info('Task worker started and listening for tasks.');
