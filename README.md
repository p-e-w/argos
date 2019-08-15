<h1 align="center">Argos</h1>
<h3 align="center">Create GNOME Shell extensions in seconds</h3>
<br>

![Screencast](https://cloud.githubusercontent.com/assets/2702526/21953508/7463004c-da5f-11e6-99e1-b8db1167c071.gif)

[Most GNOME Shell extensions](https://extensions.gnome.org) do one thing: Add a button with a dropdown menu to the panel, displaying information and exposing functionality. Even in its simplest form, creating such an extension is a nontrivial task involving a poorly documented and ever-changing JavaScript API.

**Argos lets you write GNOME Shell extensions in a language that every Linux user is already intimately familiar with: Bash scripts.**

More precisely, Argos is a GNOME Shell extension that turns executables' standard output into panel dropdown menus. It is inspired by, and fully compatible with, the [BitBar](https://github.com/matryer/bitbar) app for macOS. Argos supports many [BitBar plugins](https://github.com/matryer/bitbar-plugins) without modifications, giving you access to a large library of well-tested scripts in addition to being able to write your own.

### Key features

- **100% API [compatible](#bitbar-plugins-with-argos) with BitBar 1.9.2:** All BitBar plugins that run on Linux (i.e. do not contain macOS-specific code) work with Argos (else it's a bug).
- **Beyond BitBar:** Argos can do everything that BitBar can do, but also some things that BitBar can't do (yet). See the documentation for details.
- **Sophisticated asynchronous execution engine:** No matter how long your scripts take to run, Argos will schedule them intelligently and prevent blocking.
- **Unicode support:** Just print your text to stdout. It will be rendered the way you expect.
- **Optimized for minimum resource consumption:** Even with multiple plugins refreshing every second, Argos typically uses less than 1% of the CPU.
- **Fully [documented](#usage).**


## Installation

### From the GNOME Shell Extensions website (recommended)

[<img src="https://img.shields.io/badge/extensions.gnome.org-Argos-9999ff.svg" height="30">](https://extensions.gnome.org/extension/1176/argos/)

If you have a recent version of GNOME Software, you can also install Argos directly from there by simply searching for it. Note that this method may not always get you the latest release of Argos.

### Manually

Clone the repository, then copy or symlink the directory `argos@pew.worldwidemann.com` into `~/.local/share/gnome-shell/extensions`. Restart GNOME Shell by pressing <kbd>Alt+F2</kbd>, then entering `r`. On some systems, you may additionally have to enable the Argos extension using GNOME Tweak Tool.


## Examples

### GNOME Shell log viewer

Argos plugins are great for monitoring your system, displaying anything that a command line script can output in a convenient, unobtrusive place.

Extension developers often rely on the central GNOME Shell log for debugging. That log may be viewed in a terminal with `journalctl /usr/bin/gnome-shell -f` – but it is also an excellent target for our first sample plugin:

#### `shell_log.1s.sh`

```bash
#!/usr/bin/env bash

LOG_ENTRY=$(journalctl /usr/bin/gnome-shell -n 1 --output=cat --no-pager)
echo "<span color='#9BF' weight='normal'><small><tt>$LOG_ENTRY</tt></small></span> | length=40"

echo "---"
echo "View GNOME Shell Log | bash='journalctl /usr/bin/gnome-shell -f'"
```

Make it executable and drop it into `~/.config/argos`, and you should see something like this:

![Shell Log](https://cloud.githubusercontent.com/assets/2702526/21953515/8d79c9b2-da5f-11e6-97eb-658a5e10854b.png)

As the plugin updates every second, new log entries are shown almost without delay.


### Simple launcher

Plugins are not limited to displaying information – they can also perform actions when the user clicks on a menu item. This allows you to rapidly create launchers that look and act exactly like you want.

#### `launcher.sh`

```bash
#!/usr/bin/env bash

echo "Launcher | iconName=starred"
echo "---"

WIKIPEDIA_ICON=$(curl -s "https://en.wikipedia.org/static/favicon/wikipedia.ico" | base64 -w 0)
echo "Wikipedia | image='$WIKIPEDIA_ICON' imageWidth=20 font=serif href='https://en.wikipedia.org'"

echo "---"
echo "Gedit | iconName=gedit bash=gedit terminal=false"
echo "Nautilus | iconName=system-file-manager bash=nautilus terminal=false"
echo "Process list (<span color='yellow'><tt>top</tt></span>) | iconName=utilities-terminal-symbolic bash=top"
echo "---"
echo "Looking Glass | eval='imports.ui.main.createLookingGlass(); imports.ui.main.lookingGlass.toggle();'"
```

![Simple Launcher](https://cloud.githubusercontent.com/assets/2702526/21953517/9e5c08e4-da5f-11e6-8ae8-f9edc57aa83e.png)

Note how the Wikipedia icon is downloaded from the web and serialized into the menu item without ever needing to be saved to disk. All of this comes from a file smaller than the configuration files of most dedicated "launcher" extensions, while providing *much* more flexibility. Argos plugins blur the line between configuration and code.


### Advanced launcher

An Argos plugin is just an executable file that writes to stdout. As such, any language can be used to create plugins. Switching from Bash to Python gives you easy access to the GNOME platform APIs, enabling even more powerful launchers.

#### `launcher.py`

```python
#!/usr/bin/env python3

import re
from gi.repository import Gio

applications = {}

for app_info in Gio.AppInfo.get_all():
  icon, categories = app_info.get_icon(), app_info.get_categories()
  if icon is None or categories is None:
    continue
  # Remove "%U" and "%F" placeholders
  command_line = re.sub("%\\w", "", app_info.get_commandline()).strip()
  app = (app_info.get_name(), icon.to_string(), command_line)
  for category in categories.split(";"):
    if category not in ["GNOME", "GTK", ""]:
      if category not in applications:
        applications[category] = []
      applications[category].append(app)
      break

print("Applications\n---")

for category, apps in sorted(applications.items()):
  print(category)
  for app in sorted(apps):
    print("--%s | useMarkup=false iconName=%s bash='%s' terminal=false" % app)
```

![Advanced Launcher](https://cloud.githubusercontent.com/assets/2702526/21953520/b6112244-da5f-11e6-88b0-1d8cd61e5198.png)

And there you have it: A working clone of [a full-blown GNOME Shell extension](https://extensions.gnome.org/extension/6/applications-menu/) – implemented using a fraction of the code.


### `top` viewer

Argos basically pipes standard output into a panel menu. This makes for some very cool plugins like this `top` output viewer:

#### `top.3s+.sh`

```bash
#!/usr/bin/env bash

echo "top"
echo "---"

if [ "$ARGOS_MENU_OPEN" == "true" ]; then
  # http://stackoverflow.com/a/14853319
  TOP_OUTPUT=$(top -b -n 1 | head -n 20 | awk 1 ORS="\\\\n")
  echo "$TOP_OUTPUT | font=monospace bash=top"
else
  echo "Loading..."
fi
```

![top Viewer](https://cloud.githubusercontent.com/assets/2702526/21953525/e30d340e-da5f-11e6-9ed3-cc10a067d515.gif)

It's `top` at your fingertips! Of course, this approach works with any other terminal program as well.

Note that the plugin checks the [`ARGOS_MENU_OPEN` environment variable](#environment-variables) to ensure `top` is run only if the dropdown menu is visible, while the [`+` in the filename](#filename-format) forces a re-run whenever the user opens the menu. This pattern makes output available immediately when it is needed, but keeps idle resource consumption of the plugin near zero.


## Usage

Argos monitors the directory `~/.config/argos` for changes. Any executable file found in this directory is considered a plugin. Files whose name starts with a dot (`.`) and files in subdirectories are ignored.

Plugins are run and their standard output is interpreted as described below. For each plugin, a panel button with a dropdown menu is created. The arrangement of buttons from left to right follows the alphabetical order of the files they are generated from (except when a `POSITION` is explicitly specified in the filename). New plugins and edits to existing plugins are automatically detected and reflected in the panel.

### Filename format

A plugin file may be named anything (it only needs to be executable), but if its name has the special form

```
NAME.POSITION.INTERVAL[+].EXTENSION
```

where

* `POSITION` consists of an integer (optional) + one of `l` (left), `c` (center) or `r` (right), and
* `INTERVAL` consists of an integer + one of `s` (seconds), `m` (minutes), `h` (hours) or `d` (days)

then

* the dropdown menu button is placed in the panel at `POSITION`, and
* the plugin is re-run and its output re-rendered every `INTERVAL`, and
* if `INTERVAL` is followed by `+`, the plugin is additionally re-run each time the dropdown menu is opened.

`POSITION` may be omitted entirely (in which case the button is placed before all other buttons on the right-hand side of the panel) while `INTERVAL` can be left empty. For example, a script named `plugin.10s.sh` is updated every 10 seconds, the button belonging to `plugin.1c..sh` is positioned just right of the GNOME Shell clock, and `plugin.l.1m.sh` is displayed left of the "Activities" button and updated every minute.

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

Lines beginning with `--` are rendered in a submenu associated with the preceding unindented line. While Argos supports nested submenus *in principle*, GNOME Shell does not render them correctly.

[Emoji codes](http://www.emoji-cheat-sheet.com) like `:horse:` :horse: and `:smile:` :smile: in the line text are replaced with their corresponding Unicode characters (unless the `emojize` attribute is set to `false`). Note that multicolor emoji rendering requires GNOME 3.26 or later.

[ANSI SGR escape sequences](https://en.wikipedia.org/wiki/ANSI_escape_code#graphics) and [Pango markup](https://developer.gnome.org/pygtk/stable/pango-markup-language.html) tags may be used for styling. This can be disabled by setting the `ansi` and `useMarkup` attributes, respectively, to `false`.

Backslash escapes such as `\n` and `\t` in the line text are converted to their corresponding characters (newline and tab in this case), which can be prevented by setting the `unescape` attribute to `false`. Newline escapes can be used to create multi-line menu items.

### Line attributes

#### Display

Control how the line is rendered.

| Attribute | Value | Description |
| --- | --- | --- |
| `color` | Hex RGB/RGBA or color name | Sets the text color for the item. |
| `font` | Font name | Sets the font for the item. |
| `size` | Font size in points | Sets the font size for the item. |
| `iconName` | Icon name | Sets a menu icon for the item. See the [freedesktop.org icon naming specification](https://specifications.freedesktop.org/icon-naming-spec/icon-naming-spec-latest.html) for a list of names that should work anywhere, or run [gtk3-icon-browser](https://developer.gnome.org/gtk3/unstable/gtk3-icon-browser.html) to see the names of all icons in your current icon theme. **Argos only.** |
| `image`, `templateImage` | Base64-encoded image file | Renders an image inside the item. The image is positioned to the left of the text and to the right of the icon. GNOME Shell does not have a concept of "template images", so `image` and `templateImage` are interchangeable in Argos. |
| `imageWidth`, `imageHeight` | Width/height in pixels | Sets the dimensions of the image. If only one dimension is specified, the image's original aspect ratio is maintained. **Argos only.** |
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
| `bash` | Bash command | Runs a command using `bash` inside a GNOME Terminal window. |
| `terminal` | `true` or `false` | If `false`, runs the Bash command in the background (i.e. without opening a terminal window). |
| `param1`, `param2`, ... | Command line arguments | Arguments to be passed to the Bash command. *Note: Provided for compatibility with BitBar only. Argos allows placing arguments directly in the command string.* |
| `href` | URI | Opens a URI in the application registered to handle it. URIs starting with `http://` launch the web browser, while `file://` URIs open the file in its associated default application. |
| `eval` | JavaScript code | Passes the code to JavaScript's `eval` function. **Argos only.** |
| `refresh` | `true` or `false` | If `true`, re-runs the plugin, updating its output. |

### Environment variables

Plugin executables are run with the following special environment variables set:

| Name | Value |
| --- | --- |
| `ARGOS_VERSION` | Version number of the Argos extension. The presence of this environment variable can also be used to determine that the plugin is actually running in Argos, rather than BitBar or [kargos](https://github.com/lipido/kargos). |
| `ARGOS_MENU_OPEN` | `true` if the dropdown menu was open at the time the plugin was run, and `false` otherwise. |


## BitBar plugins with Argos

These screenshots show how some scripts from the BitBar plugin repository look when rendered by Argos compared to the "canonical" BitBar rendering (macOS screenshots taken from https://getbitbar.com).

| Plugin | BitBar on macOS | Argos on GNOME Shell |
| --- | --- | --- |
| [**Ping**](https://getbitbar.com/plugins/Network/ping.10s.sh) | ![Ping/BitBar](https://cloud.githubusercontent.com/assets/2702526/21953532/0b7956de-da60-11e6-9e73-067755cb326d.png) | ![Ping/Argos](https://cloud.githubusercontent.com/assets/2702526/21953530/fe8ac58e-da5f-11e6-8571-f0bc722d30a1.png) |
| [**Stock Ticker**](https://getbitbar.com/plugins/Finance/gfinance.5m.py) | ![Stock Ticker/BitBar](https://cloud.githubusercontent.com/assets/2702526/21953537/29818494-da60-11e6-9df0-becf03a42553.png) | ![Stock Ticker/Argos](https://cloud.githubusercontent.com/assets/2702526/21953535/1b93fc0e-da60-11e6-8bb0-7eb349045230.png) |
| [**World Clock**](https://getbitbar.com/plugins/Time/worldclock.1s.sh) | ![World Clock/BitBar](https://cloud.githubusercontent.com/assets/2702526/21953545/4d946c3e-da60-11e6-863c-552ee2ab9282.png) | ![World Clock/Argos](https://cloud.githubusercontent.com/assets/2702526/21953541/41388042-da60-11e6-99dc-770d0b6a668a.png) |
| [**Unicorn**](https://getbitbar.com/plugins/Web/Cornify/cornify.1m.sh) | ![Unicorn/BitBar](https://cloud.githubusercontent.com/assets/2702526/21953552/75dc46f8-da60-11e6-9f61-53464281876c.png) | ![Unicorn/Argos](https://cloud.githubusercontent.com/assets/2702526/21953550/68297b98-da60-11e6-9823-c76340527330.png) |
| [**ANSI**](https://getbitbar.com/plugins/Tutorial/ansi.sh) | ![ANSI/BitBar](https://cloud.githubusercontent.com/assets/2702526/21953559/a2c26b52-da60-11e6-9e0e-1be3550a2116.png) | ![ANSI/Argos](https://cloud.githubusercontent.com/assets/2702526/21953553/911d790a-da60-11e6-92a1-b6e20d423f72.png) |


## Acknowledgments

GNOME Shell is a difficult platform to develop for. At the time this project was started, the Gjs documentation hadn't been updated in three years and was missing important classes (new documentation has [since appeared](https://ptomato.wordpress.com/2017/05/22/the-gjs-documentation-is-back/)). Once again, [**Valadoc**](https://valadoc.org) saved the day for me. While not fully identical to the Gjs API, Valadoc is the best manual for GNOME on the web today.

Argos includes [**emojilib**](https://github.com/muan/emojilib)'s emoji name/character mappings. It's wonderful that such a comprehensive and well-maintained library is so easily available.

Without [**BitBar**](https://github.com/matryer/bitbar), Argos wouldn't be what it is today, or, more likely, wouldn't exist at all. There have been many attempts on many platforms to simplify panel menu creation, but BitBar was the first to get it right by finding the balance between text-only configuration and dynamic output. Thank you for showing the way!


## Contributing

Contributors are always welcome. However, **please file an issue describing what you intend to add before opening a pull request,** *especially* for new features! I have a clear vision of what I want (and do not want) Argos to be, so discussing potential additions might help you avoid duplication and wasted work.

By contributing, you agree to release your changes under the same license as the rest of the project (see below).


## License

Copyright &copy; 2016-2018 Philipp Emanuel Weidmann (<pew@worldwidemann.com>)

Released under the terms of the [GNU General Public License, version 3](https://gnu.org/licenses/gpl.html)
