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
const PopupMenu = imports.ui.popupMenu;

const ArgosMenuItem = new Lang.Class({
  Name: "ArgosMenuItem",
  Extends: PopupMenu.PopupBaseMenuItem,

  _init: function(button, line) {
    this.parent();

    if (line.hasOwnProperty("iconName")) {
      this.actor.add_child(new St.Icon({
        style_class: "popup-menu-icon",
        icon_name: line.iconName
      }));
    }

    let label = new St.Label({});
    this.actor.add_child(label);
    this.actor.label_actor = label;

    let clutterText = label.get_clutter_text();
    clutterText.use_markup = true;
    clutterText.text = line.markup;

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
