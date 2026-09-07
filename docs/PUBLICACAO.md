# Publicação na listagem do Foundry

Como o sistema chega à listagem oficial (foundryvtt.com/packages) e como cada versão
nova é registrada depois. O que o repositório já faz sozinho está marcado.

## Antes de submeter — checklist (feito)

- [x] Manifesto completo: `id`, `title`, `description`, `version`, `authors`, `url`,
      `manifest` (URL estável: `releases/latest/download/system.json`) e `download`
      (fixado por versão) — os dois injetados pelo release, não vivem no repositório
      (senão o Foundry oferece "Update" para a cópia de desenvolvimento e a
      sobrescreve), `compatibility` (`minimum: 13`,
      `verified: 14`), `license`, `readme`, `changelog`, `bugs`, `media` (`setup`,
      `cover`, `screenshot`), `socket`, `languages`.
- [x] Release pública com zip + `system.json` (workflow `release.yml`); instalar pelo
      manifest URL funciona no v13 e no v14 (testado).
- [x] Nenhum texto nem imagem do livro no pacote; selo e aviso da Licença da
      Comunidade; aviso de material com IA; LGPD (nada sai da máquina).
- [x] Código GPL-3.0; fontes OFL; ícones próprios.
- [x] Prints e capa sem arte da editora.
- [x] Política de IA do Foundry: código com auxílio de IA, textos do autor (revisados).

## Submeter (uma vez, à mão)

1. Entre em foundryvtt.com com a conta que tem a licença e abra
   **https://foundryvtt.com/creators/submit/** ("Package Submission Form").
2. Preencha: tipo **Game System**; `id` **ordem-paranormal-2e** (igual ao manifesto);
   título **Ordem Paranormal 2 — Playtest (Não-Oficial)**; **Summary** (uma frase, sem
   repetir o título) e **Description** (até 600 caracteres, com não-oficial, Licença da
   Comunidade e o aviso de IA); **Package URL** = o repositório
   **https://github.com/SergioSJS/ordem-paranormal-2e-fvtt** (o manifesto NÃO vai aqui);
   **Required Game Systems** vazio (somos o sistema); tags: Actor and Item Sheets,
   Adventures, Content Importers, Dice Rolling, Journals and Notes — nunca "AI Tools"
   nem "Contains Zero AI". As imagens vêm do `media` do manifesto, não do formulário.
3. **Add Version**: número `X.Y.Z`; **Package Manifest URL** fixo da versão
   (`https://github.com/SergioSJS/ordem-paranormal-2e-fvtt/releases/download/vX.Y.Z/system.json`,
   não o `latest`); Release Notes URL = a página da release no GitHub; Minimum Core
   `13`; Verified Core `14`; Maximum vazio.
4. Onde perguntar sobre direitos de terceiros: declare que o sistema usa nomes e regras
   de Ordem Paranormal RPG sob a **Licença da Comunidade** (link), sem texto nem arte
   dos livros; as artes vêm de zips que o próprio mestre baixa da editora.
5. **Generative AI Content Declaration** (até 600 caracteres, em inglês): código com
   auxílio de IA, revisado e mantido pelo autor; textos do autor; sem regra, lore, arte ou
   áudio gerados por IA; nada do livro no pacote; "Not Zero AI".
6. Envie. A revisão é manual (dias). Se pedirem ajuste, é pelo e-mail da conta.

## Depois da aprovação — cada versão nova

A listagem **não** lê o manifesto sozinha: cada versão precisa ser registrada. O
workflow já faz isso quando o segredo existe:

1. Na página do pacote (logado), copie o **Package Release Token** (campo acima de
   "Save Package").
2. No GitHub: Settings → Secrets and variables → Actions → **New repository secret**
   `FOUNDRY_RELEASE_TOKEN` com o token.
3. A partir daí, `git tag vX.Y.Z && git push origin vX.Y.Z` e
   `gh workflow run release.yml -f tag=vX.Y.Z` publicam o zip no GitHub **e** registram a
   versão no Foundry (Package Release API), com o manifesto fixo daquela versão e a
   compatibilidade do `system.json`.

Sem o segredo, o passo é pulado e a versão pode ser adicionada à mão na página do
pacote (Versions → manifest URL da versão).

## Regras de versão

- SemVer. `verified` sobe quando uma build nova do Foundry for exercitada pelo e2e.
- O `manifest` do `system.json` no repositório fica em `latest`; o que vai para a API
  é sempre `releases/download/vX.Y.Z/system.json`.
