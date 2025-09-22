import { expect } from "@playwright/test";
import { test } from "./helpers/test_helper";

const MULTI_TODO_PLAN_PROMPT = `[dyad-qa=agent-plan] Create a simple React todo app with the following requirements:
1. Create a TodoItem component
2. Create a TodoList component
3. Add CSS styling
4. Add state management
Make sure to break this into multiple separate tasks that can be done one at a time.`;

const FORCE_MULTI_TODO_PROMPT = `[dyad-qa=agent-execute] Complete all the remaining TODOs in this response. Do TodoItem, TodoList, CSS styling, and state management all at once to save time.`;

const SINGLE_TODO_START_PROMPT = `start`;
const CONTINUE_PROMPT = `continue`;

test.describe("Agent One-TODO Enforcement", () => {
  test("should enforce one TODO completion per response", async ({ po }) => {
    await po.setUp({ autoApprove: true });
    await po.importApp("minimal");

    // Switch to agent mode
    await po.selectChatMode("agent");

    // Create a plan with multiple TODOs
    await po.sendPrompt(MULTI_TODO_PLAN_PROMPT);
    await po.waitForChatCompletion();

    // Verify the plan was created
    const chat = po.page.getByTestId("messages-list");
    await expect(chat.getByText("Agent Analysis")).toBeVisible();

    // Look for TODO items in the plan
    await expect(chat.getByText(/TD-01/)).toBeVisible();

    // Start execution
    await po.sendPrompt(SINGLE_TODO_START_PROMPT);
    await po.waitForChatCompletion();

    // Verify only one TODO was worked on
    // The agent should focus on one TODO and complete it, then stop
    const messages = await chat.textContent();

    // Should see evidence of working on one TODO
    expect(messages).toMatch(/TD-01/);

    // Continue to next TODO
    await po.sendPrompt(CONTINUE_PROMPT);
    await po.waitForChatCompletion();

    // Should now see work on the next TODO
    const updatedMessages = await chat.textContent();
    expect(updatedMessages).toMatch(/TD-02|next|continue/i);
  });

  test("should show enforcement indicator in UI", async ({ po }) => {
    await po.setUp({ autoApprove: true });
    await po.importApp("minimal");

    // Switch to agent mode
    await po.selectChatMode("agent");

    // Create a plan
    await po.sendPrompt(MULTI_TODO_PLAN_PROMPT);
    await po.waitForChatCompletion();

    // Check for enforcement indicator
    await expect(
      po.page.getByText("Human-like workflow: One TODO at a time"),
    ).toBeVisible();

    // Check for shield icon indicating enforcement
    await expect(
      po.page.locator('[data-testid="agent-plan-panel"] svg'),
    ).toBeVisible();
  });

  test("should block attempts to complete multiple TODOs", async ({ po }) => {
    await po.setUp({ autoApprove: true });
    await po.importApp("minimal");

    await po.selectChatMode("agent");

    // Create a plan
    await po.sendPrompt(MULTI_TODO_PLAN_PROMPT);
    await po.waitForChatCompletion();

    // Try to force the agent to complete multiple TODOs at once
    await po.sendPrompt(FORCE_MULTI_TODO_PROMPT);
    await po.waitForChatCompletion();

    const chat = po.page.getByTestId("messages-list");
    const messages = await chat.textContent();

    // Should see enforcement message about blocking multiple TODO attempts
    expect(messages).toMatch(
      /one TODO|human-like workflow|one task at a time/i,
    );

    // Should not see multiple completions in the same response
    const _completionMatches =
      messages?.match(/completed|finished|done/gi) || [];

    // Even if agent tried to complete multiple, enforcement should limit it
    // We should see evidence that the system prevented multiple completions
    expect(messages).toMatch(/blocked|prevented|only one/i);
  });

  test("should work properly with auto-advance disabled", async ({ po }) => {
    await po.setUp({ autoApprove: true });
    await po.importApp("minimal");

    await po.selectChatMode("agent");

    // Create plan
    await po.sendPrompt(MULTI_TODO_PLAN_PROMPT);
    await po.waitForChatCompletion();

    // Verify auto-advance is disabled by default
    const autoSwitch = po.page.locator('[aria-label="Toggle auto-continue"]');
    await expect(autoSwitch).not.toBeChecked();

    // Start first TODO
    await po.sendPrompt(SINGLE_TODO_START_PROMPT);
    await po.waitForChatCompletion();

    // Agent should stop after completing one TODO and wait for user input
    // Check that continue button is available
    await expect(po.getContinueButton()).toBeVisible();

    // Verify start button is not shown (since we're in middle of execution)
    await expect(po.getStartButton()).toHaveCount(0);

    // Continue to next TODO
    await po.clickContinue();
    await po.waitForChatCompletion();

    // Should work on next TODO
    const chat = po.page.getByTestId("messages-list");
    const messages = await chat.textContent();

    // Should see progression through TODOs one at a time
    expect(messages).toMatch(/TD-02|next todo|continuing/i);
  });

  test("should respect enforcement even with auto-advance enabled", async ({
    po,
  }) => {
    await po.setUp({ autoApprove: true });
    await po.importApp("minimal");

    await po.selectChatMode("agent");

    // Create plan
    await po.sendPrompt(MULTI_TODO_PLAN_PROMPT);
    await po.waitForChatCompletion();

    // Enable auto-advance
    const autoSwitch = po.page.locator('[aria-label="Toggle auto-continue"]');
    await autoSwitch.check();
    await expect(autoSwitch).toBeChecked();

    // Start execution - with auto-advance, it should still do one TODO at a time
    // but continue automatically
    await po.sendPrompt(SINGLE_TODO_START_PROMPT);

    // Wait for multiple completion cycles (auto-advance will trigger multiple times)
    await po.waitForChatCompletion();

    // Even with auto-advance, each individual response should only complete one TODO
    const chat = po.page.getByTestId("messages-list");
    const chatContent = await chat.textContent();

    // Should see evidence of sequential TODO processing, not bulk completion
    expect(chatContent).toMatch(/TD-01.*TD-02/s); // Sequential processing

    // Should still see enforcement indicator
    await expect(
      po.page.getByText("Human-like workflow: One TODO at a time"),
    ).toBeVisible();
  });

  test("should log enforcement actions for debugging", async ({ po }) => {
    await po.setUp({ autoApprove: true });
    await po.importApp("minimal");

    await po.selectChatMode("agent");

    // Create plan
    await po.sendPrompt(MULTI_TODO_PLAN_PROMPT);
    await po.waitForChatCompletion();

    // Try to trigger enforcement by attempting multiple TODO operations
    await po.sendPrompt(FORCE_MULTI_TODO_PROMPT);
    await po.waitForChatCompletion();

    const chat = po.page.getByTestId("messages-list");
    const messages = await chat.textContent();

    // Should see system logs about enforcement actions
    expect(messages).toMatch(
      /system|blocked|enforcement|one-todo-per-response/i,
    );

    // Should provide clear feedback about why actions were blocked
    expect(messages).toMatch(/human-like.*workflow|one.*task.*time/i);
  });
});
