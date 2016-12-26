/*
 * Argos - Display the output of arbitrary programs in the GNOME Shell panel
 *
 * Copyright (c) 2016 Philipp Emanuel Weidmann <pew@worldwidemann.com>
 *
 * Nemo vir est qui mundum non reddat meliorem.
 *
 * Released under the terms of the GNU General Public License, version 3
 * (https://gnu.org/licenses/gpl.html)
 */

const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const ArgosMenuItem = Extension.imports.menuitem.ArgosMenuItem;
const Utilities = Extension.imports.utilities;

const ArgosButton = new Lang.Class({
  Name: "ArgosButton",
  Extends: PanelMenu.Button,

  _init: function(file) {
    this.parent(0, "", false);

    this._file = file;

    let label = new St.Label({
      // Used to remove shell theme styling such as bold text (see stylesheet.css)
      style_class: "argos-button-label",
      y_expand: true,
      y_align: Clutter.ActorAlign.CENTER
    });

    this.actor.add_actor(label);

    this._clutterText = label.get_clutter_text();
    this._clutterText.use_markup = true;
    this._clutterText.text = "<small><i>" + GLib.markup_escape_text(file.get_basename(), -1) + " ...</i></small>";

    this._isDestroyed = false;

    this._updateTimeout = null;
    this._cycleTimeout = null;

    this.connect("destroy", Lang.bind(this, this._onDestroy));

    this._updateRunning = false;
    this._updateInterval = Utilities.getUpdateInterval(file);

    this._update();
  },

  _onDestroy: function() {
    this._isDestroyed = true;

    if (this._updateTimeout !== null)
      Mainloop.source_remove(this._updateTimeout);
    if (this._cycleTimeout !== null)
      Mainloop.source_remove(this._cycleTimeout);

    this.menu.removeAll();
  },

  update: function() {
    if (this._updateTimeout !== null) {
      Mainloop.source_remove(this._updateTimeout);
      this._updateTimeout = null;
    }

    this._update();
  },

  _update: function() {
    if (this._updateRunning)
      return;

    this._updateRunning = true;

    try {
      Utilities.spawnWithCallback(null, [this._file.get_path()], null, 0, null,
        Lang.bind(this, function(standardOutput) {
          this._updateRunning = false;

          if (this._isDestroyed)
            return;

          this._processOutput(standardOutput.split("\n"));

          if (this._updateInterval !== null) {
            this._updateTimeout = Mainloop.timeout_add_seconds(this._updateInterval, Lang.bind(this, function() {
              this._updateTimeout = null;
              this._update();
              return false;
            }));
          }
        }));
    } catch (error) {
      log("Unable to execute file '" + this._file.get_basename() + "': " + error);
      this._updateRunning = false;
    }
  },

  _processOutput: function(output) {
    let buttonLines = [];
    let dropdownLines = [];

    let dropdownMode = false;

    for (let i = 0; i < output.length; i++) {
      let line = Utilities.parseLine(output[i]);

      if (line.markup.length === 0)
        continue;

      if (!dropdownMode && line.text === "---") {
        dropdownMode = true;
      } else if (dropdownMode) {
        dropdownLines.push(line);
      } else {
        buttonLines.push(line);
      }
    }

    this.menu.removeAll();

    if (this._cycleTimeout !== null) {
      Mainloop.source_remove(this._cycleTimeout);
      this._cycleTimeout = null;
    }

    if (buttonLines.length === 0) {
      this._clutterText.text = GLib.markup_escape_text(this._file.get_basename(), -1);
    } else if (buttonLines.length === 1) {
      this._clutterText.text = buttonLines[0].markup;
    } else {
      this._clutterText.text = buttonLines[0].markup;
      let i = 0;
      this._cycleTimeout = Mainloop.timeout_add_seconds(3, Lang.bind(this, function() {
        i++;
        this._clutterText.text = buttonLines[i % buttonLines.length].markup;
        return true;
      }));

      for (let j = 0; j < buttonLines.length; j++) {
        if (buttonLines[j].dropdown !== "false")
          this.menu.addMenuItem(new ArgosMenuItem(this, buttonLines[j]));
      }
    }

    if (this.menu.numMenuItems > 0)
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    for (let i = 0; i < dropdownLines.length; i++) {
      if (dropdownLines[i].text === "---") {
        // Although not documented, BitBar appears to render additional "---" lines as separators
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      } else {
        this.menu.addMenuItem(new ArgosMenuItem(this, dropdownLines[i]));
      }
    }

    if (dropdownLines.length > 0)
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    let menuItem = new PopupMenu.PopupMenuItem(this._file.get_basename());
    menuItem.connect("activate", Lang.bind(this, function() {
      Gio.AppInfo.launch_default_for_uri("file://" + this._file.get_path(), null);
    }));
    this.menu.addMenuItem(menuItem);
  }
});
