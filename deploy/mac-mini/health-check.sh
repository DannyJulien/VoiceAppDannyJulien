#!/bin/zsh
set -euo pipefail

curl --fail --silent --show-error http://127.0.0.1:4173/health
echo
