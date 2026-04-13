#!/usr/bin/env bash
# demo-argos-features.10s.sh
# Shows: submenu state restore (id=...), reopen=true, and minwidth on header.

# Panel title
echo "🧪 Demo"

# Start dropdown
echo "---"

# 1) Submenu with a fixed minimum width and a stable id
echo "⚙️  Settings | id=demo-settings minwidth=360"
# Toggle a simple on/off flag in /tmp (purely demonstrative)
FLAG="/tmp/argos-demo-flag"
if [[ -f "$FLAG" ]]; then
  echo "--✅ Enabled  | bash='rm -f \"$FLAG\"' terminal=false refresh=true reopen=true"
else
  echo "--❌ Disabled | bash='touch \"$FLAG\"' terminal=false refresh=true reopen=true"
fi

# 2) Another submenu to show that open state is preserved across refreshes
echo "---"
echo "📊 Status | id=demo-status minwidth=360"
NOW="$(date '+%H:%M:%S')"
echo "--Time: $NOW"
echo "--Flag file present: $( [[ -f \"$FLAG\" ]] && echo yes || echo no )"

# 3) A top-level action (closes unless reopen=true is used)
echo "---"
echo "♻️  Force Refresh | refresh=true"
