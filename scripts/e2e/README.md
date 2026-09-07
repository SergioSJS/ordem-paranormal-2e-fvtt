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

> **Um Foundry por vez.** O harness aponta um symlink para este repositório, então o
> Foundry descartável abre os MESMOS bancos de `packs/`. LevelDB aceita um processo só:
> com o harness no ar, o seu Foundry sobe o mundo **sem compêndio nenhum** — sem erro,
> eles simplesmente não aparecem. Mate o harness antes de abrir o app:
>
> ```bash
> pkill -f "port=30099"
> lsof packs/*/LOCK   # tem que sair vazio
> ```
>
> Se os dois abrirem o mesmo banco, ele **fica quebrado para os dois**: o log do
> servidor mostra `Failed to connect to database "…"`, o Foundry tenta reparar e o
> mundo sobe sem compêndio. Conserto: mate os dois, rode `npm run pack:build` (ele
> recria cada banco a partir de `packs/sources/`) e suba um só. A suíte falha logo no
> começo, com o nome dos compêndios que não carregaram, em vez de morrer lá na frente.

> **Reinicie o servidor entre rodadas.** O Foundry marca como indisponível quem já está
> conectado, e a sessão do run anterior fica de pé um tempo: a rodada seguinte trava na
> tela de entrada com "option being selected is not enabled". Um `pkill` e um start
> novo resolvem — foi o que custou duas rodadas aqui.
>
> A tela de entrada monta a lista de usuários por JavaScript, então esperar por
> `name="userid"` com `curl` nunca casa. Espere o servidor responder em `/join` e
> deixe o Playwright esperar pelo seletor.

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

> **`"active": false` e o log dizendo `Software license verification failed`?** A
> assinatura da licença leva o hostname da máquina, e o macOS o troca de vez em quando
> ("MacBook-Pro-de-…" vira "MBP-de-…"). O servidor sobe pedindo o aceite da EULA e não
> ativa o mundo. O harness detecta, aceita a EULA na cópia descartável (reassina só ela,
> com internet) e pede para reiniciar o servidor. O seu Foundry vai pedir o mesmo aceite
> na próxima abertura.

### Com o seu Foundry aberto

O seu app segura o `LOCK` dos bancos de `packs/`; o descartável sobe **sem compêndio
nenhum** e o e2e quebra em `game.packs.get(...)` — ou trava em lugares estranhos. Sem
fechar o app, aponte o symlink para uma cópia do repositório (os LevelDB da cópia são
outros arquivos):

```bash
rsync -a --delete --exclude node_modules --exclude .git --exclude "packs/*/LOCK" ./ /tmp/op2-sistema-copia/
ln -sfn /tmp/op2-sistema-copia "$DATA/Data/systems/ordem-paranormal-2e"
```

Refaça o `rsync` a cada mudança no código antes de rodar. Para voltar ao normal:
`ln -sfn "$PWD" "$DATA/Data/systems/ordem-paranormal-2e"`.

## Rodando

```bash
node scripts/e2e/verificar.mjs http://localhost:30099 /tmp
```

Sai com código 1 se alguma verificação falhar ou se houver erro no console do browser.
Grava `e2e-foundry.png` na pasta de saída.

O relatório só sai no fim (uns 5 minutos). No meio, a cada 90 s, o harness escreve em
stderr um sinal de vida — `[e2e 180s] print ok; janelas: …; console: …` — e um print
do estado em `e2e-andamento.png` na pasta de saída. **Silêncio por mais de 90 s é
travamento**, não lentidão: um diálogo aberto prende o `page.evaluate` para sempre.
Olhe o print e a lista de janelas para achar o diálogo; se o print "trava", a página
está presa em JS.

Com `docs/Ordem-2-Playtest-Alpha-Ato-II-Extras.zip` presente, o harness também importa
o Ato II pelo caminho de verdade: entrega o zip ao importador pelo `<input type=file>`,
espera o upload, e confere no mundo os caminhos, os arquivos servidos, o laser e o
rádio. Aponte `OP2_E2E_DATA` para o User Data descartável para ele zerar
`worlds/<mundo>/ato-ii/` antes e exercitar o upload a cada execução:

```bash
OP2_E2E_DATA="$DATA" node scripts/e2e/verificar.mjs http://localhost:30099 /tmp
```

## Testando no v13

Mesmo procedimento, com a build v13 e um `dataPath` **próprio**. Nunca abra o mesmo
mundo nas duas versões: a migração do v14 é irreversível.
