import { expect } from "@playwright/test";
import { test } from "./helpers/test_helper";

const PLAN_PROMPT = `[dyad-qa=agent-plan] bootstrap agent response`;
const AWAITING_PROMPT = `[dyad-qa=agent-awaiting] show awaiting user`;
const COMPLETED_PROMPT = `[dyad-qa=agent-completed] finish flow`;

test("agent Start and Continue buttons appear with correct states", async ({
  po,
}) => {
  await po.setUp({ autoApprove: true });
  await po.importApp("minimal");

  await po.selectChatMode("agent");
  await po.sendPrompt(PLAN_PROMPT);
  await po.waitForChatCompletion();

  // Start should be visible after plan_ready; Continue should not be visible
  await expect(po.getStartButton()).toBeVisible();
  await expect(po.getContinueButton()).toHaveCount(0);

  // Clicking Start should stream a message (we don't assert side-effects here)
  await po.clickStart();
  await po.waitForChatCompletion();

  // Now simulate agent awaiting user after first TODO
  await po.sendPrompt(AWAITING_PROMPT);
  await po.waitForChatCompletion();
  await expect(po.getContinueButton()).toBeVisible();
  // When Continue is visible, Start should not be visible
  await expect(po.getStartButton()).toHaveCount(0);

  // Click Continue to proceed to next TODO (stream again)
  await po.clickContinue();
  await po.waitForChatCompletion();

  // Simulate completion; Continue should disappear
  await po.sendPrompt(COMPLETED_PROMPT);
  await po.waitForChatCompletion();
  await expect(po.getContinueButton()).toHaveCount(0);
  await expect(po.getStartButton()).toHaveCount(0);
});

// We intentionally keep a single deterministic flow here.
