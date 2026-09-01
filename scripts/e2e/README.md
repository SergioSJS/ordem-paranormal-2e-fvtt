# Verificação de ponta a ponta

Sobe o sistema num Foundry de verdade e confere o que os testes offline não alcançam.

Foi este harness que encontrou:

- o sanitizador do chat removendo `<svg>` dos cards — só o número sobrevivia;
- `{{actor.name}}` vazio na ficha, porque o contexto do `DocumentSheetV2` traz
  `document`, não `actor`;
- `{{formInput}}` reclamando de campo inexistente, sem `fields` no contexto;
- o hook `renderChatMessage` avisando depreciação a cada mensagem;
- as aptidões padrão nunca criadas, porque `migrateData` não roda na criação;
- nomes de atributo cortados no layout em inglês;
- o `evento.currentTarget` nulo após o primeiro `await` nos botões de chat — foi a
  sobrecarga mental, com rolagem mais lenta, que expôs o erro.

Nenhum desses aparece em `npm test`.

## Pré-requisitos

- **Node 24** para rodar o servidor do Foundry (o `npm test` do projeto roda em 22+).
  `nvm install 24` resolve.
- **A build de Node do Foundry.** O `.app` do macOS é Electron e não sobe headless —
  ele tenta abrir uma janela e falha com `Cannot read properties of undefined (reading 'dock')`.
  Os arquivos do servidor ficam em
  `/Applications/Foundry Virtual Tabletop.app/Contents/Resources/app` e rodam com Node.
- `npm i -D playwright` (não é dependência do sistema, só do harness).

## Subindo um Foundry descartável

Nunca aponte para o seu User Data de trabalho: use um separado.

```bash
FVTT_APP="/Applications/Foundry Virtual Tabletop.app/Contents/Resources/app"
DATA=/tmp/fvtt-e2e
NODE24="$HOME/.nvm/versions/node/v24.20.0/bin/node"

mkdir -p "$DATA/Data/systems" "$DATA/Config"
ln -sfn "$PWD" "$DATA/Data/systems/ordem-paranormal-2e"

# A licença é a sua, já assinada nesta máquina.
cp "$HOME/Library/Application Support/FoundryVTT/Config/license.json" "$DATA/Config/"

# Um mundo é só uma pasta com world.json — mais previsível que dirigir a UI de setup.
mkdir -p "$DATA/Data/worlds/op2-teste"
cat > "$DATA/Data/worlds/op2-teste/world.json" <<'JSON'
{ "id": "op2-teste", "title": "OP2 Teste", "system": "ordem-paranormal-2e",
  "coreVersion": "14.363", "systemVersion": "0.0.1" }
JSON

(cd "$FVTT_APP" && "$NODE24" main.mjs --dataPath="$DATA" --port=30099 --headless --noupnp --world=op2-teste) &
```

`curl -s localhost:30099/api/status` deve responder com `"system":"ordem-paranormal-2e"`.

## Rodando

```bash
node scripts/e2e/verificar.mjs http://localhost:30099 /tmp
```

Sai com código 1 se alguma verificação falhar ou se houver erro no console do browser.
Grava `e2e-foundry.png` na pasta de saída.

## Testando no v13

Mesmo procedimento, com a build v13 e um `dataPath` **próprio**. Nunca abra o mesmo
mundo nas duas versões: a migração do v14 é irreversível.
