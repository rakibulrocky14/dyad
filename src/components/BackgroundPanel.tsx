import { useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { backgroundTasksAtom, BackgroundTask } from '../atoms/backgroundTaskAtoms';
import { selectedAppIdAtom } from '../atoms/appAtoms';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { PlusIcon } from 'lucide-react';
import { ipcRenderer } from 'electron';

export function BackgroundPanel() {
  const [tasks, setTasks] = useAtom(backgroundTasksAtom);
  const appId = useAtomValue(selectedAppIdAtom);

  // Fetch initial tasks
  useEffect(() => {
    if (appId) {
      window.electron.ipcRenderer.invoke('bg-tasks:get-all', { appId }).then(setTasks);
    }
  }, [appId, setTasks]);

  // Listen for real-time updates
  useEffect(() => {
    const handleTaskUpdate = (updatedTask: BackgroundTask) => {
      setTasks(prevTasks => {
        const taskIndex = prevTasks.findIndex(t => t.id === updatedTask.id);
        if (taskIndex !== -1) {
          // Update existing task
          const newTasks = [...prevTasks];
          newTasks[taskIndex] = updatedTask;
          return newTasks;
        } else {
          // Add new task
          return [updatedTask, ...prevTasks];
        }
      });
    };

    const unsubscribe = window.electron.ipcRenderer.on('bg-task-updated', handleTaskUpdate);

    return () => {
      unsubscribe();
    };
  }, [setTasks]);

  const handleCreateTestTask = () => {
    if (!appId) return;

    window.electron.ipcRenderer.invoke('bg-tasks:create', {
      appId,
      type: 'code_generation',
      title: 'Generate a test component',
      payload: {
        prompt: 'Create a simple React button component with a blue background.',
      },
    });
  };

  return (
    <Card className="h-full w-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
        <CardTitle className="text-lg">Background Tasks</CardTitle>
        <Button size="sm" variant="outline" onClick={handleCreateTestTask}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </CardHeader>
      <CardContent className="p-4 overflow-y-auto">
        <div className="space-y-4">
          {tasks.map(task => (
            <div key={task.id} className="p-3 rounded-md border bg-muted/50">
              <div className="font-semibold">{task.title}</div>
              <div className="text-sm text-muted-foreground">
                Status: <span className={`font-medium ${
                  task.status === 'completed' ? 'text-green-500' :
                  task.status === 'failed' ? 'text-red-500' :
                  'text-yellow-500'
                }`}>{task.status}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">ID: {task.id}</div>
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              No background tasks.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
