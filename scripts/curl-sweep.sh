#!/bin/sh
#
# The post-cutover curl sweep — AWK-45's second half.
#
# WHY THIS EXISTS, AND WHY IT IS NOT A NICE-TO-HAVE: ADR-0010 ships no analytics and
# no server log, so nothing will ever tell us a redirect 404'd in production. That
# decision was made on the argument that inbound URLs are a FINITE KNOWN SET, so a
# one-time curl pass tests what analytics would only have hinted at months later.
# This script is that accepted mitigation, not a convenience.
#
# It PARSES public/_redirects rather than restating it, so there is one ledger and
# the sweep tests exactly the file that ships. It also tests things the file cannot
# state about itself: that Netlify's trailing-slash normalization really does catch
# both live forms, that the old site's own inventory resolves, and that unknown and
# reserved paths still 404 — which is how a catch-all would announce itself.
#
# WHAT IT CANNOT CHECK: whether each cheatsheet points at the RIGHT gist. A wrong
# gist returns a healthy 200 and looks identical to a correct one from out here.
# See ADR-0002's gist table and the amendment under it for why that matters and
# where the answer lives.
#
# Usage:
#   scripts/curl-sweep.sh                 # against awkale.me, the default
#   scripts/curl-sweep.sh awkale.netlify.app
#   scripts/curl-sweep.sh deploy-preview-1--awkale.netlify.app
#
# Run it AFTER the apex cutover (AWK-46). Against the old site every rule fails,
# which is correct and is the point.

set -eu

HOST="${1:-awkale.me}"

# A bare hostname gets https://; a full URL is used as given, so this also works
# against a local dev server (http://localhost:5173) now that @netlify/vite-plugin
# serves _redirects and _headers in dev. That is what makes the thirteen testable
# before the apex cutover rather than only after it.
case "$HOST" in
  http://* | https://*) BASE="${HOST%/}" ;;
  *) BASE="https://$HOST" ;;
esac
REDIRECTS="$(dirname "$0")/../public/_redirects"

pass=0
fail=0

# Colour only when stdout is a terminal, so piping to a file or a pager does not
# collect escape codes.
if [ -t 1 ]; then
  red() { printf '\033[31m%s\033[0m\n' "$1"; }
  green() { printf '\033[32m%s\033[0m\n' "$1"; }
else
  red() { printf '%s\n' "$1"; }
  green() { printf '%s\n' "$1"; }
fi

# status_of URL -> "<code> <location>"
# `-s` alone: `-S` exists to print errors to stderr, which would then need
# suppressing anyway — the `|| echo` below is what reports a failed request.
status_of() {
  curl -s -o /dev/null -m 20 -w '%{http_code} %{redirect_url}' "$1" || echo "000 curl-failed"
}

expect_redirect() {
  url="$1" want_to="$2" want_code="$3"
  got="$(status_of "$url")"
  code="${got%% *}"
  loc="${got#* }"

  # curl's %{redirect_url} is always absolute, so a relative target in the ledger
  # (/projects/) arrives as $BASE/projects/. Both forms are accepted because an
  # external target is already absolute and matches the first comparison.
  if [ "$code" = "$want_code" ] && { [ "$loc" = "$want_to" ] || [ "$loc" = "${BASE}${want_to}" ]; }; then
    green "  ok    $code  $url -> $loc"
    pass=$((pass + 1))
  else
    red "  FAIL  $url"
    red "        want $want_code -> $want_to"
    red "        got  $code -> $loc"
    fail=$((fail + 1))
  fi
}

expect_status() {
  url="$1" want="$2"
  got="$(status_of "$url")"
  code="${got%% *}"
  if [ "$code" = "$want" ]; then
    green "  ok    $code  $url"
    pass=$((pass + 1))
  else
    red "  FAIL  $url — want $want, got $code"
    fail=$((fail + 1))
  fi
}

echo
echo "curl sweep against $BASE"
echo "reading the ledger from $REDIRECTS"

echo
echo "== every rule, slash-free (as written) =="
# `want_code`, not `status`: `status` is READ-ONLY in zsh, so naming it that breaks the
# script anywhere /bin/sh is zsh.
while read -r from to want_code; do
  case "$from" in '' | \#*) continue ;; esac
  expect_redirect "$BASE$from" "$to" "$want_code"
done <"$REDIRECTS"

echo
echo "== every rule again, WITH a trailing slash =="
echo "   (the live URLs all had one: the old site was Jekyll with permalink: pretty."
echo "    _redirects writes sources slash-free and relies on Netlify normalizing.)"
while read -r from to want_code; do
  case "$from" in '' | \#*) continue ;; esac
  expect_redirect "$BASE$from/" "$to" "$want_code"
done <"$REDIRECTS"

echo
echo "== the new site's own pages still serve =="
for p in / /projects/ /concerts/ /concerts/composers/ /contact/ /contact/sent/; do
  expect_status "$BASE$p" 200
done

echo
echo "== reserved paths and unknowns must 404 =="
echo "   (ADR-0001 reserves these; a catch-all would turn each into an empty shell)"
for p in /music /music/ /2-or-3-things /2-or-3-things/ /portfolios/never-existed /no-such-page; do
  expect_status "$BASE$p" 404
done

echo
echo "== the old site's remaining inventory =="
echo "   (/ and /favicon.ico were the only old root URLs that were not redirects)"
#
# /favicon.ico now 200s — AWK-50 shipped the file (public/favicon.ico, the old
# site's 363-byte mark byte for byte) and declared it in root.tsx. This line was
# asserted as 404 until then, because a permanently-red line in the one mitigation
# ADR-0010 leaves us is how the whole sweep stops being run.
#
# Status only, deliberately. What the bytes ARE is asserted in
# scripts/assert-pages.test.ts against the built output, which is cheaper and more
# precise than inferring a format from a live content-type header.
expect_status "$BASE/favicon.ico" 200
#
# Both halves, because both are load-bearing and for different clients: Safari has
# no SVG-favicon support and falls back to the .ico, while Chrome and Firefox take
# the SVG. Checking only one leaves the other free to be renamed or shadowed by a
# header rule with this sweep still green — and it is the only live check there is.
expect_status "$BASE/icon.svg" 200

echo
printf 'passed %s, failed %s\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
