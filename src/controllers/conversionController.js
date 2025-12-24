// =============================================
// CONTROLADOR DE CONVERSIÓN - CONVERSOR PDF SUMATE
// =============================================

const express = require('express');
const multer = require('multer');
const axios = require('axios');
const excelToPdfService = require('../services/excelToPdfService');
const wordToPdfService = require('../services/wordToPdfService');
const imageToPdfService = require('../services/imageToPdfService');
const config = require('../config/config');

const router = express.Router();

// Configurar multer
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.conversion.maxFileSizeMB * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/tiff',
      'image/gif',
      'image/bmp',
      'image/svg+xml'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no soportado'), false);
    }
  }
});

/**
 * Convertir Excel a PDF
 * POST /api/convert/excel-to-pdf
 */
router.post('/convert/excel-to-pdf', upload.single('file'), async (req, res) => {
  try {
    console.log('[CONTROLLER] 📊 Solicitud de conversión Excel a PDF');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Archivo Excel requerido'
      });
    }

    const options = {
      fileName: req.body.fileName || req.file.originalname.replace(/\.[^/.]+$/, ''),
      method: req.body.method || req.query.method,
      enableFallback: req.body.enableFallback !== 'false'
    };

    const result = await excelToPdfService.convert(req.file.buffer, options);

    if (result.success) {
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.setHeader('X-Conversion-Method', result.method);
      res.send(result.buffer);
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('[CONTROLLER] ❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Convertir Word a PDF
 * POST /api/convert/word-to-pdf
 */
router.post('/convert/word-to-pdf', upload.single('file'), async (req, res) => {
  try {
    console.log('[CONTROLLER] 📝 Solicitud de conversión Word a PDF');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Archivo Word requerido'
      });
    }

    const options = {
      fileName: req.body.fileName || req.file.originalname.replace(/\.[^/.]+$/, ''),
      format: req.body.format || 'pdf'
    };

    const result = await wordToPdfService.convert(req.file.buffer, options);

    if (result.success) {
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.setHeader('X-Conversion-Method', result.method);
      res.send(result.buffer);
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('[CONTROLLER] ❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Convertir archivo automáticamente (detectar tipo)
 * POST /api/convert/file
 */
router.post('/convert/file', upload.single('file'), async (req, res) => {
  try {
    console.log('[CONTROLLER] 📄 Solicitud de conversión automática');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Archivo requerido'
      });
    }

    const isExcel = req.file.mimetype.includes('spreadsheet') ||
                    req.file.mimetype.includes('excel');
    const isWord = req.file.mimetype.includes('word') ||
                   req.file.mimetype.includes('document');

    let result;
    const options = {
      fileName: req.body.fileName || req.file.originalname.replace(/\.[^/.]+$/, ''),
      method: req.body.method || req.query.method,
      enableFallback: req.body.enableFallback !== 'false'
    };

    if (isExcel) {
      console.log('[CONTROLLER] Detectado como Excel');
      result = await excelToPdfService.convert(req.file.buffer, options);
    } else if (isWord) {
      console.log('[CONTROLLER] Detectado como Word');
      result = await wordToPdfService.convert(req.file.buffer, options);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Tipo de archivo no soportado'
      });
    }

    if (result.success) {
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.setHeader('X-Conversion-Method', result.method);
      res.send(result.buffer);
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('[CONTROLLER] ❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Convertir desde URL (integración con constructor-de-documentos)
 * POST /api/convert/from-url
 */
router.post('/convert/from-url', async (req, res) => {
  try {
    console.log('[CONTROLLER] 🌐 Solicitud de conversión desde URL');

    const { url, data, format = 'general', outputFormat = 'pdf' } = req.body;

    if (!url && !data) {
      return res.status(400).json({
        success: false,
        error: 'URL o datos requeridos'
      });
    }

    let fileBuffer;
    let fileType = 'excel'; // Por defecto asumimos Excel

    // Si se proporciona URL, descargar el archivo
    if (url) {
      console.log(`[CONTROLLER] Descargando desde: ${url}`);
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });

      fileBuffer = Buffer.from(response.data);

      // Detectar tipo por headers
      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('word')) {
        fileType = 'word';
      }
    }

    // Si se proporcionan datos, llamar al constructor de documentos
    if (data && !url) {
      console.log(`[CONTROLLER] Generando documento con formato: ${format}`);

      const constructorUrl = `${config.constructorUrl}/webhook/${format}`;
      const response = await axios.post(constructorUrl, data, {
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      fileBuffer = Buffer.from(response.data);
    }

    // Convertir a PDF
    let result;
    const options = {
      fileName: req.body.fileName || `documento_${format}`,
      method: req.body.method || req.query.method,
      enableFallback: req.body.enableFallback !== 'false'
    };

    if (fileType === 'excel') {
      result = await excelToPdfService.convert(fileBuffer, options);
    } else {
      result = await wordToPdfService.convert(fileBuffer, options);
    }

    if (result.success) {
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.setHeader('X-Conversion-Method', result.method);
      res.send(result.buffer);
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('[CONTROLLER] ❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || error.message
    });
  }
});

/**
 * Endpoint integrado: Generar documento y convertir a PDF
 * POST /api/generate-and-convert
 */
router.post('/generate-and-convert', async (req, res) => {
  try {
    console.log('[CONTROLLER] 🚀 Generar documento y convertir a PDF');

    const { data, formato = 'general', method = 'puppeteer' } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Datos requeridos para generar documento'
      });
    }

    // Paso 1: Generar documento Excel
    console.log(`[CONTROLLER] Generando documento Excel formato: ${formato}`);
    const constructorUrl = `${config.constructorUrl}/webhook/${formato}`;

    const excelResponse = await axios.post(constructorUrl, data, {
      responseType: 'arraybuffer',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const excelBuffer = Buffer.from(excelResponse.data);

    // Paso 2: Convertir a PDF
    console.log(`[CONTROLLER] Convirtiendo a PDF con método: ${method}`);
    const result = await excelToPdfService.convert(excelBuffer, {
      fileName: `${formato}_${new Date().getTime()}`,
      method: method,
      enableFallback: true
    });

    if (result.success) {
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.setHeader('X-Conversion-Method', result.method);
      res.setHeader('X-Document-Format', formato);
      res.send(result.buffer);
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('[CONTROLLER] ❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || error.message
    });
  }
});

/**
 * Convertir imágenes a PDF
 * POST /api/convert/images-to-pdf
 */
router.post('/convert/images-to-pdf', upload.array('images', 20), async (req, res) => {
  try {
    console.log('[CONTROLLER] 📸 Solicitud de conversión de imágenes a PDF');

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Al menos una imagen es requerida'
      });
    }

    console.log(`[CONTROLLER] Procesando ${req.files.length} imagen(es)`);

    const imageBuffers = req.files.map(file => file.buffer);

    const options = {
      fileName: req.body.fileName || 'imagenes',
      method: req.body.method || req.query.method || 'pdf-lib',
      pageSize: req.body.pageSize || 'A4',
      orientation: req.body.orientation || 'portrait',
      margin: parseInt(req.body.margin) || 20,
      quality: parseInt(req.body.quality) || 90,
      fit: req.body.fit || 'contain'
    };

    const result = await imageToPdfService.convert(imageBuffers, options);

    if (result.success) {
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.setHeader('X-Conversion-Method', result.method);
      res.setHeader('X-Total-Pages', result.pages || 1);
      res.send(result.buffer);
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('[CONTROLLER] ❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Convertir imagen única a PDF
 * POST /api/convert/image-to-pdf
 */
router.post('/convert/image-to-pdf', upload.single('image'), async (req, res) => {
  try {
    console.log('[CONTROLLER] 🖼️ Solicitud de conversión de imagen a PDF');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Imagen requerida'
      });
    }

    const options = {
      fileName: req.body.fileName || req.file.originalname.replace(/\.[^/.]+$/, ''),
      method: req.body.method || req.query.method || 'pdf-lib',
      pageSize: req.body.pageSize || 'A4',
      orientation: req.body.orientation || 'portrait',
      margin: parseInt(req.body.margin) || 20,
      quality: parseInt(req.body.quality) || 90,
      fit: req.body.fit || 'contain'
    };

    const result = await imageToPdfService.convert([req.file.buffer], options);

    if (result.success) {
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.setHeader('X-Conversion-Method', result.method);
      res.send(result.buffer);
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('[CONTROLLER] ❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Crear collage de imágenes en PDF
 * POST /api/convert/images-collage
 */
router.post('/convert/images-collage', upload.array('images', 50), async (req, res) => {
  try {
    console.log('[CONTROLLER] 🎨 Solicitud de collage de imágenes');

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Al menos una imagen es requerida para el collage'
      });
    }

    console.log(`[CONTROLLER] Creando collage con ${req.files.length} imagen(es)`);

    const imageBuffers = req.files.map(file => file.buffer);

    const options = {
      columns: parseInt(req.body.columns) || 2,
      rows: parseInt(req.body.rows) || 2,
      spacing: parseInt(req.body.spacing) || 10,
      pageSize: req.body.pageSize || 'A4',
      orientation: req.body.orientation || 'portrait',
      margin: parseInt(req.body.margin) || 20,
      backgroundColor: req.body.backgroundColor || '#FFFFFF'
    };

    const result = await imageToPdfService.createCollage(imageBuffers, options);

    if (result.success) {
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.setHeader('X-Conversion-Method', result.method);
      res.setHeader('X-Total-Pages', result.pages || 1);
      res.send(result.buffer);
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('[CONTROLLER] ❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Convertir desde URLs de imágenes
 * POST /api/convert/images-from-urls
 */
router.post('/convert/images-from-urls', async (req, res) => {
  try {
    console.log('[CONTROLLER] 🌐 Solicitud de conversión desde URLs de imágenes');

    const { urls, ...options } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array de URLs requerido'
      });
    }

    console.log(`[CONTROLLER] Descargando ${urls.length} imagen(es)`);

    // Descargar imágenes
    const imageBuffers = [];
    for (const url of urls) {
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 10000
        });
        imageBuffers.push(Buffer.from(response.data));
      } catch (error) {
        console.error(`[CONTROLLER] ⚠️ Error descargando ${url}:`, error.message);
      }
    }

    if (imageBuffers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se pudieron descargar las imágenes'
      });
    }

    const result = await imageToPdfService.convert(imageBuffers, {
      fileName: options.fileName || 'imagenes_desde_urls',
      method: options.method || 'pdf-lib',
      pageSize: options.pageSize || 'A4',
      orientation: options.orientation || 'portrait',
      margin: options.margin || 20,
      quality: options.quality || 90,
      fit: options.fit || 'contain'
    });

    if (result.success) {
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.setHeader('X-Conversion-Method', result.method);
      res.setHeader('X-Total-Pages', result.pages || 1);
      res.send(result.buffer);
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('[CONTROLLER] ❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;