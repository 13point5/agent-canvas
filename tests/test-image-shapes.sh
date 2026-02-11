#!/usr/bin/env bash
# Test image shape creation, asset storage, and snapshot integrity
set -euo pipefail

BOARD="0f0d4eb5-3459-4989-88cd-1bdc32d077c0"
BASE="http://localhost:3456/api/boards/$BOARD"
LOG="tests/log-image-shapes.txt"
PASS=0
FAIL=0

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEST_IMAGE="$SCRIPT_DIR/assets/claude-code-docs.png"
ASSETS_DIR="$HOME/.agent-canvas/boards/$BOARD/assets"

> "$LOG"

pass() {
  echo "✅ PASS: $1" | tee -a "$LOG"
  PASS=$((PASS + 1))
}

fail() {
  echo "❌ FAIL: $1" | tee -a "$LOG"
  FAIL=$((FAIL + 1))
}

# ── Precondition: test image exists ──────────────────────────────────

echo "─── Precondition: test image exists ───" | tee -a "$LOG"
if [ -f "$TEST_IMAGE" ]; then
  pass "Test image found at $TEST_IMAGE"
else
  fail "Test image not found at $TEST_IMAGE"
  echo "Aborting." | tee -a "$LOG"
  exit 1
fi

# ── Clean up any previous test assets ────────────────────────────────

rm -f "$ASSETS_DIR/claude-code-docs.png" "$ASSETS_DIR/claude-code-docs-1.png" 2>/dev/null || true

# ── Test 1: Create image shape ───────────────────────────────────────

echo "" | tee -a "$LOG"
echo "─── Test 1: Create image shape ───" | tee -a "$LOG"

response=$(curl -s -w "\n%{http_code}" -X POST "$BASE/shapes" \
  -H "Content-Type: application/json" \
  -d "{\"shapes\":[{\"type\":\"image\",\"x\":100,\"y\":100,\"src\":\"$TEST_IMAGE\"}]}")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')

echo "HTTP $http_code" | tee -a "$LOG"
echo "$body" | jq . 2>/dev/null | tee -a "$LOG" || echo "$body" | tee -a "$LOG"

if [ "$http_code" = "200" ]; then
  pass "Image shape created (HTTP 200)"
else
  fail "Expected HTTP 200, got $http_code"
fi

# Check response has assetPaths
if echo "$body" | jq -e '.assetPaths' > /dev/null 2>&1; then
  pass "Response contains assetPaths"
else
  fail "Response missing assetPaths"
fi

# Check assetPaths has correct key
asset_url=$(echo "$body" | jq -r '.assetPaths["claude-code-docs.png"]' 2>/dev/null)
if [ -n "$asset_url" ] && [ "$asset_url" != "null" ]; then
  pass "assetPaths maps claude-code-docs.png → $asset_url"
else
  fail "assetPaths missing claude-code-docs.png key"
fi

# ── Test 2: Asset file exists on disk ────────────────────────────────

echo "" | tee -a "$LOG"
echo "─── Test 2: Asset file on disk ───" | tee -a "$LOG"

if [ -f "$ASSETS_DIR/claude-code-docs.png" ]; then
  pass "Asset file exists at $ASSETS_DIR/claude-code-docs.png"
else
  fail "Asset file NOT found at $ASSETS_DIR/claude-code-docs.png"
fi

# ── Test 3: Asset served via HTTP ────────────────────────────────────

echo "" | tee -a "$LOG"
echo "─── Test 3: Asset served via HTTP ───" | tee -a "$LOG"

if [ -n "$asset_url" ] && [ "$asset_url" != "null" ]; then
  serve_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3456$asset_url")
  if [ "$serve_code" = "200" ]; then
    pass "Asset served at $asset_url (HTTP 200)"
  else
    fail "Asset not served (HTTP $serve_code)"
  fi
else
  fail "Skipped — no asset URL from test 1"
fi

# ── Test 4: Our assets in snapshot use URL, not base64 ───────────────

echo "" | tee -a "$LOG"
echo "─── Test 4: Our assets use URL src, not base64 ───" | tee -a "$LOG"

snapshot_response=$(curl -s "$BASE/snapshot")

# Extract src values for assets named claude-code-docs*
our_asset_srcs=$(echo "$snapshot_response" | jq -r '
  .snapshot.document.store | to_entries[]
  | select(.key | startswith("asset:"))
  | select(.value.props.name | test("^claude-code-docs"))
  | .value.props.src' 2>/dev/null)

has_base64=false
for src in $our_asset_srcs; do
  if echo "$src" | grep -q "^data:"; then
    has_base64=true
    fail "Asset has base64 src: ${src:0:60}..."
  fi
done

if [ "$has_base64" = false ] && [ -n "$our_asset_srcs" ]; then
  pass "All our assets use URL src (no base64)"
else
  if [ -z "$our_asset_srcs" ]; then
    fail "No assets named claude-code-docs* found in snapshot"
  fi
fi

# ── Test 5: Snapshot references served URL ───────────────────────────

echo "" | tee -a "$LOG"
echo "─── Test 5: Snapshot references served URL ───" | tee -a "$LOG"

if echo "$our_asset_srcs" | grep -q "/api/boards/$BOARD/assets/"; then
  pass "Snapshot references /api/boards/$BOARD/assets/ URL"
else
  fail "Snapshot does NOT reference expected asset URL"
fi

# ── Test 6: Duplicate filename dedup ─────────────────────────────────

echo "" | tee -a "$LOG"
echo "─── Test 6: Duplicate filename dedup ───" | tee -a "$LOG"

dup_response=$(curl -s -w "\n%{http_code}" -X POST "$BASE/shapes" \
  -H "Content-Type: application/json" \
  -d "{\"shapes\":[{\"type\":\"image\",\"x\":400,\"y\":100,\"src\":\"$TEST_IMAGE\"}]}")
dup_code=$(echo "$dup_response" | tail -1)
dup_body=$(echo "$dup_response" | sed '$d')

echo "HTTP $dup_code" | tee -a "$LOG"
echo "$dup_body" | jq . 2>/dev/null | tee -a "$LOG" || echo "$dup_body" | tee -a "$LOG"

if [ "$dup_code" = "200" ]; then
  pass "Duplicate image shape created (HTTP 200)"
else
  fail "Duplicate creation failed (HTTP $dup_code)"
fi

# Check dedup filename
dup_url=$(echo "$dup_body" | jq -r '.assetPaths["claude-code-docs.png"]' 2>/dev/null)
if echo "$dup_url" | grep -q "claude-code-docs-1.png"; then
  pass "Dedup filename: $dup_url"
else
  fail "Expected dedup filename with -1 suffix, got: $dup_url"
fi

if [ -f "$ASSETS_DIR/claude-code-docs-1.png" ]; then
  pass "Dedup file exists at $ASSETS_DIR/claude-code-docs-1.png"
else
  fail "Dedup file NOT found at $ASSETS_DIR/claude-code-docs-1.png"
fi

# ── Test 7: Missing file returns 400 ────────────────────────────────

echo "" | tee -a "$LOG"
echo "─── Test 7: Missing file returns 400 ───" | tee -a "$LOG"

missing_response=$(curl -s -w "\n%{http_code}" -X POST "$BASE/shapes" \
  -H "Content-Type: application/json" \
  -d '{"shapes":[{"type":"image","x":100,"y":100,"src":"/tmp/nonexistent-image-abc123.png"}]}')
missing_code=$(echo "$missing_response" | tail -1)
missing_body=$(echo "$missing_response" | sed '$d')

echo "HTTP $missing_code" | tee -a "$LOG"
echo "$missing_body" | jq . 2>/dev/null | tee -a "$LOG" || echo "$missing_body" | tee -a "$LOG"

if [ "$missing_code" = "400" ]; then
  pass "Missing file returns HTTP 400"
else
  fail "Expected HTTP 400, got $missing_code"
fi

# ── Test 8: Image with explicit dimensions ───────────────────────────

echo "" | tee -a "$LOG"
echo "─── Test 8: Image with explicit dimensions ───" | tee -a "$LOG"

dim_response=$(curl -s -w "\n%{http_code}" -X POST "$BASE/shapes" \
  -H "Content-Type: application/json" \
  -d "{\"shapes\":[{\"type\":\"image\",\"x\":700,\"y\":100,\"src\":\"$TEST_IMAGE\",\"props\":{\"w\":300,\"h\":200}}]}")
dim_code=$(echo "$dim_response" | tail -1)
dim_body=$(echo "$dim_response" | sed '$d')

echo "HTTP $dim_code" | tee -a "$LOG"
echo "$dim_body" | jq . 2>/dev/null | tee -a "$LOG" || echo "$dim_body" | tee -a "$LOG"

if [ "$dim_code" = "200" ]; then
  pass "Image with explicit dimensions created (HTTP 200)"
else
  fail "Expected HTTP 200, got $dim_code"
fi

# ── Summary ──────────────────────────────────────────────────────────

echo "" | tee -a "$LOG"
echo "═══════════════════════════════════════" | tee -a "$LOG"
echo "IMAGE SHAPE TESTS: $PASS passed, $FAIL failed" | tee -a "$LOG"
echo "═══════════════════════════════════════" | tee -a "$LOG"
echo "Full log: $LOG"
