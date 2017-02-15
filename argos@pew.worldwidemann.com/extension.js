/*
 * Argos - Create GNOME Shell extensions in seconds
 *
 * Copyright (c) 2016-2017 Philipp Emanuel Weidmann <pew@worldwidemann.com>
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
const Utilities = Extension.imports.utilities;

let directory;
let directoryMonitor;
let directoryChangedId;
let debounceTimeout = null;
let buttons = [];

function init() {
  let directoryPath = GLib.build_filenamev([GLib.get_user_config_dir(), "argos"]);

  directory = Gio.File.new_for_path(directoryPath);

  if (!directory.query_exists(null)) {
    directory.make_directory(null);

    // Create "welcome" script on first run to indicate
    // that the extension is installed and working
    let scriptPath = GLib.build_filenamev([directoryPath, "argos.sh"]);

    let scriptContents =
      '#!/usr/bin/env bash\n\n' +
      'URL="github.com/p-e-w/argos"\n' +
      'DIR=$(dirname "$0")\n\n' +
      'echo "Argos"\n' +
      'echo "---"\n' +
      'echo "$URL | iconName=help-faq-symbolic href=\'https://$URL\'"\n' +
      'echo "$DIR | iconName=folder-symbolic href=\'file://$DIR\'"\n\n';

    GLib.file_set_contents(scriptPath, scriptContents);

    // Running an external program just to make a file executable is ugly,
    // but Gjs appears to be missing bindings for the "chmod" syscall
    GLib.spawn_sync(null, ["chmod", "+x", scriptPath], null, GLib.SpawnFlags.SEARCH_PATH, null);
  }

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
    let settings = Utilities.parseFilename(files[i].get_basename());
    let button = new ArgosButton(files[i], settings.updateInterval);
    buttons.push(button);
    Main.panel.addToStatusArea("argos-button-" + i, button, settings.position, settings.box);
  }
}

function removeButtons() {
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].destroy();
  }
  buttons = [];
}
