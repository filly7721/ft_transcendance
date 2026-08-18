#!/bin/sh
set -e

CERT_DIR=/certs
STAMP="$CERT_DIR/.san"

HOST=$(printf '%s' "${PUBLIC_ORIGIN:-https://localhost}" \
  | sed -e 's|^[a-zA-Z][a-zA-Z0-9+.-]*://||' -e 's|/.*$||' -e 's|:[0-9]*$||')

if printf '%s' "$HOST" | grep -qE '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'; then
  EXTRA="IP:$HOST"
else
  EXTRA="DNS:$HOST"
fi

SAN="DNS:localhost,DNS:host.docker.internal,IP:127.0.0.1"
case ",$SAN," in
  *",$EXTRA,"*) ;;
  *) SAN="$SAN,$EXTRA" ;;
esac

if [ -f "$CERT_DIR/cert.pem" ] && [ -f "$CERT_DIR/key.pem" ] \
   && [ "$(cat "$STAMP" 2>/dev/null)" = "$SAN" ]; then
  echo "[cert] reusing certificate for $SAN"
  exit 0
fi

echo "[cert] generating a self-signed certificate for $SAN"
mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$CERT_DIR/key.pem" \
  -out "$CERT_DIR/cert.pem" \
  -subj "/CN=$HOST" \
  -addext "subjectAltName=$SAN"

chmod 600 "$CERT_DIR/key.pem"
printf '%s' "$SAN" > "$STAMP"
echo "[cert] done"
