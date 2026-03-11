# Attendance & Salary Manager

## Current State
- App has a top header, top tab navigation, tab content area, and a fixed "Welcome" button at bottom-left.
- Color scheme uses charcoal/orange.
- Mode toggles between view and edit via the Welcome button.

## Requested Changes (Diff)

### Add
- Main/Home screen shown when app first loads (before any tab is selected).
- "View AttendPay" button centered on the main screen — tapping it enters view-only mode and navigates to the tabs.
- In view mode, the edit button (Welcome) is hidden entirely.
- "Welcome" text (not a button) shown at the bottom of the main screen in small font.

### Modify
- Move all 6 tab navigation buttons to the bottom of the screen (phone-style bottom nav bar).
- Tab bar fits phone screen width — icons or abbreviated labels.
- Color scheme updated to: #FF7F11 (orange), #ACBFA4 (sage green), #E2E8CE (light cream), #262626 (near-black).
- Welcome is no longer a button — just small text at the bottom of the main screen.
- Edit mode toggle: only accessible from main screen or hidden in view-only mode.

### Remove
- Welcome button (fixed bottom-left floating button) removed.
- Top tab navigation bar removed (replaced with bottom nav).

## Implementation Plan
1. Add a `screen` state: `"home" | "app"`.
2. Home screen: centered "View AttendPay" button, app title, and small "Welcome" text at the bottom. Welcome text is tappable to toggle edit mode so admin can still access edit.
3. Tapping "View AttendPay" sets mode to `view` and navigates to app screen.
4. App screen: tab content + bottom nav bar with 6 tabs.
5. Bottom nav bar uses #FF7F11 active color, #ACBFA4 for inactive, #262626 background.
6. In view mode, no visible edit button; Welcome text at bottom of home screen provides the only path to edit mode.
7. Apply new color palette throughout.
