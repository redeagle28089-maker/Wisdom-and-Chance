# Design Guidelines for Base44 + Replit Enhanced App

## Design Approach
**System Selected:** Shadcn UI + Tailwind CSS (existing foundation)
**Rationale:** Developer-focused productivity tool requiring clarity, efficiency, and professional polish. Building on the existing Shadcn "new-york" variant ensures consistency while allowing customization.

**Design Principles:**
1. **Clarity over decoration** - Information hierarchy guides every decision
2. **Professional restraint** - Clean, purposeful interfaces without unnecessary flourish
3. **Functional excellence** - Every element serves user goals

---

## Typography

**Font Families:**
- Primary: Inter (Google Fonts) - body text, UI elements
- Monospace: JetBrains Mono (Google Fonts) - code snippets, technical data

**Type Scale:**
- Headings: text-3xl (page titles), text-2xl (section headers), text-xl (subsection headers)
- Body: text-base (default), text-sm (secondary info, captions)
- Technical: text-sm font-mono (API responses, entity IDs, code)

**Hierarchy:**
- Page titles: font-semibold tracking-tight
- Section headers: font-medium
- Body text: font-normal
- Labels: text-sm font-medium uppercase tracking-wide

---

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 4, 6, 8, 12, 16** for consistency
- Component padding: p-4 to p-6
- Section spacing: space-y-8 to space-y-12
- Card gaps: gap-4
- Grid gaps: gap-6

**Container Strategy:**
- Main content: max-w-7xl mx-auto px-6
- Forms/Settings: max-w-2xl
- Data tables: full-width with horizontal scroll on mobile

**Grid Patterns:**
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Settings panels: Two-column split (navigation + content)
- Entity listings: Single column with responsive table/card switching

---

## Component Library

**Navigation:**
- Sidebar navigation (collapsible on mobile) using Shadcn Sidebar component
- Breadcrumbs for deep navigation hierarchy
- Top bar with user menu, notifications, environment indicator

**Data Display:**
- Tables: Shadcn Table with sortable columns, row actions dropdown
- Cards: Elevated with subtle border, hover state with slight lift
- Stats widgets: Large number display with trend indicator and sparkline
- Empty states: Icon + descriptive text + primary action button

**Forms:**
- Shadcn Form + React Hook Form (existing)
- Inline validation with clear error messages
- Input groups with labels above inputs (not placeholder-only)
- Action buttons right-aligned (primary + secondary pattern)

**Feedback:**
- Toast notifications (Sonner - existing) for async actions
- Loading states: Skeleton screens matching content layout
- Error boundaries with retry actions and contact support link
- Progress indicators for multi-step operations

**Modals & Overlays:**
- Shadcn Dialog for confirmations and forms
- Shadcn Sheet for sliding panels (entity details, settings)
- Tooltips for icon-only buttons and technical terms

---

## Visual Treatment

**Depth & Elevation:**
- Flat base with subtle borders (border-neutral-200)
- Cards: Very subtle shadow (shadow-sm) + border
- No heavy drop shadows - maintain clean aesthetic
- Hover states: Slight background shift (hover:bg-neutral-50)

**Borders & Dividers:**
- Section dividers: border-t border-neutral-200
- Card borders: rounded-lg border
- Input borders: Maintain Shadcn defaults

**States:**
- Hover: Subtle background change + cursor-pointer
- Active: Border accent or background intensity increase
- Disabled: opacity-50 cursor-not-allowed
- Loading: Animated skeleton or spinner, never block interaction unnecessarily

---

## Page Structures

**Dashboard:**
- Top stats row (3-4 key metrics in cards)
- Recent activity/entities list below
- Quick actions panel or empty state if no data
- Proper loading skeletons for async data

**Entity Management (CRUD):**
- Table view with search, filters, bulk actions
- Create button (primary) top-right
- Row actions: View/Edit/Delete in dropdown
- Inline editing for simple fields

**Settings/Configuration:**
- Two-column: Navigation tabs left, content right
- Form sections with clear headings
- Save actions sticky at bottom or top-right
- Unsaved changes warning

**Error States:**
- Full-page error: Centered icon + message + retry button
- Inline errors: Below relevant field with icon
- API error handling: User-friendly message + technical details in collapsible

---

## Icons

**Library:** Lucide React (existing)
**Usage:**
- Navigation: 20px icons with label
- Buttons: 16px inline with text
- Empty states: 48px decorative
- Status indicators: 16px with semantic meaning (check, x, alert)

---

## Images

**Not applicable** - This is a developer productivity tool; focus on data visualization and UI efficiency rather than imagery. Any branding assets (Base44 logo) should be minimal and appear in navigation/authentication screens only.

---

## Responsive Behavior

- Mobile: Stack all columns, hamburger menu, simplified tables (switch to cards)
- Tablet: 2-column grids, persistent navigation
- Desktop: Full multi-column layouts, expanded sidebar

**Breakpoints:** Use Tailwind defaults (sm: 640px, md: 768px, lg: 1024px, xl: 1280px)