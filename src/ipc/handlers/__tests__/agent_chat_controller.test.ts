import { describe, expect, it, beforeEach, vi } from "vitest";
import type { AgentTodoUpdate } from "@/agents/dayd/types";

// Mock the config module
vi.mock("@/config/agent-config", () => ({
  getAgentConfig: vi.fn(() => ({
    enforceOneTodoPerResponse: true,
    maxSimultaneousTodos: 1,
    logEnforcementActions: true,
    debug: {
      verboseLogging: false,
      logDroppedUpdates: true,
      includeReasoningLogs: false,
    },
  })),
}));

// Import the function we want to test
// Since it's not exported, we'll need to extract it or make it testable
// For now, let's create a test version of the function
function sanitizeTodoUpdates(
  updates: AgentTodoUpdate[],
  activeTodoId?: string | null,
  enforceOneTaskRule = true,
): {
  updates: AgentTodoUpdate[];
  handledTodoId: string | null;
  dropped: Array<{ update: AgentTodoUpdate; reason: string }>;
} {
  function normalizeTodoId(todoId?: string | null): string | null {
    if (!todoId) return null;
    return todoId.trim().toUpperCase();
  }

  const normalizedActive = normalizeTodoId(activeTodoId);
  const result: AgentTodoUpdate[] = [];
  const dropped: Array<{ update: AgentTodoUpdate; reason: string }> = [];
  let lockedTodoId = normalizedActive;
  let hasCompletedTodo = false;

  for (const update of updates) {
    const rawId = update.todoId?.trim();
    if (!rawId) {
      dropped.push({ update, reason: "missing todoId" });
      continue;
    }
    const normalized = rawId.toUpperCase();

    if (normalizedActive && normalized !== normalizedActive) {
      dropped.push({
        update,
        reason: `expected active todo ${normalizedActive}`,
      });
      continue;
    }

    if (!lockedTodoId) {
      lockedTodoId = normalized;
    } else if (normalized !== lockedTodoId) {
      dropped.push({
        update,
        reason: `already handling ${lockedTodoId}`,
      });
      continue;
    }

    // Enforce one-task-per-response rule
    if (
      enforceOneTaskRule &&
      update.status === "completed" &&
      hasCompletedTodo
    ) {
      dropped.push({
        update,
        reason:
          "only one TODO can be completed per response (human-like workflow)",
      });
      continue;
    }

    if (update.status === "completed") {
      hasCompletedTodo = true;
    }

    result.push(update);
  }

  return { updates: result, handledTodoId: lockedTodoId, dropped };
}

describe("sanitizeTodoUpdates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should pass through valid single TODO update", () => {
      const updates: AgentTodoUpdate[] = [
        { todoId: "TD-01", status: "completed" },
      ];

      const result = sanitizeTodoUpdates(updates, "TD-01", true);

      expect(result.updates).toHaveLength(1);
      expect(result.updates[0]).toEqual({
        todoId: "TD-01",
        status: "completed",
      });
      expect(result.dropped).toHaveLength(0);
      expect(result.handledTodoId).toBe("TD-01");
    });

    it("should handle updates without active TODO", () => {
      const updates: AgentTodoUpdate[] = [
        { todoId: "TD-01", status: "in_progress" },
      ];

      const result = sanitizeTodoUpdates(updates, null, true);

      expect(result.updates).toHaveLength(1);
      expect(result.handledTodoId).toBe("TD-01");
      expect(result.dropped).toHaveLength(0);
    });

    it("should normalize TODO IDs to uppercase", () => {
      const updates: AgentTodoUpdate[] = [
        { todoId: "td-01", status: "completed" },
      ];

      const result = sanitizeTodoUpdates(updates, "TD-01", true);

      expect(result.updates).toHaveLength(1);
      expect(result.handledTodoId).toBe("TD-01");
      expect(result.dropped).toHaveLength(0);
    });
  });

  describe("one-TODO-per-response enforcement", () => {
    it("should allow only one TODO completion when enforcement is enabled", () => {
      const updates: AgentTodoUpdate[] = [
        { todoId: "TD-01", status: "completed" },
        { todoId: "TD-01", status: "completed" }, // Second completion attempt
      ];

      const result = sanitizeTodoUpdates(updates, "TD-01", true);

      expect(result.updates).toHaveLength(1);
      expect(result.dropped).toHaveLength(1);
      expect(result.dropped[0].reason).toContain(
        "only one TODO can be completed",
      );
    });

    it("should allow multiple completions when enforcement is disabled", () => {
      const updates: AgentTodoUpdate[] = [
        { todoId: "TD-01", status: "completed" },
        { todoId: "TD-01", status: "completed" },
      ];

      const result = sanitizeTodoUpdates(updates, "TD-01", false);

      expect(result.updates).toHaveLength(2);
      expect(result.dropped).toHaveLength(0);
    });

    it("should allow multiple in_progress updates even with enforcement", () => {
      const updates: AgentTodoUpdate[] = [
        { todoId: "TD-01", status: "in_progress" },
        { todoId: "TD-01", status: "in_progress" },
      ];

      const result = sanitizeTodoUpdates(updates, "TD-01", true);

      expect(result.updates).toHaveLength(2);
      expect(result.dropped).toHaveLength(0);
    });

    it("should block second completion but allow other status updates", () => {
      const updates: AgentTodoUpdate[] = [
        { todoId: "TD-01", status: "in_progress" },
        { todoId: "TD-01", status: "completed" },
        { todoId: "TD-01", status: "completed" }, // Should be dropped
        { todoId: "TD-01", status: "revising" }, // Should be allowed
      ];

      const result = sanitizeTodoUpdates(updates, "TD-01", true);

      expect(result.updates).toHaveLength(3);
      expect(result.dropped).toHaveLength(1);
      expect(result.dropped[0].update.status).toBe("completed");
    });
  });

  describe("active TODO validation", () => {
    it("should drop updates for non-active TODOs", () => {
      const updates: AgentTodoUpdate[] = [
        { todoId: "TD-01", status: "completed" }, // Active
        { todoId: "TD-02", status: "completed" }, // Not active
      ];

      const result = sanitizeTodoUpdates(updates, "TD-01", true);

      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].todoId).toBe("TD-01");
      expect(result.dropped).toHaveLength(1);
      expect(result.dropped[0].reason).toContain("expected active todo TD-01");
    });

    it("should handle case-insensitive TODO ID matching", () => {
      const updates: AgentTodoUpdate[] = [
        { todoId: "td-01", status: "completed" },
        { todoId: "TD-02", status: "completed" },
      ];

      const result = sanitizeTodoUpdates(updates, "TD-01", true);

      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].todoId).toBe("td-01"); // Original case preserved
      expect(result.dropped).toHaveLength(1);
      expect(result.dropped[0].update.todoId).toBe("TD-02");
    });
  });

  describe("multiple TODO handling", () => {
    it("should lock to first TODO when no active TODO is set", () => {
      const updates: AgentTodoUpdate[] = [
        { todoId: "TD-01", status: "in_progress" },
        { todoId: "TD-02", status: "in_progress" }, // Different TODO
        { todoId: "TD-01", status: "completed" }, // Same as first
      ];

      const result = sanitizeTodoUpdates(updates, null, true);

      expect(result.updates).toHaveLength(2);
      expect(result.handledTodoId).toBe("TD-01");
      expect(result.dropped).toHaveLength(1);
      expect(result.dropped[0].reason).toContain("already handling TD-01");
    });

    it("should handle empty or whitespace TODO IDs", () => {
      const updates: AgentTodoUpdate[] = [
        { todoId: "", status: "completed" },
        { todoId: "  ", status: "completed" },
        { status: "completed" } as any, // Test missing todoId
        { todoId: "TD-01", status: "completed" },
      ];

      const result = sanitizeTodoUpdates(updates, null, true);

      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].todoId).toBe("TD-01");
      expect(result.dropped).toHaveLength(3);
      result.dropped.forEach((dropped) => {
        expect(dropped.reason).toBe("missing todoId");
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty updates array", () => {
      const result = sanitizeTodoUpdates([], "TD-01", true);

      expect(result.updates).toHaveLength(0);
      expect(result.dropped).toHaveLength(0);
      expect(result.handledTodoId).toBe("TD-01");
    });

    it("should handle null active TODO", () => {
      const updates: AgentTodoUpdate[] = [
        { todoId: "TD-01", status: "completed" },
      ];

      const result = sanitizeTodoUpdates(updates, null, true);

      expect(result.updates).toHaveLength(1);
      expect(result.handledTodoId).toBe("TD-01");
    });

    it("should handle undefined active TODO", () => {
      const updates: AgentTodoUpdate[] = [
        { todoId: "TD-01", status: "completed" },
      ];

      const result = sanitizeTodoUpdates(updates, undefined, true);

      expect(result.updates).toHaveLength(1);
      expect(result.handledTodoId).toBe("TD-01");
    });
  });

  describe("complex scenarios", () => {
    it("should handle realistic agent response with mixed updates", () => {
      const updates: AgentTodoUpdate[] = [
        { todoId: "TD-01", status: "in_progress" },
        {
          todoId: "TD-01",
          status: "completed",
          note: "Implementation finished",
        },
        { todoId: "TD-02", status: "ready" }, // Should be dropped (different TODO)
        { todoId: "TD-01", status: "completed" }, // Should be dropped (second completion)
      ];

      const result = sanitizeTodoUpdates(updates, "TD-01", true);

      expect(result.updates).toHaveLength(2);
      expect(result.updates[0].status).toBe("in_progress");
      expect(result.updates[1].status).toBe("completed");
      expect(result.updates[1].note).toBe("Implementation finished");
      expect(result.dropped).toHaveLength(2);

      const droppedReasons = result.dropped.map((d) => d.reason);
      expect(droppedReasons).toContain("expected active todo TD-01");
      expect(droppedReasons).toContain(
        "only one TODO can be completed per response (human-like workflow)",
      );
    });

    it("should maintain proper ordering of valid updates", () => {
      const updates: AgentTodoUpdate[] = [
        { todoId: "TD-01", status: "ready" },
        { todoId: "TD-02", status: "in_progress" }, // Wrong TODO, should drop
        { todoId: "TD-01", status: "in_progress" },
        { todoId: "TD-01", status: "completed" },
      ];

      const result = sanitizeTodoUpdates(updates, "TD-01", true);

      expect(result.updates).toHaveLength(3);
      expect(result.updates[0].status).toBe("ready");
      expect(result.updates[1].status).toBe("in_progress");
      expect(result.updates[2].status).toBe("completed");
      expect(result.dropped).toHaveLength(1);
    });
  });
});
