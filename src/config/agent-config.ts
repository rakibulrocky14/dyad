/**
 * Configuration settings for Dyad Agent workflow behavior
 *
 * This file controls how the agent processes TODOs and manages workflow execution
 * to ensure human-like, manageable task breakdown.
 */

export interface AgentWorkflowConfig {
  /** Enforce one TODO completion per response to maintain human-like workflow */
  enforceOneTodoPerResponse: boolean;

  /** Maximum number of TODOs that can be started simultaneously */
  maxSimultaneousTodos: number;

  /** Whether to log enforcement actions for debugging */
  logEnforcementActions: boolean;

  /** Auto-advance settings */
  autoAdvance: {
    /** Default auto-advance state for new workflows */
    defaultEnabled: boolean;

    /** Delay between auto-continued TODOs (ms) */
    delayBetweenTodos: number;

    /** Maximum consecutive auto-continues before requiring user intervention */
    maxConsecutiveRuns: number;
  };

  /** Workflow validation settings */
  validation: {
    /** Validate TODO dependencies before execution */
    checkDependencies: boolean;

    /** Warn when TODOs are completed out of logical order */
    warnOutOfOrderCompletion: boolean;

    /** Maximum number of pending TODOs before warning */
    maxPendingTodos: number;
  };

  /** Development and debugging options */
  debug: {
    /** Enable verbose logging of agent decisions */
    verboseLogging: boolean;

    /** Log all dropped TODO updates with reasons */
    logDroppedUpdates: boolean;

    /** Include internal reasoning in system logs */
    includeReasoningLogs: boolean;
  };
}

/**
 * Default configuration that prioritizes human-like workflow:
 * - One TODO at a time
 * - Clear logging and feedback
 * - Reasonable auto-advance limits
 */
export const DEFAULT_AGENT_CONFIG: AgentWorkflowConfig = {
  enforceOneTodoPerResponse: true,
  maxSimultaneousTodos: 1,
  logEnforcementActions: true,

  autoAdvance: {
    defaultEnabled: false,
    delayBetweenTodos: 1000, // 1 second delay
    maxConsecutiveRuns: 5, // Prevent runaway execution
  },

  validation: {
    checkDependencies: true,
    warnOutOfOrderCompletion: true,
    maxPendingTodos: 10,
  },

  debug: {
    verboseLogging: false,
    logDroppedUpdates: true,
    includeReasoningLogs: false,
  },
};

/**
 * Alternative configuration for more aggressive/batch processing
 * (Not recommended for production use as it reduces human-like behavior)
 */
export const BATCH_AGENT_CONFIG: AgentWorkflowConfig = {
  ...DEFAULT_AGENT_CONFIG,
  enforceOneTodoPerResponse: false,
  maxSimultaneousTodos: 3,
  autoAdvance: {
    ...DEFAULT_AGENT_CONFIG.autoAdvance,
    defaultEnabled: true,
    maxConsecutiveRuns: 10,
  },
};

/**
 * Development configuration with enhanced debugging
 */
export const DEBUG_AGENT_CONFIG: AgentWorkflowConfig = {
  ...DEFAULT_AGENT_CONFIG,
  debug: {
    verboseLogging: true,
    logDroppedUpdates: true,
    includeReasoningLogs: true,
  },
};

/**
 * Get the current agent configuration
 * In the future, this could be made configurable via settings or environment variables
 */
export function getAgentConfig(): AgentWorkflowConfig {
  // For now, always use the human-like default configuration
  // This can be extended to read from user preferences or environment variables
  return DEFAULT_AGENT_CONFIG;
}

/**
 * Validate agent configuration values
 */
export function validateAgentConfig(config: AgentWorkflowConfig): string[] {
  const errors: string[] = [];

  if (config.maxSimultaneousTodos < 1) {
    errors.push("maxSimultaneousTodos must be at least 1");
  }

  if (config.autoAdvance.delayBetweenTodos < 0) {
    errors.push("autoAdvance.delayBetweenTodos cannot be negative");
  }

  if (config.autoAdvance.maxConsecutiveRuns < 1) {
    errors.push("autoAdvance.maxConsecutiveRuns must be at least 1");
  }

  if (config.validation.maxPendingTodos < 1) {
    errors.push("validation.maxPendingTodos must be at least 1");
  }

  if (config.enforceOneTodoPerResponse && config.maxSimultaneousTodos > 1) {
    errors.push("enforceOneTodoPerResponse conflicts with maxSimultaneousTodos > 1");
  }

  return errors;
}

/**
 * Configuration presets for different use cases
 */
export const AGENT_CONFIG_PRESETS = {
  /** Human-like workflow (recommended) */
  human: DEFAULT_AGENT_CONFIG,

  /** Batch processing (use with caution) */
  batch: BATCH_AGENT_CONFIG,

  /** Development and debugging */
  debug: DEBUG_AGENT_CONFIG,
} as const;

export type AgentConfigPreset = keyof typeof AGENT_CONFIG_PRESETS;
