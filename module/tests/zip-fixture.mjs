import { deflateRawSync } from "node:zlib";
import { crc32 } from "../ui/zip.mjs";

/**
 * Monta um zip de verdade em memória, com cabeçalhos locais, diretório central e o
 * registro de fim — o mesmo formato que o pacote da editora usa. Assim o teste cobre o
 * leitor inteiro, não um mock dele.
 * @param {Array<{nome: string, conteudo: Uint8Array, guardar?: boolean}>} arquivos
 * @param {string} [comentario]
 */
export function montarZip(arquivos, comentario = "") {
  const codificador = new TextEncoder();
  const partes = [];
  const centrais = [];
  let offset = 0;

  const u16 = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
  const u32 = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
  const juntar = (pedacos) => {
    const total = pedacos.reduce((n, p) => n + p.length, 0);
    const saida = new Uint8Array(total);
    let i = 0;
    for (const p of pedacos) { saida.set(p, i); i += p.length; }
    return saida;
  };

  for (const { nome, conteudo, guardar } of arquivos) {
    const nomeBytes = codificador.encode(nome);
    const dados = guardar ? conteudo : new Uint8Array(deflateRawSync(conteudo));
    const metodo = guardar ? 0 : 8;
    const crc = crc32(conteudo);
    const local = juntar([
      u32(0x04034b50), u16(20), u16(0x800), u16(metodo), u16(0), u16(0),
      u32(crc), u32(dados.length), u32(conteudo.length), u16(nomeBytes.length), u16(0),
      nomeBytes, dados,
    ]);
    centrais.push(juntar([
      u32(0x02014b50), u16(20), u16(20), u16(0x800), u16(metodo), u16(0), u16(0),
      u32(crc), u32(dados.length), u32(conteudo.length), u16(nomeBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nomeBytes,
    ]));
    partes.push(local);
    offset += local.length;
  }
  const diretorio = juntar(centrais);
  const comentarioBytes = codificador.encode(comentario);
  const eocd = juntar([
    u32(0x06054b50), u16(0), u16(0), u16(arquivos.length), u16(arquivos.length),
    u32(diretorio.length), u32(offset), u16(comentarioBytes.length), comentarioBytes,
  ]);
  const tudo = juntar([...partes, diretorio, eocd]);
  return tudo.buffer.slice(tudo.byteOffset, tudo.byteOffset + tudo.byteLength);
}

