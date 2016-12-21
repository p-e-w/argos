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

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const ArgosButton = Extension.imports.button.ArgosButton;

let directory;
let directoryMonitor;
let directoryChangedId;
let debounceTimeout = null;
let buttons = [];

function init() {
  let directoryName = GLib.build_filenamev([GLib.get_user_config_dir(), "argos"]);

  directory = Gio.File.new_for_path(directoryName);
  if (!directory.query_exists(null))
    directory.make_directory(null);

  directoryMonitor = directory.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
}

function enable() {
  addButtons();

  directoryChangedId = directoryMonitor.connect("changed", function(monitor, file, otherFile, eventType) {
    removeButtons();

    // Some high-level file operations trigger multiple "changed" events in rapid succession.
    // Debouncing groups them together to avoid unnecessary updates.
    if (debounceTimeout === null) {
      debounceTimeout = Mainloop.timeout_add(100, function() {
        debounceTimeout = null;
        addButtons();

        return false;
      });
    }
  });
}

function disable() {
  directoryMonitor.disconnect(directoryChangedId);

  if (debounceTimeout !== null)
    Mainloop.source_remove(debounceTimeout);

  removeButtons();
}

function addButtons() {
  let files = [];

  let enumerator = directory.enumerate_children(Gio.FILE_ATTRIBUTE_STANDARD_NAME, Gio.FileQueryInfoFlags.NONE, null);

  let fileInfo = null;
  while ((fileInfo = enumerator.next_file(null)) !== null) {
    let file = enumerator.get_child(fileInfo);

    if (GLib.file_test(file.get_path(), GLib.FileTest.IS_EXECUTABLE) &&
      !GLib.file_test(file.get_path(), GLib.FileTest.IS_DIR) &&
      !file.get_basename().startsWith(".")) {
      files.push(file);
    }
  }

  files.sort(function(file1, file2) {
    return file1.get_basename().localeCompare(file2.get_basename());
  });

  // Iterate in reverse order as buttons are added right-to-left
  for (let i = files.length - 1; i >= 0; i--) {
    let button = new ArgosButton(files[i]);
    buttons.push(button);
    Main.panel.addToStatusArea("argos-button-" + i, button);
  }
}

function removeButtons() {
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].destroy();
  }
  buttons = [];
}
