/** One /context category as the bar draws it. */
export type ContextBarCategory = {
  name: string
  tokens: number
  /** Theme key /context draws the category in. */
  color: string
  kind: 'used' | 'free' | 'buffer'
}

/** The last breakdown read, kept so drawing never waits on a count. */
export type ContextBarSnapshot = {
  categories: ContextBarCategory[]
  totalTokens: number
  maxTokens: number
  percentage: number
}

declare module 'claude-code' {
  interface PluginState {
    'context-bar': { isOn: boolean; snapshot: ContextBarSnapshot | null }
  }
}
