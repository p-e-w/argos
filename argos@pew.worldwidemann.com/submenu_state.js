import GLib from 'gi://GLib';
// submenu_state.js
export default class SubmenuState {
  constructor() { this._openKeys = new Set(); }


  wasOpen(key) { return key && this._openKeys.has(key); }

  requestReopen(button) {
    button._reopenAfterAction = true;
    this._capture(button.menu);
  }

  prepareForUpdate(button) {
    if(button._reopenAfterAction) return;
    this._capture(button.menu);
  }
  
  finalizeUpdate(button) {
    if (!button._reopenAfterAction) return;
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      button.menu.open(false);
      return GLib.SOURCE_REMOVE;
    });
    button._reopenAfterAction = false;
    this._openKeys.clear();
  }
    
  _capture(rootMenu) {
    this._openKeys.clear();
    this._walk(rootMenu, item => {
      if (item.menu?.isOpen && item._submenuKey) this._openKeys.add(item._submenuKey);
    });
  }

  // interne Hilfe: durch alle Items (rekursiv) laufen
  _walk(menu, fn) {
    for (const it of menu._getMenuItems()) {
      if (it.constructor.name === 'PopupSubMenuMenuItem') {
        fn(it);
        this._walk(it.menu, fn);
      }
    }
  }
}
