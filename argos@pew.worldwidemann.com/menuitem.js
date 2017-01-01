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

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const ArgosLineView = Extension.imports.lineview.ArgosLineView;

const ArgosMenuItem = new Lang.Class({
  Name: "ArgosMenuItem",
  Extends: PopupMenu.PopupBaseMenuItem,

  _init: function(button, line) {
    this.parent();

    let lineView = new ArgosLineView();
    lineView.setLine(line);
    this.actor.add_child(lineView);

    this.connect("activate", Lang.bind(this, function() {
      if (line.hasOwnProperty("bash")) {
        let argv = [];

        if (line.terminal === "false") {
          argv = ["bash", "-c", line.bash];
        } else {
          // Run bash immediately after executing the command to keep the terminal window open
          // (see http://stackoverflow.com/q/3512055)
          argv = ["gnome-terminal", "-e", "bash -c " + GLib.shell_quote(line.bash + "; exec bash")];
        }

        GLib.spawn_async(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
      }

      if (line.hasOwnProperty("href"))
        Gio.AppInfo.launch_default_for_uri(line.href, null);

      if (line.refresh === "true")
        button.update();
    }));
  }
});
