#!/usr/bin/env bash
# Test valid shape creation — all should return 200 with createdIds
set -euo pipefail

BOARD="0f0d4eb5-3459-4989-88cd-1bdc32d077c0"
BASE="http://localhost:3456/api/boards/$BOARD/shapes"
LOG="tests/log-valid-shapes.txt"
PASS=0
FAIL=0

> "$LOG"

run_test() {
  local name="$1"
  local payload="$2"

  echo "─── $name ───" | tee -a "$LOG"
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE" \
    -H "Content-Type: application/json" \
    -d "$payload")
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  echo "HTTP $http_code" | tee -a "$LOG"
  echo "$body" | jq . 2>/dev/null | tee -a "$LOG" || echo "$body" | tee -a "$LOG"

  if [ "$http_code" = "200" ]; then
    echo "✅ PASS" | tee -a "$LOG"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL (expected 200, got $http_code)" | tee -a "$LOG"
    FAIL=$((FAIL + 1))
  fi
  echo "" | tee -a "$LOG"
}

# ── Geo shapes ────────────────────────────────────────────────────────

run_test "Geo: basic rectangle" \
  '{"shapes":[{"type":"geo","x":50,"y":50,"props":{"w":200,"h":100,"geo":"rectangle"}}]}'

run_test "Geo: ellipse with color and fill" \
  '{"shapes":[{"type":"geo","x":300,"y":50,"props":{"w":150,"h":150,"geo":"ellipse","color":"blue","fill":"solid"}}]}'

run_test "Geo: diamond with text and font" \
  '{"shapes":[{"type":"geo","x":500,"y":50,"props":{"w":180,"h":180,"geo":"diamond","text":"Hello","font":"sans","size":"l"}}]}'

run_test "Geo: star with all style props" \
  '{"shapes":[{"type":"geo","x":50,"y":250,"props":{"w":160,"h":160,"geo":"star","color":"red","fill":"pattern","dash":"dashed","size":"xl","font":"mono","align":"middle","verticalAlign":"middle"}}]}'

run_test "Geo: cloud with label color and url" \
  '{"shapes":[{"type":"geo","x":300,"y":250,"props":{"w":220,"h":140,"geo":"cloud","labelColor":"violet","url":"https://example.com"}}]}'

run_test "Geo: heart with scale and growY" \
  '{"shapes":[{"type":"geo","x":550,"y":250,"props":{"w":120,"h":120,"geo":"heart","scale":1.5,"growY":10}}]}'

run_test "Geo: pentagon" \
  '{"shapes":[{"type":"geo","x":50,"y":450,"props":{"w":140,"h":140,"geo":"pentagon"}}]}'

run_test "Geo: hexagon" \
  '{"shapes":[{"type":"geo","x":250,"y":450,"props":{"w":140,"h":140,"geo":"hexagon","color":"green","fill":"semi"}}]}'

run_test "Geo: octagon" \
  '{"shapes":[{"type":"geo","x":450,"y":450,"props":{"w":140,"h":140,"geo":"octagon"}}]}'

run_test "Geo: trapezoid with dash" \
  '{"shapes":[{"type":"geo","x":650,"y":450,"props":{"w":180,"h":100,"geo":"trapezoid","dash":"dotted"}}]}'

run_test "Geo: arrow-right" \
  '{"shapes":[{"type":"geo","x":50,"y":620,"props":{"w":160,"h":80,"geo":"arrow-right","color":"orange"}}]}'

run_test "Geo: check-box and x-box" \
  '{"shapes":[{"type":"geo","x":250,"y":620,"props":{"w":60,"h":60,"geo":"check-box"}},{"type":"geo","x":340,"y":620,"props":{"w":60,"h":60,"geo":"x-box"}}]}'

run_test "Geo: rhombus and rhombus-2" \
  '{"shapes":[{"type":"geo","x":450,"y":620,"props":{"w":120,"h":120,"geo":"rhombus"}},{"type":"geo","x":600,"y":620,"props":{"w":120,"h":120,"geo":"rhombus-2"}}]}'

run_test "Geo: oval" \
  '{"shapes":[{"type":"geo","x":750,"y":620,"props":{"w":180,"h":100,"geo":"oval","fill":"lined-fill"}}]}'

run_test "Geo: tempId" \
  '{"shapes":[{"type":"geo","x":50,"y":780,"tempId":"box-temp","props":{"w":200,"h":100,"geo":"rectangle","text":"Has tempId"}}]}'

# ── Text shapes ───────────────────────────────────────────────────────

run_test "Text: basic" \
  '{"shapes":[{"type":"text","x":50,"y":920,"props":{"text":"Plain text shape"}}]}'

run_test "Text: styled" \
  '{"shapes":[{"type":"text","x":300,"y":920,"props":{"text":"Styled text","color":"red","size":"xl","font":"serif","textAlign":"middle"}}]}'

run_test "Text: with w and autoSize" \
  '{"shapes":[{"type":"text","x":600,"y":920,"props":{"text":"Fixed width","w":300,"autoSize":false}}]}'

run_test "Text: with scale" \
  '{"shapes":[{"type":"text","x":50,"y":1000,"props":{"text":"Scaled","scale":2.0,"font":"mono"}}]}'

# ── Note shapes ───────────────────────────────────────────────────────

run_test "Note: basic" \
  '{"shapes":[{"type":"note","x":50,"y":1100,"props":{"text":"A sticky note"}}]}'

run_test "Note: styled" \
  '{"shapes":[{"type":"note","x":300,"y":1100,"props":{"text":"Styled note","color":"light-blue","size":"l","font":"sans","align":"start","verticalAlign":"start"}}]}'

run_test "Note: with fontSizeAdjustment and url" \
  '{"shapes":[{"type":"note","x":550,"y":1100,"props":{"text":"Adjusted","fontSizeAdjustment":12,"url":"https://example.com"}}]}'

run_test "Note: with growY and scale" \
  '{"shapes":[{"type":"note","x":50,"y":1350,"props":{"text":"Grown","growY":20,"scale":1.2}}]}'

run_test "Note: with labelColor" \
  '{"shapes":[{"type":"note","x":300,"y":1350,"props":{"text":"Label color","color":"yellow","labelColor":"red"}}]}'

# ── Frame shapes ──────────────────────────────────────────────────────

run_test "Frame: basic" \
  '{"shapes":[{"type":"frame","x":800,"y":50,"props":{"w":400,"h":300}}]}'

run_test "Frame: named with color" \
  '{"shapes":[{"type":"frame","x":800,"y":400,"props":{"w":400,"h":300,"name":"My Frame","color":"blue"}}]}'

# ── Arrow shapes ──────────────────────────────────────────────────────

run_test "Arrow: standalone with coordinates" \
  '{"shapes":[{"type":"arrow","x1":50,"y1":1550,"x2":250,"y2":1550}]}'

run_test "Arrow: with props styling" \
  '{"shapes":[{"type":"arrow","x1":50,"y1":1620,"x2":300,"y2":1620,"props":{"color":"red","size":"l","arrowheadStart":"none","arrowheadEnd":"triangle"}}]}'

run_test "Arrow: elbow kind" \
  '{"shapes":[{"type":"arrow","x1":50,"y1":1700,"x2":300,"y2":1800,"props":{"kind":"elbow","color":"blue","dash":"dashed"}}]}'

run_test "Arrow: with text label" \
  '{"shapes":[{"type":"arrow","x1":350,"y1":1550,"x2":600,"y2":1550,"props":{"text":"connects","labelPosition":0.5,"font":"sans"}}]}'

run_test "Arrow: binding with fromId/toId" \
  '{"shapes":[
    {"tempId":"src","type":"geo","x":50,"y":1900,"props":{"w":150,"h":80,"geo":"rectangle","text":"Source"}},
    {"tempId":"dst","type":"geo","x":400,"y":1900,"props":{"w":150,"h":80,"geo":"rectangle","text":"Dest"}},
    {"type":"arrow","fromId":"src","toId":"dst","x1":200,"y1":1940,"x2":400,"y2":1940,"props":{"arrowheadEnd":"arrow"}}
  ]}'

run_test "Arrow: with bend" \
  '{"shapes":[{"type":"arrow","x1":350,"y1":1620,"x2":600,"y2":1720,"props":{"bend":50,"color":"green"}}]}'

# ── Mixed batch ───────────────────────────────────────────────────────

run_test "Mixed: geo + text + note + frame + arrow" \
  '{"shapes":[
    {"tempId":"f1","type":"frame","x":800,"y":800,"props":{"w":500,"h":400,"name":"Mixed Batch"}},
    {"tempId":"g1","type":"geo","x":830,"y":870,"props":{"w":180,"h":80,"geo":"rectangle","text":"Box A","color":"blue"}},
    {"tempId":"g2","type":"geo","x":1080,"y":870,"props":{"w":180,"h":80,"geo":"rectangle","text":"Box B","color":"green"}},
    {"type":"arrow","fromId":"g1","toId":"g2","x1":1010,"y1":910,"x2":1080,"y2":910},
    {"type":"text","x":830,"y":1000,"props":{"text":"Description text","font":"sans","size":"s"}},
    {"type":"note","x":1080,"y":1000,"props":{"text":"Remember this","color":"yellow"}}
  ]}'

# ── richText ──────────────────────────────────────────────────────────

run_test "Geo: with richText" \
  '{"shapes":[{"type":"geo","x":50,"y":2100,"props":{"w":250,"h":100,"geo":"rectangle","richText":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Rich text!"}]}]}}}]}'

run_test "Note: with richText" \
  '{"shapes":[{"type":"note","x":350,"y":2100,"props":{"richText":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Rich note"}]}]}}}]}'

# ── Summary ───────────────────────────────────────────────────────────

echo "═══════════════════════════════════════" | tee -a "$LOG"
echo "VALID SHAPES TESTS: $PASS passed, $FAIL failed" | tee -a "$LOG"
echo "═══════════════════════════════════════" | tee -a "$LOG"
echo "Full log: $LOG"
