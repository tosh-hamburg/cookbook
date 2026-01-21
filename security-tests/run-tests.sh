#!/bin/bash
#
# Security Tests für Cookbook ausführen
#
# Verwendung:
#   ./run-tests.sh              # Nur sichere Tests
#   ./run-tests.sh all          # Alle Tests
#   ./run-tests.sh auth         # Nur Auth-Tests
#   ./run-tests.sh authz        # Nur Authz-Tests
#   ./run-tests.sh input        # Nur Input-Tests
#   ./run-tests.sh api          # Nur API-Tests
#

cd "$(dirname "$0")"

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         🔐 Cookbook Security Tests                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Test-Modus
TEST_MODE=${1:-safe}

case $TEST_MODE in
  all)
    echo -e "${YELLOW}⚠️  Alle Tests (inkl. destruktive) werden ausgeführt!${NC}"
    COMMAND="npm test"
    ;;
  auth)
    echo "🔐 Nur Authentifizierungstests"
    COMMAND="npm run test:auth"
    ;;
  authz)
    echo "🛡️  Nur Autorisierungstests"
    COMMAND="npm run test:authz"
    ;;
  input)
    echo "🧹 Nur Input-Validierungstests"
    COMMAND="npm run test:input"
    ;;
  api)
    echo "🌐 Nur API-Sicherheitstests"
    COMMAND="npm run test:api"
    ;;
  safe|*)
    echo "✅ Nur sichere Tests (read-only)"
    COMMAND="npm run test:safe"
    ;;
esac

echo ""
echo "📍 Ziel: ${API_URL:-https://cookbook.dunker.one/api}"
echo ""

# Docker ausführen
docker compose run --rm security-tests $COMMAND

echo ""
echo -e "${GREEN}Tests abgeschlossen!${NC}"
