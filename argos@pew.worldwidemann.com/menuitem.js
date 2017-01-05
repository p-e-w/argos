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
const PopupMenu = imports.ui.popupMenu;
const AltSwitcher = imports.ui.status.system.AltSwitcher;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const ArgosLineView = Extension.imports.lineview.ArgosLineView;

const ArgosMenuItem = new Lang.Class({
  Name: "ArgosMenuItem",
  Extends: PopupMenu.PopupBaseMenuItem,

  _init: function(button, line, alternateLine) {
    this.parent();

    let altSwitcher = null;

    let lineView = new ArgosLineView(line);

    if (typeof alternateLine === "undefined") {
      this.actor.add_child(lineView);
    } else {
      let alternateLineView = new ArgosLineView(alternateLine);
      altSwitcher = new AltSwitcher(lineView, alternateLineView);
      lineView.visible = true;
      alternateLineView.visible = true;
      this.actor.add_child(altSwitcher.actor);
    }

    this.connect("activate", Lang.bind(this, function() {
      let activeLine = (altSwitcher === null) ? line : altSwitcher.actor.get_child().line;

      if (activeLine.hasOwnProperty("bash")) {
        let argv = [];

        if (activeLine.terminal === "false") {
          argv = ["bash", "-c", activeLine.bash];
        } else {
          // Run bash immediately after executing the command to keep the terminal window open
          // (see http://stackoverflow.com/q/3512055)
          argv = ["gnome-terminal", "-e", "bash -c " + GLib.shell_quote(activeLine.bash + "; exec bash")];
        }

        GLib.spawn_async(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
      }

      if (activeLine.hasOwnProperty("href"))
        Gio.AppInfo.launch_default_for_uri(activeLine.href, null);

      if (activeLine.refresh === "true")
        button.update();
    }));
  }
});
