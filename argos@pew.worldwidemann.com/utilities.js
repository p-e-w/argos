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
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Config = imports.misc.config;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const EMOJI = Extension.imports.emoji.EMOJI;

const BOXES = {
  l: "left",
  c: "center",
  r: "right"
};

function parseFilename(filename) {
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

const ANSI_COLORS = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

function ansiToMarkup(text) {
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

function getShellVersion(str) {

    let v = str.split(".");
    let n = 0;

    if (v.length == 2) {
	// GNOME 40 and newer versioning scheme
	// https://discourse.gnome.org/t/new-gnome-versioning-scheme/4235
	// must be > 3.x.y with x <= 38
	// 40.alpha -> 33997
	// 41.beta  -> 34098
	// 41.rc    -> 34099
	// 41.0     -> 34100
	// 40.1     -> 34001
	let testReleases = new Map([["alpha", -3],
				    ["beta",  -2],
				    ["rc",    -1]]);
	let minor = testReleases.get(v[1]);
	let major = Number(v[0]);

	if (typeof(minor) == "undefined") {
	    minor = Number(v[1]);
	}

	if (major >= 40)
	    n = 30000 + major * 100 + minor;

    } else if (v.length == 3 && v[0] == "3") {
	n = v.map(Number).reduce(
	    function(a, x) {
		return 100 * a + x;
	    });

    };

    if (n == 0) {
	log("argos: Unsupported GNOME shell version " + str);
	return 0;
    }

    // log("argos: GNOME shell version " + str + " => " + n);
    return n;
}

const shellVersion = getShellVersion(Config.PACKAGE_VERSION);

function readStream(stream, callback) {
  stream.read_line_async(GLib.PRIORITY_LOW, null, function(source, result) {
    let [line] = source.read_line_finish(result);

    if (line === null) {
      callback(null);
    } else {
      if (shellVersion <= 33400)
	callback(String(line) + "\n");
      else
	callback(imports.byteArray.toString(line) + "\n");
      readStream(source, callback);
    }
  });
}

function getActor(obj) {
  if (shellVersion >= 33400)
    return obj;
  else
    return obj.actor;
}

function makeSimpleClass(BaseClass, getSuperArgs, initFn, name) {
  if (shellVersion < 33200) {
    return new Lang.Class({
      Name: name,
      Extends: BaseClass,
      _init: function(...args) {
	this.parent(getSuperArgs(...args));
	initFn.bind(this)(...args);
      }
    });
  } else if (shellVersion < 33400) {
    return class extends BaseClass {
      constructor(...args) {
	super(getSuperArgs(...args));
	initFn.bind(this)(...args);
      }
    }
  } else {
    return GObject.registerClass(
      {
	GTypeName: name
      },
      class extends BaseClass {
	_init(...args) {
	  super._init(getSuperArgs(...args));
	  initFn.bind(this)(...args);
	}
      });
  }
}

if (shellVersion <= 33400)
    var AltSwitcher = imports.ui.status.system.AltSwitcher;
else
  var AltSwitcher = GObject.registerClass(
    class AltSwitcher extends St.Bin {
      _init(standard, alternate) {
        super._init();
        this._standard = standard;
        this._standard.connect('notify::visible', this._sync.bind(this));
        if (this._standard instanceof St.Button)
          this._standard.connect('clicked',
                                 () => this._clickAction.release());

        this._alternate = alternate;
        this._alternate.connect('notify::visible', this._sync.bind(this));
        if (this._alternate instanceof St.Button)
          this._alternate.connect('clicked',
                                  () => this._clickAction.release());

        this._capturedEventId = global.stage.connect('captured-event', this._onCapturedEvent.bind(this));

        this._flipped = false;

        this._clickAction = new Clutter.ClickAction();
        this._clickAction.connect('long-press', this._onLongPress.bind(this));

        this.connect('destroy', this._onDestroy.bind(this));
      }

      vfunc_map() {
        super.vfunc_map();
        this._flipped = false;
      }

      vfunc_unmap() {
        super.vfunc_unmap();
        this._flipped = false;
      }

      _sync() {
        let childToShow = null;

        if (this._standard.visible && this._alternate.visible) {
          let [x_, y_, mods] = global.get_pointer();
          let altPressed = (mods & Clutter.ModifierType.MOD1_MASK) != 0;
          if (this._flipped)
            childToShow = altPressed ? this._standard : this._alternate;
          else
            childToShow = altPressed ? this._alternate : this._standard;
        } else if (this._standard.visible) {
          childToShow = this._standard;
        } else if (this._alternate.visible) {
          childToShow = this._alternate;
        } else {
          this.hide();
          return;
        }

        let childShown = this.get_child();
        if (childShown != childToShow) {
          if (childShown) {
            if (childShown.fake_release)
              childShown.fake_release();
            childShown.remove_action(this._clickAction);
          }
          childToShow.add_action(this._clickAction);

          let hasFocus = this.contains(global.stage.get_key_focus());
          this.set_child(childToShow);
          if (hasFocus)
            childToShow.grab_key_focus();

	  // The actors might respond to hover, so
          // sync the pointer to make sure they update.
          global.sync_pointer();
        }

        this.show();
      }

      _onDestroy() {
        if (this._capturedEventId > 0) {
          global.stage.disconnect(this._capturedEventId);
          this._capturedEventId = 0;
        }
      }

      _onCapturedEvent(actor, event) {
        let type = event.type();
        if (type == Clutter.EventType.KEY_PRESS || type == Clutter.EventType.KEY_RELEASE) {
          let key = event.get_key_symbol();
          if (key == Clutter.KEY_Alt_L || key == Clutter.KEY_Alt_R)
            this._sync();
        }

        return Clutter.EVENT_PROPAGATE;
      }

      _onLongPress(action, actor, state) {
        if (state == Clutter.LongPressState.QUERY ||
            state == Clutter.LongPressState.CANCEL)
          return true;

        this._flipped = !this._flipped;
        this._sync();
        return true;
      }
    });
