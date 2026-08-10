<p align="center">
  <img alt="header" src="https://shieldcn.dev/header/glow.svg?title=glypt&amp;subtitle=Let+your+Agent+find+better+icons.&amp;size=wide&amp;mode=dark&amp;theme=emerald&amp;border=false" />
</p>

<p align="center">
  <img alt="badge" src="https://shieldcn.dev/npm/glypt.svg" />
</p>

## What is glypt?

glypt is a local, read-only visual icon discovery tool for coding agents. It renders icons from the library a project already uses, labels them with opaque refs, and reveals an icon's identity only after the agent has visually selected it. glypt is built on top of [Iconify](https://github.com/iconify/iconify) for icon data and more.

```text
agent understands the project and its icon library
→ glypt renders a visual PNG atlas
→ agent selects opaque refs
→ glypt resolves those refs to Iconify IDs
→ agent verifies native package exports and edits the app
```

glypt does not inspect a project, modify source files, choose icons automatically, or invent native imports. The installed agent skill owns that workflow around Glypt's CLI or MCP server.

## Highlights

- **322,996+ icons across 220+ Iconify icon sets** — counts follow Iconify's live catalog and change as it is updated.
- **Visual-first discovery** — inspect PNG atlases with opaque refs before seeing icon names.
- **Lean, cache-friendly CLI and MCP** — one local npm package with a shared core for both interfaces.
- **Native-library safe** — resolve selected icons to Iconify IDs without editing source files or inventing native imports.

## How to Use?

### 1. Install the npm package

glypt requires Node.js 22 or newer. Install the single npm package to get the CLI and local stdio MCP server:

```bash
npm install --global glypt
```

You can also run a command without a global installation:

```bash
npx -y glypt@latest --help
```

### 2. Install the required agent skill

The skill is distributed from this GitHub repository through the [skills CLI](https://github.com/vercel-labs/skills). It is separate from the npm package and is required for the intended agent workflow:

```bash
npx skills add amittam104/glypt --skill glypt -g
```

When running the command inside a project that enforces pnpm, use the equivalent pnpm command:

```bash
pnpm dlx skills add amittam104/glypt --skill glypt -g
```

The installer detects supported coding agents and asks where to install the skill. The `-g` flag makes it available across projects on your machine.

### 3. Choose how your agent uses glypt

After installing the skill, choose one of these options:

- **MCP:** Configure the local stdio server once so your agent can call Glypt's `show_icon_atlas` and `resolve_icon` tools directly.
- **CLI:** Skip MCP configuration and let your agent run `glypt atlas` and `glypt resolve` in its terminal.

Both options provide the same visual discovery and resolution workflow. You only need one.

#### Option A: Configure the MCP server

The published package starts the local stdio server with:

```bash
npx -y glypt@latest mcp
```

##### Codex

```bash
codex mcp add glypt -- npx -y glypt@latest mcp
codex mcp list
```

##### Claude Code

```bash
claude mcp add --scope user glypt -- npx -y glypt@latest mcp
claude mcp get glypt
```

##### Cursor

Add Glypt to `.cursor/mcp.json` for one project or `~/.cursor/mcp.json` for all projects:

```json
{
  "mcpServers": {
    "glypt": {
      "command": "npx",
      "args": ["-y", "glypt@latest", "mcp"]
    }
  }
}
```

##### OpenCode

Add Glypt to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "glypt": {
        "type": "local",
        "command": ["npx", "-y", "glypt@latest", "mcp"]
      }
    }
  }
}
```

For another stdio-compatible MCP client, use `npx` as the command and `-y`, `glypt@latest`, and `mcp` as its arguments.

#### Option B: Use the CLI

No MCP configuration is required. If your agent can run terminal commands, it can use the globally installed CLI. Render a role-based atlas by repeating `--role` for each visual query:

```bash
glypt atlas --library lucide-react \
  --role navigation=arrow \
  --role navigation=chevron \
  --role empty-state=document
```

Open the returned `imagePath`, visually select refs, and resolve them with the returned session ID:

```bash
glypt resolve <session-id> A1 B2
```

When search is not useful, browse the collection in 48-icon pages:

```bash
glypt atlas --library lucide-react
glypt atlas --library lucide-react --cursor 1
```

Without a global installation, replace `glypt` in any command with `npx -y glypt@latest`. Run `glypt atlas --help` or `glypt resolve --help` for all command options.

### 4. Ask your agent to use glypt

For example:

```text
Use glypt to choose and integrate icons for the empty state and back button on this page.
```

The same prompt works with either MCP or the CLI. The skill tells the agent to inspect the project, preserve its current native icon library, visually review the atlas, resolve only selected refs, and statically verify the final imports.

## How is it different from better-icons?

glypt and [better-icons](https://github.com/better-auth/better-icons) solve adjacent problems with different priorities.

|                       | glypt                                                                           | better-icons                                                     |
| --------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Primary choice method | Visually inspect rendered PNG atlases with opaque refs                          | Search, recommend, and retrieve icons by metadata and identity   |
| Library strategy      | Preserve the native icon library already used by the project                    | Search and retrieve across many Iconify collections              |
| Returned result       | Resolve selected refs to Iconify IDs, then verify native exports in the project | Retrieve SVG or JSON and support direct project synchronization  |
| Completeness fallback | Browse the selected collection exhaustively in visual pages                     | Use search, recommendations, similar icons, and collection tools |
| Source editing        | Glypt never reads or edits application files                                    | Includes project-aware and synchronization workflows             |

Choose glypt when visual comparison, existing-library consistency, and verified native imports are the priority.

## Acknowledgements

glypt relies heavily on [Iconify](https://github.com/iconify/iconify) for icon collection metadata, search, icon data, and normalized icon identities. Thank you to the Iconify maintainers and contributors for building and maintaining the open icon ecosystem that makes glypt possible.

Each icon collection remains subject to its own license. Review the collection's license before redistributing its icons.

## Local development

```bash
pnpm install
pnpm build
node bin/run.js --help
```

The npm package contains the CLI, MCP server, and shared core. The portable app workflow lives separately in [`skills/glypt/SKILL.md`](skills/glypt/SKILL.md).
