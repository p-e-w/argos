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

import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import EMOJI from './emoji.js'

export const BOXES = {
  l: "left",
  c: "center",
  r: "right"
};

export function parseFilename(filename) {
  let settings = {
    updateOnOpen: false,
    updateInterval: null,
    position: 0,
    box: "right"
  };

  let nameParts = filename.split(".");

  let updatePart = (nameParts.length >= 3) ? nameParts[nameParts.length - 2] : null;
  let positionPart = (nameParts.length >= 4) ? nameParts[nameParts.length - 3] : null;

  if (updatePart !== null && updatePart.endsWith("+")) {
    settings.updateOnOpen = true;
    updatePart = updatePart.substring(0, updatePart.length - 1);
  }

  if (updatePart !== null && updatePart.length >= 2) {
    // Attempt to parse BitBar refresh time string
    let number = updatePart.substring(0, updatePart.length - 1);
    let unit = updatePart.substring(updatePart.length - 1);

    let factorIndex = "smhd".indexOf(unit);

    if (factorIndex >= 0 && /^\d+$/.test(number)) {
      let factors = [1, 60, 60 * 60, 24 * 60 * 60];
      settings.updateInterval = parseInt(number, 10) * factors[factorIndex];
    }
  }

  if (positionPart !== null && positionPart.length >= 1) {
    let position = positionPart.substring(0, positionPart.length - 1);
    let box = positionPart.substring(positionPart.length - 1);

    if (BOXES.hasOwnProperty(box) && /^\d*$/.test(position)) {
      settings.box = BOXES[box];

      if (position.length > 0)
        settings.position = parseInt(position, 10);
    }
  }

  return settings;
}

// Performs (mostly) BitBar-compatible output line parsing
// (see https://github.com/matryer/bitbar#plugin-api)
export function parseLine(lineString) {
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

    line.text = lineString.substring(0, separatorIndex);

  } else {
    // Line has no attributes
    line.text = lineString;
  }

  let leadingDashes = line.text.search(/[^-]/);
  if (leadingDashes >= 2) {
    line.menuLevel = Math.floor(leadingDashes / 2);
    line.text = line.text.substring(line.menuLevel * 2);
  } else {
    line.menuLevel = 0;
  }

  line.isSeparator = /^-+$/.test(line.text.trim());

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

  line.markup = line.text;

  if (!line.hasOwnProperty("unescape") || line.unescape !== "false")
    line.markup = GLib.strcompress(line.markup);

  if (!line.hasOwnProperty("emojize") || line.emojize !== "false") {
    line.markup = line.markup.replace(/:([\w+-]+):/g, function(match, emojiName) {
      emojiName = emojiName.toLowerCase();
      return EMOJI.hasOwnProperty(emojiName) ? EMOJI[emojiName] : match;
    });
  }

  if (!line.hasOwnProperty("trim") || line.trim !== "false")
    line.markup = line.markup.trim();

  if (line.hasOwnProperty("useMarkup") && line.useMarkup === "false") {
    line.markup = GLib.markup_escape_text(line.markup, -1);
    // Restore escaped ESC characters (needed for ANSI sequences)
    line.markup = line.markup.replace("&#x1b;", "\x1b");
  }

  // Note that while it is possible to format text using a combination of Pango markup
  // and ANSI escape sequences, lines like "<b>ABC \e[1m DEF</b>" lead to unmatched tags
  if (!line.hasOwnProperty("ansi") || line.ansi !== "false")
    line.markup = ansiToMarkup(line.markup);

  if (markupAttributes.length > 0)
    line.markup = "<span " + markupAttributes.join(" ") + ">" + line.markup + "</span>";

  if (line.hasOwnProperty("bash")) {
    // Append BitBar's legacy "paramN" attributes to the bash command
    // (Argos allows placing arguments directy in the command string)
    let i = 1;
    while (line.hasOwnProperty("param" + i)) {
      line.bash += " " + GLib.shell_quote(line["param" + i]);
      i++;
    }
  }

  line.hasAction = line.hasOwnProperty("bash") || line.hasOwnProperty("href") ||
    line.hasOwnProperty("eval") ||
    (line.hasOwnProperty("refresh") && line.refresh === "true");

  return line;
}

export const ANSI_COLORS = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

export function ansiToMarkup(text) {
  let markup = "";

  let markupAttributes = {};

  let regex = new GLib.Regex("(\\e\\[([\\d;]*)m)", 0, 0);

  // GLib's Regex.split is a fantastic tool for tokenizing strings because of an important detail:
  // If the regular expression contains capturing groups, their matches are also returned.
  // Therefore, tokens will be an array of the form
  //   TEXT, [(FULL_ESC_SEQUENCE, SGR_SEQUENCE, TEXT), ...]
  let tokens = regex.split(text, 0);

  for (let i = 0; i < tokens.length; i++) {
    if (regex.match(tokens[i], 0)[0]) {
      // Default is SGR 0 (reset)
      let sgrSequence = (tokens[i + 1].length > 0) ? tokens[i + 1] : "0";
      let sgrCodes = sgrSequence.split(";");

      for (let j = 0; j < sgrCodes.length; j++) {
        if (sgrCodes[j].length === 0)
          continue;

        let code = parseInt(sgrCodes[j], 10);

        if (code === 0) {
          // Reset all attributes
          markupAttributes = {};
        } else if (code === 1) {
          markupAttributes.font_weight = "bold";
        } else if (code === 3) {
          markupAttributes.font_style = "italic";
        } else if (code === 4) {
          markupAttributes.underline = "single";
        } else if (30 <= code && code <= 37) {
          markupAttributes.color = ANSI_COLORS[code - 30];
        } else if (40 <= code && code <= 47) {
          markupAttributes.bgcolor = ANSI_COLORS[code - 40];
        }
      }

      let textToken = tokens[i + 2];

      if (textToken.length > 0) {
        let attributeString = "";
        for (let attribute in markupAttributes) {
          attributeString += " " + attribute + "='" + markupAttributes[attribute] + "'";
        }

        if (attributeString.length > 0) {
          markup += "<span" + attributeString + ">" + textToken + "</span>";
        } else {
          markup += textToken;
        }
      }

      // Skip processed tokens
      i += 2;

    } else {
      markup += tokens[i];
    }
  }

  return markup;
}

// Combines the benefits of spawn_sync (easy retrieval of output)
// with those of spawn_async (non-blocking execution).
// Based on https://github.com/optimisme/gjs-examples/blob/master/assets/spawn.js.
export function spawnWithCallback(workingDirectory, argv, envp, flags, childSetup, callback) {
  let [success, pid, stdinFile, stdoutFile, stderrFile] = GLib.spawn_async_with_pipes(
    workingDirectory, argv, envp, flags, childSetup);

  if (!success)
    return;

  GLib.close(stdinFile);
  GLib.close(stderrFile);

  let standardOutput = "";

  let stdoutStream = new Gio.DataInputStream({
    base_stream: new GioUnix.InputStream({
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

export function getShellVersion(str) {
  let versionParts = str.split(".");
  let versionNumber = 0;

  if (versionParts.length < 2) {
    log("Invalid GNOME Shell version '" + str + "'");
    return 0;
  }

  let major = Number(versionParts[0]);

  if (major >= 40) {
    // GNOME 40 and newer versioning scheme
    // https://discourse.gnome.org/t/new-gnome-versioning-scheme/4235
    // must be > 3.x.y with x <= 38
    // For 40.x, the 3rd digit is ignored
    // 40.alpha -> 33997
    // 41.beta  -> 34098
    // 41.rc    -> 34099
    // 41.0     -> 34100
    // 40.1     -> 34001
    // 40.1.1   -> 34001
    let testReleases = new Map([["alpha", -3], ["beta", -2], ["rc", -1]]);
    let minor = testReleases.get(versionParts[1]);
    let major = Number(versionParts[0]);

    if (typeof minor === "undefined")
      minor = Number(versionParts[1]);

    if (major >= 40)
      versionNumber = 30000 + major * 100 + minor;

  } else if (versionParts.length === 3 && versionParts[0] === "3") {
    versionNumber = versionParts.map(Number).reduce(function(previousValue, currentValue) {
      return 100 * previousValue + currentValue;
    });
  };

  if (versionNumber === 0) {
    log("Unsupported GNOME Shell version '" + str + "'");
    return 0;
  }

  return versionNumber;
}

export const SHELL_VERSION = getShellVersion(Config.PACKAGE_VERSION);
const SHELL_3_32 = getShellVersion("3.32.0");
const SHELL_3_34 = getShellVersion("3.34.0");

export function readStream(stream, callback) {
  stream.read_line_async(GLib.PRIORITY_LOW, null, function(source, result) {
    let [line] = source.read_line_finish(result);

    if (line === null) {
      callback(null);
    } else {
      callback(imports.byteArray.toString(line) + "\n");
      readStream(source, callback);
    }
  });
}

export function getActor(obj) {
  return obj;
}
