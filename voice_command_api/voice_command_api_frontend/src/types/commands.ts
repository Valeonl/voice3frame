export interface CommandParameter {
  name: string;
  description: string;
  defaultValue?: string;
  possibleValues?: string[];
}

export interface Command {
  id: string;
  displayName: string;
  className: string;
  description: string;
  parameters: CommandParameter[];
  examples: string[];
}

export interface PromptConfig {
  role: string;
  commands: Command[];
  promptText?: string;
} 