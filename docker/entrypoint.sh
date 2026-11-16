#!/bin/sh
# Prepara as pastas e inicia o servidor.
# Por padrão roda como root (mais simples no CasaOS, que cria as pastas como root).
# Para rodar com outro usuário, defina PUID e PGID (ex.: 1000) no YAML.
set -e

mkdir -p "$DATA_DIR" "$ARQUIVOS_DIR/Para editar" "$ARQUIVOS_DIR/Editadas"

if [ "$(id -u)" = "0" ] && [ -n "$PUID" ] && [ "$PUID" != "0" ]; then
  PGID="${PGID:-$PUID}"
  echo "[estudio-ia] ajustando dono das pastas para $PUID:$PGID"
  chown -R "$PUID:$PGID" "$DATA_DIR" "$ARQUIVOS_DIR" 2>/dev/null || echo "[estudio-ia] aviso: não consegui ajustar o dono de todas as pastas"
  umask 0002
  exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups node server.js
fi

umask 0002
exec node server.js
