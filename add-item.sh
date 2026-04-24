#!/bin/bash
# add-item.sh - Add products to Vilgots Garderob lookbook
#
# Usage:
#   ./add-item.sh add --name "..." --price "299 kr" --url "https://..." --image-url "https://..." [options]
#   ./add-item.sh list [--json]
#   ./add-item.sh count
#   ./add-item.sh exists --url "https://..."
#   ./add-item.sh remove --id 42
#
# Options for add:
#   --name        Product name (required)
#   --price       Price string, e.g. "490 kr" (required)
#   --url         Product page URL (required)
#   --image-url   Image URL to download (required, unless --no-image)
#   --brand       Brand name
#   --size        Size info, e.g. "Från 62"
#   --section     Section name (must match existing section)
#   --description Short description
#   --tag         Tag text, e.g. "Rekommenderas"
#   --tag-class   Tag CSS class: tag-rec, tag-sale, tag-custom, tag-sold
#   --original-price  Original price if on sale
#   --no-image    Skip image download (for placeholder items)
#   --placeholder-text  Text for placeholder card
#   --placeholder-style CSS style for placeholder card
#   --dry-run     Show what would happen without changing anything
#   --no-commit   Don't auto-commit after adding

set -euo pipefail
SITE_DIR="$(cd "$(dirname "$0")" && pwd)"
HTML_FILE="$SITE_DIR/index.html"
IMG_DIR="$SITE_DIR/img"
HELPER="$SITE_DIR/json-helper.py"
LOCKFILE="$SITE_DIR/.add-item.lock"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

die() { echo -e "${RED}ERROR: $1${NC}" >&2; exit 1; }
info() { echo -e "${GREEN}$1${NC}" >&2; }
warn() { echo -e "${YELLOW}$1${NC}" >&2; }

# Verify dependencies
command -v python3 >/dev/null 2>&1 || die "python3 required"
command -v curl >/dev/null 2>&1 || die "curl required"
[ -f "$HTML_FILE" ] || die "index.html not found at $HTML_FILE"
[ -f "$HELPER" ] || die "json-helper.py not found at $HELPER"

# File lock to prevent concurrent modifications (macOS-compatible; mkdir is atomic)
acquire_lock() {
    if ! mkdir "$LOCKFILE.d" 2>/dev/null; then
        die "Another add-item.sh is running. Try again."
    fi
    trap 'rm -rf "$LOCKFILE.d"' EXIT
}

# Safe filename generation
safe_filename() {
    local name="$1"
    local ext="${2:-.webp}"
    local slug
    slug=$(echo "$name" | \
        tr '[:upper:]' '[:lower:]' | \
        sed 's/å/a/g; s/ä/a/g; s/ö/o/g; s/é/e/g; s/ü/u/g; s/í/i/g' | \
        sed 's/[^a-z0-9]/-/g' | \
        sed 's/--*/-/g; s/^-//; s/-$//' | \
        head -c 60 | sed 's/-$//')
    echo "${slug}${ext}"
}

# Download and verify image
download_image() {
    local url="$1"
    local output="$2"

    local http_code
    http_code=$(curl -sL -o "$output" -w '%{http_code}' \
        --connect-timeout 10 --max-time 30 "$url")

    if [ "$http_code" != "200" ]; then
        rm -f "$output"
        die "Image download failed: HTTP $http_code for $url"
    fi

    # Verify it's actually an image via magic bytes
    local mime
    mime=$(file --mime-type -b "$output" 2>/dev/null || echo "unknown")

    case "$mime" in
        image/jpeg|image/png|image/webp|image/gif)
            return 0 ;;
        *)
            rm -f "$output"
            die "Downloaded file is not an image ($mime) from $url"
            ;;
    esac
}

# Detect image extension from file
detect_ext() {
    local filepath="$1"
    local mime
    mime=$(file --mime-type -b "$filepath" 2>/dev/null || echo "unknown")
    case "$mime" in
        image/jpeg) echo ".jpg" ;;
        image/png) echo ".png" ;;
        image/webp) echo ".webp" ;;
        image/gif) echo ".gif" ;;
        *) echo ".jpg" ;;
    esac
}

# Valid sections (single source of truth)
VALID_SECTIONS=(
    "The Tiny Universe"
    "Lulu Babe"
    "Custom & Handgjort"
    "Cuddle Sleep Dream"
    "H&M"
    "Jacadi Paris"
    "Accessoarer"
    "Sailor & Nautisk Stil"
    "Stickade Set"
    "Dressade Rompers"
    "Childrensalon: Formal"
    "Childrensalon: Blazers & Hängslen"
    "Childrensalon: Skor & Accessoarer"
    "Lilax: Tuxedo Footies"
    "Childrensalon: Buster Suits"
)

# ===== COMMANDS =====

cmd_add() {
    local name="" price="" url="" image_url="" brand="" size="" section=""
    local description="" tag="" tag_class="" original_price=""
    local placeholder_text="" placeholder_style="" no_image=false
    local dry_run=false no_commit=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --name) name="$2"; shift 2 ;;
            --price) price="$2"; shift 2 ;;
            --url) url="$2"; shift 2 ;;
            --image-url) image_url="$2"; shift 2 ;;
            --brand) brand="$2"; shift 2 ;;
            --size) size="$2"; shift 2 ;;
            --section) section="$2"; shift 2 ;;
            --description) description="$2"; shift 2 ;;
            --tag) tag="$2"; shift 2 ;;
            --tag-class) tag_class="$2"; shift 2 ;;
            --original-price) original_price="$2"; shift 2 ;;
            --placeholder-text) placeholder_text="$2"; shift 2 ;;
            --placeholder-style) placeholder_style="$2"; shift 2 ;;
            --no-image) no_image=true; shift ;;
            --dry-run) dry_run=true; shift ;;
            --no-commit) no_commit=true; shift ;;
            *) die "Unknown option: $1" ;;
        esac
    done

    # Validate required fields
    [ -n "$name" ] || die "Missing --name"
    [ -n "$price" ] || die "Missing --price"
    [ -n "$url" ] || die "Missing --url"
    if [ "$no_image" = false ] && [ -z "$image_url" ] && [ -z "$placeholder_text" ]; then
        die "Missing --image-url (or use --no-image / --placeholder-text)"
    fi

    # === Strict validation ===

    # URL must be HTTPS
    [[ "$url" =~ ^https:// ]] || die "URL must start with https://"
    # Block search engine URLs
    [[ "$url" =~ (google\.com|bing\.com|duckduckgo\.com|yahoo\.com|search\.) ]] && \
        die "URL is a search engine URL, not a product page"
    # Block too-short URLs
    [[ ${#url} -ge 20 ]] || die "URL too short (min 20 chars)"

    # Price must contain digit and currency
    [[ "$price" =~ [0-9] ]] || die "Price must contain at least one digit: '$price'"
    [[ "$price" =~ (kr|KR|SEK|DKK|NOK|USD|GBP|EUR|AUD|CAD|JPY|CHF|[\$£€¥]) ]] || \
        die "Price must contain a currency (kr, \$, £, €, or ISO code): '$price'"
    [[ ${#price} -le 30 ]] || die "Price too long (max 30 chars): '$price'"

    # Name length
    [[ ${#name} -ge 3 ]] || die "Name too short (min 3 chars)"
    [[ ${#name} -le 120 ]] || die "Name too long (max 120 chars)"

    # Brand required and length
    [ -n "$brand" ] || die "Missing --brand (required)"
    [[ ${#brand} -ge 2 ]] || die "Brand too short (min 2 chars)"
    [[ ${#brand} -le 60 ]] || die "Brand too long (max 60 chars)"

    # Size format
    if [ -n "$size" ]; then
        [[ "$size" =~ ^Från\ [0-9A-Z] ]] || \
            die "Invalid size format: '$size'. Expected 'Från 62', 'Från NB', 'Från 3M', etc."
    fi

    # Section whitelist
    if [ -n "$section" ]; then
        local valid=false
        for s in "${VALID_SECTIONS[@]}"; do
            [[ "$s" == "$section" ]] && valid=true && break
        done
        [ "$valid" = true ] || die "Invalid section: '$section'. Run './add-item.sh sections' to list valid sections."
    fi

    # Image URL validation
    if [ "$no_image" = false ] && [ -n "$image_url" ]; then
        [[ "$image_url" =~ ^https:// ]] || die "Image URL must start with https://"
        [[ "$image_url" =~ (google\.com/search|bing\.com/images) ]] && \
            die "Image URL is a search page, not a direct image link"
    fi

    acquire_lock

    # Check duplicate
    if python3 "$HELPER" exists "$HTML_FILE" --url "$url" >/dev/null 2>&1; then
        die "Product with this URL already exists"
    fi

    # Download image if needed
    local img_path=""
    local images_json="[]"

    if [ "$no_image" = false ] && [ -n "$image_url" ]; then
        # Download to temp first
        local tmpfile
        tmpfile=$(mktemp /tmp/vg-img-XXXXXXXX)

        info "Downloading image..."
        download_image "$image_url" "$tmpfile"

        # Detect format and create safe filename
        local ext
        ext=$(detect_ext "$tmpfile")
        local filename
        filename=$(safe_filename "$name" "$ext")

        # Check if filename already exists, add suffix if needed
        local final_path="$IMG_DIR/$filename"
        local counter=1
        while [ -f "$final_path" ]; do
            local base="${filename%$ext}"
            final_path="$IMG_DIR/${base}-${counter}${ext}"
            counter=$((counter + 1))
        done

        if [ "$dry_run" = true ]; then
            info "[DRY RUN] Would save image to: $final_path"
            rm -f "$tmpfile"
            img_path="img/$(basename "$final_path")"
        else
            mv "$tmpfile" "$final_path"
            img_path="img/$(basename "$final_path")"
            info "Image saved: $img_path"
        fi
        images_json="[\"$img_path\"]"
    fi

    # Build product JSON
    local product_json
    product_json=$(python3 -c "
import json, sys
p = {
    'images': json.loads(sys.argv[1]),
    'name': sys.argv[2],
    'brand': sys.argv[3],
    'description': sys.argv[4],
    'price': sys.argv[5],
    'size': sys.argv[6],
    'url': sys.argv[7],
    'section': sys.argv[8],
}
if sys.argv[9]: p['tag'] = sys.argv[9]
if sys.argv[10]: p['tag_class'] = sys.argv[10]
if sys.argv[11]: p['original_price'] = sys.argv[11]
if sys.argv[12]: p['placeholder_text'] = sys.argv[12]
if sys.argv[13]: p['placeholder_style'] = sys.argv[13]
# Remove empty values
p = {k: v for k, v in p.items() if v}
print(json.dumps(p, ensure_ascii=False))
" "$images_json" "$name" "$brand" "$description" "$price" "$size" "$url" \
  "$section" "$tag" "$tag_class" "$original_price" "$placeholder_text" "$placeholder_style")

    if [ "$dry_run" = true ]; then
        info "[DRY RUN] Would add product:"
        echo "$product_json" | python3 -m json.tool
        exit 0
    fi

    # Write product to temp file and inject
    local tmp_product
    tmp_product=$(mktemp /tmp/vg-product-XXXXXXXX)
    echo "$product_json" > "$tmp_product"

    local result
    result=$(python3 "$HELPER" inject "$HTML_FILE" "$tmp_product")
    rm -f "$tmp_product"

    echo "$result"

    # Auto-commit
    if [ "$no_commit" = false ] && command -v git >/dev/null 2>&1; then
        cd "$SITE_DIR"
        if git rev-parse --git-dir >/dev/null 2>&1; then
            git add index.html
            [ -n "$img_path" ] && git add "$img_path"
            git commit -m "add: $name ($brand)" >/dev/null 2>&1 || true
            info "Committed to git"
        fi
    fi
}

cmd_list() {
    local json_flag=""
    if [[ "${1:-}" == "--json" ]]; then
        json_flag="--json"
    fi
    python3 "$HELPER" list "$HTML_FILE" $json_flag
}

cmd_count() {
    python3 "$HELPER" count "$HTML_FILE"
}

cmd_exists() {
    local url="" name=""
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --url) url="$2"; shift 2 ;;
            --name) name="$2"; shift 2 ;;
            *) die "Unknown option: $1" ;;
        esac
    done
    local args=""
    [ -n "$url" ] && args="$args --url \"$url\""
    [ -n "$name" ] && args="$args --name \"$name\""
    eval python3 "$HELPER" exists "$HTML_FILE" $args
}

cmd_sections() {
    for s in "${VALID_SECTIONS[@]}"; do
        echo "$s"
    done
}

cmd_remove() {
    local id=""
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --id) id="$2"; shift 2 ;;
            *) die "Unknown option: $1" ;;
        esac
    done
    [ -n "$id" ] || die "Missing --id"
    acquire_lock
    python3 "$HELPER" remove "$HTML_FILE" --id "$id"
}

# ===== MAIN =====

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 {add|list|count|exists|remove|sections} [options]"
    exit 1
fi

command="$1"
shift

case "$command" in
    add) cmd_add "$@" ;;
    list) cmd_list "$@" ;;
    count) cmd_count "$@" ;;
    exists) cmd_exists "$@" ;;
    remove) cmd_remove "$@" ;;
    sections) cmd_sections ;;
    *) die "Unknown command: $command" ;;
esac
