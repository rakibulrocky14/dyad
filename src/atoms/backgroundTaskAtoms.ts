import { atom } from 'jotai';
import { background_tasks } from '../db/schema';

export type BackgroundTask = typeof background_tasks.$inferSelect;

export const backgroundTasksAtom = atom<BackgroundTask[]>([]);

export const isBackgroundPanelOpenAtom = atom(true);
