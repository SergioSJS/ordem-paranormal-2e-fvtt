#!/usr/bin/env sh
# Imprime as notas de uma versão a partir do CHANGELOG.md: a seção `## [X.Y.Z]` até a
# próxima, mais a linha de instalação. É o corpo da release no GitHub — antes ele era o
# assunto do commit da tag, que não diz nada (achado em uso real: "se isso for um
# release note eu sou um pato").
#   uso: scripts/release/notas-da-versao.sh vX.Y.Z [dono/repo] > notas.md
set -eu
TAG="$1"
REPO="${2:-SergioSJS/ordem-paranormal-2e-fvtt}"
VERSAO="${TAG#v}"
SECAO=$(awk -v v="$VERSAO" '
  $0 ~ "^## \\[" v "\\]" { f = 1; next }
  /^## \[/ { f = 0 }
  f' CHANGELOG.md | sed -e '/./,$!d' | sed -e ':a' -e '/^\n*$/{$d;N;ba' -e '}')
if [ -z "$SECAO" ]; then
  SECAO="Sem seção própria no CHANGELOG. Veja https://github.com/${REPO}/blob/main/CHANGELOG.md."
fi
printf '%s\n\n---\n\n' "$SECAO"
printf '**Instalar ou atualizar:** em *Sistemas de jogo → Instalar sistema*, cole o manifesto\n'
printf '`https://github.com/%s/releases/latest/download/system.json`. Esta versão, fixa:\n' "$REPO"
printf '`https://github.com/%s/releases/download/%s/system.json`.\n' "$REPO" "$TAG"
