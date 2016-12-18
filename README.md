![Header](https://cloud.githubusercontent.com/assets/2702526/21295125/68218a42-c574-11e6-98ba-6d8add0efb9e.png)


# Argos – Display the output of arbitrary programs in the GNOME Shell panel

Argos is a GNOME Shell extension that turns executables' standard output into panel dropdown menus. It is inspired by, and largely compatible with, the [BitBar](https://github.com/matryer/bitbar) app for macOS. Argos supports many [BitBar plugins](https://github.com/matryer/bitbar-plugins) without modifications.

Executable files in `~/.config/argos` are run and their output is placed in the panel as [documented in the BitBar README](https://github.com/matryer/bitbar#plugin-api). Argos monitors the directory for changes; new plugins and edits to existing plugins are automatically detected and reflected in the panel. The arrangement of the dropdown menus from left to right follows the alphabetical order of the files they are generated from. Files whose name starts with a dot (`.`) and files in subdirectories are ignored.


## Installation

Clone the repository, then copy or symlink the directory `argos@pew.worldwidemann.com` into `~/.local/share/gnome-shell/extensions`. Restart GNOME Shell by pressing <kbd>Alt+F2</kbd>, then entering `r`. On some systems, you may have to manually enable the Argos extension using GNOME Tweak Tool.


## Usage example

Save this bash script as `argos_demo.1m.sh`, make it executable and put it in the Argos config directory as described above:

```bash
#!/usr/bin/env bash

echo "<b>Argos</b> Demo"
echo "---"
echo "⏱ Current time: <span color='yellow'>$(date +'%H:%M')</span>   <i>(click to refresh)</i> | refresh=true"
echo "Open Wikipedia... | href='https://en.wikipedia.org/wiki/Main_Page'"
echo "Run  <tt><span color='green'>uname -a</span></tt>  in bash... | bash='uname -a'"
echo "Run <span color='orange'>gedit</span>... | bash=gedit terminal=false"
echo "---"
echo "Emoji <span color='#ff0'>🙂</span><span color='#f00'>🦀</span><span color='#3f0'>🍀</span> | size=18"
echo "Custom font | font='Liberation Serif' color=#abc size=larger"
```

This popup menu will appear in the panel:

![Demo](https://cloud.githubusercontent.com/assets/2702526/21295128/82841be8-c574-11e6-8b7b-fd85da671e82.png)

Clicking the last menu item (*argos_demo.1m.sh*) opens the script in a text editor where it can be live-edited, with changes being immediately reflected on saving.


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
