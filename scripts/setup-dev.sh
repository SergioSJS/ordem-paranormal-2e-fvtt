#!/usr/bin/env bash
# Cria o symlink deste repositório dentro da pasta de sistemas do Foundry VTT.
#
#   npm run setup                  # usa a instalação padrão
#   FOUNDRY_DATA=/caminho npm run setup   # aponta para outra instalação (ex.: v13)
set -euo pipefail

SYSTEM_ID="ordem-paranormal-2e"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

DEFAULT_DATA="$HOME/Library/Application Support/FoundryVTT/Data"
[[ "$(uname -s)" == "Linux" ]] && DEFAULT_DATA="$HOME/.local/share/FoundryVTT/Data"

DATA_DIR="${FOUNDRY_DATA:-$DEFAULT_DATA}"
SYSTEMS_DIR="$DATA_DIR/systems"
LINK_PATH="$SYSTEMS_DIR/$SYSTEM_ID"

if [[ ! -d "$SYSTEMS_DIR" ]]; then
  echo "Pasta de sistemas não encontrada: $SYSTEMS_DIR"
  echo "Abra o Foundry VTT pelo menos uma vez para criar a estrutura de dados,"
  echo "ou defina FOUNDRY_DATA apontando para o User Data da sua instalação."
  exit 1
fi

if [[ -e "$LINK_PATH" && ! -L "$LINK_PATH" ]]; then
  echo "Já existe uma pasta (não symlink) em: $LINK_PATH"
  echo "Remova ou renomeie manualmente antes de continuar."
  exit 1
fi

ln -sfn "$REPO_ROOT" "$LINK_PATH"
echo "Symlink criado:"
ls -la "$LINK_PATH"

if command -v npm >/dev/null 2>&1 && [[ ! -d "$REPO_ROOT/node_modules" ]]; then
  echo ""
  echo "Instalando dependências de desenvolvimento..."
  (cd "$REPO_ROOT" && npm install)
fi

if [[ ! -f "$REPO_ROOT/styles/op2.css" ]]; then
  echo ""
  echo "Compilando o CSS pela primeira vez..."
  (cd "$REPO_ROOT" && npm run build:css)
fi

cat <<MSG

Pronto.

  1. Reinicie o Foundry VTT.
  2. Ative "Hot Reload" em Configurações → Configurar Aplicação.
  3. Crie um mundo com o sistema "Ordem Paranormal 2 — Playtest (Não-Oficial)".
  4. Em outro terminal: npm run watch:css

Para testar no Foundry v13, use uma instalação separada com User Data próprio:

  FOUNDRY_DATA="\$HOME/FoundryV13/Data" npm run setup

Nunca abra o mesmo mundo no v13 e no v14 — a migração do v14 é irreversível.
MSG
