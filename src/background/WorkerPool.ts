/**
 * Minimal in-process worker pool that limits the number of concurrently
 * running asynchronous tasks. This is a lightweight substitute for a full
 * worker thread implementation and is sufficient for unit testing the task
 * scheduling logic.
 */
export type WorkerFn<T = any> = () => Promise<T>;

export class WorkerPool {
  private queue: WorkerFn[] = [];
  private active = 0;

  constructor(private maxWorkers = 4) {}

  /**
   * Queue a task for execution. The promise resolves with the task's result
   * once it has completed.
   */
  run<T>(fn: WorkerFn<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const task: WorkerFn = async () => {
        try {
          const result = await fn();
          resolve(result as T);
        } catch (err) {
          reject(err);
        } finally {
          this.active--;
          this.next();
        }
      };
      this.queue.push(task);
      this.next();
    });
  }

  private next() {
    if (this.active >= this.maxWorkers) return;
    const task = this.queue.shift();
    if (!task) return;
    this.active++;
    task();
  }

  pending() {
    return this.queue.length + this.active;
  }
}
