# Attendance & Salary Manager

## Current State
- Full-stack attendance/salary management app with Motoko backend and React/TypeScript frontend.
- Glossy morphism UI with blue/purple accents, light gray background.
- Edit mode: Contracts, Attendance (per contract), Advances, Payments, Labours, Settled tabs.
- View mode: Attendance only.
- Contracts can be added/edited. Mark Attendance dialog exists in AttendanceTab with a column dropdown inside the dialog header.

## Requested Changes (Diff)

### Add
- Error handling (catch block) in `handleAdd` in ContractsTab so if `createContract` fails, the optimistic contract is removed from the list and an error toast is shown.
- A two-step flow for the Mark Attendance button: Step 1 = column picker dialog (choose Bed, Paper, Mesh columns); Step 2 = the per-labour marking dialog for that selected column. The column picker must appear FIRST as a dedicated step before the labour dialog opens.
- `will-change: transform` and CSS containment on frequently re-rendered elements to reduce repaints.
- `React.memo` or stable references where possible to prevent unnecessary re-renders in AttendanceTab.

### Modify
- `handleAdd` in ContractsTab: wrap the entire backend call in try/catch/finally. On error, revert the optimistic UI (remove the temp contract from state) and show `toast.error`.
- Mark Attendance flow in AttendanceTab: Instead of embedding the column picker as a select inside the dialog header, split it into two separate steps:
  - Step 1: Show a modal/dialog with column buttons (Bed, Paper, each Mesh column). User taps a column to select it.
  - Step 2: The per-labour attendance marking dialog opens for that specific column (same UI as current, but without the inline column switcher since the column is already chosen). User can still switch column from inside if needed.
- App.tsx loading screen: Ensure the loading overlay fully fades out before the main content is interactive to avoid visual flicker. The `appReadyDom` state removal should use `onTransitionEnd` instead of a hardcoded 600ms timeout to avoid blank frames.
- Reduce unnecessary re-renders in App.tsx by memoizing callbacks passed to child tabs.

### Remove
- Nothing to remove.

## Implementation Plan
1. **ContractsTab.tsx** — Fix `handleAdd`:
   - Add `catch` block: on error, filter out the optimistic contract (by `tempId`), show `toast.error("Failed to save contract. Please try again.")`.
   - Keep `finally` for `setAdding(false)`.

2. **AttendanceTab.tsx** — Two-step Mark Attendance:
   - Add state: `showColumnPicker` (boolean), separate from `markDialogOpen`.
   - "Mark Attendance" button now sets `showColumnPicker = true`.
   - Step 1: A Dialog/modal showing column buttons (Bed, Paper, Mesh 1, Mesh 2...). Tapping a column sets `markDialogCol` to that column, closes column picker, and opens `markDialogOpen`.
   - Step 2: Existing per-labour dialog, but remove the inline column select from the header (or keep it as a small change-column link for convenience).

3. **App.tsx** — Reduce flicker:
   - Change the loading overlay unmount logic: instead of `setTimeout(() => setAppReadyDom(true), 600)`, use `onTransitionEnd` on the overlay div to set `appReadyDom = true` after the opacity fade completes.
   - Add `useCallback` wrappers on `handleViewAttendance` and other callbacks passed as props to prevent re-renders.
   - Add `translate3d(0,0,0)` or `will-change: opacity` on the home screen container to prevent repaints during fade transitions.
