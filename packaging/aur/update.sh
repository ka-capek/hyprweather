#!/usr/bin/env bash
# Připraví PKGBUILD na novou verzi: pkgver, kontrolní součet z vydání
# na GitHubu a přegenerované .SRCINFO.
#
#   ./update.sh 0.2.0
set -euo pipefail
cd "$(dirname "$0")"

VERSION="${1:?použití: ./update.sh <verze bez v>}"
URL="https://github.com/ka-capek/hyprweather/releases/download/v$VERSION/hyprweather-$VERSION-x86_64.AppImage"

echo "Stahuji kontrolní součet: $URL"
SUM="$(curl -fsSL "$URL" | sha256sum | cut -d' ' -f1)"

sed -i -e "s/^pkgver=.*/pkgver=$VERSION/" \
       -e "s/^pkgrel=.*/pkgrel=1/" \
       -e "s/^sha256sums=.*/sha256sums=('$SUM')/" PKGBUILD

if command -v makepkg >/dev/null; then
  makepkg --printsrcinfo > .SRCINFO
  echo "PKGBUILD a .SRCINFO připravené na $VERSION ($SUM)"
else
  echo "makepkg není po ruce — .SRCINFO vyrob na Archu: makepkg --printsrcinfo > .SRCINFO" >&2
fi
