# Attendance & Salary Manager

## Current State
- Login screen shows today's working contract via a useEffect that runs once when `actor` is available
- Contracts list in ContractsTab sorts working contract first via `todayWorkingIds`
- AdvancesTab has Edit + Delete buttons for each advance row

## Requested Changes (Diff)

### Add
- Polling interval on login screen to re-fetch working contract every 10 seconds while on home screen

### Modify
- **Login screen (App.tsx)**: Fix working contract display — run fetch when screen='home' AND actor is ready; also poll every 10s; handle count > 0 requirement more robustly by showing contract even if count is 0 (count=0 badge is hidden in ContractsTab anyway, but the name should still show on login)
- **ContractsTab**: Ensure `loadWorkingToday` re-runs reliably when contracts load, and the working contract ID matching uses String comparison to avoid bigint equality edge cases
- **AdvancesTab**: Remove the Delete button entirely — only keep Edit/Save/Cancel

### Remove
- Delete button and `handleDelete` function from AdvancesTab

## Implementation Plan
1. In `App.tsx`: change the working contract fetch to depend on both `actor` and `screen`; add a `setInterval` polling every 10s when on home screen; remove `latestCount > 0` guard so contract name always shows if there's a valid today entry
2. In `AdvancesTab.tsx`: remove the Delete button from the actions cell and remove the `handleDelete` function
3. In `ContractsTab.tsx`: verify working today ID matching works with both bigint and string comparisons
