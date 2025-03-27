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
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GdkPixbuf from 'gi://GdkPixbuf';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

const cArgosLineView = GObject.registerClass({
  GTypeName: "ArgosLineView",
},

class ArgosLineView extends St.BoxLayout {

  _init(line) {
    super._init({
      style_class: "argos-line-view"
    });

    if (typeof line !== "undefined")
      this.setLine(line);
  }

  setLine(line) {
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
        let size = Math.max(pixbuf.width, pixbuf.height);
        let texture = St.TextureCache.get_default().load_gicon(null, pixbuf, size, 1, 1.0);

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

        texture.set_size(width, height);

        this.add_child(texture);
        // Do not stretch the texture to the height of the container
        this.child_set_property(texture, "y-fill", false);
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
      clutterText.text = line.markup;
      clutterText.use_markup = true;

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
  }

  setMarkup(markup) {
    this.setLine({
      markup: markup
    });
  }
});

export default cArgosLineView;
