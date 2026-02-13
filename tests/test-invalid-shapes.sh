#!/usr/bin/env bash
# Test invalid shape creation — all should return 400 with Zod error details
set -euo pipefail

BOARD="0f0d4eb5-3459-4989-88cd-1bdc32d077c0"
BASE="http://localhost:3456/api/boards/$BOARD/shapes"
LOG="tests/log-invalid-shapes.txt"
PASS=0
FAIL=0

> "$LOG"

run_test() {
  local name="$1"
  local payload="$2"
  local expected_code="${3:-400}"

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

# ══════════════════════════════════════════════════════════════════════
# DISCRIMINATED UNION ERRORS — bad/missing type
# ══════════════════════════════════════════════════════════════════════

run_test "Bad shape type: banana" \
  '{"shapes":[{"type":"banana","x":0,"y":0,"props":{"w":100,"h":100}}]}'

run_test "Missing type field" \
  '{"shapes":[{"x":0,"y":0,"props":{"w":100,"h":100}}]}'

run_test "Empty type string" \
  '{"shapes":[{"type":"","x":0,"y":0,"props":{}}]}'

# ══════════════════════════════════════════════════════════════════════
# MISSING REQUIRED FIELDS
# ══════════════════════════════════════════════════════════════════════

run_test "Geo: missing x" \
  '{"shapes":[{"type":"geo","y":0,"props":{"w":100,"h":100,"geo":"rectangle"}}]}'

run_test "Geo: missing y" \
  '{"shapes":[{"type":"geo","x":0,"props":{"w":100,"h":100,"geo":"rectangle"}}]}'

run_test "Geo: missing props entirely" \
  '{"shapes":[{"type":"geo","x":0,"y":0}]}'

run_test "Geo: missing props.w" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"h":100,"geo":"rectangle"}}]}'

run_test "Geo: missing props.h" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"geo":"rectangle"}}]}'

run_test "Geo: missing props.geo" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100}}]}'

run_test "Text: missing x" \
  '{"shapes":[{"type":"text","y":0,"props":{"text":"hello"}}]}'

run_test "Text: missing y" \
  '{"shapes":[{"type":"text","x":0,"props":{"text":"hello"}}]}'

run_test "Text: missing props entirely" \
  '{"shapes":[{"type":"text","x":0,"y":0}]}'

run_test "Note: missing x" \
  '{"shapes":[{"type":"note","y":0,"props":{"text":"note"}}]}'

run_test "Note: missing props" \
  '{"shapes":[{"type":"note","x":0,"y":0}]}'

run_test "Frame: missing props" \
  '{"shapes":[{"type":"frame","x":0,"y":0}]}'

run_test "Frame: missing props.w" \
  '{"shapes":[{"type":"frame","x":0,"y":0,"props":{"h":100}}]}'

run_test "Frame: missing props.h" \
  '{"shapes":[{"type":"frame","x":0,"y":0,"props":{"w":100}}]}'

run_test "Visual Iframe: missing props.html" \
  '{"shapes":[{"type":"visual-iframe","x":0,"y":0,"props":{"w":400,"h":300,"name":"Artifact"}}]}'

# ══════════════════════════════════════════════════════════════════════
# BAD ENUM VALUES
# ══════════════════════════════════════════════════════════════════════

run_test "Geo: bad geo type 'banana'" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"banana"}}]}'

run_test "Geo: bad color 'pink'" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle","color":"pink"}}]}'

run_test "Geo: bad fill 'gradient'" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle","fill":"gradient"}}]}'

run_test "Geo: bad size 'xxl'" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle","size":"xxl"}}]}'

run_test "Geo: bad dash 'wavy'" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle","dash":"wavy"}}]}'

run_test "Geo: bad font 'comic'" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle","font":"comic"}}]}'

run_test "Geo: bad align 'center'" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle","align":"center"}}]}'

run_test "Geo: bad verticalAlign 'top'" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle","verticalAlign":"top"}}]}'

run_test "Text: bad textAlign 'center'" \
  '{"shapes":[{"type":"text","x":0,"y":0,"props":{"text":"hi","textAlign":"center"}}]}'

run_test "Arrow: bad arrowheadEnd 'circle'" \
  '{"shapes":[{"type":"arrow","x1":0,"y1":0,"x2":100,"y2":100,"props":{"arrowheadEnd":"circle"}}]}'

run_test "Arrow: bad kind 'straight'" \
  '{"shapes":[{"type":"arrow","x1":0,"y1":0,"x2":100,"y2":100,"props":{"kind":"straight"}}]}'

# ══════════════════════════════════════════════════════════════════════
# WRONG TYPES (string where number expected, etc.)
# ══════════════════════════════════════════════════════════════════════

run_test "Geo: x is string" \
  '{"shapes":[{"type":"geo","x":"zero","y":0,"props":{"w":100,"h":100,"geo":"rectangle"}}]}'

run_test "Geo: props.w is string" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":"wide","h":100,"geo":"rectangle"}}]}'

run_test "Geo: props.h is boolean" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":true,"geo":"rectangle"}}]}'

run_test "Text: autoSize is string" \
  '{"shapes":[{"type":"text","x":0,"y":0,"props":{"text":"hi","autoSize":"yes"}}]}'

run_test "Geo: scale is string" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle","scale":"big"}}]}'

# ══════════════════════════════════════════════════════════════════════
# UNKNOWN/EXTRA PROPS (.strict() enforcement)
# ══════════════════════════════════════════════════════════════════════

run_test "Geo: unknown prop 'foo' in props" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle","foo":"bar"}}]}'

run_test "Geo: unknown prop 'rotation' at top level" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"rotation":45,"props":{"w":100,"h":100,"geo":"rectangle"}}]}'

run_test "Text: unknown prop 'bold' in props" \
  '{"shapes":[{"type":"text","x":0,"y":0,"props":{"text":"hi","bold":true}}]}'

run_test "Note: unknown prop 'pinned' in props" \
  '{"shapes":[{"type":"note","x":0,"y":0,"props":{"text":"note","pinned":true}}]}'

run_test "Frame: unknown prop 'locked' in props" \
  '{"shapes":[{"type":"frame","x":0,"y":0,"props":{"w":100,"h":100,"locked":true}}]}'

run_test "Arrow: unknown prop 'weight' in props" \
  '{"shapes":[{"type":"arrow","x1":0,"y1":0,"x2":100,"y2":100,"props":{"weight":5}}]}'

run_test "Visual Iframe: unknown prop in props" \
  '{"shapes":[{"type":"visual-iframe","x":0,"y":0,"props":{"html":"<h1>Test</h1>","interactive":true}}]}'

run_test "Top-level unknown field 'id'" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"id":"shape:custom","props":{"w":100,"h":100,"geo":"rectangle"}}]}'

# ══════════════════════════════════════════════════════════════════════
# BAD BODY STRUCTURE
# ══════════════════════════════════════════════════════════════════════

run_test "Empty shapes array" \
  '{"shapes":[]}'

run_test "Missing shapes field" \
  '{"data":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle"}}]}'

run_test "Shapes is not array" \
  '{"shapes":"not-an-array"}'

run_test "Shapes is null" \
  '{"shapes":null}'

run_test "Body is just an array" \
  '[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle"}}]'

# ══════════════════════════════════════════════════════════════════════
# BAD richText STRUCTURE
# ══════════════════════════════════════════════════════════════════════

run_test "Geo: richText missing type:doc" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle","richText":{"content":[]}}}]}'

run_test "Geo: richText with wrong type" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle","richText":{"type":"paragraph","content":[]}}}]}'

run_test "Geo: richText content not array" \
  '{"shapes":[{"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle","richText":{"type":"doc","content":"text"}}}]}'

# ══════════════════════════════════════════════════════════════════════
# MIXED VALID + INVALID (whole batch should fail)
# ══════════════════════════════════════════════════════════════════════

run_test "Batch: 1 valid + 1 invalid shape" \
  '{"shapes":[
    {"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle"}},
    {"type":"geo","x":200,"y":0,"props":{"w":100,"h":100,"geo":"banana"}}
  ]}'

run_test "Batch: valid geo + invalid text (missing props)" \
  '{"shapes":[
    {"type":"geo","x":0,"y":0,"props":{"w":100,"h":100,"geo":"rectangle"}},
    {"type":"text","x":200,"y":0}
  ]}'

# ── Summary ───────────────────────────────────────────────────────────

echo "═══════════════════════════════════════" | tee -a "$LOG"
echo "INVALID SHAPES TESTS: $PASS passed, $FAIL failed" | tee -a "$LOG"
echo "═══════════════════════════════════════" | tee -a "$LOG"
echo "Full log: $LOG"
