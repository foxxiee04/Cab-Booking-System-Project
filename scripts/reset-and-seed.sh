#!/usr/bin/env bash
# One command: reset all DBs + seed. Kept under scripts/ with the rest of the
# database maintenance entrypoints.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/reset-database-swarm.sh" "$@"
