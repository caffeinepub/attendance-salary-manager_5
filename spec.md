# Attendance & Salary Manager

## Current State
The app uses a premium dark aesthetic throughout: deep dark backgrounds (#0a0f1e range), orange glow accents, glassmorphism cards, bold orange gradient buttons, and the Figtree font. All tabs (Contracts, Attendance, Advances, Payments, Labours, Settled) use this dark theme. The header shows a large gradient "Maaya" title. The login screen has a dark glassmorphism card.

The app also displays "Working Today" badges on contract cards (in both edit and view mode), with a labour count beside them (e.g. "Working Today · 5 labours"). These badges also appear on the login screen.

## Requested Changes (Diff)

### Add
- New design system: modern glossy morphism with blue and purple accents, very light gray background (#f3f4f6 or similar)
- Cards with gloss white outline design (white/near-white card backgrounds with subtle blue-purple border glow)
- Blue-purple gradient accents for buttons, headers, highlights, and interactive elements
- Consistent visible text colors (dark text on light backgrounds, white text where needed on colored surfaces)

### Modify
- `index.css` and `tailwind.config.js`: Replace all dark theme tokens with light gray background + blue/purple accent palette
- `App.tsx`: Replace dark background classes, orange accents, and dark glassmorphism styles with new light glossy morphism styles. Remove all "Working Today" badge UI and related frontend display logic (keep backend calls for data integrity but remove badge rendering everywhere). Remove labour count display.
- `ContractsTab.tsx`: Remove "Working Today · {count} labours" badge rendering. Update all card/container/text styles to new light theme.
- `AttendanceTab.tsx`: Remove "Working Today · {wd.count} labours" text display from contract list cards. Update all styles to new light theme.
- `AdvancesTab.tsx`: Update all styles to new light glossy morphism theme.
- `PaymentsTab.tsx`: Update all styles to new light glossy morphism theme.
- `LaboursTab.tsx`: Update all styles to new light glossy morphism theme.
- `SettledTab.tsx`: Update all styles to new light glossy morphism theme.
- Login screen: Replace dark glassmorphism with light glossy morphism card (white card, blue/purple gradient buttons, light gray page background).
- Header: Replace dark background with light/white frosted glass style, keep "Maaya" gradient but use blue-purple gradient instead of orange.
- Bottom tab bar: Switch from dark to light style with blue/purple active state.
- All dialogs/modals: Replace dark backgrounds with white/light glossy morphism surfaces.
- All buttons: Replace orange gradient with blue-purple gradient.
- All badges (attendance: Present/Absent/Other): Keep color coding but ensure visibility on light backgrounds.

### Remove
- "Working Today" badge and labour count display in ContractsTab contract cards
- "Working Today" badge and labour count display in AttendanceTab contract list
- "Working Today" contract name and badge on the login screen (App.tsx)
- All dark background colors, orange accent colors, and dark glassmorphism styling

## Implementation Plan
1. Update `index.css` and `tailwind.config.js` with new light gray + blue/purple OKLCH token palette
2. Update `App.tsx`:
   - Remove Working Today badge section on login screen
   - Replace all dark/orange styles with light glossy morphism styles
   - Update header, bottom tab bar, login card, dialogs
3. Update `ContractsTab.tsx`:
   - Remove Working Today badge rendering (the "Working Today · {count} labours" JSX)
   - Update all inline styles and className strings to new theme
4. Update `AttendanceTab.tsx`:
   - Remove Working Today badge/count from contract cards in view mode
   - Update all styles to new theme
5. Update `AdvancesTab.tsx`, `PaymentsTab.tsx`, `LaboursTab.tsx`, `SettledTab.tsx`:
   - Replace dark backgrounds, borders, and text colors with light glossy morphism equivalents
6. Validate (lint + typecheck + build)
