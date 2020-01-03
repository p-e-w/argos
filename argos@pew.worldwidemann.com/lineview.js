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
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GdkPixbuf = imports.gi.GdkPixbuf;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

var ArgosLineView = new Lang.Class({
  Name: "ArgosLineView",
  Extends: St.BoxLayout,

  _init: function(line) {
    this.parent({
      style_class: "argos-line-view"
    });

    if (typeof line !== "undefined")
      this.setLine(line);
  },

  setLine: function(line) {
    this.line = line;

    this.remove_all_children();

    if (line.hasOwnProperty("iconName")) {
      this.add_child(new St.Icon({
        style_class: "popup-menu-icon",
        icon_name: line.iconName
      }));
    }

    if (line.hasOwnProperty("image") || line.hasOwnProperty("templateImage")) {
      let image = line.hasOwnProperty("image") ? line.image : line.templateImage;

      // Source: https://github.com/GNOME/gnome-maps (mapSource.js)
      let bytes = GLib.Bytes.new(GLib.base64_decode(image));
      let stream = Gio.MemoryInputStream.new_from_bytes(bytes);

      try {
        let pixbuf = GdkPixbuf.Pixbuf.new_from_stream(stream, null);

        // TextureCache.load_gicon returns a square texture no matter what the Pixbuf's
        // actual dimensions are, so we request a size that can hold all pixels of the
        // image and then resize manually afterwards
        let aspectRatio = pixbuf.width / pixbuf.height;

        let width = parseInt(line.imageWidth, 10);
        let height = parseInt(line.imageHeight, 10);

        if (isNaN(width) && isNaN(height)) {
          width = pixbuf.width;
          height = pixbuf.height;
        } else if (isNaN(width)) {
          width = Math.round(height * aspectRatio);
        } else if (isNaN(height)) {
          height = Math.round(width / aspectRatio);
        }

        // Scale icon when display is scaled
        let themeContext = St.ThemeContext.get_for_stage(global.stage);
        // TODO: themeContext.connect('notify::scale-factor', ...) to redraw icon when scale factor changes
        let scaleFactor = themeContext.scale_factor;
        height *= scaleFactor;
        width *= scaleFactor;

        let texture = St.TextureCache.get_default().load_gicon(null, pixbuf, height, 1, 1.0);
        texture.set_size(width, height);

        // Do not stretch the texture to the height of the container
        texture.set_y_align(Clutter.ActorAlign.CENTER);

        this.add_child(texture);
      } catch (error) {
        log("Unable to load image from Base64 representation: " + error);
      }
    }

    if (line.markup.length > 0) {
      let label = new St.Label({
        y_expand: true,
        y_align: Clutter.ActorAlign.CENTER
      });

      this.add_child(label);

      let clutterText = label.get_clutter_text();
      clutterText.use_markup = true;
      clutterText.text = line.markup;

      if (line.hasOwnProperty("length")) {
        let maxLength = parseInt(line.length, 10);
        // "clutterText.text.length" fails for non-BMP Unicode characters
        let textLength = clutterText.buffer.get_length();

        if (!isNaN(maxLength) && textLength > maxLength) {
          clutterText.set_cursor_position(maxLength);
          clutterText.delete_chars(textLength);
          clutterText.insert_text("...", maxLength);
        }
      }
    }
  },

  setMarkup: function(markup) {
    this.setLine({
      markup: markup
    });
  }
});
