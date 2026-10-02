// Punta a punta del servidor: secreto compartido y la conversion que usa la
// Herramienta (POST /api/convert/image-to-pdf, metodo pdf-lib).
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

const CLAVE = 'clave-de-prueba';

function puertoLibre() {
  return new Promise((ok) => {
    const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => ok(p)); });
  });
}

test('servidor: X-API-Key obligatoria y conversion de imagen a PDF', async (t) => {
  const port = await puertoLibre();
  const hijo = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), CONVERSOR_API_KEY: CLAVE, TEMP_DIR: path.join(os.tmpdir(), 'conversor-test') },
    stdio: 'ignore'
  });
  t.after(() => hijo.kill());
  const base = `http://127.0.0.1:${port}`;

  // Espera a que arranque (hasta 30 s: en una maquina cargada tarda)
  let salud;
  for (let i = 0; i < 300 && !salud; i++) {
    try { salud = await fetch(`${base}/health`); } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  assert.ok(salud, 'el servidor no arranco en 30 s');
  assert.equal(salud.status, 200, '/health sin clave responde 200');

  const jpg = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 40, b: 40 } } }).jpeg().toBuffer();
  const enviar = (headers) => {
    const form = new FormData();
    form.append('image', new Blob([jpg], { type: 'image/jpeg' }), 'image.jpg');
    return fetch(`${base}/api/convert/image-to-pdf`, { method: 'POST', headers, body: form });
  };

  assert.equal((await enviar({})).status, 401, 'sin X-API-Key');
  assert.equal((await enviar({ 'X-API-Key': 'mala' })).status, 401, 'X-API-Key incorrecta');
  assert.equal((await fetch(`${base}/api/stats`)).status, 401, '/api/stats tambien pide clave');

  const ok = await enviar({ 'X-API-Key': CLAVE });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('content-type'), 'application/pdf');
  const pdf = await PDFDocument.load(Buffer.from(await ok.arrayBuffer()));
  assert.equal(pdf.getPageCount(), 1);
});
