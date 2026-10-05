# =============================================================================
#  WAYpoint — Makefile
#  Packages the behavior & resource packs into .mcpack files and bundles
#  them into a single .mcaddon file.
#
#  Usage:
#    make            -> build .mcpack + .mcaddon
#    make packs      -> build only the .mcpack files
#    make bp         -> build only the behavior pack (.mcpack)
#    make rp         -> build only the resource pack (.mcpack)
#    make addon      -> build only the .mcaddon (requires packs)
#    make clean      -> remove everything from dist/
#    make rebuild    -> clean + build
# =============================================================================

# ---- Configuration ----------------------------------------------------------

# Paths
PACK_DIR        := pack
BP_DIR          := $(PACK_DIR)/behavior_pack/WAYpoint
RP_DIR          := $(PACK_DIR)/resource_pack/WAYpoint

# Output
DIST_DIR        := dist

# Names
NAME            := WAYpoint
BP_NAME         := $(NAME)_BP
RP_NAME         := $(NAME)_RP

# Output files
BP_MCPACK       := $(DIST_DIR)/$(BP_NAME).mcpack
RP_MCPACK       := $(DIST_DIR)/$(RP_NAME).mcpack
MCADDON         := $(DIST_DIR)/$(NAME).mcaddon

# Tools
ZIP             := zip
ZIPFLAGS        := -r -q -X

# Ignore common junk when zipping
EXCLUDES := \
	-x "*.DS_Store" \
	-x "*__MACOSX*" \
	-x "*.git*" \
	-x "*.mcpack" \
	-x "*.mcaddon" \
	-x "*.mcworld" \
	-x "*.mctemplate"

# ---- Phony targets ----------------------------------------------------------

.PHONY: all packs bp rp addon clean rebuild check help

# ---- Default target ---------------------------------------------------------

all: addon

# ---- Pack targets -----------------------------------------------------------

packs: bp rp

bp: $(BP_MCPACK)

rp: $(RP_MCPACK)

addon: packs $(MCADDON)

# ---- Behavior pack ----------------------------------------------------------

$(BP_MCPACK): $(shell find $(BP_DIR) -type f 2>/dev/null)
	@echo ">> Packaging behavior pack -> $(BP_MCPACK)"
	@mkdir -p $(DIST_DIR)
	@rm -f $(BP_MCPACK)
	@cd $(BP_DIR) && $(ZIP) $(ZIPFLAGS) "$(abspath $(BP_MCPACK))" . $(EXCLUDES)
	@echo "   done."

# ---- Resource pack ----------------------------------------------------------

$(RP_MCPACK): $(shell find $(RP_DIR) -type f 2>/dev/null)
	@echo ">> Packaging resource pack -> $(RP_MCPACK)"
	@mkdir -p $(DIST_DIR)
	@rm -f $(RP_MCPACK)
	@cd $(RP_DIR) && $(ZIP) $(ZIPFLAGS) "$(abspath $(RP_MCPACK))" . $(EXCLUDES)
	@echo "   done."

# ---- Combined add-on --------------------------------------------------------

$(MCADDON): $(BP_MCPACK) $(RP_MCPACK)
	@echo ">> Bundling -> $(MCADDON)"
	@rm -f $(MCADDON)
	@cd $(DIST_DIR) && $(ZIP) $(ZIPFLAGS) "$(abspath $(MCADDON))" \
		"$(BP_NAME).mcpack" "$(RP_NAME).mcpack"
	@echo "   done."

# ---- Sanity check -----------------------------------------------------------

check:
	@echo ">> Checking required folders..."
	@test -d "$(BP_DIR)" || (echo "   missing: $(BP_DIR)"; exit 1)
	@test -d "$(RP_DIR)" || (echo "   missing: $(RP_DIR)"; exit 1)
	@test -f "$(BP_DIR)/manifest.json" || (echo "   missing: $(BP_DIR)/manifest.json"; exit 1)
	@test -f "$(RP_DIR)/manifest.json" || (echo "   missing: $(RP_DIR)/manifest.json"; exit 1)
	@command -v $(ZIP) >/dev/null 2>&1 || (echo "   'zip' not installed"; exit 1)
	@echo "   OK."

# ---- Cleanup ----------------------------------------------------------------

clean:
	@echo ">> Cleaning $(DIST_DIR)/"
	@rm -rf $(DIST_DIR)

rebuild: clean all

# ---- Help -------------------------------------------------------------------

help:
	@echo "WAYpoint — available targets:"
	@echo "  all       (default) build .mcpack + .mcaddon"
	@echo "  packs     build only .mcpack files"
	@echo "  bp        build only behavior pack (.mcpack)"
	@echo "  rp        build only resource pack (.mcpack)"
	@echo "  addon     build only .mcaddon"
	@echo "  check     verify folders, manifests and tools"
	@echo "  clean     remove dist/"
	@echo "  rebuild   clean + all"
	@echo "  help      show this message"
