#!/usr/bin/env bash
# Test style features: fill variants, white color, labelColor, scale
set -euo pipefail

BOARD="0f0d4eb5-3459-4989-88cd-1bdc32d077c0"
BASE="http://localhost:3456/api/boards/$BOARD/shapes"
LOG="tests/log-style-features.txt"
PASS=0
FAIL=0

> "$LOG"

run_test() {
  local name="$1"
  local payload="$2"
  local expected_code="${3:-200}"

  echo "─── $name ───" | tee -a "$LOG"
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE" \
    -H "Content-Type: application/json" \
    -d "$payload")
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  echo "HTTP $http_code" | tee -a "$LOG"
  echo "$body" | jq . 2>/dev/null | tee -a "$LOG" || echo "$body" | tee -a "$LOG"

  if [ "$http_code" = "$expected_code" ]; then
    echo "✅ PASS (got expected $expected_code)" | tee -a "$LOG"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL (expected $expected_code, got $http_code)" | tee -a "$LOG"
    FAIL=$((FAIL + 1))
  fi
  echo "" | tee -a "$LOG"
}

# ── fill: "fill" (easter egg) ────────────────────────────────────────

run_test "Geo: fill='fill'" \
  '{"shapes":[{"type":"geo","x":50,"y":50,"props":{"w":250,"h":250,"geo":"rectangle","color":"blue","fill":"fill","text":"Fill"}}]}'

# ── fill: "lined-fill" (easter egg) ──────────────────────────────────

run_test "Geo: fill='lined-fill'" \
  '{"shapes":[{"type":"geo","x":350,"y":50,"props":{"w":250,"h":250,"geo":"rectangle","color":"blue","fill":"lined-fill","text":"Lined fill"}}]}'

# ── color: "white" (easter egg) ──────────────────────────────────────

run_test "Geo: color='white' with fill" \
  '{"shapes":[{"type":"geo","x":650,"y":50,"props":{"w":250,"h":250,"geo":"rectangle","color":"white","fill":"fill","text":"White"}}]}'

# ── labelColor separate from shape color ─────────────────────────────

run_test "Geo: labelColor='red' with color='blue'" \
  '{"shapes":[{"type":"geo","x":950,"y":50,"props":{"w":250,"h":250,"geo":"rectangle","color":"blue","labelColor":"red","text":"Label color"}}]}'

# ── scale ─────────────────────────────────────────────────────────────

run_test "Geo: scale=2.5" \
  '{"shapes":[{"type":"geo","x":1250,"y":50,"props":{"w":250,"h":250,"geo":"rectangle","color":"blue","scale":2.5,"text":"Scale"}}]}'

# ── labelColor on notes ──────────────────────────────────────────────

run_test "Note: labelColor='violet'" \
  '{"shapes":[{"type":"note","x":50,"y":350,"props":{"text":"Note with label color","color":"yellow","labelColor":"violet"}}]}'

# ── all colors as labelColor ─────────────────────────────────────────

run_test "Geo: labelColor='light-violet'" \
  '{"shapes":[{"type":"geo","x":350,"y":350,"props":{"w":200,"h":100,"geo":"rectangle","labelColor":"light-violet","text":"light-violet label"}}]}'

run_test "Geo: labelColor='light-green'" \
  '{"shapes":[{"type":"geo","x":600,"y":350,"props":{"w":200,"h":100,"geo":"rectangle","labelColor":"light-green","text":"light-green label"}}]}'

run_test "Geo: labelColor='light-red'" \
  '{"shapes":[{"type":"geo","x":850,"y":350,"props":{"w":200,"h":100,"geo":"rectangle","labelColor":"light-red","text":"light-red label"}}]}'

run_test "Geo: labelColor='light-blue'" \
  '{"shapes":[{"type":"geo","x":1100,"y":350,"props":{"w":200,"h":100,"geo":"rectangle","labelColor":"light-blue","text":"light-blue label"}}]}'

# ── combined: labelColor + fill + white + scale ──────────────────────

run_test "Geo: all style features combined" \
  '{"shapes":[{"type":"geo","x":50,"y":500,"props":{"w":300,"h":200,"geo":"rectangle","color":"white","fill":"lined-fill","labelColor":"red","scale":1.5,"text":"All combined"}}]}'

# ── invalid: bad labelColor should 400 ───────────────────────────────

run_test "INVALID: labelColor='pink'" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle","labelColor":"pink"}}]}' \
  400

run_test "INVALID: fill='gradient'" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle","fill":"gradient"}}]}' \
  400

# ── Summary ───────────────────────────────────────────────────────────

echo "═══════════════════════════════════════" | tee -a "$LOG"
echo "STYLE FEATURES TESTS: $PASS passed, $FAIL failed" | tee -a "$LOG"
echo "═══════════════════════════════════════" | tee -a "$LOG"
echo "Full log: $LOG"
