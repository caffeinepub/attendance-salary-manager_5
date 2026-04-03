# Attendance & Salary Manager

## Current State
Working Today badge uses localStorage only -- cross-device sync is broken. Backend has recordWorkingToday/getWorkingTodayMap but they are not wired in frontend. Login screen has no today-working contract info. Contract list does not sort working-today first.

## Requested Changes (Diff)

### Add
- recordWorkingToday and getWorkingTodayMap to IDL bindings and backend.d.ts
- Call actor.recordWorkingToday from AttendanceTab on every attendance save
- Login screen: show today-working contract name + badge at bottom, fetched from backend
- Sort working-today contract first in contract list

### Modify
- ContractsTab: fetch working today status from backend (merge with localStorage fallback)
- AttendanceTab: call recordWorkingToday after each attendance save with correct labour count
- App.tsx home screen: fetch and display today working contract name

### Remove
- Nothing

## Implementation Plan
1. Update backend.did.js, backend.did.d.ts, backend.d.ts with WorkingTodayEntry type and two new methods
2. AttendanceTab: call actor.recordWorkingToday in background after each save
3. ContractsTab: fetch getWorkingTodayMap on load, sort working-today contract first
4. App.tsx: fetch today working contract on home screen mount, show at bottom of login card
