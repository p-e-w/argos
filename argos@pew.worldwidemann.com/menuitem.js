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

const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GdkPixbuf = imports.gi.GdkPixbuf;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const PopupMenu = imports.ui.popupMenu;

const ArgosMenuItem = new Lang.Class({
  Name: "ArgosMenuItem",
  Extends: PopupMenu.PopupBaseMenuItem,

  _init: function(button, line) {
    this.parent();

    if (line.hasOwnProperty("iconName")) {
      this.actor.add_child(new St.Icon({
        style_class: "popup-menu-icon",
        icon_name: line.iconName
      }));
    } else if (line.hasOwnProperty("image") || line.hasOwnProperty("templateImage")) {
      let image = line.hasOwnProperty("image") ? line.image : line.templateImage;

      // Since support for data URIs was removed(!!!) from St, loading a Base64-encoded image
      // into Clutter using Gjs has become an utter nightmare. The number of roadblocks
      // and almost-working solutions is ridiculous. Some crucial bindings (e.g. for Cogl.Texture)
      // appear to be missing entirely, while others (like MemoryInputStream.new_from_data)
      // cause memory corruption and crash GNOME Shell. Base64 decoding itself has buggy bindings
      // (should return a Uint8Array!). It goes without saying that all of this is either
      // undocumented, poorly documented or wrongly(!) documented.
      // In summary, the GNOME Shell developer's experience is still catastrophic. Fortunately,
      // the working solution below was eventually found buried in gnome-maps (mapSource.js).
      let bytes = GLib.Bytes.new(GLib.base64_decode(image));
      let stream = Gio.MemoryInputStream.new_from_bytes(bytes);

      try {
        let pixbuf = GdkPixbuf.Pixbuf.new_from_stream(stream, null);

        // TextureCache.load_gicon returns a square texture no matter what the Pixbuf's
        // actual dimensions are, so we request a size that can hold all pixels of the
        // image and then resize manually afterwards
        let size = Math.max(pixbuf.width, pixbuf.height);
        let texture = St.TextureCache.get_default().load_gicon(null, pixbuf, size, 1);
        texture.set_size(pixbuf.width, pixbuf.height);

        this.actor.add_child(texture);
        // Do not stretch the texture to the height of the container
        this.actor.child_set_property(texture, "y-fill", false);
      } catch (error) {
        log("Unable to load image from Base64 representation: " + error);
      }
    }

    let label = new St.Label({
      y_expand: true,
      y_align: Clutter.ActorAlign.CENTER
    });

    this.actor.add_child(label);
    this.actor.label_actor = label;

    let clutterText = label.get_clutter_text();
    clutterText.use_markup = true;
    clutterText.text = line.markup;

    this.connect("activate", Lang.bind(this, function() {
      if (line.hasOwnProperty("bash")) {
        let argv = [];

        if (line.terminal === "false") {
          argv = ["bash", "-c", line.bash];
        } else {
          // Run bash immediately after executing the command to keep the terminal window open
          // (see http://stackoverflow.com/q/3512055)
          argv = ["gnome-terminal", "-e", "bash -c " + GLib.shell_quote(line.bash + "; exec bash")];
        }

        GLib.spawn_async(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
      }

      if (line.hasOwnProperty("href"))
        Gio.AppInfo.launch_default_for_uri(line.href, null);

      if (line.refresh === "true")
        button.update();
    }));
  }
});
