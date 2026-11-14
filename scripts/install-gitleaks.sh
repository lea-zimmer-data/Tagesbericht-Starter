#!/usr/bin/env bash
# Installiert gitleaks in fester Version nach ${1:-$HOME/.local/bin}, mit Prüfsummenprüfung.
set -euo pipefail

VERSION="8.30.1"
SHA_X64="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"
SHA_ARM64="e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080"

ziel="${1:-$HOME/.local/bin}"

case "$(uname -m)" in
  x86_64) arch="x64"; soll="$SHA_X64" ;;
  aarch64 | arm64) arch="arm64"; soll="$SHA_ARM64" ;;
  *) echo "Nicht unterstützte Architektur: $(uname -m)" >&2; exit 1 ;;
esac

if command -v gitleaks >/dev/null 2>&1 && gitleaks version | grep -q "$VERSION"; then
  echo "gitleaks $VERSION ist bereits installiert."
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
datei="gitleaks_${VERSION}_linux_${arch}.tar.gz"
curl -sSfL -o "$tmp/$datei" \
  "https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/${datei}"
echo "${soll}  $tmp/$datei" | sha256sum -c -
mkdir -p "$ziel"
tar -xzf "$tmp/$datei" -C "$ziel" gitleaks
echo "gitleaks $VERSION nach $ziel installiert."
