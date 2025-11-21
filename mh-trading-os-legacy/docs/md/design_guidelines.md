# MH Trading OS — Design Guidelines

## Design Approach

**Selected Approach:** Design System-based, drawing from Linear's clean SaaS aesthetics and Notion's information hierarchy principles.

**Rationale:** This is a utility-focused, data-intensive B2B operations platform requiring clarity, efficiency, and consistency over visual experimentation. Users need to process complex pricing data, manage inventory, and execute sales operations with minimal cognitive load.

**Core Principles:**
1. **Information Clarity**: Dense data presented with strong hierarchy and breathing room
2. **Operational Efficiency**: Quick access to common actions, minimal clicks to complete tasks
3. **Professional Trust**: Polished, consistent interface that conveys reliability
4. **Scalable Patterns**: Reusable components that work across all modules

---

## Typography System

**Font Stack:**
- **Primary**: Inter (via Google Fonts CDN) - clean, highly legible for data/UI
- **Monospace**: JetBrains Mono - for SKUs, codes, numerical data

**Hierarchy:**
- **Page Titles**: text-2xl font-semibold (30px)
- **Section Headers**: text-lg font-semibold (18px)
- **Card/Module Titles**: text-base font-medium (16px)
- **Body Text**: text-sm (14px)
- **Labels/Meta**: text-xs font-medium uppercase tracking-wide (12px)
- **Table Data**: text-sm font-normal
- **Numerical Data**: font-mono text-sm for SKUs, prices, IDs

---

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 4, 6, 8, 12, 16** for consistent rhythm.

**Common Patterns:**
- Page padding: `p-6 lg:p-8`
- Card padding: `p-4` or `p-6` for larger modules
- Section gaps: `space-y-6` or `space-y-8`
- Grid gaps: `gap-4` or `gap-6`
- Form field spacing: `space-y-4`

**Container Strategy:**
- Full-width dashboard: `max-w-screen-2xl mx-auto`
- Forms/focused content: `max-w-4xl mx-auto`
- Sidebar + content layout: `grid grid-cols-[240px_1fr]` (desktop)

---

## Component Library

### Navigation & Layout

**Top Navigation Bar:**
- Fixed header with app logo, main nav links, user profile dropdown
- Height: `h-16`, horizontal padding `px-6`
- Links: text-sm font-medium with hover states
- User menu: avatar (32px) + name + role badge

**Sidebar (for modules like Pricing Studio, Stand Center):**
- Width: `w-60` fixed, collapsible on mobile
- Section headers with text-xs uppercase labels
- Nav items: `py-2 px-3 rounded-md` with active state indicators
- Sticky position with scroll

**Page Layout Structure:**
```
┌─────────────────────────────────────┐
│ Top Nav (h-16)                      │
├──────────┬──────────────────────────┤
│ Sidebar  │ Main Content (p-6)       │
│ (w-60)   │ ┌──────────────────────┐ │
│          │ │ Page Header          │ │
│          │ ├──────────────────────┤ │
│          │ │ Content Modules      │ │
│          │ └──────────────────────┘ │
└──────────┴──────────────────────────┘
```

### Dashboard Components

**KPI Cards:**
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`
- Card: rounded-lg with subtle border, `p-4`
- Structure: Label (text-xs uppercase), Value (text-2xl font-bold), Trend indicator (↑↓ with small text)

**Alert Banners:**
- Positioned below page header
- Types: Info, Warning, Error (use border-l-4 accent)
- Dismissible with icon button
- `p-4 rounded-md` with icon + message + action button

**Data Tables:**
- Striped rows with hover states
- Header: `bg-muted text-xs font-medium uppercase`
- Cells: `px-4 py-3 text-sm`
- Actions column: Icon buttons (edit, delete, view) aligned right
- Pagination: bottom-right, showing "1-10 of 234" with prev/next buttons
- Filters: Top-left with search input + dropdown filters in a row

### Forms & Inputs

**Form Layout:**
- Single column: `max-w-2xl space-y-4`
- Two-column: `grid grid-cols-2 gap-4` for compact forms
- Label above input: `text-sm font-medium mb-1`
- Helper text: `text-xs` below input
- Required indicator: red asterisk

**Input Styles:**
- Text inputs: `h-10 px-3 rounded-md border`
- Textareas: `p-3 rounded-md border` with min-height
- Selects: Same as inputs with dropdown icon
- Checkboxes/Radios: `h-4 w-4` with label `text-sm`
- Number inputs with steppers for quantities

**Button Hierarchy:**
- Primary: `px-4 py-2 rounded-md font-medium` (solid fill)
- Secondary: `px-4 py-2 rounded-md font-medium border`
- Ghost/Tertiary: `px-4 py-2 rounded-md font-medium` (no border, hover background)
- Icon buttons: `h-9 w-9 rounded-md` (for tables, toolbars)
- Button groups: `inline-flex rounded-md` with connected buttons

### Pricing Studio Specific

**Pricing Parameters Editor:**
- Two-column grid: Parameter name | Value input
- Grouped by category (Margins, Uplifts, MAP, Rounding) with section headers
- Inline edit with save/cancel actions
- "Explain" icon button next to complex params

**Product Catalog Table:**
- Full-width, horizontally scrollable
- Fixed first column (SKU + Name)
- Columns: COGS, UVP, MAP, channel prices, status badges
- Bulk actions toolbar: "Reprice Selected" button
- Row actions: Explain price (opens modal), Edit inline

**Competitor Comparison View:**
- Split layout: Your price | Competitor prices table
- Visual indicators: Price above/below thresholds
- Guardrail warnings as inline badges

### Stand Center Specific

**Stand Map View:**
- Google Maps or Leaflet integration, `h-96 rounded-lg`
- Clustered markers with status colors
- Side panel: `w-80` with stand list, filterable
- Map controls: Zoom, filter by status, search

**Stand Profile Card:**
- Header: Stand name, status badge, QR preview thumbnail
- Sections: Location details, Inventory summary, Recent visits
- Action buttons: Edit, Generate QR, Plan Refill, Start Visit

**Visit Mode (Rep Interface):**
- Simplified mobile-first layout
- Large touch targets: `h-12` buttons
- Photo upload with preview thumbnails in grid
- Quick count inputs: SKU + stepper controls
- Floating action button for "Complete Visit"

**Refill Planner:**
- Table with SKU, On Hand, Min/Max, Suggested Qty
- Editable quantity inputs
- Total weight/cost summary footer
- "Approve Plan" and "Create Order" buttons

### Sales Desk

**Quick Quote Builder:**
- Left panel: Product search + add to quote
- Right panel: Quote summary with line items table
- Discount calculator: Inline inputs with live preview
- Loyalty section: Earn/redeem toggle with balance display
- Gifts indicator: "Qualifies for X gift at Y threshold"
- Footer: Subtotal, discounts, loyalty, total with "Convert to Order" button

**Invoice Display:**
- PDF preview embed with download button
- Company header, partner details, line items, totals
- Payment terms and commission breakdown

### AI Hub

**AI Console Layout:**
- Tab navigation: Pricing Analyst | Stand Ops | Growth Writer | Ops Assistant
- Input area: Textarea with context selectors (SKU, Stand, Order)
- Output area: Formatted response with copyable sections
- History sidebar: Recent requests with timestamps

### Admin & Settings

**Settings Grid:**
- Categorized cards: Google Sheets, Pricing, Integrations, Users
- Card structure: Icon + title + description + "Configure" link
- Health status indicators: Green checkmark, yellow warning, red error

**Integration Status Panel:**
- Google Sheets: Connection status + last sync timestamp
- OpenAI: API key status (masked) + usage quota
- Test connection buttons with loading states

---

## Accessibility & Polish

- Focus rings: Visible 2px outline offset-2 on interactive elements
- Skip navigation link for keyboard users
- ARIA labels for icon-only buttons
- Loading states: Skeleton screens for tables, spinners for buttons
- Empty states: Illustration + message + action for empty tables
- Error states: Inline validation messages with icons
- Toast notifications: Top-right corner for success/error feedback

---

## Responsive Strategy

- **Mobile (< 768px)**: Sidebar collapses to overlay, tables scroll horizontally, KPI cards stack
- **Tablet (768-1024px)**: Sidebar remains, 2-column grids where appropriate
- **Desktop (> 1024px)**: Full multi-column layouts, fixed sidebar, expanded tables

---

## Multi-Language Support

- RTL support for Arabic: Use `dir="rtl"` and mirror layouts
- Text alignment: Use logical properties (text-start vs text-left)
- Navigation: Mirror sidebar positioning for RTL
- Store language preference in localStorage