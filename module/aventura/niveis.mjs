/**
 * Níveis de cena (Foundry v14) na importação de aventura.
 *
 * Parede, luz, som, nota e token levam `levels: [id]`, e um documento preso a um nível
 * que a cena não tem some do mapa. Dois jeitos de isso acontecer na importação:
 *
 * 1. A cena já existe no mundo (reimportação) com um nível de id X — o servidor cria o
 *    `defaultLevel0000` quando a cena chega sem níveis, e o mestre está vendo por ele —
 *    e a cena que chega traz o nível com id Y. O update troca X por Y por baixo da cena
 *    aberta: o canvas ainda aponta para X e o Foundry quebra em `SceneLevel#isVisible`
 *    ("reading 'visibility'"), além de deixar as paredes presas a X invisíveis.
 * 2. A cena que chega traz paredes presas a um id que nem está nos níveis dela (o id do
 *    mundo de quem capturou a cena).
 *
 * Aqui a cena que chega passa a usar os ids de nível da cena que já existe (por
 * posição), e toda referência a nível inexistente vai para o primeiro nível. Puro:
 * altera os dados crus no lugar e devolve o que mudou.
 */
const EMBUTIDOS = ["walls", "lights", "sounds", "tiles", "drawings", "regions", "templates", "notes", "tokens"];

/**
 * @param {object} cena  Dados crus da cena que chega (alterados no lugar).
 * @param {string[]} [niveisExistentes]  Ids dos níveis da cena que já existe no mundo, em ordem.
 * @returns {{ niveis: number, referencias: number }}  Quantos ids de nível e quantas referências mudaram.
 */
export function alinharNiveis(cena, niveisExistentes = []) {
  const niveis = Array.isArray(cena.levels) ? cena.levels : [];
  const mapa = new Map();
  let renomeados = 0;
  niveis.forEach((nivel, i) => {
    const alvo = niveisExistentes[i] ?? nivel._id;
    if (alvo !== nivel._id) renomeados += 1;
    mapa.set(nivel._id, alvo);
    nivel._id = alvo;
  });
  // Sem níveis na cena que chega: o servidor sintetiza um; referência a nível vira "todos".
  const validos = new Set(niveis.map((n) => n._id));
  const primeiro = niveis[0]?._id ?? null;
  const resolver = (id) => mapa.get(id) ?? (validos.has(id) ? id : primeiro);
  let referencias = 0;
  for (const colecao of EMBUTIDOS) {
    for (const doc of cena[colecao] ?? []) {
      if (!Array.isArray(doc.levels) || !doc.levels.length) continue;
      const novos = [...new Set(doc.levels.map(resolver).filter(Boolean))];
      if (novos.length !== doc.levels.length || novos.some((id, i) => id !== doc.levels[i])) referencias += 1;
      doc.levels = novos;
    }
  }
  if (typeof cena.initialLevel === "string" && cena.initialLevel && !validos.has(cena.initialLevel)) {
    cena.initialLevel = resolver(cena.initialLevel);
  }
  return { niveis: renomeados, referencias };
}
