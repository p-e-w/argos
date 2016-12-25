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

function getUpdateInterval(file) {
  let updateInterval = null;

  let nameParts = file.get_basename().split(".");

  if (nameParts.length === 3 && nameParts[1].length >= 2) {
    // Attempt to parse BitBar refresh time string
    let number = nameParts[1].substring(0, nameParts[1].length - 1);
    let unit = nameParts[1].substring(nameParts[1].length - 1);

    let factorIndex = "smhd".indexOf(unit);

    if (factorIndex >= 0 && /^\d+$/.test(number)) {
      let factors = [1, 60, 60 * 60, 24 * 60 * 60];
      updateInterval = parseInt(number, 10) * factors[factorIndex];
    }
  }

  return updateInterval;
}

// Performs (mostly) BitBar-compatible output line parsing
// (see https://github.com/matryer/bitbar#plugin-api)
function parseLine(lineString) {
  let line = {};

  let separatorIndex = lineString.indexOf("|");

  if (separatorIndex >= 0) {
    let attributes = [];
    try {
      attributes = GLib.shell_parse_argv(lineString.substring(separatorIndex + 1))[1];
    } catch (error) {
      log("Unable to parse attributes for line '" + lineString + "': " + error);
    }

    for (let i = 0; i < attributes.length; i++) {
      let assignmentIndex = attributes[i].indexOf("=");

      if (assignmentIndex >= 0) {
        let name = attributes[i].substring(0, assignmentIndex).trim();
        let value = attributes[i].substring(assignmentIndex + 1).trim();

        if (name.length > 0 && value.length > 0)
          line[name] = value;
      }
    }

    line.text = lineString.substring(0, separatorIndex).trim();

  } else {
    // Line has no attributes
    line.text = lineString.trim();
  }

  let markupAttributes = [];

  if (line.hasOwnProperty("color"))
    markupAttributes.push("color='" + GLib.markup_escape_text(line.color, -1) + "'");

  if (line.hasOwnProperty("font"))
    markupAttributes.push("font_family='" + GLib.markup_escape_text(line.font, -1) + "'");

  if (line.hasOwnProperty("size")) {
    let pointSize = parseFloat(line.size);
    // Pango expects numerical sizes in 1024ths of a point
    // (see https://developer.gnome.org/pango/stable/PangoMarkupFormat.html)
    let fontSize = (isNaN(pointSize)) ? line.size : Math.round(1024 * pointSize).toString();
    markupAttributes.push("font_size='" + GLib.markup_escape_text(fontSize, -1) + "'");
  }

  let text = (line.useMarkup === "false") ? GLib.markup_escape_text(line.text, -1) : line.text;

  if (markupAttributes.length > 0) {
    line.markup = "<span " + markupAttributes.join(" ") + ">" + text + "</span>";
  } else {
    line.markup = text;
  }

  return line;
}

// Combines the benefits of spawn_sync (easy retrieval of output)
// with those of spawn_async (non-blocking execution).
// Based on https://github.com/optimisme/gjs-examples/blob/master/assets/spawn.js.
function spawnWithCallback(workingDirectory, argv, envp, flags, childSetup, callback) {
  let [success, pid, stdinFile, stdoutFile, stderrFile] = GLib.spawn_async_with_pipes(
    workingDirectory, argv, envp, flags, childSetup);

  if (!success)
    return;

  GLib.close(stdinFile);
  GLib.close(stderrFile);

  let standardOutput = "";

  let stdoutStream = new Gio.DataInputStream({
    base_stream: new Gio.UnixInputStream({
      fd: stdoutFile
    })
  });

  readStream(stdoutStream, function(output) {
    if (output === null) {
      stdoutStream.close(null);
      callback(standardOutput);
    } else {
      standardOutput += output;
    }
  });
}

function readStream(stream, callback) {
  stream.read_line_async(GLib.PRIORITY_LOW, null, function(source, result) {
    let [line] = source.read_line_finish(result);

    if (line === null) {
      callback(null);
    } else {
      callback(String(line) + "\n");
      readStream(source, callback);
    }
  });
}
