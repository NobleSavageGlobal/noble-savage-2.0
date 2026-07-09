# 🎯 Prompt Engineering Guide for Noble Savage OS Development

## The R.O.C.K.S. Framework

A structured approach to getting better AI assistance for design, implementation, and problem-solving.

### **R — Role**
Assign the AI a specific expert identity.

**Good**:
> "You are a Senior UX/UI Designer with 15 years of experience redesigning SaaS dashboards."

**Poor**:
> "Be a designer"

### **O — Objective**
State the goal clearly in one sentence.

**Good**:
> "Redesign the chat interface to reduce cognitive load and prioritize the most important actions first."

**Poor**:
> "Make it better"

### **C — Context**
Provide relevant background information.

**Good**:
> "Noble Savage OS is an operator-grade AI workspace combining document intelligence, conversational AI, and knowledge management. Current users are power operators who need to make rapid decisions across 6 workstreams."

**Poor**:
> "We have an app"

### **K — Key Deliverables**
List exactly what you want as output.

**Good**:
> "Provide:
> 1. Layout redesign (sidebar, main panel, right rail)
> 2. Component specifications (HTML/CSS-ready)
> 3. Color palette with usage rationale
> 4. Micro-interactions and transitions
> 5. Accessibility checklist (WCAG 2.1 AA)"

**Poor**:
> "Redesign it"

### **S — Success Criteria**
Define what "done" looks like.

**Good**:
> "Success: User can start a new chat in ≤2 clicks. Document library is visible without scrolling. Token usage is always visible."

**Poor**:
> "It should look professional"

---

## 📋 Template: Complete Design Prompt

```markdown
# DESIGN BRIEF: [Feature Name]

## ROLE
You are a [Expert Identity] with specific expertise in [Domain].

## OBJECTIVE
[One sentence goal]

## CONTEXT
[2-3 sentences of background]

## CURRENT STATE
[What exists now and what's broken]

## CONSTRAINTS
- Tech stack: [React, Tailwind, etc.]
- Performance budget: [targets]
- Accessibility requirement: [WCAG 2.1 AA]
- Must support: [light/dark mode, mobile, keyboard]

## KEY DELIVERABLES
1. [Specific output 1]
2. [Specific output 2]
3. [Specific output 3]

## SUCCESS CRITERIA
- Criterion 1: [Measurable]
- Criterion 2: [Measurable]
- Criterion 3: [Measurable]

## BONUS (Optional)
- Reference: [Design inspiration or example]
- Preferred style: [Aesthetic direction]
```

---

## 🎨 Template: Component Specification Prompt

```markdown
# COMPONENT SPEC: [ComponentName]

## ROLE
Act as a Design Systems Architect for enterprise SaaS products.

## OBJECTIVE
Create production-ready specifications for a [component description].

## REQUIREMENTS
Provide in this order:
1. **Component Purpose**: 1-line description
2. **Props/Configuration**: List with types and defaults
3. **Visual States**: default, hover, active, disabled, error
4. **Accessibility**: Focus indicators, ARIA labels, keyboard support
5. **Responsive Behavior**: Mobile, tablet, desktop
6. **Code Block**: React component skeleton or CSS module

## CONSTRAINTS
- Use CSS variables (--space-*, --fs-*, --accent, etc.)
- Support light and dark modes
- Keyboard navigable
- < 100KB total bundle impact

## OUTPUT FORMAT
Markdown with labeled code blocks.
```

---

## 🔄 Template: Iterative Critique Prompt

```markdown
# UX AUDIT: [Interface Name]

## ROLE
You are a UX researcher who conducted usability testing with 20 power users.

## OBJECTIVE
Audit this interface and provide actionable fixes.

## INSTRUCTIONS
For each area below, rate 1-10 and provide:
- The problem
- Why it matters
- A concrete fix

## AUDIT AREAS
1. **Visual Hierarchy** — Are users' eyes drawn to the right elements first?
2. **Navigation** — Can users find features in ≤3 clicks?
3. **Information Density** — Is anything overwhelming or under-utilized?
4. **Consistency** — Are components, colors, and spacing uniform?
5. **Accessibility** — Color contrast, focus states, screen reader support?
6. **Brand Identity** — Does it match "operator-grade" positioning?

## REFERENCE
[Attach screenshot or link to current interface]
```

---

## 🚀 Power Phrases

Use these to instantly upgrade AI output quality:

### **For Design Work**
- "Apply Nielsen Norman Group's 10 usability heuristics."
- "Reference IBM Carbon Design System principles."
- "Optimize for F-pattern reading on desktop."
- "Ensure all interactive elements have 44px minimum touch targets."
- "Include empty states, loading states, and error states."

### **For Code Work**
- "Provide production-ready code, not pseudocode."
- "Include comments explaining non-obvious logic."
- "Format as a reusable component, not a one-off."
- "Add TypeScript types for all props."
- "Include unit tests for edge cases."

### **For Decision-Making**
- "Provide 3 options with tradeoffs for each."
- "Critique your own work before submitting."
- "If you make assumptions, list them explicitly."
- "What are the failure modes of this approach?"
- "What does success look like if this goes wrong?"

---

## ❌ Negative Constraints (What to Avoid)

Instead of vague instructions, use specific constraints:

**❌ Vague**:
```
"Make it look good"
"Just redesign it"
"Be creative"
```

**✅ Specific**:
```
"Use a 4-point color palette based on cool grays (#0f172a, #334155, #cbd5e1, #f1f5f9) and one accent (teal #0f766e)"
"Match Linear's visual density and component patterns"
"Ensure all interactive elements have 44px minimum touch targets"
```

---

## 🔄 The "Layered" Prompting Strategy

Instead of one giant prompt, use **3 sequential prompts**:

### **Prompt 1: Strategy (Get the plan)**
```
"Before writing any code/design, provide:
1. What you'd change and why
2. Risks or downsides of each change
3. Priority order (high/medium/low)
4. Implementation approach"
```
↓
*Review and approve the strategy*
↓

### **Prompt 2: Implementation (Execute approved plan)**
```
"Now implement the strategy you just outlined. Provide:
1. Component/layout code
2. CSS/styling
3. Integration steps
4. Any caveats or gotchas"
```
↓
*Test and validate the output*
↓

### **Prompt 3: Critique (Self-review and refine)**
```
"Review your implementation and identify:
1. What could be improved
2. Accessibility issues
3. Performance concerns
4. Edge cases not handled
5. Recommended fixes"
```

**Why this works**: Prevents jumping straight to code before thinking through design rationale.

---

## 📊 Prompt Examples for Noble Savage OS

### Example 1: Token Indicator Component

```markdown
# COMPONENT SPEC: TokenIndicator

## ROLE
You are a Design Systems Architect who built the token counter for ChatGPT.

## OBJECTIVE
Create a production-ready TokenIndicator component that floats in the chat header,
showing token usage without obscuring content.

## REQUIREMENTS
- Compact but informative
- Color-coded status (green: normal, yellow: warning, red: critical)
- Show usage/limit (e.g., "2,450 / 8,000")
- Status thresholds: warning at 75%, critical at 90%
- Support hover tooltip with remaining tokens
- Support light and dark modes

## CONSTRAINTS
- Component size: max 120px width
- CSS variables only (--accent, --panel, etc.)
- No external dependencies
- Keyboard accessible

## DELIVERABLES
1. React component code (under 50 lines)
2. CSS styling
3. Props interface with defaults
4. Visual state examples (normal, warning, critical)
```

### Example 2: Sidebar Redesign

```markdown
# UX REDESIGN: Navigation Sidebar

## ROLE
You are a UX designer who redesigned sidebars for Notion and Linear.

## OBJECTIVE
Reduce sidebar density by grouping related actions into collapsible sections.
Current issues: too many buttons stacked, unclear hierarchy, takes too much space on mobile.

## CURRENT STATE
- 12 navigation items displayed at once
- No grouping or hierarchy
- Fixed width on mobile (75% of screen)

## CONSTRAINTS
- Must support 6+ workstreams dynamically
- Collapsible sections persist state
- Mobile-friendly (hamburger menu on <480px)
- Keyboard navigable (Tab, Enter, Space, Arrow keys)

## KEY DELIVERABLES
1. Section grouping strategy (Projects, Actions, Settings, etc.)
2. Component spec with collapsed/expanded states
3. Icons for each section (use emoji for simplicity)
4. Mobile behavior explanation
5. React component code

## SUCCESS CRITERIA
- Max 3 sections visible by default (Project, Actions, Settings)
- User can expand/collapse any section
- Mobile: hamburger converts to drawer
- All content accessible with keyboard
```

### Example 3: Empty State Audit

```markdown
# UX AUDIT: Empty States

## ROLE
You are a UX researcher who conducted 10 user interviews about onboarding friction.

## OBJECTIVE
Identify and fix empty state UX across:
- No threads yet
- No knowledge entries yet
- No board tasks yet
- Onboarding incomplete

## INSTRUCTIONS
For each empty state, provide:
1. Current problem (why users get stuck)
2. Proposed solution (with mockup or description)
3. Estimated impact (high/medium/low)
4. Implementation complexity (simple/moderate/complex)

## CONSTRAINTS
- Must explain the empty state's purpose
- Provide clear next action (CTA button)
- Use emoji/illustration (no external images)
- Support light/dark modes

## REFERENCE
Current empty states are generic text. Goal: make them friendly, instructive, and actionable.
```

---

## 🎯 Common Prompt Mistakes & Fixes

### Mistake 1: Asking for too much at once
**❌**: "Redesign the entire interface"
**✅**: "Redesign the chat header. Focus on: (1) token indicator, (2) model selector, (3) action buttons"

### Mistake 2: Vague success criteria
**❌**: "Make it accessible"
**✅**: "Ensure WCAG 2.1 AA compliance: 4.5:1 color contrast, keyboard navigation, focus indicators, screen reader support"

### Mistake 3: Not specifying output format
**❌**: "Give me the design"
**✅**: "Provide: (1) React component code, (2) CSS module, (3) Props interface, (4) Usage examples"

### Mistake 4: Forgetting constraints
**❌**: "Build a beautiful sidebar"
**✅**: "Build a sidebar that works on mobile (max 75vw), desktop (fixed 240px), supports 6+ items, and uses <20KB of CSS"

### Mistake 5: No reference point
**❌**: "Make it look professional"
**✅**: "Reference Linear's sidebar design patterns: collapsible sections, icon+label, active state highlight"

---

## 📝 Prompt Checklist

Before sending a prompt to AI, verify:

- [ ] **Role** is specific and expert-level
- [ ] **Objective** is one sentence and clear
- [ ] **Context** explains the problem briefly
- [ ] **Constraints** are specific (not "beautiful")
- [ ] **Deliverables** are numbered and measurable
- [ ] **Success criteria** are testable
- [ ] **Output format** is specified
- [ ] **No vague verbs** (make, build, improve, enhance)

---

## 🔄 Feedback Loop: How to Iterate

After receiving AI output:

1. **Critique the output** using the same structure:
   > "Rate each aspect: (1) Accessibility [6/10], (2) Performance [9/10], (3) Code quality [8/10]. For scores <7, provide specific fixes."

2. **Request refinement**:
   > "The component is too wide. Reduce to 120px max-width while keeping all information visible. Show 3 options with tradeoffs."

3. **Ask for edge cases**:
   > "How does this handle: (1) very long titles, (2) zero items, (3) 50+ items, (4) rapid state changes?"

---

## 💡 Pro Tips

1. **Use markdown formatting** in your prompts — it helps AI structure responses
2. **Be specific about tone** — "formal", "casual", "technical", "beginner-friendly"
3. **Ask for reasoning** — "explain why you chose this approach" leads to better decisions
4. **Request alternatives** — "provide 3 approaches with pros/cons each"
5. **Iterate incrementally** — don't change 5 things at once

---

**Version**: 2.6.0  
**Last Updated**: 2026-07-09  
**Framework**: R.O.C.K.S. + Layered Prompting
