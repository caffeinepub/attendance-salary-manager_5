# Attendance & Salary Manager

## Current State
App has dark aesthetic with orange accents. Several components have color mismatches: white backgrounds with near-white (`#F1F5F9`) text (invisible), or dark text on dark backgrounds in dialogs. The home button navigates to login without confirmation. App defaults to Attendance tab on open.

## Requested Changes (Diff)

### Add
- Confirm exit dialog when tapping Home button from app tabs screen
- Confirm dialog: "Exit to Login?" with Yes/No buttons

### Modify
- **ContractsTab**: Fix `inputStyle` text color from `#F1F5F9` to `#1E293B` (dark text on white bg)
- **AttendanceTab**: Fix stats cards background from `#FFFFFF` to dark (`#111827`); fix label color to be visible; fix labour name color in mark dialog from `#0F172A` to `#F1F5F9`; fix sticky labour column color (currently `#0F172A` dark text on `#0F1C2E` dark bg — change to `#F1F5F9`)
- **AdvancesTab**: Remove white backgrounds from table rows (change even rows from `#FFFFFF` to `#111827`); fix `inputStyle` and select text color from `#F1F5F9` to `#1E293B`; fix contract column color `#666` to `#94A3B8`; remove white bg from contract filter select
- **SettledTab**: Remove white backgrounds from table rows and settle buttons; use dark backgrounds
- **App**: Default `activeTab` to `"Contracts"` instead of `"Attendance"`; add confirm exit dialog before going back to home

### Remove
- Nothing removed

## Implementation Plan
1. Fix ContractsTab inputStyle color
2. Fix AttendanceTab stats cards + mark dialog + sticky labour color
3. Fix AdvancesTab table rows, inputs, selects
4. Fix SettledTab table rows and buttons
5. Change App default tab to Contracts
6. Add confirm exit dialog in App home button
