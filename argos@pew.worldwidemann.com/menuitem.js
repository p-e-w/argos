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

const Lang = imports.lang;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const AltSwitcher = imports.ui.status.system.AltSwitcher;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const ArgosLineView = Extension.imports.lineview.ArgosLineView;

// Menu entry representing a docker container
const ArgosMenuItem = GObject.registerClass(
  {
      GTypeName: 'ArgosMenuItem'
  },
  class extends PopupMenu.PopupBaseMenuItem {
    _init(button, line, alternateLine) {
      let hasAction = line.hasAction || (typeof alternateLine !== "undefined" && alternateLine.hasAction);

      super._init({
        activate: hasAction,
        hover: hasAction,
        can_focus: hasAction
      });

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

      if (hasAction) {
        this.connect("activate", Lang.bind(this, function() {
          let activeLine = (altSwitcher === null) ? line : altSwitcher.actor.get_child().line;

          if (activeLine.hasOwnProperty("href"))
            Gio.AppInfo.launch_default_for_uri(activeLine.href, null);

          if (activeLine.hasOwnProperty("eval"))
            eval(activeLine.eval);

          if (activeLine.hasOwnProperty("bash")) {
            let argv = [];

            if (activeLine.terminal === "false") {
              argv = ["bash", "-c", activeLine.bash];
            } else {
              // Run shell immediately after executing the command to keep the terminal window open
              // (see http://stackoverflow.com/q/3512055)
              argv = ["gnome-terminal", "--", "bash", "-c", activeLine.bash + "; exec ${SHELL:=bash}"];
            }

            let [success, pid] = GLib.spawn_async(
              null, argv, null, GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);

            if (success) {
              GLib.child_watch_add(GLib.PRIORITY_DEFAULT_IDLE, pid, function() {
                if (activeLine.refresh === "true")
                  button.update();
              });
            }
          } else if (activeLine.refresh === "true") {
            button.update();
          }
        }));
      }
    }
  }
);
