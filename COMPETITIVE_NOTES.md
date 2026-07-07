# Competitive Tear-Down: ChatGPT, Claude, Perplexity, Linear

Date: 2026-07-07
Scope: Desktop web UI patterns most relevant to an AI personal assistant.
Method: Combination of live-product interaction patterns and publicly available docs/help references. Exact pixel values are practical ranges measured by visual estimation at 100% zoom on a 1440px-wide viewport.

## 1) ChatGPT

### Layout

- Sidebar anatomy
  - Width: ~260-300px expanded; ~56-72px collapsed icon rail.
  - Collapsible states: full list state, collapsed icon-only rail, mobile overlay drawer.
  - Pinned vs auto-grouped:
    - Pinned: new chat, GPTs/explore, recent chats near top.
    - Auto-grouped: conversation history by recency buckets (today, yesterday, previous 7/30 days), often virtualized for long history.
- Main canvas
  - Max content width: ~760-900px for message text comfort; larger visual content can exceed this in centered container modes.
  - Gutters: ~24-40px left/right inside content column depending on viewport.
  - Density: medium; generous line-height, clear card separation for tool outputs.
- Right rail
  - Appears contextually, not persistent.
  - Typical contents: artifacts/canvas previews, file context, citations/sources (when relevant), thread metadata or side panels for specific features.
- Header/toolbar
  - Model switcher: top-left/top-center area of main header, close to thread title context.
  - Share/export: top-right actions (share link, sometimes export/thread actions in overflow).
  - Command palette/search entry: keyboard-first entry path exists; discovery tends to be shortcut-driven.

### Interaction

- Streaming behavior
  - Primarily token/phrase progressive rendering with smooth paragraph growth.
  - Tool outputs (tables/code/file references) often snap in chunked updates after model text preamble.
- Stop/regenerate/edit/copy
  - Stop: near composer while streaming.
  - Regenerate: attached to assistant message action row or thread-level retry controls.
  - Edit: user message inline edit affordance, then re-run branch.
  - Copy: per-message copy action plus code-block copy.
- Hover/focus states
  - Message actions are mostly hover-revealed desktop affordances, but keyboard focus remains visible for accessibility.
  - Composer has strong focus ring and clear active state.
- Keyboard shortcuts (common)
  - New chat, focus composer, submit/send, open search/history, open command surfaces.
  - Behavior strongly optimized for power users who stay hands-on-keyboard.

### Rich output

- Markdown fidelity
  - Strong on headings, lists, tables, fenced code blocks with language labels and copy.
  - LaTeX support is solid in common math flows.
  - Mermaid support is inconsistent across surfaces and often feature-gated.
  - Checkboxes render correctly in most markdown contexts.
- Artifacts/canvas
  - Supports side-by-side or dedicated artifact/canvas contexts depending on feature mode.
  - Pattern: keep conversation visible while artifact gets expanded working area.
- Inline file previews
  - Images and common document previews are integrated; code files open with syntax-aware previews.
- Source citations
  - Where available, citations use inline markers/chips with expandable source details rather than heavy academic footnote styling.

## 2) Claude

### Layout

- Sidebar anatomy
  - Width: ~250-290px expanded; ~60-72px collapsed rail.
  - Collapsible states: expanded conversation list, collapsed icon rail, mobile slide-over.
  - Pinned vs auto-grouped:
    - Pinned: new chat, projects/workspaces, key entry actions.
    - Auto-grouped: recent conversations by time with lightweight grouping.
- Main canvas
  - Max content width: ~760-880px for prose-centric readability.
  - Gutters: ~28-44px desktop.
  - Density: lower than many peers (more breathing room, strong readability bias).
- Right rail
  - Appears for specific modes (artifacts/project context/references), not always-on.
  - Typical contents: artifact controls, attachments context, source or file chips.
- Header/toolbar
  - Model selector and mode context are near top conversation frame.
  - Share/export/overflow controls are present but deliberately subdued.
  - Command-like quick actions exist, but interaction priority is conversational flow over toolbar complexity.

### Interaction

- Streaming behavior
  - Character/token progressive rendering that feels sentence-smooth.
  - Structured outputs may arrive in coherent chunks after initial response frame.
- Stop/regenerate/edit/copy
  - Stop and retry are clearly attached to current generation lifecycle.
  - User message edit and resend is straightforward; branch behavior is understandable.
  - Copy appears on hover/message actions and at code-block level.
- Hover/focus states
  - Minimal chrome; actions appear on hover with low-contrast but clear hit targets.
  - Strong emphasis on clean reading mode; fewer persistent buttons than ChatGPT.
- Keyboard shortcuts (known/documented patterns)
  - Composer-centric send/new-thread shortcuts.
  - Desktop quick entry support (for Claude Desktop) emphasizes global invocation and fast capture.

### Rich output

- Markdown fidelity
  - High-quality markdown, excellent long-form prose rendering.
  - Code blocks are clean with copy affordances.
  - Tables render well; checkboxes generally supported.
  - LaTeX support is present in many contexts, but feature behavior can vary by product surface.
- Artifacts/canvas
  - Strong artifact workflow pattern: conversational thread plus a focused output workspace.
  - Artifacts can feel like first-class documents rather than transient message blobs.
- Inline file previews
  - Good support for common files and multimodal attachments, with clear file chips and preview affordances.
- Source citations
  - Citation style tends toward inline references and source snippets when available; less citation-heavy than Perplexity.

## 3) Perplexity

### Layout

- Sidebar anatomy
  - Width: ~260-320px expanded; compact collapsed rail available.
  - Collapsible states: expanded nav, compact rail, mobile drawer.
  - Pinned vs auto-grouped:
    - Pinned: home/discover/spaces/library entries and new query.
    - Auto-grouped: thread history by recency, often search-centric naming.
- Main canvas
  - Max content width: ~820-980px depending on mode (answer + sources).
  - Gutters: ~20-36px.
  - Density: higher information density than ChatGPT/Claude due to source cards and follow-up modules.
- Right rail
  - Frequently used for sources, related questions, thread context, and sometimes media or collection modules.
  - Can be merged into inline sections on narrower widths.
- Header/toolbar
  - Model/focus mode controls near top query bar.
  - Share/export and collection controls visible on answer pages.
  - Search/query entry is a primary top-level element (not just a chat composer).

### Interaction

- Streaming behavior
  - Hybrid: initial answer appears quickly, then sections and citations continue to populate.
  - Source stack often updates incrementally during generation.
- Stop/regenerate/edit/copy
  - Stop and rewrite/follow-up controls live near query/action bar.
  - Edit query is first-class because search reformulation is central.
  - Copy controls on full answer and code blocks.
- Hover/focus states
  - Strong hover states on citations/source cards.
  - Focus treatment emphasizes click-through to evidence.
- Keyboard shortcuts
  - Common web-app shortcuts around search focus, submit, and navigation.
  - Less shortcut-driven than Linear, more than average consumer chat.

### Rich output

- Markdown fidelity
  - Good markdown rendering, code blocks and tables are solid.
  - Math rendering is generally available where technical answers are expected.
  - Citation-aware formatting is a core differentiator.
- Artifacts/canvas
  - More answer-and-evidence centric than document-canvas centric.
  - Split behaviors prioritize source exploration over freeform canvas editing.
- Inline file previews
  - Strong with web/media source previews; file-first enterprise previews vary by plan/mode.
- Source citations
  - Best-in-class visibility: inline citation numbers/chips, source list cards, quick jump and hover/open interactions.

## 4) Linear (reference for ergonomics and speed)

### Layout

- Sidebar anatomy
  - Width: ~240-280px expanded with dense navigation hierarchy.
  - Collapsible states: full sidebar, slim rail, contextual panes inside content.
  - Pinned vs auto-grouped:
    - Pinned: team, inbox, assigned, projects, views.
    - Auto-grouped: dynamic sections by recency/context, smart groupings in issue lists.
- Main canvas
  - Max content width: list/detail adaptive, often wider than chat products to optimize data density.
  - Gutters: ~16-28px; deliberately tight.
  - Density: high but legible; optimized for fast scanning and action.
- Right rail
  - Contextual detail pane patterns are frequent (issue details, activity, linked items).
  - Appears as split-pane rather than ephemeral overlay in many workflows.
- Header/toolbar
  - Command palette is core interaction model.
  - Search and quick-create are top-tier controls.
  - Share/export is secondary to workflow actions.

### Interaction

- Streaming behavior
  - Not LLM-streaming centric; interaction model is instant state mutation and optimistic UI updates.
- Stop/regenerate/edit/copy
  - Relevant analog is rapid edit/create via inline fields, slash commands, and command palette actions.
- Hover/focus states
  - Exceptionally polished hover and focus states for dense interactive rows.
  - Every row is action-capable with predictable affordances.
- Keyboard shortcuts
  - Industry-leading shortcut coverage: command palette, create, assign, filter, navigate, triage, open details.
  - Power-user flow can be nearly mouseless.

### Rich output

- Markdown fidelity
  - Strong markdown for issue descriptions/comments: headings, lists, code blocks, checkboxes, mentions.
  - Not designed as a rich AI artifact canvas.
- Artifacts/canvas
  - Split-pane issue detail is the core "artifact" pattern.
- Inline file previews
  - Attachment previews exist but are workflow-supporting rather than primary reading surfaces.
- Source citations
  - N/A as a search citation product; references are issue links/relations and activity history.

## Cross-Product Synthesis (what to copy for a top-tier AI assistant)

- Use a dual-speed layout model:
  - Mode A (conversation): Claude-level reading comfort.
  - Mode B (operations): Linear-level density and keyboard velocity.
- Keep sidebar persistent and meaningful:
  - Pinned essentials at top, auto-grouped history below, never mix the two visually.
- Treat right rail as contextual intelligence:
  - Sources, artifacts, and file previews should appear when relevant, not always.
- Make streaming feel alive but controllable:
  - Immediate first tokens, stable paragraph growth, visible stop state, no jitter.
- Standardize message actions:
  - Always same placement for stop/regenerate/edit/copy across all messages.
- Match Perplexity on evidence UX:
  - Inline citations + source cards + hover/open details.
- Match Linear on keyboard ergonomics:
  - Command palette first, full shortcut map, and visible shortcut hints in menus.
- Match Claude on calm visual hierarchy:
  - Minimal noise, high legibility, restrained but clear focus states.
- Match ChatGPT on rich output practicality:
  - Reliable tables, code copy, math rendering, and attachment previews.

## Confidence and Validation Notes

- High confidence: interaction patterns, relative density, sidebar and canvas behavior categories.
- Medium confidence: exact pixel ranges, some right-rail triggering rules, product-by-product shortcut completeness.
- Validate in next step with a screenshot benchmark pass:
  - 1440px desktop and 390px mobile captures.
  - Time-to-first-token and actions-per-task keyboard benchmark.
  - Markdown stress test: table, code, LaTeX, Mermaid, checklist, citations, file preview.