import log from "electron-log";
import type { ChatStreamParams } from "@/ipc/ipc_types";
import {
  ensureAgentWorkflow,
  getAgentWorkflowById,
  getAgentWorkflowStateByChatId,
  setAgentWorkflowStatus,
  updateAgentAnalysis,
  replaceAgentPlan,
  applyAgentTodoUpdates,
  appendAgentLog,
  setAgentCurrentTodo,
  setAgentAutoAdvance,
} from "./agent_workflow_service";
import {
  parseAgentArtifacts,
  type AgentParsedArtifacts,
} from "@/agents/dayd/parser";
import type {
  AgentCommand,
  AgentTodo,
  AgentWorkflow,
  AgentWorkflowStatus,
} from "@/agents/dayd/types";
import {
  AgentCommandSchema,
  AgentTodoUpdateSchema,
} from "@/agents/dayd/types";

const logger = log.scope("agent-chat-controller");

export interface AgentStreamPreparation {
  workflow: AgentWorkflow;
  workflowId: number;
  command: AgentCommand;
  contextMessage: string;
  interceptResponse?: string;
}

export interface AgentStreamResult {
  workflow: AgentWorkflow;
  artifacts: AgentParsedArtifacts;
  shouldAutoContinue: boolean;
}

function detectCommand(prompt: string, workflow: AgentWorkflow | null): AgentCommand {
  const trimmed = prompt.trim();
  const lower = trimmed.toLowerCase();

  // Determine if workflow has an approved plan
  const hasPlan = workflow && workflow.todos.length > 0;
  const remainingTodos = hasPlan
    ? workflow!.todos.filter((todo) => todo.status !== "completed")
    : [];

  if (!hasPlan || workflow?.status === "idle") {
    return { kind: "brief", payload: { prompt: trimmed } } as AgentCommand;
  }

  if (lower === "start") {
    return { kind: "start", payload: { prompt: trimmed } } as AgentCommand;
  }

  if (lower === "continue") {
    return { kind: "continue", payload: { prompt: trimmed } } as AgentCommand;
  }

  if (lower === "change plan" || lower === "change-plan") {
    return { kind: "change_plan", payload: { prompt: trimmed } } as AgentCommand;
  }

  if (lower.startsWith("revise")) {
    const parts = trimmed.split(/\s+/);
    const todoId = parts[1];
    if (todoId) {
      return {
        kind: "revise",
        payload: { prompt: trimmed, todoId: todoId.toUpperCase() },
      } as AgentCommand;
    }
  }

  if (lower.startsWith("switch mode")) {
    return {
      kind: "switch_mode",
      payload: { prompt: trimmed, target: lower.split(/[:\s]+/).pop() },
    } as AgentCommand;
  }

  // If the user explicitly requests auto-advance toggle
  if (lower === "auto" || lower === "auto continue") {
    return { kind: "custom", payload: { prompt: trimmed, toggleAuto: true } } as AgentCommand;
  }

  // If there are no remaining todos, treat as review conversation
  if (remainingTodos.length === 0) {
    return { kind: "custom", payload: { prompt: trimmed, stage: "completed" } } as AgentCommand;
  }

  return { kind: "custom", payload: { prompt: trimmed } } as AgentCommand;
}

function summariseTodos(todos: AgentTodo[]): Array<Record<string, unknown>> {
  return todos.map((todo) => ({
    todoId: todo.todoId,
    title: todo.title,
    description: todo.description,
    owner: todo.owner,
    status: todo.status,
    inputs: todo.inputs,
    outputs: todo.outputs,
    completionCriteria: todo.completionCriteria,
    dyadTagRefs: todo.dyadTagRefs,
    orderIndex: todo.orderIndex,
  }));
}

function findNextTodo(workflow: AgentWorkflow): AgentTodo | undefined {
  return workflow.todos.find((todo) => todo.status !== "completed");
}

export async function prepareAgentStream(
  req: ChatStreamParams,
): Promise<AgentStreamPreparation> {
  const workflowRow = await ensureAgentWorkflow(req.chatId);
  let workflow = await getAgentWorkflowById(workflowRow.id);
  if (!workflow) {
    const fallback = await getAgentWorkflowStateByChatId(req.chatId);
    if (!fallback) {
      throw new Error(`Unable to load workflow for chat ${req.chatId}`);
    }
    workflow = fallback;
  }

  let command = detectCommand(req.prompt, workflow);

  // Normalize command through schema to guarantee structure
  const parsedCommand = AgentCommandSchema.safeParse(command);
  if (parsedCommand.success) {
    command = parsedCommand.data;
  }

  const commandLogPayload = {
    command: command.kind,
    prompt: req.prompt,
  } as Record<string, unknown>;

  const applyUpdates: Array<{ todoId: string; status: string }> = [];
  let targetTodo: AgentTodo | undefined;

  switch (command.kind) {
    case "brief": {
      await setAgentWorkflowStatus(workflowRow.id, "analysis");
      await setAgentCurrentTodo(workflowRow.id, null);
      workflow = (await getAgentWorkflowById(workflowRow.id)) ?? workflow;
      await appendAgentLog(workflowRow.id, {
        logType: "command",
        content: "Received new brief; entering analysis mode",
        metadata: commandLogPayload,
      });
      break;
    }
    case "change_plan": {
      await setAgentWorkflowStatus(workflowRow.id, "analysis");
      await setAgentCurrentTodo(workflowRow.id, null);
      workflow = (await getAgentWorkflowById(workflowRow.id)) ?? workflow;
      await appendAgentLog(workflowRow.id, {
        logType: "command",
        content: "User requested a new plan",
        metadata: commandLogPayload,
      });
      break;
    }
    case "revise": {
      const todoId = command.payload?.todoId;
      const todo = workflow.todos.find(
        (item) => item.todoId.toUpperCase() === todoId?.toUpperCase(),
      );
      if (todo) {
        applyUpdates.push({ todoId: todo.todoId, status: "revising" });
        await appendAgentLog(workflowRow.id, {
          logType: "command",
          todoId: todo.todoId,
          content: `Revise requested for ${todo.todoId}`,
          metadata: commandLogPayload,
        });
      } else {
        await appendAgentLog(workflowRow.id, {
          logType: "system",
          content: `Revise command referenced missing todo ${todoId}`,
          metadata: commandLogPayload,
        });
      }
      await setAgentWorkflowStatus(workflowRow.id, "revising");
      workflow = (await getAgentWorkflowById(workflowRow.id)) ?? workflow;
      break;
    }
    case "start": {
      targetTodo = findNextTodo(workflow);
      if (targetTodo) {
        applyUpdates.push({ todoId: targetTodo.todoId, status: "in_progress" });
        await setAgentCurrentTodo(workflowRow.id, targetTodo.todoId);
        await setAgentWorkflowStatus(workflowRow.id, "executing");
        await appendAgentLog(workflowRow.id, {
          logType: "command",
          todoId: targetTodo.todoId,
          content: `Starting TODO ${targetTodo.todoId}`,
          metadata: commandLogPayload,
        });
      } else {
        await appendAgentLog(workflowRow.id, {
          logType: "system",
          content: "No remaining TODOs to start",
          metadata: commandLogPayload,
        });
      }
      break;
    }
    case "continue": {
      const pending = workflow.todos.filter((todo) => todo.status !== "completed");
      targetTodo = pending[0];
      if (targetTodo) {
        applyUpdates.push({ todoId: targetTodo.todoId, status: "in_progress" });
        await setAgentCurrentTodo(workflowRow.id, targetTodo.todoId);
        await setAgentWorkflowStatus(workflowRow.id, "executing");
        await appendAgentLog(workflowRow.id, {
          logType: "command",
          todoId: targetTodo.todoId,
          content: `Continuing with TODO ${targetTodo.todoId}`,
          metadata: commandLogPayload,
        });
      } else {
        await appendAgentLog(workflowRow.id, {
          logType: "system",
          content: "Continue requested but all TODOs are complete",
          metadata: commandLogPayload,
        });
      }
      break;
    }
    case "switch_mode": {
      await appendAgentLog(workflowRow.id, {
        logType: "command",
        content: `User requested to switch mode to ${command.payload?.target}`,
        metadata: commandLogPayload,
      });
      break;
    }
    default: {
      await appendAgentLog(workflowRow.id, {
        logType: "command",
        content: `User input: ${req.prompt}`,
        metadata: commandLogPayload,
      });
    }
  }

  if (applyUpdates.length) {
    await applyAgentTodoUpdates(
      workflowRow.id,
      applyUpdates.map((update) => ({
        todoId: update.todoId,
        status: update.status,
      })),
    );
  }

  workflow = (await getAgentWorkflowById(workflowRow.id)) ?? workflow;

  const contextTodos =
    command.kind === "brief" || command.kind === "change_plan"
      ? []
      : workflow.todos;

  const context = {
    timestamp: new Date().toISOString(),
    status: workflow.status,
    autoAdvance: workflow.autoAdvance,
    currentTodoId: workflow.currentTodoId,
    dyadTagContext: workflow.dyadTagContext,
    command: { ...command, raw: req.prompt },
    analysis: workflow.analysis,
    todos: summariseTodos(contextTodos),
  };

  const contextMessage = `<agent-workflow-context>${JSON.stringify(context)}</agent-workflow-context>`;

  return {
    workflow,
    workflowId: workflowRow.id,
    command,
    contextMessage,
  };
}

export async function processAgentStreamResult(
  workflowId: number,
  responseText: string,
): Promise<AgentStreamResult> {
  const artifacts = parseAgentArtifacts(responseText);

  if (artifacts.warnings.length) {
    for (const warning of artifacts.warnings) {
      logger.warn(`[agent] ${warning}`);
    }
  }

  if (artifacts.analysis) {
    await updateAgentAnalysis(workflowId, artifacts.analysis);
  }

  if (artifacts.plan) {
    await replaceAgentPlan(workflowId, artifacts.plan, { status: "plan_ready" });
  }

  if (artifacts.todoUpdates.length) {
    await applyAgentTodoUpdates(
      workflowId,
      artifacts.todoUpdates.map((update) => ({
        todoId: update.todoId,
        status: update.status ?? "in_progress",
        dyadTagRefs: update.dyadTagRefs,
      })),
    );
  }

  if (artifacts.logs.length) {
    for (const logEntry of artifacts.logs) {
      if (!logEntry.content.trim()) continue;
      await appendAgentLog(workflowId, {
        todoId: logEntry.todoId ?? undefined,
        todoKey: logEntry.todoKey ?? undefined,
        logType: logEntry.logType,
        content: logEntry.content,
        dyadTagRefs: logEntry.dyadTagRefs,
        metadata: logEntry.metadata,
      });
    }
  }

  if (artifacts.workflowStatus) {
    await setAgentWorkflowStatus(workflowId, artifacts.workflowStatus);
  }

  if (artifacts.currentTodoId !== undefined) {
    await setAgentCurrentTodo(workflowId, artifacts.currentTodoId ?? null);
  }

  if (artifacts.autoAdvance !== undefined) {
    await setAgentAutoAdvance(workflowId, artifacts.autoAdvance);
  }

  const workflow = (await getAgentWorkflowById(workflowId))!;
  const pendingTodos = workflow.todos.filter((todo) => todo.status !== "completed");
  const activeTodo = workflow.todos.find((todo) => todo.todoId === workflow.currentTodoId);

  const shouldAutoContinue = Boolean(
    workflow.autoAdvance &&
      pendingTodos.length > 0 &&
      (!activeTodo || activeTodo.status !== "in_progress"),
  );

  return {
    workflow,
    artifacts,
    shouldAutoContinue,
  };
}
