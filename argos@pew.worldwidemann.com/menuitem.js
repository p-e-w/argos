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

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import ArgosLineView from './lineview.js'
import * as Utilities from './utilities.js'

const cArgosMenuItem = GObject.registerClass(
  {
    GTypeName: "ArgosMenuItem"
  },
  class _ArgosMenuItem extends PopupMenu.PopupBaseMenuItem {
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
	Utilities.getActor(this).add_child(lineView);
      } else {
	let alternateLineView = new ArgosLineView(alternateLine);
	altSwitcher = new AltSwitcher(lineView, alternateLineView);
	lineView.visible = true;
	alternateLineView.visible = true;
	Utilities.getActor(this).add_child(altSwitcher.actor);
      }

      if (hasAction) {
	this.connect("activate", () => {
	  let activeLine = (altSwitcher === null) ? line : altSwitcher.actor.get_child().line;

	  if (activeLine.hasOwnProperty("href"))
	    Gio.AppInfo.launch_default_for_uri(activeLine.href, null);

	  if (activeLine.hasOwnProperty("eval"))
	    eval(activeLine.eval);

	  if (activeLine.hasOwnProperty("bash")) {
        // support reopen
        if (activeLine.reopen === "true") {
            button._subs.requestReopen(button);
        }
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
	  }else if (activeLine.reopen === "true") { // trigger update even without bash
        button.update();
      }
	});
      }
    }
  });

export default cArgosMenuItem;
