// =============================================
// CONFIGURACIÓN - CONVERSOR PDF
// =============================================

const config = {
  port: process.env.PORT || 3004,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Configuración de iLovePDF
  ilovepdf: {
    publicKey: process.env.ILOVEPDF_PUBLIC_KEY,
    secretKey: process.env.ILOVEPDF_SECRET_KEY
  },

  // Configuración de conversión
  conversion: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB) || 10,
    defaultMethod: process.env.DEFAULT_CONVERSION_METHOD || 'puppeteer',
    enableFallback: process.env.ENABLE_FALLBACK !== 'false',
    tempDir: process.env.TEMP_DIR || '/tmp/pdf-converter'
  },

  // Configuración de Puppeteer
  puppeteer: {
    headless: process.env.PUPPETEER_HEADLESS || 'new',
    timeout: parseInt(process.env.PUPPETEER_TIMEOUT) || 60000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      // Sin --no-zygote ni --single-process: con Chrome >= 154 (lo que instala
      // hoy el Dockerfile) el navegador se cierra al arrancar ("Target closed")
      '--disable-gpu'
    ]
  },

  // URL del constructor de documentos
  constructorUrl: process.env.CONSTRUCTOR_DOCUMENTOS_URL || 'http://localhost:3003',
  // Secreto del constructor (cabecera X-API-Key) para /convert/from-url y /generate-and-convert
  constructorApiKey: process.env.CONSTRUCTOR_API_KEY || ''
};

module.exports = config;