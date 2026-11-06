# herdr-mIDE — one entry point for every command.
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

HERDR_APP_HOME ?= $(HOME)/.config/herdr-app
INTERVAL ?= 1
EXCLUDES := --exclude=.DS_Store --exclude=jsconfig.json --exclude=gpui-kit.d.ts
MODS := mide-files mide-changes mide-editor

.DEFAULT_GOAL := help
.PHONY: help dev sync check install status shot switch

help:
	@echo "herdr-mIDE commands:"
	@echo "  make dev      live sync + hot reload (Ctrl-C to stop)"
	@echo "  make sync     one-shot copy into $(HERDR_APP_HOME)"
	@echo "  make check    herdr-app check every mod"
	@echo "  make install  first-time install (install.sh)"
	@echo "  make status   window state + mod errors"
	@echo "  make shot     window screenshot → herdr-shot.png"
	@echo "  make switch   show the herdr-mide layout"

sync:
	@mkdir -p $(HERDR_APP_HOME)/mods $(HERDR_APP_HOME)/layouts $(HERDR_APP_HOME)/themes
	@rsync -a $(EXCLUDES) mods/mide-files/ $(HERDR_APP_HOME)/mods/mide-files/
	@rsync -a $(EXCLUDES) mods/mide-changes/ $(HERDR_APP_HOME)/mods/mide-changes/
	@rsync -a $(EXCLUDES) mods/mide-editor/ $(HERDR_APP_HOME)/mods/mide-editor/
	@rsync -a layouts/herdr-mide.json $(HERDR_APP_HOME)/layouts/herdr-mide.json
	@rsync -a themes/mide-night.json $(HERDR_APP_HOME)/themes/mide-night.json
	@echo "synced → $(HERDR_APP_HOME)"

dev: sync
	@echo ""
	@echo "Watching for changes (every $(INTERVAL)s). Herdr reloads each file as it lands."
	@echo "Verify: make status (errors) · make shot (window PNG)"
	@while :; do \
		changed="$$(rsync -a --itemize-changes $(EXCLUDES) mods/mide-files/ $(HERDR_APP_HOME)/mods/mide-files/ || true; \
		           rsync -a --itemize-changes $(EXCLUDES) mods/mide-changes/ $(HERDR_APP_HOME)/mods/mide-changes/ || true; \
		           rsync -a --itemize-changes $(EXCLUDES) mods/mide-editor/ $(HERDR_APP_HOME)/mods/mide-editor/ || true; \
		           rsync -a --itemize-changes layouts/herdr-mide.json $(HERDR_APP_HOME)/layouts/herdr-mide.json || true; \
		           rsync -a --itemize-changes themes/mide-night.json $(HERDR_APP_HOME)/themes/mide-night.json || true)"; \
		if [ -n "$$changed" ]; then \
			echo ""; \
			echo "$$(date '+%H:%M:%S') synced — Herdr is reloading:"; \
			echo "$$changed"; \
		fi; \
		sleep $(INTERVAL); \
	done

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
