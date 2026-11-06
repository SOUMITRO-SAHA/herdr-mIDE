# herdr-mIDE — one entry point for every command.
# The script logic lives in scripts/ (install.sh stays here at the root).
#
#   make dev       watch loop: sync repo → Herdr app home on every change;
#                  Herdr hot-reloads each mod as it lands. Ctrl-C to stop.
#   make sync      one-shot copy of mods, layout and theme into the app home
#   make check     herdr-app check on every mod (the runtime's own parser)
#   make install   first-time install (never overwrites; prints keys to merge)
#   make status    what the window says: layout, focus, errors from mods
#   make shot      PNG of the window → herdr-shot.png
#   make switch    show the herdr-mide layout (ctrl-shift-l cycles back)
#
# Overrides:
#   HERDR_APP_HOME   app home (default ~/.config/herdr-app)
#   INTERVAL         dev loop poll seconds (default 1) — make dev INTERVAL=0.3

INTERVAL ?= 1
MODS := mide-files mide-changes mide-diff mide-editor

.DEFAULT_GOAL := help
.PHONY: help dev sync check install status shot switch

help:
	@echo "herdr-mIDE commands:"
	@echo "  make dev      live sync + hot reload (Ctrl-C to stop)"
	@echo "  make sync     one-shot copy into the Herdr app home"
	@echo "  make check    herdr-app check every mod"
	@echo "  make install  first-time install (install.sh)"
	@echo "  make status   window state + mod errors"
	@echo "  make shot     window screenshot → herdr-shot.png"
	@echo "  make switch   show the herdr-mide layout"

dev:
	@INTERVAL="$(INTERVAL)" ./scripts/dev.sh

sync:
	@./scripts/sync.sh

check:
	@for mod in $(MODS); do herdr-app check mods/$$mod || exit 1; done

install:
	@./install.sh

status:
	@herdr-app status

shot:
	@herdr-app shot && echo "saved: $(CURDIR)/herdr-shot.png"

switch:
	@herdr-app do layout.switch --name herdr-mide
