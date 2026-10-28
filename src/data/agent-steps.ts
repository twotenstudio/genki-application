import data from './agent-steps.json' with { type: 'json' };

export interface AgentStep {
  /** Stable slug, used to build tab and panel ids. */
  id: string;
  title: string;
  /** The prompt exactly as I gave it to Claude Code. */
  prompt: string;
  /** What was good about the output. */
  worked: string;
  /** What I changed or rejected, and why. */
  changed: string;
}

// Assigning the JSON import to the interface makes TypeScript check every entry at build time.
export const agentSteps: readonly AgentStep[] = data;
