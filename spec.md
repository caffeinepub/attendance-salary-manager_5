# Attendance & Salary Manager

## Current State
App has 6 tabs (Contracts, Attendance, Advances, Payments, Labours, Settled). Labour group delete confirmation dialog already exists. SettledTab fetches all contracts on render (causes flash of empty state). Settle/Unsettle calls `await load()` after each action (slow). Header always shows "Home" button with exit confirm dialog. Attendance records have no timestamp fields.

## Requested Changes (Diff)

### Add
- Toast notifications (using Sonner) for all data changes: contract add/edit, labour add/edit/toggle, group add/delete, advance add/edit/delete, settle/unsettle, attendance mark
- "Today working" indicator badge on contract list items in Contracts tab — a contract is "working today" if attendance was last saved for it today before 11pm; stored in localStorage key `attendpay_last_attendance` as `{contractId: isoTimestamp}`
- Toaster component to index/App

### Modify
- **SettledTab**: Show loading spinner immediately; optimistic updates for settle/unsettle (update state before backend call instead of calling `load()` after). Pass settled/unsettled contracts from App.tsx via props to avoid redundant fetch and eliminate empty flash.
- **ContractsTab**: Show "Working Today" green dot/badge on contracts that have today attendance (read from localStorage). Accept `todayWorkingContractIds` prop.
- **App.tsx header button**: On Contracts tab → "Home" with exit confirm (existing). On any other tab → show "Back" label, clicking it goes to Contracts tab directly without confirm dialog.
- **AttendanceTab**: After saving attendance, write to localStorage `attendpay_last_attendance` with `{contractId: timestamp}`. Emit toast on attendance save.
- **LaboursTab**: Emit toast on add labour, update labour, toggle active, add group, delete group.
- **AdvancesTab**: Emit toast on add/edit/delete advance.
- **SettledTab**: Emit toast on settle/unsettle.

### Remove
- `await load()` calls after settle/unsettle in SettledTab (replaced with optimistic updates)

## Implementation Plan
1. Add `<Toaster />` to App.tsx and import `toast` from sonner wherever needed
2. Modify App.tsx header button: if activeTab === 'Contracts' show Home+exitConfirm, else show Back+setActiveTab('Contracts')
3. Modify SettledTab: accept contracts as props, do optimistic updates, add toast calls
4. Modify ContractsTab: accept `todayWorkingContractIds: Set<string>` prop, show badge
5. Modify App.tsx: pass contracts state to SettledTab; load contracts once in App state
6. Modify AttendanceTab: write localStorage on attendance save, add toast
7. Modify LaboursTab: add toast calls
8. Modify AdvancesTab: add toast calls
