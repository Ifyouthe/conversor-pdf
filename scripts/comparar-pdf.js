#!/usr/bin/env node
// =============================================
// Compara dos PDFs ignorando solo los metadatos (CreationDate y ModDate del
// diccionario Info, que cambian en cada conversion). Carga los dos con
// pdf-lib, fija esas fechas al mismo valor y los vuelve a serializar igual;
// si los bytes coinciden, el contenido (paginas, imagenes, tamanos) es el mismo.
//
// Uso: node scripts/comparar-pdf.js a.pdf b.pdf [c.pdf d.pdf ...]
// Sale con 1 si algun par difiere.
// =============================================

const fs = require('fs');
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');

const FECHA_FIJA = new Date('2000-01-01T00:00:00Z');

async function normalizar(ruta) {
  const pdf = await PDFDocument.load(fs.readFileSync(ruta), { updateMetadata: false });
  pdf.setCreationDate(FECHA_FIJA);
  pdf.setModificationDate(FECHA_FIJA);
  const bytes = Buffer.from(await pdf.save({ useObjectStreams: false, updateFieldAppearances: false }));
  return { bytes, paginas: pdf.getPageCount(), tamanos: pdf.getPages().map((p) => p.getSize()) };
}

async function main() {
  const archivos = process.argv.slice(2);
  if (archivos.length < 2 || archivos.length % 2) {
    console.error('Uso: comparar-pdf.js a1 b1 [a2 b2 ...]');
    process.exit(2);
  }
  let distintos = 0;
  for (let i = 0; i < archivos.length; i += 2) {
    const [a, b] = [archivos[i], archivos[i + 1]];
    const na = await normalizar(a);
    const nb = await normalizar(b);
    const igual = na.bytes.equals(nb.bytes);
    const huella = crypto.createHash('sha256').update(na.bytes).digest('hex').slice(0, 12);
    if (!igual) distintos++;
    console.log(`${igual ? 'IGUAL   ' : 'DISTINTO'}  ${a} vs ${b} (${na.paginas} vs ${nb.paginas} paginas, ${JSON.stringify(na.tamanos[0])}; normalizado ${huella})`);
  }
  process.exit(distintos ? 1 : 0);
}

main().catch((e) => {
  console.error(`ERROR: ${e.message}`);
  process.exit(2);
});
