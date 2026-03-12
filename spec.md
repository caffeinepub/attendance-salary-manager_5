# Attendance & Salary Manager

## Current State
The app has a complete backend (Motoko) and frontend (React/TypeScript) with:
- Contracts, Attendance, Advances, Payments, Labours, Settled tabs
- Mobile-first UI with bottom tab navigation
- View/Edit mode toggle via "Welcome" text
- Labour type: id, name, phone (no group support)
- All core features working except labour grouping was not added to backend

## Requested Changes (Diff)

### Add
- Labour group support in backend: Group type (id, name), createGroup, deleteGroup, getAllGroups; Labour gets optional groupId field
- Labours tab: manage groups section (add/delete groups), group dropdown when adding/editing labours, group column in table
- Payments tab: filter labours by group or by individual labour selection

### Modify
- Backend Labour type to include optional groupId
- createLabour and updateLabour to accept optional groupId
- LaboursTab to show Groups management and group assignment
- PaymentsTab to include labour filter (All / By Group / By Labour)

### Remove
- Nothing removed

## Implementation Plan
1. Update backend to add Group type, group CRUD, and groupId field on Labour
2. Regenerate backend.d.ts bindings
3. Update LaboursTab: groups management UI, group dropdown in add/edit forms, group column
4. Update PaymentsTab: filter section with All/By Group/By Labour toggle
