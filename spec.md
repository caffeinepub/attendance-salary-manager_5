# Attendance & Salary Manager

## Current State
- Header: left side has a Back button (visible only in edit mode on non-Contracts tabs). Right side has mode indicator (Edit/View Mode dot+label), Export CSV (Download icon) button, and edit mode dropdown menu.
- Home button exists in the ContractsTab component itself (inside the tab content).
- View mode: no back button. After selecting a contract in AttendanceTab, the contract name is shown in small header text.
- Header shows "Edit Mode" / "View Mode" text indicator with dot.
- AdvancesTab has no saving status indicator.
- Download/Export CSV button is always visible in header.
- Working today badge shows count from workingCount calculation that checks ALL columns (any non-Absent, non-empty value).
- Working today badge shows even if count is 0.
- No "Maaya" branding text in header.

## Requested Changes (Diff)

### Add
- Large gradient "Maaya" text centered in the header (bold, gradient orange-to-amber colors).
- Home button in the header left side (for both edit and view mode, replacing the current back/home buttons in the ContractsTab and showing in header at appropriate times).
- Back button in view mode (in header, when a contract is selected in AttendanceTab view mode).
- Contract name displayed in large text at top of attendance view when a specific contract is selected in view mode.
- Saving status indicator in AdvancesTab when saving an advance.

### Modify
- Remove "Edit Mode" / "View Mode" text label and dot indicator from header.
- Remove Download (Export CSV) button from header (keep it in the edit mode dropdown menu or remove entirely from header — the button should not be visible in the header).
- Working today badge: hide if labourCount === 0; show only when count > 0.
- Working today labour count: calculate from the SINGLE column that had the LAST attendance change (not all columns). Specifically, count non-Absent, non-empty values in only that one column.
- Home button position: move from inside ContractsTab to the header. In edit mode: show on all tabs (navigates to Contracts tab, or shows exit confirm from Contracts tab). In view mode: show always (navigates home/login).
- Back button in view mode in header when a contract is selected in AttendanceTab.

### Remove
- "Edit Mode" / "View Mode" mode indicator from header.
- Download/Export CSV button from header.
- Home button from inside ContractsTab content area.

## Implementation Plan
1. **App.tsx header**: 
   - Remove the mode indicator (dot + text).
   - Remove the Export CSV/Download button from header (keep the export functionality accessible from the dropdown menu).
   - Add "Maaya" large gradient text centered in the header using absolute positioning.
   - Move Home button logic to the header left side: in edit mode show Back/Home based on tab; in view mode, show Home button always plus a Back button when attendanceContractId is set.
   - Pass a callback to AttendanceTab for when user wants to go back (clear selectedContractId in view mode).

2. **AttendanceTab.tsx**:
   - Accept an `onBack` prop.
   - When in view mode with a selected contract, show the contract name in large text at the top.
   - Call `onBack` from the header back button (already handled in App.tsx header, but AttendanceTab needs to expose a way to clear selection OR App.tsx passes a prop to trigger deselection).
   - Fix working count: store the last-changed column key in `markAttendanceToday`, and count non-Absent values only in that specific column.

3. **ContractsTab.tsx**:
   - Remove the Home button from inside the tab content.

4. **AdvancesTab.tsx**:
   - Add a `savingAdvance` state and show a saving indicator (spinner + "Saving..." text) when an advance is being created/edited/deleted.

5. **Working today badge** (ContractsTab.tsx + getTodayWorkingData in AttendanceTab.tsx):
   - Store the last changed column key alongside the count.
   - Don't show badge if count is 0.
