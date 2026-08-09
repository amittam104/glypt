---
name: glypt
description: Visually discover and integrate icons from the native icon library already used by a project. Use when adding, replacing, or reviewing interface icons and the choice should be made from rendered Glypt atlases instead of icon names.
---

# glypt

Use Glypt as the visual discovery layer in an icon integration task. Inspect and edit the target project yourself. Glypt accepts a library name, renders PNG atlases with opaque refs, and resolves selected refs to Iconify IDs. It never receives a project path, reads application source, chooses the final icon, or generates native imports.

Prefer the Glypt MCP tools when they are available. Fall back to the `glypt` CLI when MCP is unavailable. If neither surface is installed, stop and explain the missing setup instead of substituting a different icon service.

## Workflow

### 1. Inspect the target project

- Read the target component and nearby icon usage.
- Inspect the package manifest, lockfile, and existing imports to identify the native icon library already in use.
- Record the project's icon component or wrapper, size, stroke, color, spacing, and accessibility conventions.
- Keep the existing library. Do not install another icon library or add `@iconify/react` only to render a selected icon.
- If the project uses a generic Iconify renderer, identify the concrete collection from existing icon IDs. Ask for clarification when no single collection can be established.

### 2. Define visual roles

Describe each icon placement as a stable role ID and one to six short, visually distinct queries. Use appearance or metaphor concepts rather than several near-synonyms.

Example:

```json
[
  {
    "id": "back-navigation",
    "queries": ["arrow", "chevron", "corner"]
  },
  {
    "id": "empty-search",
    "queries": ["search", "document", "spark"]
  }
]
```

Send at most eight roles in one atlas request. Glypt deduplicates the results and limits the complete board to 48 renderable icons.

### 3. Render and inspect an atlas

With MCP, call `show_icon_atlas`:

```json
{
  "library": "lucide-react",
  "roles": [
    {
      "id": "back-navigation",
      "queries": ["arrow", "chevron", "corner"]
    }
  ]
}
```

With the CLI, repeat `--role` for each query:

```bash
glypt atlas --library lucide-react \
  --role back-navigation=arrow \
  --role back-navigation=chevron \
  --role back-navigation=corner
```

Actually view the returned MCP image or the CLI `imagePath`. Compare silhouette, weight, legibility, and fit with the surrounding interface. Select only opaque refs such as `A1` or `B3`; do not use hidden icon names to make the visual choice.

If a role is unresolved or the candidates are weak, retry with fewer, simpler, visually different queries. If search still fails, browse the collection exhaustively:

```json
{
  "library": "lucide-react"
}
```

For CLI browsing, omit `--role` and pass the returned cursor to the next page:

```bash
glypt atlas --library lucide-react
glypt atlas --library lucide-react --cursor 1
```

Inspect each board before requesting another page. Stop when a suitable candidate is found.

### 4. Resolve only selected refs

With MCP, call `resolve_icon` using the atlas session ID and selected refs:

```json
{
  "sessionId": "123e4567-e89b-42d3-a456-426614174000",
  "refs": ["A1", "B3"]
}
```

With the CLI:

```bash
glypt resolve 123e4567-e89b-42d3-a456-426614174000 A1 B3
```

Keep refs with their original session. Sessions expire after 24 hours; create a new atlas instead of reusing expired refs.

### 5. Verify native imports

- Treat each resolved Iconify ID as an identity, not as proof of a package export.
- Inspect the installed package exports, type declarations, or existing project imports to find the matching native symbol.
- Verify the exact export statically before editing code. Never invent an import from an Iconify name.
- Preserve the project's existing import and rendering pattern, including wrappers used by libraries such as HugeIcons.
- If no native export can be verified, choose another visual candidate or report the unresolved mapping. Do not silently fall back to inline SVG or a different library.

### 6. Apply and validate the change

- Make the smallest required application edit.
- Preserve local sizing, styling, interaction, and accessible-label behavior.
- Run the project's existing targeted lint, typecheck, or build commands. Do not introduce new test infrastructure for an icon-only change.
- Visually check the affected interface when a runnable preview is available.

## Error handling

- For an unknown or ambiguous library, retry with the exact installed npm package, published collection name, or Iconify prefix. Do not guess.
- For an empty search result, simplify the queries and then use exhaustive browsing.
- For an expired or missing session, render a new atlas and select again.
- For an unverified native export, select an alternative or clearly report the blocker.
