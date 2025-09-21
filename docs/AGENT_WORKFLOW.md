# Agent Workflow Documentation

## Overview

Dyad's Agent Mode implements a structured, human-like workflow system that breaks down complex tasks into manageable TODOs and executes them one at a time. This approach ensures better control, transparency, and maintainability compared to traditional AI systems that might attempt to solve everything at once.

## Core Principles

### Human-like Workflow
The agent is designed to work like a human developer:
- **Sequential Processing**: Completes one task at a time, just like a human would
- **Clear Communication**: Reports progress after each task completion
- **Manageable Chunks**: Breaks down complex requirements into smaller, focused TODOs
- **User Control**: Waits for explicit approval before moving to the next task (unless auto-advance is enabled)

### Transparency and Auditability
- Every action is logged and traceable through dyad tags
- Clear plan structure that users can inspect and approve
- Progress tracking with detailed status updates
- Enforcement logs help debug workflow issues

## One-TODO Enforcement

### What It Does
The system enforces a strict "one TODO per response" rule to maintain human-like behavior:

- **Single Focus**: Agent can only complete one TODO in each response
- **Sequential Execution**: TODOs are processed in logical order
- **Explicit Progression**: User must issue `start` or `continue` commands (unless auto-advance is enabled)
- **Clear Boundaries**: Each task has defined completion criteria

### Why This Matters
1. **Predictable Behavior**: Users know exactly what the agent will work on
2. **Better Error Recovery**: If something goes wrong, only one task is affected
3. **Cost Control**: Prevents runaway execution that could consume excessive API credits
4. **Quality Assurance**: Each task gets focused attention rather than rushed bulk processing
5. **User Agency**: Users maintain control over the development process

## Agent Commands

### Planning Phase
- **Initial Brief**: Provide requirements → Agent analyzes and creates plan
- **Clarifications**: Agent asks questions if requirements are unclear
- **Plan Approval**: User reviews the generated TODO plan

### Execution Phase
- **`start`**: Begin working on the first pending TODO
- **`continue`**: Move to the next pending TODO after completion
- **Auto-advance**: Automatically continue to next TODO (when enabled)

### Plan Management
- **`revise TD-XX`**: Update a specific TODO
- **`change plan`**: Rebuild the entire plan from scratch
- **`switch mode: build`**: Exit agent mode and return to build mode

## Configuration

### Default Behavior
- **One TODO Per Response**: ✅ Enabled (enforced)
- **Auto-advance**: ❌ Disabled by default
- **Max Simultaneous TODOs**: 1
- **Enforcement Logging**: ✅ Enabled

### Configuration Options
The system can be configured via `src/config/agent-config.ts`:

```typescript
interface AgentWorkflowConfig {
  // Core enforcement
  enforceOneTodoPerResponse: boolean;
  maxSimultaneousTodos: number;
  logEnforcementActions: boolean;
  
  // Auto-advance settings
  autoAdvance: {
    defaultEnabled: boolean;
    delayBetweenTodos: number;
    maxConsecutiveRuns: number;
  };
  
  // Validation and debugging
  validation: {
    checkDependencies: boolean;
    warnOutOfOrderCompletion: boolean;
    maxPendingTodos: number;
  };
  
  debug: {
    verboseLogging: boolean;
    logDroppedUpdates: boolean;
    includeReasoningLogs: boolean;
  };
}
```

## Usage Examples

### Basic Workflow
```
User: Create a React todo application with components and styling
Agent: [Analyzes] → [Creates plan with 4 TODOs]
User: start
Agent: [Completes TD-01: TodoItem component] → Stops, waits for user
User: continue
Agent: [Completes TD-02: TodoList component] → Stops, waits for user
... and so on
```

### With Auto-Advance
```
User: Create a React todo application
Agent: [Creates plan]
User: [Enables auto-advance] → start
Agent: [TD-01] → [Auto TD-02] → [Auto TD-03] → [Auto TD-04] → [Complete]
```

### Handling Multiple TODO Attempts
```
User: Complete all remaining TODOs at once to save time
Agent: [Attempts multiple TODOs]
System: [Blocks extra TODOs] → "Only one TODO can be completed per response"
Agent: [Completes only TD-01] → Reports enforcement action
```

## UI Indicators

### Agent Plan Panel
- **Enforcement Indicator**: Shows "Human-like workflow: One TODO at a time" with shield icon
- **Auto-advance Toggle**: Switch to enable/disable automatic continuation
- **TODO Status**: Visual indicators for pending, in-progress, completed, blocked states
- **Progress Tracking**: Current TODO highlighted, completion status visible

### System Messages
- **Enforcement Logs**: When multiple TODOs are blocked
- **Progress Updates**: After each TODO completion
- **Status Changes**: Workflow state transitions (analysis → plan_ready → executing → etc.)

## Troubleshooting

### Common Issues

#### Agent Tries to Complete Multiple TODOs
**Symptoms**: System logs show "blocked attempt to work on multiple TODOs"
**Solution**: This is expected behavior. The enforcement system is working correctly.
**Action**: Continue with normal workflow using `continue` command.

#### Auto-advance Not Working
**Symptoms**: Agent completes one TODO but doesn't continue automatically
**Possible Causes**:
- Auto-advance is disabled (check toggle switch)
- TODO marked as blocked or requiring user input
- Error in TODO completion status

#### TODOs Completed Out of Order
**Symptoms**: Warning messages about out-of-order completion
**Solution**: The system allows this but warns for awareness. Consider revising plan if logical order is important.

### Debugging

#### Enable Verbose Logging
Set `debug.verboseLogging: true` in config for detailed agent decision logs.

#### Check Enforcement Actions
Look for system messages containing:
- "blocked attempt to work on multiple TODOs"
- "only one TODO can be completed per response"
- "human-like workflow"

#### Validate Configuration
Use `validateAgentConfig()` function to check for configuration conflicts.

## Best Practices

### For Users
1. **Review Plans**: Always check the generated TODO plan before starting execution
2. **Clear Requirements**: Provide specific, detailed requirements to minimize clarifications
3. **Use Continue**: Let the agent complete each TODO fully before moving to the next
4. **Auto-advance Carefully**: Enable auto-advance only when you trust the plan completely

### For Developers
1. **Respect Enforcement**: Don't try to bypass the one-TODO rule
2. **Clear System Prompts**: Ensure prompts emphasize sequential execution
3. **Log Important Actions**: Use system logs for debugging and transparency
4. **Test Edge Cases**: Verify behavior with multiple TODO attempts

## System Architecture

### Key Components
- **Agent System Prompt**: Enforces one-TODO behavior at the AI level
- **Chat Controller**: Validates and sanitizes TODO updates
- **Parser**: Extracts agent artifacts from responses
- **Configuration**: Manages enforcement rules and debugging options
- **UI Components**: Provide visual feedback and controls

### Enforcement Layers
1. **Prompt Level**: System prompt instructs AI to focus on one TODO
2. **Validation Level**: `sanitizeTodoUpdates` function blocks multiple completions
3. **Logging Level**: System messages provide transparency
4. **UI Level**: Visual indicators show enforcement status

## Future Enhancements

### Planned Features
- User-configurable enforcement settings in UI
- Smart dependency checking between TODOs
- Batch mode for experienced users (with warnings)
- Enhanced progress visualization
- TODO templates for common patterns

### Considerations
- Balance between control and efficiency
- Integration with tool calling (when implemented)
- Performance implications of strict enforcement
- User experience improvements