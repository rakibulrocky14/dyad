CREATE TABLE `background_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`priority` integer DEFAULT 3 NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`estimated_duration` integer,
	`payload` text,
	`result` text,
	`error` text,
	`logs` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`ai_model` text,
	`project_path` text,
	`rules` text,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_dependencies` (
	`task_id` text NOT NULL,
	`depends_on` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `background_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on`) REFERENCES `background_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_dependencies_task_id_depends_on_unique` ON `task_dependencies` (`task_id`,`depends_on`);