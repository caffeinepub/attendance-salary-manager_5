# Attendance & Salary Manager

## Current State
The login/home page uses a premium dark aesthetic: `#0B1120` background, orange glow blobs, glassmorphism card, orange gradient buttons (Figtree font). The rest of the app (all 6 tabs + header + bottom tab bar) uses a light theme: white/light-gray backgrounds, dark text, white cards, light borders.

## Requested Changes (Diff)

### Add
- Dark theme CSS variables for app screen (dark backgrounds, muted borders, light text on dark)

### Modify
- App screen background: `#F2F2F2` → `#0B1120`
- Header bar: white bg → `rgba(255,255,255,0.055)` glassmorphism with dark backdrop
- Bottom tab bar: white bg → same dark glass style, active tab orange, inactive muted
- All tab content areas: white/light-gray → dark surfaces (`#0F172A`, `#1E293B`, `#111827`)
- Card/list item backgrounds: `#FFFFFF` → `#1E293B` with subtle border `rgba(255,255,255,0.1)`
- Input/select backgrounds: white → `#1E293B`, border `rgba(255,255,255,0.12)`
- Text colors: `#1F1F1F`/`#0F172A` → `#F1F5F9`/`#E2E8F0`; muted: `#9E9E9E` → `#94A3B8`
- Table body rows: white/light-gray → `#111827` (even) / `#0F172A` (odd)
- Sticky labour column: `#EFF6FF` → `#1A2744`
- Stats cards: white → `#1E293B`
- Dropdown panels: white → `#1E293B`
- Empty state boxes: light → dark surface
- Secondary/cancel buttons: `#F2F2F2` → `rgba(255,255,255,0.07)` with border
- Orange glow blob decorations: add to app screen background (same as login)
- Keep all orange accents (`#F97316`, `#FF7F11`, `#EA580C`) and table headers (`#1E293B`) as-is or ensure they still read well
- Badge colors (Present/Absent/Other): keep hue but darken bg slightly for dark surface
- Overview dialog, admin login dialog, all modal dialogs: dark glass surfaces
- Section heading text and border-left: keep orange accent

### Remove
- Light theme background on the app screen

## Implementation Plan
1. Update `index.css` CSS variables to dark values so Tailwind-based shadcn components pick up dark theme
2. Update App.tsx: app screen container background + orange glow blobs; header bar; bottom tab bar
3. Update ContractsTab.tsx: card items, inputs, buttons, form areas
4. Update AttendanceTab.tsx: contract select, stats cards, table rows, dropdowns, attendance marking dialog
5. Update PaymentsTab.tsx: dropdowns, stats cards, table rows, overview dialog
6. Update AdvancesTab.tsx: list items, inputs, dialogs
7. Update LaboursTab.tsx: card items, inputs
8. Update SettledTab.tsx: card items
9. Validate build
