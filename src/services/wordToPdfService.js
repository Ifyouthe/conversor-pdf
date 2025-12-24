// =============================================
// SERVICIO WORD A PDF - CONVERSOR PDF SUMATE
// =============================================

const ILovePDFApi = require('@ilovepdf/ilovepdf-nodejs');
const ILovePDFFile = require('@ilovepdf/ilovepdf-nodejs/ILovePDFFile');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class WordToPdfService {
  constructor() {
    console.log('[WORD-TO-PDF] ✅ Servicio inicializado');
  }

  /**
   * Convierte Word a PDF
   */
  async convert(wordBuffer, options = {}) {
    const {
      fileName = 'documento',
      format = 'pdf'
    } = options;

    console.log(`[WORD-TO-PDF] 🚀 Iniciando conversión de Word a ${format.toUpperCase()}`);

    if (format.toLowerCase() === 'pdf') {
      const result = await this.convertWithILovePDF(wordBuffer, fileName);

      // Actualizar estadísticas
      if (global.conversionStats) {
        global.conversionStats.total++;
        if (result.success) {
          global.conversionStats.successful++;
          global.conversionStats.byMethod.ilovepdf++;
        } else {
          global.conversionStats.failed++;
        }
      }

      return result;
    } else {
      // Si no es PDF, devolver el DOCX original
      return {
        success: true,
        buffer: wordBuffer,
        fileName: `${this.sanitizeFileName(fileName)}.docx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        method: 'original'
      };
    }
  }

  /**
   * Conversión usando iLovePDF
   */
  async convertWithILovePDF(wordBuffer, fileName) {
    try {
      console.log('[WORD-TO-PDF] 📝 Convirtiendo con iLovePDF...');

      // Verificar credenciales
      if (!config.ilovepdf.publicKey || !config.ilovepdf.secretKey) {
        throw new Error('Credenciales de iLovePDF no configuradas');
      }

      // Crear archivo temporal
      const tempPath = path.join(config.conversion.tempDir, `word_${Date.now()}.docx`);
      fs.writeFileSync(tempPath, wordBuffer);

      // Inicializar API
      const instance = new ILovePDFApi(config.ilovepdf.publicKey, config.ilovepdf.secretKey);

      // Crear tarea
      const task = instance.newTask('officepdf');
      await task.start();

      // Agregar archivo
      const file = new ILovePDFFile(tempPath);
      await task.addFile(file);

      // Procesar
      await task.process();

      // Descargar resultado
      const pdfBuffer = await task.download();

      // Limpiar temporal
      fs.unlinkSync(tempPath);

      console.log('[WORD-TO-PDF] ✅ Conversión exitosa con iLovePDF');

      return {
        success: true,
        buffer: pdfBuffer,
        fileName: `${this.sanitizeFileName(fileName)}.pdf`,
        mimeType: 'application/pdf',
        method: 'ilovepdf'
      };

    } catch (error) {
      console.error('[WORD-TO-PDF] ❌ Error con iLovePDF:', error.message);
      return {
        success: false,
        error: error.message,
        method: 'ilovepdf'
      };
    }
  }

  /**
   * Procesar plantilla Word con datos
   */
  async processTemplate(templateBuffer, data) {
    try {
      console.log('[WORD-TO-PDF] 📝 Procesando plantilla Word con datos...');

      // Cargar plantilla
      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: '{',
          end: '}'
        }
      });

      // Establecer datos
      doc.setData(data);

      // Renderizar documento
      doc.render();

      // Obtener buffer del documento procesado
      const buffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE'
      });

      console.log('[WORD-TO-PDF] ✅ Plantilla procesada exitosamente');
      return buffer;

    } catch (error) {
      console.error('[WORD-TO-PDF] ❌ Error procesando plantilla:', error.message);
      throw error;
    }
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

module.exports = new WordToPdfService();