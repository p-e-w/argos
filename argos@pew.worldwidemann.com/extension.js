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
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import ArgosButton from './button.js'
import * as Utilities from './utilities.js'

export default class ArgosExtension {

constructor() {
  let directoryPath = GLib.build_filenamev([GLib.get_user_config_dir(), "argos"]);

  this.directory = Gio.File.new_for_path(directoryPath);
  this.buttons = [];

  if (!this.directory.query_exists(null)) {
    this.directory.make_directory(null);

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

    GLib.file_set_contents_full(scriptPath, scriptContents, GLib.FileSetContentsFlags.CONSISTENT, 0o700);
  }

  // WATCH_MOVES requires GLib 2.46 or later
  let monitorFlags = Gio.FileMonitorFlags.hasOwnProperty("WATCH_MOVES") ?
    Gio.FileMonitorFlags.WATCH_MOVES : Gio.FileMonitorFlags.SEND_MOVED;
  this.directoryMonitor = this.directory.monitor_directory(monitorFlags, null);
}

enable() {
  this.addAllButtons();

  directoryChangedId = directoryMonitor.connect("changed", function(monitor, file, otherFile, eventType) {
    switch (eventType) {
      case Gio.FileMonitorEvent.CREATED:
      case Gio.FileMonitorEvent.MOVED_IN:
        if (this.isValidArgosScript(file)) {
          this.addButtonForFile(file);
        }
        break;

      case Gio.FileMonitorEvent.DELETED:
      case Gio.FileMonitorEvent.MOVED_OUT:
      case Gio.FileMonitorEvent.PRE_UNMOUNT:
      case Gio.FileMonitorEvent.UNMOUNTED:
        this.removeButtonForFile(file);
        break;

      case Gio.FileMonitorEvent.MOVED:
      case Gio.FileMonitorEvent.RENAMED:
        this.removeButtonForFile(file);

        if (this.isValidArgosScript(otherFile)) {
          this.addButtonForFile(otherFile);
        }
        break;

      default:
        this.updateButtonForFile(file);
        break;
    }
  });
}

disable() {
  this.directoryMonitor.disconnect(this.directoryChangedId);

  this.removeButtons();
}

function updateButtonForFile(file) {
  let basename = file.get_basename();
  let button = buttons.find((b) => b && b.getFileBasename() == basename);

  if (!button) {
    return false;
  }

  button.update();
}

addButtonForFile(file) {
    let basename = file.get_basename();
    let settings = Utilities.parseFilename(basename);
    let button = new ArgosButton(file, settings);
    let index = this.buttons.findIndex((b) => b && b.getFileBasename() == basename);

    if (index < 0) {
      // append it if not otherwise found
      index = this.buttons.length;
    }

    // destroy existing button as we'll recreate
    if (this.buttons[index] !== null) {
      this.removeButton(index);
    }

    this.buttons[index] = button;
    button.addToPanel(Main.panel, "argos-button-" + index, settings);
}

removeButtonForFile(file) {
    let basename = file.get_basename();
    let index = this.buttons.findIndex((b) => b && b.getFileBasename() == basename);

    if (index >= 0) {
      this.removeButton(index);
    }
}

isValidArgosScript(file) {
  return GLib.file_test(file.get_path(), GLib.FileTest.IS_EXECUTABLE) &&
    !GLib.file_test(file.get_path(), GLib.FileTest.IS_DIR) &&
    !file.get_basename().startsWith(".");
}

compareFilesForSort(file1, file2) {
  let basename1 = file1.get_basename();
  let basename2 = file2.get_basename();
  let settings1 = Utilities.parseFilename(basename1);
  let settings2 = Utilities.parseFilename(basename2);

  let boxDiff = settings1.box.localeCompare(settings2.box);

  if (boxDiff !== 0) {
    return boxDiff;
  }

  let posDiff = settings1.position - settings2.position;

  if (posDiff !== 0) {
    return posDiff;
  }

  return basename1.localeCompare(basename2);
}

findButtonFiles() {
  let files = [];

  let enumerator = this.directory.enumerate_children(Gio.FILE_ATTRIBUTE_STANDARD_NAME, Gio.FileQueryInfoFlags.NONE, null);

  let fileInfo = null;
  while ((fileInfo = enumerator.next_file(null)) !== null) {
    let file = enumerator.get_child(fileInfo);

    if (this.isValidArgosScript(file)) {
      files.push(file);
    }
  }

  files.sort(this.compareFilesForSort);

  return files;
}

addAllButtons() {
  const files = this.findButtonFiles();

  // Iterate in reverse order as buttons are added right-to-left
  for (let i = files.length - 1; i >= 0; i--) {
    this.addButtonForFile(files[i], i);
  }
}

removeButton(index) {
  if (this.buttons[index]) {
    this.buttons[index].destroy();
    this.buttons[index] = null;
  }
}

removeButtons() {
  for (let i = 0; i < this.buttons.length; i++) {
    this.removeButton(i);
  }
  this.buttons = [];
}

}
