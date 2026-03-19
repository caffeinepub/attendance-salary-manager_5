# Attendance & Salary Manager

## Current State
Edit mode is protected by a 4-digit PIN stored in localStorage. The PIN dialog appears when the hidden 'Welcome' text is tapped.

## Requested Changes (Diff)

### Add
- Backend: stable vars `adminToken` and `adminPassword` (optional Text)
- Backend: `hasAdminCredentials() -> Bool`
- Backend: `setAdminCredentials(token: Text, password: Text) -> ()` (only works when no credentials set)
- Backend: `verifyAdminCredentials(token: Text, password: Text) -> Bool`
- Backend: `changeAdminCredentials(oldToken: Text, oldPassword: Text, newToken: Text, newPassword: Text) -> Bool`
- Frontend: Replace PIN dialog with admin token + password login dialog
- Frontend: First login sets the token and password; subsequent logins require them
- Frontend: 'Change PIN' menu item replaced with 'Change Admin Password'

### Modify
- Backend: main.mo gets admin credential stable vars and functions
- Frontend: App.tsx replaces PIN logic with admin credential logic (calls backend)

### Remove
- Frontend: Local PIN storage in localStorage
- Frontend: PIN-based authentication flow

## Implementation Plan
1. Add `adminToken: ?Text` and `adminPassword: ?Text` stable vars to backend
2. Add `hasAdminCredentials`, `setAdminCredentials`, `verifyAdminCredentials`, `changeAdminCredentials` functions
3. Update frontend: replace PIN state/logic with token+password state/logic
4. Replace PIN dialog UI with token+password dialog
5. Replace 'Change PIN' menu item with 'Change Admin Password'
