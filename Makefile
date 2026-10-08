# WAYpoint addon build: every .mcstructure under BP/structures is discovered automatically.
PACK_DIR := pack
BP_DIR := $(PACK_DIR)/behavior_pack/WAYpoint
RP_DIR := $(PACK_DIR)/resource_pack/WAYpoint
STRUCTURES_DIR := $(BP_DIR)/structures
SCANNER := tools/scan_structures.py
DIMENSIONS_JS := $(BP_DIR)/scripts/structure_dimensions.js
DIST_DIR := dist
NAME := WAYpoint
BP_NAME := $(NAME)_BP
RP_NAME := $(NAME)_RP
BP_MCPACK := $(DIST_DIR)/$(BP_NAME).mcpack
RP_MCPACK := $(DIST_DIR)/$(RP_NAME).mcpack
MCADDON := $(DIST_DIR)/$(NAME).mcaddon
ZIP := zip
PYTHON ?= python3
NODE ?= node
ZIPFLAGS := -r -q -X
EXCLUDES := -x "*.DS_Store" -x "*__MACOSX*" -x "*.git*" -x "*.mcpack" -x "*.mcaddon"
.PHONY: all scan packs bp rp addon clean rebuild check help
all: addon
scan: $(DIMENSIONS_JS)
$(DIMENSIONS_JS): $(SCANNER) $(shell find $(STRUCTURES_DIR) -type f -name '*.mcstructure' 2>/dev/null)
	@echo ">> Scanning structures"
	@$(PYTHON) $(SCANNER) $(STRUCTURES_DIR) $(DIMENSIONS_JS)
packs: bp rp
bp: $(BP_MCPACK)
rp: $(RP_MCPACK)
addon: packs $(MCADDON)
$(BP_MCPACK): scan $(shell find $(BP_DIR) -type f 2>/dev/null)
	@mkdir -p $(DIST_DIR) && rm -f $(BP_MCPACK)
	@cd $(BP_DIR) && $(ZIP) $(ZIPFLAGS) "$(abspath $(BP_MCPACK))" . $(EXCLUDES)
$(RP_MCPACK): $(shell find $(RP_DIR) -type f 2>/dev/null)
	@mkdir -p $(DIST_DIR) && rm -f $(RP_MCPACK)
	@cd $(RP_DIR) && $(ZIP) $(ZIPFLAGS) "$(abspath $(RP_MCPACK))" . $(EXCLUDES)
$(MCADDON): $(BP_MCPACK) $(RP_MCPACK)
	@rm -f $(MCADDON) && cd $(DIST_DIR) && $(ZIP) $(ZIPFLAGS) "$(abspath $(MCADDON))" "$(BP_NAME).mcpack" "$(RP_NAME).mcpack"
check:
	@test -d "$(STRUCTURES_DIR)" && test -f "$(BP_DIR)/manifest.json" && test -f "$(RP_DIR)/manifest.json"
	@command -v $(ZIP) >/dev/null && command -v $(PYTHON) >/dev/null && command -v $(NODE) >/dev/null
	@for file in $(shell find $(BP_DIR)/scripts -type f -name '*.js' -print); do $(NODE) --check "$$file" || exit 1; done
	@for file in $(shell find $(PACK_DIR) -type f -name '*.json' -print); do $(PYTHON) -m json.tool "$$file" >/dev/null || exit 1; done
	@echo "OK"
clean:
	rm -rf $(DIST_DIR)
rebuild: clean all
help:
	@echo "make [scan|packs|addon|check|clean] — structures are discovered automatically from BP/structures"
