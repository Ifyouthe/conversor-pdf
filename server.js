// =============================================
// CONVERSOR PDF SUMATE - Microservicio
// Conversión de documentos a PDF
// =============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Importar servicios
const excelToPdfService = require('./src/services/excelToPdfService');
const wordToPdfService = require('./src/services/wordToPdfService');
const conversionController = require('./src/controllers/conversionController');

const app = express();
const PORT = process.env.PORT || 3004;

// Configurar trust proxy para Traefik
app.set('trust proxy', true);

console.log('========================================');
console.log('🎯 INICIANDO CONVERSOR PDF SUMATE');
console.log('📄 Microservicio de Conversión a PDF');
console.log(`🔍 Puerto: ${PORT}`);
console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔧 Método preferido: ${process.env.DEFAULT_CONVERSION_METHOD || 'puppeteer'}`);
console.log('========================================');

// =============================================
// CONFIGURACIÓN MULTER
// =============================================
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: (process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024 // MB a bytes
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // Excel
      'application/vnd.ms-excel', // Excel antiguo
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // Word
      'application/msword' // Word antiguo
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no soportado. Solo Excel y Word.'), false);
    }
  }
});

// =============================================
// MIDDLEWARES
// =============================================

// Seguridad
app.use(helmet({
  contentSecurityPolicy: false
}));

// CORS
app.use(cors({
  origin: ['https://sumate.evolvedigital.cloud', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3003'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Demasiadas solicitudes, por favor intenta más tarde',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log('[RATE-LIMIT] Límite alcanzado para IP:', req.ip);
    res.status(429).json({
      success: false,
      error: 'Demasiadas solicitudes, por favor intenta más tarde',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =============================================
// RUTAS DE CONVERSIÓN
// =============================================
app.use('/api', conversionController);

// =============================================
// HEALTH CHECK
// =============================================
app.get('/health', (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        puppeteer: 'available',
        ilovepdf: process.env.ILOVEPDF_PUBLIC_KEY ? 'configured' : 'not-configured'
      },
      config: {
        defaultMethod: process.env.DEFAULT_CONVERSION_METHOD || 'puppeteer',
        fallbackEnabled: process.env.ENABLE_FALLBACK !== 'false'
      }
    };

    res.json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// =============================================
// ESTADÍSTICAS
// =============================================
app.get('/api/stats', async (req, res) => {
  try {
    res.json({
      success: true,
      stats: {
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        },
        conversions: {
          total: global.conversionStats?.total || 0,
          successful: global.conversionStats?.successful || 0,
          failed: global.conversionStats?.failed || 0,
          byMethod: global.conversionStats?.byMethod || {}
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas'
    });
  }
});

// =============================================
// MANEJO DE ERRORES
// =============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
    path: req.path,
    method: req.method
  });
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Error procesando solicitud'
  });
});

// =============================================
// INICIALIZACIÓN DEL SERVIDOR
// =============================================
async function startServer() {
  try {
    // Crear directorio temporal si no existe
    const tempDir = process.env.TEMP_DIR || '/tmp/pdf-converter';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log(`📁 Directorio temporal creado: ${tempDir}`);
    }

    // Inicializar estadísticas globales
    global.conversionStats = {
      total: 0,
      successful: 0,
      failed: 0,
      byMethod: {
        puppeteer: 0,
        ilovepdf: 0
      }
    };

    // Limpieza periódica de archivos temporales
    setInterval(() => {
      const tempFiles = fs.readdirSync(tempDir);
      const now = Date.now();
      let cleaned = 0;

      tempFiles.forEach(file => {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        // Eliminar archivos de más de 5 minutos
        if (age > 5 * 60 * 1000) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      });

      if (cleaned > 0) {
        console.log(`[CLEANUP] ${cleaned} archivos temporales eliminados`);
      }
    }, parseInt(process.env.CLEANUP_INTERVAL_MS) || 300000); // 5 minutos

    const server = app.listen(PORT, () => {
      console.log(`🚀 Conversor PDF Sumate ejecutándose en puerto ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📈 Estadísticas: http://localhost:${PORT}/api/stats`);
      console.log(`🔗 Endpoints disponibles:`);
      console.log(`   📊 Excel/Word:`);
      console.log(`   • POST /api/convert/excel-to-pdf - Convertir Excel a PDF`);
      console.log(`   • POST /api/convert/word-to-pdf - Convertir Word a PDF`);
      console.log(`   • POST /api/convert/file - Convertir archivo (auto-detect)`);
      console.log(`   📸 Imágenes:`);
      console.log(`   • POST /api/convert/image-to-pdf - Convertir imagen única a PDF`);
      console.log(`   • POST /api/convert/images-to-pdf - Convertir múltiples imágenes a PDF`);
      console.log(`   • POST /api/convert/images-collage - Crear collage de imágenes`);
      console.log(`   • POST /api/convert/images-from-urls - Convertir desde URLs de imágenes`);
      console.log(`   🔗 Integración:`);
      console.log(`   • POST /api/convert/from-url - Convertir desde URL`);
      console.log(`   • POST /api/generate-and-convert - Generar y convertir`);
      console.log('========================================');
    });

    // Manejo de cierre graceful
    process.on('SIGTERM', () => {
      console.log('[SHUTDOWN] Recibida señal SIGTERM, cerrando servidor...');
      server.close(() => {
        console.log('[SHUTDOWN] Servidor cerrado correctamente');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('[SHUTDOWN] Recibida señal SIGINT, cerrando servidor...');
      server.close(() => {
        console.log('[SHUTDOWN] Servidor cerrado correctamente');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('[STARTUP] ❌ Error iniciando servidor:', error.message);
    process.exit(1);
  }
}

// Iniciar servidor
startServer();