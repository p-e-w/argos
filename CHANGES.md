# Argos – Changes in this Fork

This fork is based on [p-e-w/argos](https://github.com/p-e-w/argos) and adds several features not available in upstream.  
The goal is to stay compatible with existing scripts while making the extension more robust and convenient in daily use.

---

## New Features

### 1. Preserve Submenu State
- **Problem:** On every refresh (`updateInterval`), the entire menu was rebuilt, causing all open submenus to collapse.
- **Solution:**  
  - Open submenus are captured before `removeAll()` and restored after rebuilding.  
  - Script output now supports an `id` property for submenu headers:  

    ```text
    -- Submenu Header | id=connection
    ---- Item A
    ---- Item B
    ```

  - Only if `id` is set will the state be stored and restored.  
  - No `id` → no restore (backward compatible).

- **Technical details:**  
  - A new helper class `submenu_state.js` manages capture/restore of submenu states.  
  - Internally, `GLib.idle_add` is used to ensure restoration happens after the rebuild, avoiding race conditions.

### 2. Reopen Menu After Action
- **Problem:** After running a command from the menu, the menu always closed. For certain workflows (e.g., toggles or quick repeat actions), this was disruptive.  
- **Solution:**  
  - Scripts can now add the property `reopen=true` to a line.  
  - After executing the action, the menu automatically reopens with updated state.  
  - Works only for `bash` commands.  

- **Technical details:**  
  - Integrated into `submenu_state.js` via `requestReopen()` and `finalizeUpdate()`.  
  - `GLib.idle_add` ensures the reopen happens after the rebuild, minimizing flicker.  
  - Backward compatible: lines without `reopen=true` behave as before.

### 3. Minimum Width for Submenus
- **Problem:** When menu entries of different length appear or disappear during refresh, the whole dropdown width jumps, leading to a distracting UI flicker.  
- **Solution:**  
  - Scripts can now specify a minimum width in pixels for submenu headers using a `minwidth` property:  

    ```text
    -- Status | id=status minwidth=360
    ---- Connected
    ---- Last handshake: 2m ago
    ```

  - The `minwidth` value is applied as a hard CSS `min-width` on the corresponding `PopupSubMenuMenuItem`.  
  - Other items remain dynamic, only the submenu header defines the lower bound for its content.

- **Technical details:**  
  - Applied directly when creating a `PopupSubMenuMenuItem` in `button.js`.  
  - Backward compatible: lines without `minwidth` behave as before.  
  - Prevents width “jumping” when submenu content changes.

---

## Internal Changes

- Code for tracking/restoring submenu state was moved out of `button.js` into a **dedicated utility class**.  
- Refactored parts of the menu update logic for better maintainability.  
- Centralized `reopen` handling in `submenu_state.js` instead of scattering flag checks across `button.js` and `menuitem.js`.  
- Added support for per-submenu `minwidth` property.

---

## Known Limitations

- Only one submenu can be open at a time (GNOME Shell limitation).  
- Restoring an open submenu causes a short re-animation (visible “flicker”) because the menu is rebuilt.  
- Without an `id` property in the script line, no state is restored.  
- Menu reopen still causes a very short flicker, as the menu must be rebuilt before reopening.  
- Minimum width applies only to submenu headers (`PopupSubMenuMenuItem`), not to the entire dropdown or the panel button.

---
