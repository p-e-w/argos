![Header](https://cloud.githubusercontent.com/assets/2702526/21295125/68218a42-c574-11e6-98ba-6d8add0efb9e.png)


## Argos – Create GNOME Shell extensions in seconds

[Most GNOME Shell extensions](https://extensions.gnome.org) do one thing: Add a button with a dropdown menu to the panel, displaying information and exposing functionality. Even in its simplest form, creating such an extension is a nontrivial task involving a poorly documented and ever-changing JavaScript API.

**Argos lets you write GNOME Shell extensions in a language that every Linux user is already intimately familiar with: `bash` scripts!**

More precisely, Argos is a GNOME Shell extension that turns executables' standard output into panel dropdown menus. It is inspired by, and fully compatible with, the [BitBar](https://github.com/matryer/bitbar) app for macOS. Argos supports many [BitBar plugins](https://github.com/matryer/bitbar-plugins) without modifications, giving you access to a large library of well-tested scripts in addition to being able to write your own.

### Key features

- **100% API compatible with BitBar 1.9.2:** All BitBar plugins that run on Linux (i.e. do not contain macOS-specific code) work with Argos (else it's a bug).
- **Beyond BitBar:** Argos can do everything that BitBar can do, but also some things that BitBar can't do (yet). See the documentation for details.
- **Sophisticated asynchronous execution engine:** No matter how long your scripts take to run, Argos will schedule them intelligently and prevent blocking.
- **Unicode support:** Just print your text to stdout. It will be rendered the way you expect.
- **Optimized for minimum resource consumption:** Even with multiple plugins refreshing every second, Argos typically uses less than 1% of the CPU.
- **Fully documented**


## Installation

Clone the repository, then copy or symlink the directory `argos@pew.worldwidemann.com` into `~/.local/share/gnome-shell/extensions`. Restart GNOME Shell by pressing <kbd>Alt+F2</kbd>, then entering `r`. On some systems, you may have to manually enable the Argos extension using GNOME Tweak Tool.


## Usage

Argos monitors the directory `~/.config/argos` for changes. Any executable file found in this directory is considered a plugin. Files whose name starts with a dot (`.`) and files in subdirectories are ignored.

Plugins are run and their standard output is interpreted as described below. For each plugin, a panel button with a dropdown menu is created. The arrangement of buttons from left to right follows the alphabetical order of the files they are generated from. New plugins and edits to existing plugins are automatically detected and reflected in the panel.

### File name format

A plugin file may be named anything (it only needs to be executable), but if its name has the special form

```
NAME.INTERVAL.EXTENSION
```

where `INTERVAL` consists of an integer + a period abbreviation such as `s` (seconds), `m` (minutes), `h` (hours) or `d` (days), the plugin is re-run and its output re-rendered every `INTERVAL`.

For example, a script named `plugin.10s.sh` would update every 10 seconds.

### Output format

Argos plugins are executables (such as shell scripts) that print to standard output lines of the following form:

```
TEXT | ATTRIBUTE_1=VALUE ATTRIBUTE_2=VALUE ...
```

All attributes are optional, so the most basic plugins simply print lines consisting of text to be displayed. To include whitespace, attribute values may be quoted using the same convention employed by most command line shells.

### Rendering

Lines containing only dashes (`---`) are *separators*.

Lines above the first separator belong to the button itself. If there are multiple such lines, they are displayed in succession, each of them for 3 seconds before switching to the next. Additionally, all button lines get a dropdown menu item, except if their `dropdown` attribute is set to `false`.

Lines below the first separator are rendered as dropdown menu items. Further separators create graphical separator menu items.

Lines beginning with `--` are rendered in a submenu associated with the preceding unindented line. While Argos supports nested submenus *in principle*, GNOME Shell does not render them correctly as of version 3.22.

[Emoji codes](http://www.emoji-cheat-sheet.com) like `:horse:` :horse: and `:smile:` :smile: in the line text are replaced with their corresponding Unicode characters (unless the `emojize` attribute is set to `false`). Note that unpatched GNOME Shell does not yet support multicolor emoji.

[ANSI SGR escape sequences](https://en.wikipedia.org/wiki/ANSI_escape_code#graphics) and [Pango markup](https://developer.gnome.org/pango/stable/PangoMarkupFormat.html) tags may be used for styling. This can be disabled by setting the `ansi` and `useMarkup` attributes, respectively, to `false`.

Backslash escapes such as `\n` and `\t` in the line text are converted to their corresponding characters (newline and tab in this case), which can be prevented by setting the `unescape` attribute to `false`. Newline escapes can be used to create multi-line menu items.

### Line attributes

#### Display

Control how the line is rendered.

| Attribute | Value | Description |
| --- | --- | --- |
| `color` | Hex RGB/RGBA or color name | Sets the text color for the item. |
| `font` | Font name | Sets the font for the item. |
| `size` | Font size in points | Sets the font size for the item. |
| `iconName` | Icon name | Sets a menu icon for the item. See the [freedesktop.org icon naming specification](https://specifications.freedesktop.org/icon-naming-spec/icon-naming-spec-latest.html) for a list of valid names. **Argos only.** |
| `image`, `templateImage` | Base64-encoded image file | Renders an image inside the item. The image is positioned to the left of the text and to the right of the icon. GNOME Shell does not have a concept of "template images", so `image` and `templateImage` are interchangeable in Argos. |
| `length` | Length in characters | Truncate the line text to the specified number of characters, ellipsizing the truncated part. |
| `trim` | `true` or `false` | If `false`, preserve leading and trailing whitespace of the line text. |
| `dropdown` | `true` or `false` | If `false` and the line is a button line (see above), exclude it from being displayed in the dropdown menu. |
| `alternate` | `true` or `false` | If `true`, the item is hidden by default, and shown in place of the preceding item when the <kbd>Alt</kbd> key is pressed. |
| `emojize` | `true` or `false` | If `false`, disable substitution of `:emoji_name:` with emoji characters in the line text. |
| `ansi` | `true` or `false` | If `false`, disable interpretation of ANSI escape sequences in the line text. |
| `useMarkup` | `true` or `false` | If `false`, disable interpretation of Pango markup in the line text. **Argos only.** |
| `unescape` | `true` or `false` | If `false`, disable interpretation of backslash escapes such as `\n` in the line text. **Argos only.** |

#### Actions

Define actions to be performed when the user clicks on the line's menu item.

Action attributes are *not* mutually exclusive. Any combination of them may be associated with the same item, and all actions are executed when the item is clicked.

| Attribute | Value | Description |
| --- | --- | --- |
| `bash` | `bash` command | Runs a command using `bash` inside a GNOME Terminal window. |
| `terminal` | `true` or `false` | If `false`, runs the `bash` command in the background (i.e. without opening a terminal window). |
| `param1`, `param2`, ... | Command line arguments | Arguments to be passed to the `bash` command. *Note: Provided for compatibility with BitBar only. Argos allows placing arguments directy in the command string.* |
| `href` | URI | Opens a URI in the application registered to handle it. URIs starting with `http://` launch the web browser, while `file://` URIs open the file in its associated default application. |
| `eval` | JavaScript code | Passes the code to JavaScript's `eval` function. **Argos only.** |
| `refresh` | `true` or `false` | If `true`, re-runs the plugin, updating its output. |


## BitBar plugins with Argos

These screenshots show how some popular scripts from the BitBar plugin repository look when rendered by Argos compared to the "original" BitBar rendering (macOS screenshots taken from https://getbitbar.com).

| Plugin | BitBar on macOS | Argos on GNOME Shell |
| --- | --- | --- |
| [**Ping**](https://getbitbar.com/plugins/Network/ping.10s.sh) | ![Ping/BitBar](https://cloud.githubusercontent.com/assets/2702526/21295134/a3950144-c574-11e6-906c-4d440463c5cf.png) | ![Ping/Argos](https://cloud.githubusercontent.com/assets/2702526/21295133/985a0964-c574-11e6-9e43-f568b40e0904.png) |
| [**Stock Ticker**](https://getbitbar.com/plugins/Finance/gfinance.5m.py) | ![Stock Ticker/BitBar](https://cloud.githubusercontent.com/assets/2702526/21295146/d7786960-c574-11e6-9767-39f914f66fdc.png) | ![Stock Ticker/Argos](https://cloud.githubusercontent.com/assets/2702526/21295138/b57dcbb6-c574-11e6-8389-8fcf6179e7f0.png) |
| [**World Clock**](https://getbitbar.com/plugins/Time/worldclock.1s.sh) | ![World Clock/BitBar](https://cloud.githubusercontent.com/assets/2702526/21295156/f62936b4-c574-11e6-8a18-19f06647f26e.png) | ![World Clock/Argos](https://cloud.githubusercontent.com/assets/2702526/21295153/e8cc4d9e-c574-11e6-9f3f-d5e6d288b60b.png) |


## Contributing

Contributors are always welcome. However, **please file an issue describing what you intend to add before opening a pull request,** *especially* for new features! I have a clear vision of what I want (and do not want) Argos to be, so discussing potential additions might help you avoid duplication and wasted work.

By contributing, you agree to release your changes under the same license as the rest of the project (see below).


## License

Copyright &copy; 2016 Philipp Emanuel Weidmann (<pew@worldwidemann.com>)

Released under the terms of the [GNU General Public License, version 3](https://gnu.org/licenses/gpl.html)
