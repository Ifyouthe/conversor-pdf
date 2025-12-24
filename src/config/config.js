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
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  },

  // URL del constructor de documentos
  constructorUrl: process.env.CONSTRUCTOR_DOCUMENTOS_URL || 'http://localhost:3003'
};

module.exports = config;