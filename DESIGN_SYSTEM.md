# Frame First Design System

Frame First uses a minimal green-accent analytics-dashboard system: quiet surfaces,
dense but readable data, grouped navigation, restrained color, and layouts that adapt
before they overflow.

## Principles

- Keep the first screen useful: show app navigation, project context, and primary data.
- Prefer compact operational controls over marketing-style hero layouts.
- Use color for state and comparison, not decoration.
- Cards are for contained tools or repeated records. Do not nest cards.
- Every dashboard view must work at desktop, tablet, and mobile widths.

## Layout

- Desktop: fixed grouped left sidebar, sticky top utility bar, constrained main content.
- Tablet: keep the sidebar while width allows; then collapse to a compact top region.
- Mobile: content is single-column, nav remains horizontal, controls stack only when needed.
- Main content uses `.metrics`, `.content-grid`, `.section-gap`, `.card`, and `.actions`.

## Tokens

CSS tokens live in `apps/web/app/globals.css`:

- Colors: `--background`, `--surface`, `--surface-muted`, `--text`, `--muted`.
- State: `--accent`, `--accent-soft`, `--indigo`, `--amber`, `--danger`.
- Shape/layout: `--radius-sm`, `--radius-md`, `--radius-lg`, `--sidebar-width`,
  `--topbar-height`, `--page-max`.

## Components

- Shell: `DashboardShell` owns grouped navigation, project switching, utility actions,
  and the workspace chip.
- Metrics: `MetricCard` for top-level numeric summaries only.
- Tables: `DataTable` for compact comparison data.
- Buttons: use `.button`, `.button.primary`, `.icon-button`, `.icon-only`.
- Forms: use `.form`, `.field`, `.form-grid`, `.segmented`, `.toggle-row`.
- Overview: metric row, one primary chart, then secondary insight panels.

## Responsive QA

Before shipping visual work, verify:

- `1440x1000` desktop
- `1024x900` tablet
- `390x1200` mobile

Text should not overlap, buttons should not overflow, and charts/tool panels should stay readable.
