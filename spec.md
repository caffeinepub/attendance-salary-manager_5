# Attendance & Salary Manager

## Current State
The backend fully supports labour grouping (`Group` type, `labourGroups` map, `createGroup`, `deleteGroup`, `getAllGroups`, `createLabour`/`updateLabour` with `groupId`). The `Labour` type includes `groupId?: bigint`. However the frontend ignores all group functionality -- LaboursTab always passes `null` for groupId, and PaymentsTab has no group filter.

## Requested Changes (Diff)

### Add
- **LaboursTab:** Group management section (edit mode only) -- create named groups, delete groups, view group members
- **LaboursTab:** Each labour row shows its assigned group name (if any) as a badge
- **LaboursTab:** When editing a labour, show a group dropdown to assign/unassign
- **LaboursTab:** When creating a new labour, include group assignment dropdown
- **PaymentsTab:** Group filter dropdown before calculation -- options: "All Labours" + each group name. Selecting a group filters which labours appear in payment calculation and table.

### Modify
- `LaboursTab.tsx`: Wire `createLabour`/`updateLabour` to pass selected `groupId` (or null)
- `PaymentsTab.tsx`: Add group state; when a group is selected, filter labours list before calculating payments

### Remove
- Nothing removed

## Implementation Plan
1. In `LaboursTab.tsx`: Load groups on mount via `getAllGroups()`. Add group management panel (edit mode): input + "Create Group" button, list of groups with delete button. Add group badge to each labour row. Add group dropdown to add form and inline edit form. Pass groupId to `createLabour`/`updateLabour`.
2. In `PaymentsTab.tsx`: Load groups on mount. Add a group filter dropdown (before or near the contract selector) -- "All Labours" and each group. When calculating, filter the `labours` array to only include those matching the selected groupId (or all if "All" selected).
3. No backend changes needed.
