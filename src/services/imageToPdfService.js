// =============================================
// SERVICIO IMAGEN A PDF - CONVERSOR PDF SUMATE
// =============================================

const sharp = require('sharp');
const { PDFDocument, PageSizes, rgb, degrees } = require('pdf-lib');
const ILovePDFApi = require('@ilovepdf/ilovepdf-nodejs');
const ILovePDFFile = require('@ilovepdf/ilovepdf-nodejs/ILovePDFFile');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class ImageToPdfService {
  constructor() {
    // Formatos de imagen soportados
    this.supportedFormats = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/tiff',
      'image/gif',
      'image/bmp',
      'image/svg+xml'
    ];

    // Extensiones soportadas
    this.supportedExtensions = [
      '.jpg', '.jpeg', '.png', '.webp',
      '.tiff', '.tif', '.gif', '.bmp', '.svg'
    ];

    console.log('[IMAGE-TO-PDF] ✅ Servicio inicializado');
  }

  /**
   * Convierte una o múltiples imágenes a PDF
   */
  async convert(images, options = {}) {
    const {
      fileName = 'documento',
      method = 'pdf-lib', // pdf-lib | ilovepdf
      pageSize = 'A4',
      orientation = 'portrait',
      margin = 20,
      quality = 90,
      fit = 'contain', // contain | cover | fill
      backgroundColor = '#FFFFFF'
    } = options;

    console.log(`[IMAGE-TO-PDF] 🚀 Iniciando conversión con método: ${method}`);
    console.log(`[IMAGE-TO-PDF] 📸 Procesando ${images.length} imagen(es)`);

    // Asegurar que images sea un array
    const imageArray = Array.isArray(images) ? images : [images];

    let result;

    try {
      if (method === 'ilovepdf' && config.ilovepdf.publicKey && config.ilovepdf.secretKey) {
        result = await this.convertWithILovePDF(imageArray, fileName, options);
      } else {
        result = await this.convertWithPDFLib(imageArray, fileName, options);
      }

      // Actualizar estadísticas
      if (global.conversionStats) {
        global.conversionStats.total++;
        if (result.success) {
          global.conversionStats.successful++;
          if (!global.conversionStats.byMethod.images) {
            global.conversionStats.byMethod.images = 0;
          }
          global.conversionStats.byMethod.images++;
        } else {
          global.conversionStats.failed++;
        }
      }

      return result;

    } catch (error) {
      console.error('[IMAGE-TO-PDF] ❌ Error en conversión:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Conversión usando pdf-lib (método principal)
   */
  async convertWithPDFLib(images, fileName, options) {
    try {
      console.log('[IMAGE-TO-PDF] 📄 Convirtiendo con pdf-lib...');

      const {
        pageSize = 'A4',
        orientation = 'portrait',
        margin = 20,
        quality = 90,
        fit = 'contain'
      } = options;

      // Crear documento PDF
      const pdfDoc = await PDFDocument.create();

      // Obtener tamaño de página
      const pageDimensions = this.getPageDimensions(pageSize, orientation);

      // Procesar cada imagen
      for (const imageBuffer of images) {
        try {
          // Optimizar imagen con Sharp
          const optimizedImage = await this.optimizeImage(imageBuffer, {
            quality,
            maxWidth: pageDimensions.width - (margin * 2),
            maxHeight: pageDimensions.height - (margin * 2)
          });

          // Detectar formato de imagen
          const metadata = await sharp(optimizedImage).metadata();
          const imageFormat = metadata.format;

          // Embebir imagen en PDF
          let embeddedImage;
          if (imageFormat === 'jpeg' || imageFormat === 'jpg') {
            embeddedImage = await pdfDoc.embedJpg(optimizedImage);
          } else if (imageFormat === 'png') {
            embeddedImage = await pdfDoc.embedPng(optimizedImage);
          } else {
            // Convertir otros formatos a PNG
            const pngBuffer = await sharp(optimizedImage).png().toBuffer();
            embeddedImage = await pdfDoc.embedPng(pngBuffer);
          }

          // Crear nueva página
          const page = pdfDoc.addPage([pageDimensions.width, pageDimensions.height]);

          // Calcular dimensiones y posición de la imagen
          const { width, height, x, y } = this.calculateImagePosition(
            embeddedImage.width,
            embeddedImage.height,
            pageDimensions.width - (margin * 2),
            pageDimensions.height - (margin * 2),
            fit
          );

          // Dibujar imagen en la página
          page.drawImage(embeddedImage, {
            x: x + margin,
            y: y + margin,
            width: width,
            height: height
          });

          // Agregar metadata opcional
          if (metadata.exif) {
            // Manejar rotación EXIF si existe
            const rotation = this.getExifRotation(metadata.orientation);
            if (rotation !== 0) {
              page.setRotation(degrees(rotation));
            }
          }

        } catch (imageError) {
          console.error(`[IMAGE-TO-PDF] ⚠️ Error procesando imagen:`, imageError.message);
          // Continuar con la siguiente imagen
        }
      }

      // Establecer metadata del PDF
      pdfDoc.setTitle(`${fileName}`);
      pdfDoc.setAuthor('Conversor PDF Sumate');
      pdfDoc.setCreator('Sumate - Evolve Digital');
      pdfDoc.setProducer('pdf-lib');
      pdfDoc.setCreationDate(new Date());
      pdfDoc.setModificationDate(new Date());

      // Generar PDF
      const pdfBytes = await pdfDoc.save();

      console.log('[IMAGE-TO-PDF] ✅ Conversión exitosa con pdf-lib');

      return {
        success: true,
        buffer: Buffer.from(pdfBytes),
        fileName: `${this.sanitizeFileName(fileName)}.pdf`,
        mimeType: 'application/pdf',
        method: 'pdf-lib',
        pages: pdfDoc.getPageCount()
      };

    } catch (error) {
      console.error('[IMAGE-TO-PDF] ❌ Error con pdf-lib:', error.message);
      return {
        success: false,
        error: error.message,
        method: 'pdf-lib'
      };
    }
  }

  /**
   * Conversión usando iLovePDF
   */
  async convertWithILovePDF(images, fileName, options) {
    try {
      console.log('[IMAGE-TO-PDF] 📄 Convirtiendo con iLovePDF...');

      // Verificar credenciales
      if (!config.ilovepdf.publicKey || !config.ilovepdf.secretKey) {
        throw new Error('Credenciales de iLovePDF no configuradas');
      }

      const tempFiles = [];

      // Guardar imágenes temporalmente
      for (let i = 0; i < images.length; i++) {
        const tempPath = path.join(config.conversion.tempDir, `image_${Date.now()}_${i}.jpg`);

        // Convertir a JPEG si es necesario
        const jpegBuffer = await sharp(images[i])
          .jpeg({ quality: options.quality || 90 })
          .toBuffer();

        fs.writeFileSync(tempPath, jpegBuffer);
        tempFiles.push(tempPath);
      }

      // Inicializar API
      const instance = new ILovePDFApi(config.ilovepdf.publicKey, config.ilovepdf.secretKey);

      // Crear tarea
      const task = instance.newTask('imagepdf');
      await task.start();

      // Agregar archivos
      for (const filePath of tempFiles) {
        const file = new ILovePDFFile(filePath);
        await task.addFile(file);
      }

      // Configurar opciones
      const taskOptions = {
        orientation: options.orientation || 'portrait',
        margin: options.margin || 0,
        pagesize: options.pageSize || 'A4'
      };

      // Procesar
      await task.process(taskOptions);

      // Descargar resultado
      const pdfBuffer = await task.download();

      // Limpiar temporales
      for (const filePath of tempFiles) {
        fs.unlinkSync(filePath);
      }

      console.log('[IMAGE-TO-PDF] ✅ Conversión exitosa con iLovePDF');

      return {
        success: true,
        buffer: pdfBuffer,
        fileName: `${this.sanitizeFileName(fileName)}.pdf`,
        mimeType: 'application/pdf',
        method: 'ilovepdf'
      };

    } catch (error) {
      console.error('[IMAGE-TO-PDF] ❌ Error con iLovePDF:', error.message);
      return {
        success: false,
        error: error.message,
        method: 'ilovepdf'
      };
    }
  }

  /**
   * Optimizar imagen antes de agregar al PDF
   */
  async optimizeImage(imageBuffer, options = {}) {
    const { quality = 90, maxWidth = 2480, maxHeight = 3508 } = options; // A4 a 300 DPI

    try {
      let image = sharp(imageBuffer);
      const metadata = await image.metadata();

      // Redimensionar si es necesario
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        image = image.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Aplicar rotación automática basada en EXIF
      image = image.rotate();

      // Optimizar según formato
      if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
        return await image.jpeg({ quality }).toBuffer();
      } else if (metadata.format === 'png') {
        return await image.png({ quality }).toBuffer();
      } else {
        // Convertir otros formatos a JPEG
        return await image.jpeg({ quality }).toBuffer();
      }

    } catch (error) {
      console.error('[IMAGE-TO-PDF] ⚠️ Error optimizando imagen:', error.message);
      return imageBuffer; // Devolver imagen original si falla
    }
  }

  /**
   * Calcular posición y tamaño de imagen en página
   */
  calculateImagePosition(imgWidth, imgHeight, maxWidth, maxHeight, fit = 'contain') {
    let width, height, x, y;

    const aspectRatio = imgWidth / imgHeight;
    const maxAspectRatio = maxWidth / maxHeight;

    if (fit === 'contain') {
      // Ajustar manteniendo aspecto y conteniendo en el área
      if (aspectRatio > maxAspectRatio) {
        width = maxWidth;
        height = maxWidth / aspectRatio;
      } else {
        height = maxHeight;
        width = maxHeight * aspectRatio;
      }
    } else if (fit === 'cover') {
      // Ajustar cubriendo toda el área
      if (aspectRatio > maxAspectRatio) {
        height = maxHeight;
        width = maxHeight * aspectRatio;
      } else {
        width = maxWidth;
        height = maxWidth / aspectRatio;
      }
    } else {
      // fill: Estirar para llenar
      width = maxWidth;
      height = maxHeight;
    }

    // Centrar imagen
    x = (maxWidth - width) / 2;
    y = (maxHeight - height) / 2;

    return { width, height, x, y };
  }

  /**
   * Obtener dimensiones de página
   */
  getPageDimensions(pageSize = 'A4', orientation = 'portrait') {
    const sizes = {
      A4: { width: 595.28, height: 841.89 },
      A3: { width: 841.89, height: 1190.55 },
      Letter: { width: 612, height: 792 },
      Legal: { width: 612, height: 1008 },
      Tabloid: { width: 792, height: 1224 }
    };

    let dimensions = sizes[pageSize] || sizes.A4;

    if (orientation === 'landscape') {
      dimensions = {
        width: dimensions.height,
        height: dimensions.width
      };
    }

    return dimensions;
  }

  /**
   * Obtener rotación EXIF
   */
  getExifRotation(orientation) {
    const rotations = {
      1: 0,
      3: 180,
      6: 90,
      8: 270
    };
    return rotations[orientation] || 0;
  }

  /**
   * Crear collage de múltiples imágenes en una página
   */
  async createCollage(images, options = {}) {
    const {
      columns = 2,
      rows = 2,
      spacing = 10,
      pageSize = 'A4',
      orientation = 'portrait',
      margin = 20,
      backgroundColor = '#FFFFFF'
    } = options;

    try {
      console.log(`[IMAGE-TO-PDF] 🎨 Creando collage de ${images.length} imágenes`);

      const pdfDoc = await PDFDocument.create();
      const pageDimensions = this.getPageDimensions(pageSize, orientation);

      const imagesPerPage = columns * rows;
      const totalPages = Math.ceil(images.length / imagesPerPage);

      const cellWidth = (pageDimensions.width - (margin * 2) - (spacing * (columns - 1))) / columns;
      const cellHeight = (pageDimensions.height - (margin * 2) - (spacing * (rows - 1))) / rows;

      for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        const page = pdfDoc.addPage([pageDimensions.width, pageDimensions.height]);

        // Color de fondo
        const bgColor = this.hexToRgb(backgroundColor);
        page.drawRectangle({
          x: 0,
          y: 0,
          width: pageDimensions.width,
          height: pageDimensions.height,
          color: rgb(bgColor.r / 255, bgColor.g / 255, bgColor.b / 255)
        });

        const startIdx = pageNum * imagesPerPage;
        const endIdx = Math.min(startIdx + imagesPerPage, images.length);

        for (let i = startIdx; i < endIdx; i++) {
          const imageIdx = i - startIdx;
          const row = Math.floor(imageIdx / columns);
          const col = imageIdx % columns;

          try {
            const optimizedImage = await this.optimizeImage(images[i], {
              maxWidth: cellWidth,
              maxHeight: cellHeight
            });

            const metadata = await sharp(optimizedImage).metadata();
            let embeddedImage;

            if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
              embeddedImage = await pdfDoc.embedJpg(optimizedImage);
            } else {
              const pngBuffer = await sharp(optimizedImage).png().toBuffer();
              embeddedImage = await pdfDoc.embedPng(pngBuffer);
            }

            const { width, height, x: offsetX, y: offsetY } = this.calculateImagePosition(
              embeddedImage.width,
              embeddedImage.height,
              cellWidth,
              cellHeight,
              'contain'
            );

            const x = margin + (col * (cellWidth + spacing)) + offsetX;
            const y = pageDimensions.height - margin - ((row + 1) * cellHeight) - (row * spacing) + offsetY;

            page.drawImage(embeddedImage, {
              x: x,
              y: y,
              width: width,
              height: height
            });

          } catch (error) {
            console.error(`[IMAGE-TO-PDF] ⚠️ Error en imagen ${i}:`, error.message);
          }
        }
      }

      const pdfBytes = await pdfDoc.save();

      return {
        success: true,
        buffer: Buffer.from(pdfBytes),
        fileName: 'collage.pdf',
        mimeType: 'application/pdf',
        method: 'pdf-lib-collage',
        pages: pdfDoc.getPageCount()
      };

    } catch (error) {
      console.error('[IMAGE-TO-PDF] ❌ Error creando collage:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verificar si el archivo es una imagen soportada
   */
  isImageSupported(mimeType, fileName) {
    // Verificar por MIME type
    if (mimeType && this.supportedFormats.includes(mimeType.toLowerCase())) {
      return true;
    }

    // Verificar por extensión
    if (fileName) {
      const ext = path.extname(fileName).toLowerCase();
      return this.supportedExtensions.includes(ext);
    }

    return false;
  }

  /**
   * Convertir hex a RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  /**
   * Sanitizar nombre de archivo
   */
  sanitizeFileName(fileName) {
    if (!fileName) return 'documento';

    return fileName
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s\-_]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50);
  }
}

module.exports = new ImageToPdfService();