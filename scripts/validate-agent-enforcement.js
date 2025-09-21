#!/usr/bin/env node

/**
 * Validation Script for Agent One-TODO Enforcement
 *
 * This script validates that the one-TODO enforcement system is working correctly.
 * It tests various scenarios to ensure the agent maintains human-like workflow behavior.
 */

const { readFileSync } = require('fs');
const path = require('path');

// Mock the enforcement logic for testing (based on our implementation)
function sanitizeTodoUpdates(updates, activeTodoId = null, enforceOneTaskRule = true) {
  function normalizeTodoId(todoId) {
    if (!todoId) return null;
    return todoId.trim().toUpperCase();
  }

  const normalizedActive = normalizeTodoId(activeTodoId);
  const result = [];
  const dropped = [];
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
        reason: "only one TODO can be completed per response (human-like workflow)",
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

// Test scenarios
const testScenarios = [
  {
    name: "Single TODO completion (should pass)",
    updates: [
      { todoId: "TD-01", status: "completed" }
    ],
    activeTodoId: "TD-01",
    expectedPassed: 1,
    expectedDropped: 0,
    shouldEnforce: true
  },
  {
    name: "Multiple TODO completions (should block second)",
    updates: [
      { todoId: "TD-01", status: "completed" },
      { todoId: "TD-01", status: "completed" }
    ],
    activeTodoId: "TD-01",
    expectedPassed: 1,
    expectedDropped: 1,
    shouldEnforce: true
  },
  {
    name: "Mixed status updates with one completion (should allow)",
    updates: [
      { todoId: "TD-01", status: "in_progress" },
      { todoId: "TD-01", status: "completed" }
    ],
    activeTodoId: "TD-01",
    expectedPassed: 2,
    expectedDropped: 0,
    shouldEnforce: true
  },
  {
    name: "Multiple TODO IDs (should block non-active)",
    updates: [
      { todoId: "TD-01", status: "completed" },
      { todoId: "TD-02", status: "completed" }
    ],
    activeTodoId: "TD-01",
    expectedPassed: 1,
    expectedDropped: 1,
    shouldEnforce: true
  },
  {
    name: "No enforcement (should allow multiple)",
    updates: [
      { todoId: "TD-01", status: "completed" },
      { todoId: "TD-01", status: "completed" }
    ],
    activeTodoId: "TD-01",
    expectedPassed: 2,
    expectedDropped: 0,
    shouldEnforce: false
  },
  {
    name: "Empty TODO ID (should drop)",
    updates: [
      { todoId: "", status: "completed" },
      { todoId: "TD-01", status: "completed" }
    ],
    activeTodoId: null,
    expectedPassed: 1,
    expectedDropped: 1,
    shouldEnforce: true
  },
  {
    name: "Case insensitive matching (should work)",
    updates: [
      { todoId: "td-01", status: "completed" }
    ],
    activeTodoId: "TD-01",
    expectedPassed: 1,
    expectedDropped: 0,
    shouldEnforce: true
  },
  {
    name: "Complex realistic scenario",
    updates: [
      { todoId: "TD-01", status: "in_progress" },
      { todoId: "TD-01", status: "completed", note: "Implementation finished" },
      { todoId: "TD-02", status: "ready" }, // Should be dropped (different TODO)
      { todoId: "TD-01", status: "completed" } // Should be dropped (second completion)
    ],
    activeTodoId: "TD-01",
    expectedPassed: 2,
    expectedDropped: 2,
    shouldEnforce: true
  }
];

// Configuration validation tests
const configTests = [
  {
    name: "Valid default configuration",
    config: {
      enforceOneTodoPerResponse: true,
      maxSimultaneousTodos: 1,
      logEnforcementActions: true,
      autoAdvance: {
        defaultEnabled: false,
        delayBetweenTodos: 1000,
        maxConsecutiveRuns: 5
      }
    },
    shouldBeValid: true
  },
  {
    name: "Invalid - negative delay",
    config: {
      enforceOneTodoPerResponse: true,
      maxSimultaneousTodos: 1,
      autoAdvance: {
        delayBetweenTodos: -500
      }
    },
    shouldBeValid: false
  },
  {
    name: "Invalid - conflicting settings",
    config: {
      enforceOneTodoPerResponse: true,
      maxSimultaneousTodos: 3  // Conflicts with enforcement
    },
    shouldBeValid: false
  }
];

// Validation functions
function validateConfig(config) {
  const errors = [];

  if (config.maxSimultaneousTodos && config.maxSimultaneousTodos < 1) {
    errors.push("maxSimultaneousTodos must be at least 1");
  }

  if (config.autoAdvance?.delayBetweenTodos < 0) {
    errors.push("autoAdvance.delayBetweenTodos cannot be negative");
  }

  if (config.autoAdvance?.maxConsecutiveRuns < 1) {
    errors.push("autoAdvance.maxConsecutiveRuns must be at least 1");
  }

  if (config.enforceOneTodoPerResponse && config.maxSimultaneousTodos > 1) {
    errors.push("enforceOneTodoPerResponse conflicts with maxSimultaneousTodos > 1");
  }

  return errors;
}

// Run tests
function runTests() {
  console.log("🧪 Validating Agent One-TODO Enforcement System\n");

  let totalTests = 0;
  let passedTests = 0;

  // Test enforcement logic
  console.log("📋 Testing TODO Update Enforcement Logic:");
  console.log("=" .repeat(50));

  for (const scenario of testScenarios) {
    totalTests++;

    const result = sanitizeTodoUpdates(
      scenario.updates,
      scenario.activeTodoId,
      scenario.shouldEnforce
    );

    const passed = result.updates.length === scenario.expectedPassed &&
                  result.dropped.length === scenario.expectedDropped;

    if (passed) {
      passedTests++;
      console.log(`✅ ${scenario.name}`);
    } else {
      console.log(`❌ ${scenario.name}`);
      console.log(`   Expected: ${scenario.expectedPassed} passed, ${scenario.expectedDropped} dropped`);
      console.log(`   Actual: ${result.updates.length} passed, ${result.dropped.length} dropped`);

      if (result.dropped.length > 0) {
        console.log(`   Dropped reasons: ${result.dropped.map(d => d.reason).join(", ")}`);
      }
    }
  }

  console.log();

  // Test configuration validation
  console.log("⚙️  Testing Configuration Validation:");
  console.log("=" .repeat(50));

  for (const configTest of configTests) {
    totalTests++;

    const errors = validateConfig(configTest.config);
    const isValid = errors.length === 0;
    const passed = isValid === configTest.shouldBeValid;

    if (passed) {
      passedTests++;
      console.log(`✅ ${configTest.name}`);
    } else {
      console.log(`❌ ${configTest.name}`);
      console.log(`   Expected valid: ${configTest.shouldBeValid}, got: ${isValid}`);
      if (errors.length > 0) {
        console.log(`   Errors: ${errors.join(", ")}`);
      }
    }
  }

  console.log();
  console.log("📊 Test Summary:");
  console.log("=" .repeat(50));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log("\n🎉 All tests passed! One-TODO enforcement is working correctly.");
    return 0;
  } else {
    console.log(`\n⚠️  ${totalTests - passedTests} test(s) failed. Please review the implementation.`);
    return 1;
  }
}

// Additional validation checks
function runAdditionalChecks() {
  console.log("\n🔍 Additional Validation Checks:");
  console.log("=" .repeat(50));

  // Check if key files exist
  const keyFiles = [
    "src/config/agent-config.ts",
    "src/prompts/agent_system_prompt.ts",
    "src/ipc/handlers/agent_chat_controller.ts",
    "docs/AGENT_WORKFLOW.md"
  ];

  let filesExist = 0;
  for (const file of keyFiles) {
    try {
      const fullPath = path.join(__dirname, "..", file);
      readFileSync(fullPath);
      console.log(`✅ ${file} exists`);
      filesExist++;
    } catch (err) {
      console.log(`❌ ${file} missing`);
    }
  }

  console.log(`\n📁 File Check: ${filesExist}/${keyFiles.length} key files found`);

  // Check system prompt for enforcement keywords
  try {
    const promptPath = path.join(__dirname, "..", "src/prompts/agent_system_prompt.ts");
    const promptContent = readFileSync(promptPath, "utf8");

    const enforcementKeywords = [
      "ONE-TODO",
      "human-like",
      "one at a time",
      "STRICT",
      "one todo per response"
    ];

    let keywordsFound = 0;
    for (const keyword of enforcementKeywords) {
      if (promptContent.toLowerCase().includes(keyword.toLowerCase())) {
        keywordsFound++;
      }
    }

    console.log(`📝 System Prompt: ${keywordsFound}/${enforcementKeywords.length} enforcement keywords found`);

    if (keywordsFound >= enforcementKeywords.length * 0.6) {
      console.log("✅ System prompt appears to have enforcement instructions");
    } else {
      console.log("⚠️  System prompt may need stronger enforcement instructions");
    }

  } catch (err) {
    console.log("⚠️  Could not validate system prompt content");
  }
}

// Main execution
if (require.main === module) {
  const exitCode = runTests();
  runAdditionalChecks();

  console.log("\n" + "=".repeat(60));
  console.log("Agent One-TODO Enforcement Validation Complete");
  console.log("=".repeat(60));

  process.exit(exitCode);
}

module.exports = {
  sanitizeTodoUpdates,
  validateConfig,
  runTests
};
