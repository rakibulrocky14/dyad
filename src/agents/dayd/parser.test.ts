import { describe, expect, it } from "vitest";
import { parseAgentArtifacts } from "./parser";

const analysisTag = `<dyad-agent-analysis>{"goals":["Ship"],"constraints":["No regressions"],"acceptanceCriteria":["Tests pass"],"risks":["Time"],"clarifications":[],"dyadTagRefs":["user:1"]}</dyad-agent-analysis>`;
const planTag = `<dyad-agent-plan version="2">{"todos":[{"todoId":"TD-01","title":"Draft interfaces","description":"internal plan","owner":"Planner","inputs":["analysis"],"outputs":["design"],"completionCriteria":"interfaces defined","status":"pending","dyadTagRefs":["analysis:1"]}],"dyadTagRefs":["analysis:1"],"dyadTagContext":["user:1"]}</dyad-agent-plan>`;

const updateTag = `<dyad-agent-todo-update todoId="TD-01" status="completed" dyadTagRefs="plan:2">All done</dyad-agent-todo-update>`;
const logTag = `<dyad-agent-log todoId="TD-01" type="execution" dyadTagRefs="run:1">Implemented and verified</dyad-agent-log>`;
const statusTag = `<dyad-agent-status state="executing"></dyad-agent-status>`;
const focusTag = `<dyad-agent-focus todoId="TD-02"></dyad-agent-focus>`;
const autoTag = `<dyad-agent-auto enabled="true"></dyad-agent-auto>`;

describe("parseAgentArtifacts", () => {
  it("parses analysis and plan payloads", () => {
    const artifacts = parseAgentArtifacts(`${analysisTag}${planTag}`);
    expect(artifacts.analysis?.goals).toEqual(["Ship"]);
    expect(artifacts.plan?.version).toBe(2);
    expect(artifacts.plan?.todos).toHaveLength(1);
    expect(artifacts.plan?.todos[0].todoId).toBe("TD-01");
    expect(artifacts.plan?.todos[0].status).toBe("pending");
  });

  it("collects updates, logs, status, and auto flags", () => {
    const artifacts = parseAgentArtifacts(
      `${updateTag}${logTag}${statusTag}${focusTag}${autoTag}`,
    );
    expect(artifacts.todoUpdates).toEqual([
      {
        todoId: "TD-01",
        status: "completed",
        dyadTagRefs: ["plan:2"],
        note: "All done",
      },
    ]);
    expect(artifacts.logs).toEqual([
      {
        todoId: "TD-01",
        todoKey: undefined,
        logType: "execution",
        content: "Implemented and verified",
        dyadTagRefs: ["run:1"],
        metadata: undefined,
      },
    ]);
    expect(artifacts.workflowStatus).toBe("executing");
    expect(artifacts.currentTodoId).toBe("TD-02");
    expect(artifacts.autoAdvance).toBe(true);
  });

  describe("one-TODO enforcement", () => {
    it("should detect multiple TODO completions in one response", () => {
      const multipleCompletions = `
        <dyad-agent-todo-update todoId="TD-01" status="completed">First task done</dyad-agent-todo-update>
        <dyad-agent-todo-update todoId="TD-02" status="completed">Second task done</dyad-agent-todo-update>
        <dyad-agent-todo-update todoId="TD-03" status="completed">Third task done</dyad-agent-todo-update>
      `;
      const artifacts = parseAgentArtifacts(multipleCompletions);

      // Should have 3 todo updates
      expect(artifacts.todoUpdates).toHaveLength(3);

      // All should be completion updates
      const completedCount = artifacts.todoUpdates.filter(
        (u) => u.status === "completed",
      ).length;
      expect(completedCount).toBe(3);
    });

    it("should detect mixed TODO status updates in one response", () => {
      const mixedUpdates = `
        <dyad-agent-todo-update todoId="TD-01" status="in_progress">Starting first task</dyad-agent-todo-update>
        <dyad-agent-todo-update todoId="TD-02" status="in_progress">Starting second task</dyad-agent-todo-update>
        <dyad-agent-todo-update todoId="TD-01" status="completed">Completed first task</dyad-agent-todo-update>
        <dyad-agent-todo-update todoId="TD-03" status="completed">Completed third task</dyad-agent-todo-update>
      `;
      const artifacts = parseAgentArtifacts(mixedUpdates);

      expect(artifacts.todoUpdates).toHaveLength(4);

      const completedCount = artifacts.todoUpdates.filter(
        (u) => u.status === "completed",
      ).length;
      const inProgressCount = artifacts.todoUpdates.filter(
        (u) => u.status === "in_progress",
      ).length;

      expect(completedCount).toBe(2);
      expect(inProgressCount).toBe(2);
    });

    it("should handle single TODO completion correctly", () => {
      const singleCompletion = `
        <dyad-agent-todo-update todoId="TD-01" status="completed">Task completed properly</dyad-agent-todo-update>
        <dyad-agent-log todoId="TD-01" type="execution">Implementation finished</dyad-agent-log>
      `;
      const artifacts = parseAgentArtifacts(singleCompletion);

      expect(artifacts.todoUpdates).toHaveLength(1);
      expect(artifacts.todoUpdates[0].status).toBe("completed");
      expect(artifacts.todoUpdates[0].todoId).toBe("TD-01");
      expect(artifacts.logs).toHaveLength(1);
    });

    it("should parse TODO updates with various statuses", () => {
      const variousStatuses = `
        <dyad-agent-todo-update todoId="TD-01" status="ready">Ready to start</dyad-agent-todo-update>
        <dyad-agent-todo-update todoId="TD-02" status="blocked">Waiting for dependency</dyad-agent-todo-update>
        <dyad-agent-todo-update todoId="TD-03" status="revising">Making changes</dyad-agent-todo-update>
      `;
      const artifacts = parseAgentArtifacts(variousStatuses);

      expect(artifacts.todoUpdates).toHaveLength(3);
      expect(artifacts.todoUpdates[0].status).toBe("ready");
      expect(artifacts.todoUpdates[1].status).toBe("blocked");
      expect(artifacts.todoUpdates[2].status).toBe("revising");
    });

    it("should parse all TODO updates including those with invalid IDs", () => {
      const invalidUpdates = `
        <dyad-agent-todo-update status="completed">No ID provided</dyad-agent-todo-update>
        <dyad-agent-todo-update todoId="" status="completed">Empty ID</dyad-agent-todo-update>
        <dyad-agent-todo-update todoId="VALID-01" status="completed">Valid update</dyad-agent-todo-update>
      `;
      const artifacts = parseAgentArtifacts(invalidUpdates);

      // The parser should include all updates - validation happens later
      expect(artifacts.todoUpdates.length).toBeGreaterThan(0);

      // Find the valid update
      const validUpdate = artifacts.todoUpdates.find(
        (u) => u.todoId === "VALID-01",
      );
      expect(validUpdate).toBeDefined();
      expect(validUpdate?.status).toBe("completed");
    });
  });

  it("collects warnings for invalid payloads without throwing", () => {
    const artifacts = parseAgentArtifacts(
      `<dyad-agent-plan>{"todos": [{"todoId": "TD-01","title": "x"}]</dyad-agent-plan>`,
    );
    expect(artifacts.plan).toBeUndefined();
    expect(artifacts.warnings.length).toBeGreaterThan(0);
  });
});
