/*
 * Argos - Create GNOME Shell extensions in seconds
 *
 * Copyright (c) 2016-2018 Philipp Emanuel Weidmann <pew@worldwidemann.com>
 *
 * Nemo vir est qui mundum non reddat meliorem.
 *
 * Released under the terms of the GNU General Public License, version 3
 * (https://gnu.org/licenses/gpl.html)
 */

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import ArgosLineView from './lineview.js';
import ArgosMenuItem from './menuitem.js';
import * as Utilities from './utilities.js';
import SubmenuState from './submenu_state.js';

const cArgosButton = GObject.registerClass({
  GTypeName: "ArgosButton",
},

class ArgosButton extends PanelMenu.Button {

  _init(file, settings) {
    super._init(0, "", false);

    this._file = file;
    this._updateInterval = settings.updateInterval;
    this._subs = new SubmenuState();

    this._lineView = new ArgosLineView();
    this._lineView.setMarkup("<small><i>" + GLib.markup_escape_text(file.get_basename(), -1) + " ...</i></small>");
    Utilities.getActor(this).add_child(this._lineView);

    this._isDestroyed = false;

    this._updateTimeout = null;
    this._cycleTimeout = null;

    this.connect("destroy", this._onDestroy.bind(this));

    this._updateRunning = false;

    this._update();

    if (settings.updateOnOpen) {
      this.menu.connect("open-state-changed", (open) => {
	if (open)
	  this.update();
      });
    }
  }

  _onDestroy() {
    this._isDestroyed = true;

    if (this._updateTimeout !== null)
      GLib.source_remove(this._updateTimeout);
    if (this._cycleTimeout !== null)
      GLib.source_remove(this._cycleTimeout);

    this.menu.removeAll();
  }

  update() {
    if (this._updateTimeout !== null) {
      GLib.source_remove(this._updateTimeout);
      this._updateTimeout = null;
    }

    this._update();
  }

  _update() {
    if (this._updateRunning)
      return;

    this._updateRunning = true;

    let envp = GLib.get_environ();
    envp.push("ARGOS_VERSION=2");
    envp.push("ARGOS_MENU_OPEN=" + (this.menu.isOpen ? "true" : "false"));

    try {
      Utilities.spawnWithCallback(null, [this._file.get_path()], envp, 0, null,
        (standardOutput) => {
          this._updateRunning = false;

          if (this._isDestroyed)
            return;

          this._processOutput(standardOutput.split("\n"));

          if (this._updateInterval !== null) {
            this._updateTimeout =
	      GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
				       this._updateInterval,
				       () => {
					 this._updateTimeout = null;
					 this._update();
					 return false;
				       });
          }
        });
    } catch (error) {
      log("Unable to execute file '" + this._file.get_basename() + "': " + error);
      this._updateRunning = false;
    }
  }

  _processOutput(output) {
    let buttonLines = [];
    let dropdownLines = [];

    let dropdownMode = false;

    for (let i = 0; i < output.length; i++) {
      if (output[i].length === 0)
        continue;

      let line = Utilities.parseLine(output[i]);

      if (!dropdownMode && line.isSeparator) {
        dropdownMode = true;
      } else if (dropdownMode) {
        dropdownLines.push(line);
      } else {
        buttonLines.push(line);
      }
    }
    this._subs.prepareForUpdate(this);
    this.menu.removeAll();

    if (this._cycleTimeout !== null) {
      GLib.source_remove(this._cycleTimeout);
      this._cycleTimeout = null;
    }

    Utilities.getActor(this).visible = buttonLines.length > 0 || !dropdownMode;

    if (!Utilities.getActor(this).visible)
      return;

    if (buttonLines.length === 0) {
      this._lineView.setMarkup(GLib.markup_escape_text(this._file.get_basename(), -1));
    } else if (buttonLines.length === 1) {
      this._lineView.setLine(buttonLines[0]);
    } else {
      this._lineView.setLine(buttonLines[0]);
      let i = 0;
      this._cycleTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
        i++;
        this._lineView.setLine(buttonLines[i % buttonLines.length]);
        return true;
      });

      for (let j = 0; j < buttonLines.length; j++) {
        if (buttonLines[j].dropdown !== "false")
          this.menu.addMenuItem(new ArgosMenuItem(this, buttonLines[j]));
      }
    }

    if (this.menu.numMenuItems > 0)
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    let menus = [];
    menus[0] = this.menu;

    for (let i = 0; i < dropdownLines.length; i++) {
      let menu;
      if (dropdownLines[i].menuLevel in menus) {
        menu = menus[dropdownLines[i].menuLevel];
      } else {
        log("Invalid menu level for line '" + dropdownLines[i].text + "'");
        menu = this.menu;
      }

      let menuItem;

      if (dropdownLines[i].isSeparator) {
        // Although not documented, BitBar appears to render additional "---" lines as separators
        menuItem = new PopupMenu.PopupSeparatorMenuItem();
      } else if ((i + 1) < dropdownLines.length && dropdownLines[i + 1].menuLevel > dropdownLines[i].menuLevel) {
        // GNOME Shell actually supports only a single submenu nesting level
        // (deeper levels are rendered, but opening them closes the parent menu).
        // Since adding PopupSubMenuMenuItems to submenus does not trigger
        // an error or warning, this should be considered a bug in GNOME Shell.
        // Once it is fixed, this code will work as expected for nested submenus.
        menuItem = new PopupMenu.PopupSubMenuMenuItem("", false);
        //add optional support for restore after refresh
        if (dropdownLines[i].id) {
          menuItem._submenuKey = dropdownLines[i].id;
        }
        if (dropdownLines[i].minwidth) {
          const px = parseInt(dropdownLines[i].minwidth, 10);
          if (Number.isFinite(px) && px > 0) {
            menuItem.actor.set_style(`min-width:${px}px;`);
          }
        }
        let lineView = new ArgosLineView(dropdownLines[i]);
        menuItem.actor.insert_child_below(lineView, menuItem.label);
        menuItem.label.visible = false;
        menus[dropdownLines[i + 1].menuLevel] = menuItem.menu;
      } else if ((i + 1) < dropdownLines.length &&
        dropdownLines[i + 1].menuLevel === dropdownLines[i].menuLevel &&
        dropdownLines[i + 1].hasOwnProperty("alternate") &&
        dropdownLines[i + 1].alternate === "true") {
        menuItem = new ArgosMenuItem(this, dropdownLines[i], dropdownLines[i + 1]);
        // Skip alternate line
        i++;
      } else {
        menuItem = new ArgosMenuItem(this, dropdownLines[i]);
      }

      menu.addMenuItem(menuItem);
     if (menuItem._submenuKey && this._subs.wasOpen(menuItem._submenuKey)) {
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            menuItem.menu.open(false); 
            return GLib.SOURCE_REMOVE;
        });
     }
    }

    if (dropdownLines.length > 0)
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    let menuItem = new PopupMenu.PopupMenuItem(this._file.get_basename(), {
      style_class: "argos-menu-item-edit"
    });
    menuItem.connect("activate", () => {
      Gio.AppInfo.launch_default_for_uri("file://" + this._file.get_path(), null);
    });

    this.menu.addMenuItem(menuItem);
    this._subs.finalizeUpdate(this);
  }
});

export default cArgosButton;
