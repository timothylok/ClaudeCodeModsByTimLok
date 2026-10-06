# cc-mods

Four Claude Code mods (function-hook plugins) that save tokens and keep you aware of your limits.

| Mod | What it does |
| --- | --- |
| [`smart-model-router`](#smart-model-router) | Picks a heavy or light model for each turn |
| [`usage-bar`](#usage-bar) | Shows 5-hour and weekly rate-limit usage above the prompt |
| [`context-bar`](#context-bar) | Shows how full the context window is, by category, above the prompt |
| [`research-offloader`](#research-offloader) | Keeps research work out of the main context |

## Why: kaizen for your AI bill

Kaizen is continuous improvement through small changes, each removing one source of waste (muda). These mods apply it to a Claude Code workflow:

| Waste | Mod that removes it |
| --- | --- |
| The most expensive model doing routine work | `smart-model-router` |
| Raw web pages filling the main context | `research-offloader` |
| Hitting a rate limit by surprise | `usage-bar` (and the router's usage guard) |
| Context filling up unnoticed | `context-bar` |

None of these is a big idea; each is one small fix. Run the cycle on your own usage:

1. **Plan:** note your 5-hour and weekly usage over a normal week, using `usage-bar`.
2. **Do:** install the mods and work as usual.
3. **Check:** compare the next week's usage against the first.
4. **Adjust:** tune `usageGuard`, the model options and the research trigger phrases, then repeat.

What you can see, you can improve.

## Install

### Try from a local folder (development)

```
claude --plugin-dir D:\ai\cc-mods\smart-model-router --plugin-dir D:\ai\cc-mods\usage-bar --plugin-dir D:\ai\cc-mods\context-bar --plugin-dir D:\ai\cc-mods\research-offloader
```

Saving a file reloads the mod in a running session.

### Install from GitHub (timothylok/ClaudeCodeModsByTimLok)

```
/plugin install smart-model-router --marketplace timothylok/ClaudeCodeModsByTimLok
/plugin install usage-bar --marketplace timothylok/ClaudeCodeModsByTimLok
/plugin install context-bar --marketplace timothylok/ClaudeCodeModsByTimLok
/plugin install research-offloader --marketplace timothylok/ClaudeCodeModsByTimLok
```

Answer `y` to add the marketplace, then choose a scope. Each mod is active immediately.

## Settings

Mods with options show them as rows in `/config`, or you can set them in `settings.json` under `pluginConfigs.<mod>.options`. Changing one reloads the mod.

---

## smart-model-router

Chooses a model for every turn and sends the main thread's requests to it. Subagents keep their own model.

**How a model is chosen**, in order:

1. If your 5-hour or weekly usage is at or above the **usage guard** (default 85%), use the light model.
2. If the mode is `heavy` or `light`, use that model.
3. In `auto` mode, a prompt that mentions architecture, designing a system, multi-file work, rewriting the whole thing, deep reasoning, trade-offs, migrations, root cause, or planning, or one longer than 2,500 characters, gets the heavy model. Anything else gets the light model.

The status line shows the choice and the reason, e.g. `router: claude-opus-5-5 (complex prompt)`.

### Usage

| Command | Effect |
| --- | --- |
| `/route` | Show the current mode |
| `/route auto` | Pick per prompt (default) |
| `/route heavy` | Always use the heavy model |
| `/route light` | Always use the light model |
| `/route off` | Router does nothing; the session's own model is used |

The mode is remembered across sessions.

### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `heavyModel` | `claude-opus-5-5` | Model for complex turns |
| `lightModel` | `claude-sonnet-5-5` | Model for everyday turns |
| `usageGuard` | `85` | Usage % above which the light model is always used |

### Examples

| Prompt | Model |
| --- | --- |
| `Design the architecture for a multi-tenant billing service` | heavy |
| `Plan out a migration from REST to gRPC, with the trade-offs` | heavy |
| `Find the root cause of this flaky test` | heavy |
| `fix the typo in README` | light |
| `write a unit test for parseDate` | light |

Switching models starts a new prompt cache, so flipping often costs extra input tokens. Use `/route heavy` or `/route light` to pin a model for a stretch of work.

---

## usage-bar

A band above the prompt with a meter for each rate-limit window Claude Code reports:

```
Usage 5h █████░░░░░ 42% 2h30m   week █████████░ 91% 3d
```

- The bar is green below 70%, yellow from 70%, and red from 90%.
- The trailing time is how long until the window resets.
- A toast appears once when a window crosses 80% and once more at 95%.
- The band uses figures Claude Code already receives, so it needs no server. It only appears on a subscription, and only after the first response brings rate-limit figures. It is hidden while a survey is showing.

### Usage

| Command | Effect |
| --- | --- |
| `/usage-bar` | Hide or show the band (toggle) |

### Options

None.

---

## context-bar

A stacked bar above the prompt showing the context window, one colour per `/context` category, with a legend of the biggest categories:

```
████████▒▒▒▒░░░░░░░░░░░░░░░░░░░░ 38% · 76k/200k
■ Messages 41k  ■ System tools 18k  ■ Memory files 6k
```

- `█` is used space, `▒` is the autocompact buffer, `░` is free space.
- Figures are estimated locally from the last response's usage, so refreshing the bar sends no token-count requests. It refreshes after each turn and after a compaction.
- It sits in the same band as `usage-bar` and stacks with it. It is hidden while a survey is showing.

### Usage

| Command | Effect |
| --- | --- |
| `/context-bar` | Hide or show the bar (toggle) |

### Options

None.

---

## research-offloader

When you type a research-style prompt, the mod keeps the page fetching and reading out of the main thread, so only a summary enters your context.

**What counts as research:** prompts containing "research", "look up", "summarize this url/page/article/docs", "compare sources", "read this page/article/docs", "what is the latest", or "search the web". It only reacts to prompts you type yourself.

**Two modes**, depending on the `endpoint` option:

- **Endpoint set:** the mod POSTs `{ "query": "<your prompt>" }` to it, expects `{ "summary": "..." }` back, and gives Claude that summary as context. If the endpoint fails or returns no summary, it falls back to the subagent mode below.
- **Endpoint empty (default):** the mod tells Claude to do the research inside subagents and return only short summaries with source URLs. For that turn, subagents spawned without a model run on the `subagentModel`.

A toast tells you which mode was used.

### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `endpoint` | empty | URL of your own research bridge (for example a NotebookLM wrapper). Leave empty to use subagents |
| `subagentModel` | `haiku` | Model for research subagents: `haiku`, `sonnet` or `opus` |

### Examples

| Prompt | Result |
| --- | --- |
| `Research the best Rust ORMs in 2026` | offloaded |
| `Can you look up how Vite handles HMR?` | offloaded |
| `summarize this page for me: https://example.com` | offloaded |
| `compare sources on WebGPU support` | offloaded |
| `fix the failing test in auth.ts` | untouched |

NotebookLM has no public API, so the endpoint is yours to provide. Any service that takes `{query}` and returns `{summary}` works.

---

## Bug fixes

### 0.1.3: `usage-bar` hid other bands above the prompt

- **Symptom:** with `usage-bar` installed, a separate context bar disappeared.
- **Cause:** both mods draw into the same band above the prompt (`ui.render` on `AbovePrompt`). The outermost hook returned its own tree without calling `next(e)`, so the hook beneath it never ran.
- **Fix:** `usage-bar` now calls `next(e)` and stacks what comes back under its own row. `context-bar` does the same from 0.1.4, so the two show together in either order.
- **For mod authors:** a `ui.render` hook on a shared site must `await next(e)` and include the result in its tree. In tests, add a stand-in `ui.render` hook beneath the mod so `next` has something to return.

## Development

Each mod has `hooks/register.ts(x)`, a manifest in `.claude-plugin/plugin.json`, and tests in `tests/`.

```
claude plugin validate <mod folder>
claude plugin test <mod folder>
```

## License

[MIT](LICENSE)
