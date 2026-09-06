/**
 * O PDF do mestre, lido no navegador com o pdf.js que o próprio Foundry embarca. O
 * arquivo não sai da máquina dele: vira linhas de texto em colunas
 * (`module/extrator/grade.mjs`) e é isso que os extratores leem.
 */
import { documentoEmLinhas } from "../extrator/grade.mjs";

const PDFJS = "/scripts/pdfjs/build/pdf.mjs";
const TRABALHADOR = "/scripts/pdfjs/build/pdf.worker.mjs";

/**
 * @param {File|Blob} arquivo
 * @param {(pagina: number, total: number) => void} [aoProgredir]
 * @returns {Promise<string[]>} as linhas do documento inteiro
 */
export async function linhasDoPdf(arquivo, aoProgredir = () => {}) {
  const { getDocument, GlobalWorkerOptions } = await import(/* webpackIgnore: true */ PDFJS);
  // `??=` não servia: o pdf.js nasce com `workerSrc` string vazia, não nula, e a
  // leitura morria em "No GlobalWorkerOptions.workerSrc specified" (achado no teste).
  if (!GlobalWorkerOptions.workerSrc) GlobalWorkerOptions.workerSrc = TRABALHADOR;
  const pdf = await getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  try {
    return await documentoEmLinhas(pdf, aoProgredir);
  } finally {
    await pdf.destroy();
  }
}
