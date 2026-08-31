#!/usr/bin/env bash
# Mint a delegation token in Java, verify it in Python.
#
# Two JWT libraries agreeing is the only thing that proves the contract in
# DELEGATION-TOKEN.md holds across the wire. A token that round-trips only inside
# one library is a token that fails on the first day of the pilot - RS256 padding,
# audience-as-array, and the exp/iat window are all places the two can disagree
# while each is internally consistent.
#
# Run before any deployment that changes either side. Needs JDK 17, Maven, and the
# mind-map backend's virtualenv.
set -euo pipefail

SERVER_REPO="${SERVER_REPO:-$HOME/nexsol-server-postgress}"
MINDMAP_REPO="${MINDMAP_REPO:-/e/mind-map}"
PYTHON="${PYTHON:-$MINDMAP_REPO/backend/.venv/bin/python}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

AUDIENCE="mindmap-layout-api"
ISSUER="tradelink247"
TENANT="9446968394a"

echo "==> generating a throwaway RSA keypair"
"$PYTHON" - "$WORK" <<'PY'
import sys
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
work = sys.argv[1]
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
open(f"{work}/private.pem", "wb").write(key.private_bytes(
    serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption()))
open(f"{work}/public.pem", "wb").write(key.public_key().public_bytes(
    serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
PY

echo "==> minting with the Spring service"
cd "$SERVER_REPO"
mvn -B -q dependency:build-classpath -Dmdep.outputFile="$WORK/cp.txt" -DincludeScope=runtime
mvn -B -q compile

cat > "$WORK/MintToken.java" <<'JAVA'
import com.nexsol.backend.backendserver.service.product360.DelegationTokenService;

public class MintToken {
    public static void main(String[] args) {
        DelegationTokenService service = new DelegationTokenService();
        service.configure(true, args[0], args[1], args[2], 300);
        System.out.println(service.mint(args[3], "alice@example.com").orElse("MINT-FAILED"));
    }
}
JAVA

SEP=":"; case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) SEP=";";; esac
CP="target/classes${SEP}$(cat "$WORK/cp.txt")"
javac -cp "$CP" -d "$WORK" "$WORK/MintToken.java"
TOKEN="$(java -cp "${CP}${SEP}${WORK}" MintToken \
    "$WORK/private.pem" "$AUDIENCE" "$ISSUER" "$TENANT" | tail -1)"

if [ "$TOKEN" = "MINT-FAILED" ] || [ -z "$TOKEN" ]; then
    echo "FAIL: the Java side minted nothing" >&2
    exit 1
fi
echo "    minted ${#TOKEN} chars"

echo "==> verifying with the Python verifier"
cd "$MINDMAP_REPO/backend"
TOKEN="$TOKEN" PUBKEY="$WORK/public.pem" AUD="$AUDIENCE" ISS="$ISSUER" TENANT="$TENANT" \
"$PYTHON" - <<'PY'
import os, sys
from app.api.delegation import verify
from app.config.settings import Settings

settings = Settings(
    auth_mode="delegated",
    jwt_public_key=open(os.environ["PUBKEY"]).read(),
    jwt_audience=os.environ["AUD"],
    jwt_issuer=os.environ["ISS"],
    jwt_max_age_seconds=300,
)
identity = verify(os.environ["TOKEN"].strip(), settings)

# Verifying is not enough - it must resolve to the identity the ERP actually put in.
# A verifier that accepts the signature but reads the wrong tenant would hand one
# company's layouts to another.
assert identity.tenant == os.environ["TENANT"], identity.tenant
assert identity.subject == "alice@example.com", identity.subject
assert identity.token_id, "no jti - nothing to correlate in logs"
print(f"    verified: tenant={identity.tenant} subject={identity.subject}")

# And the same verifier must still refuse a token from a key it does not know,
# otherwise the check above proves only that it accepts everything.
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

stranger = rsa.generate_private_key(public_exponent=65537, key_size=2048)
stranger_settings = Settings(
    auth_mode="delegated",
    jwt_public_key=stranger.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode(),
    jwt_audience=os.environ["AUD"],
    jwt_issuer=os.environ["ISS"],
)
try:
    verify(os.environ["TOKEN"].strip(), stranger_settings)
except HTTPException as exc:
    assert exc.status_code == 401, exc.status_code
    print("    a token signed by an unknown key is refused")
else:
    print("FAIL: an unknown key was accepted", file=sys.stderr)
    sys.exit(1)
PY

echo "==> interop OK"
