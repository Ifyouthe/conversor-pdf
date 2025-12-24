// =============================================
// SERVICIO EXCEL A PDF - CONVERSOR PDF SUMATE
// =============================================

const puppeteer = require('puppeteer');
const ILovePDFApi = require('@ilovepdf/ilovepdf-nodejs');
const ILovePDFFile = require('@ilovepdf/ilovepdf-nodejs/ILovePDFFile');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class ExcelToPdfService {
  constructor() {
    console.log('[EXCEL-TO-PDF] ✅ Servicio inicializado');
  }

  /**
   * Convierte Excel a PDF con método automático o especificado
   */
  async convert(excelBuffer, options = {}) {
    const {
      fileName = 'documento',
      method = config.conversion.defaultMethod,
      enableFallback = config.conversion.enableFallback
    } = options;

    console.log(`[EXCEL-TO-PDF] 🚀 Iniciando conversión con método: ${method}`);

    let result;

    // Intentar con el método principal
    if (method === 'ilovepdf') {
      result = await this.convertWithILovePDF(excelBuffer, fileName);
    } else {
      result = await this.convertWithPuppeteer(excelBuffer, fileName);
    }

    // Si falla y el fallback está habilitado, intentar con el otro método
    if (!result.success && enableFallback) {
      const fallbackMethod = method === 'ilovepdf' ? 'puppeteer' : 'ilovepdf';
      console.log(`[EXCEL-TO-PDF] 🔄 Método ${method} falló, intentando con ${fallbackMethod}...`);

      if (fallbackMethod === 'ilovepdf') {
        result = await this.convertWithILovePDF(excelBuffer, fileName);
      } else {
        result = await this.convertWithPuppeteer(excelBuffer, fileName);
      }
    }

    // Actualizar estadísticas
    if (global.conversionStats) {
      global.conversionStats.total++;
      if (result.success) {
        global.conversionStats.successful++;
        global.conversionStats.byMethod[result.method]++;
      } else {
        global.conversionStats.failed++;
      }
    }

    return result;
  }

  /**
   * Conversión usando Puppeteer
   */
  async convertWithPuppeteer(excelBuffer, fileName) {
    let browser = null;

    try {
      console.log('[EXCEL-TO-PDF] 📊 Convirtiendo con Puppeteer...');

      // Convertir Excel a HTML
      const htmlContent = await this.excelToHTML(excelBuffer);

      // Lanzar navegador
      browser = await puppeteer.launch({
        headless: config.puppeteer.headless,
        args: config.puppeteer.args,
        timeout: config.puppeteer.timeout
      });

      const page = await browser.newPage();

      // Establecer contenido HTML
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
        timeout: config.puppeteer.timeout
      });

      // Configurar opciones PDF
      const pdfOptions = {
        format: 'A4',
        landscape: false,
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in'
        }
      };

      // Generar PDF
      const pdfBuffer = await page.pdf(pdfOptions);

      console.log('[EXCEL-TO-PDF] ✅ Conversión exitosa con Puppeteer');

      return {
        success: true,
        buffer: pdfBuffer,
        fileName: `${this.sanitizeFileName(fileName)}.pdf`,
        mimeType: 'application/pdf',
        method: 'puppeteer'
      };

    } catch (error) {
      console.error('[EXCEL-TO-PDF] ❌ Error con Puppeteer:', error.message);
      return {
        success: false,
        error: error.message,
        method: 'puppeteer'
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Conversión usando iLovePDF
   */
  async convertWithILovePDF(excelBuffer, fileName) {
    try {
      console.log('[EXCEL-TO-PDF] 📊 Convirtiendo con iLovePDF...');

      // Verificar credenciales
      if (!config.ilovepdf.publicKey || !config.ilovepdf.secretKey) {
        throw new Error('Credenciales de iLovePDF no configuradas');
      }

      // Crear archivo temporal
      const tempPath = path.join(config.conversion.tempDir, `excel_${Date.now()}.xlsx`);
      fs.writeFileSync(tempPath, excelBuffer);

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

      console.log('[EXCEL-TO-PDF] ✅ Conversión exitosa con iLovePDF');

      return {
        success: true,
        buffer: pdfBuffer,
        fileName: `${this.sanitizeFileName(fileName)}.pdf`,
        mimeType: 'application/pdf',
        method: 'ilovepdf'
      };

    } catch (error) {
      console.error('[EXCEL-TO-PDF] ❌ Error con iLovePDF:', error.message);
      return {
        success: false,
        error: error.message,
        method: 'ilovepdf'
      };
    }
  }

  /**
   * Convierte Excel a HTML
   */
  async excelToHTML(excelBuffer) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(excelBuffer);

      let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Documento Excel</title>
  <style>
    @page {
      size: A4;
      margin: 0.5in;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 20px;
      background: white;
      color: #333;
    }

    .worksheet {
      page-break-after: always;
      margin-bottom: 30px;
    }

    .worksheet:last-child {
      page-break-after: auto;
    }

    .worksheet-title {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 15px;
      color: #2c3e50;
      border-bottom: 2px solid #3498db;
      padding-bottom: 5px;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 11px;
      margin-top: 10px;
    }

    td, th {
      border: 1px solid #ddd;
      padding: 6px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background-color: #f8f9fa;
      font-weight: 600;
      color: #2c3e50;
    }

    tr:nth-child(even) {
      background-color: #f9f9f9;
    }

    .number {
      text-align: right;
      font-family: 'Consolas', 'Courier New', monospace;
    }

    .center {
      text-align: center;
    }

    .bold {
      font-weight: bold;
    }

    .merged-cell {
      text-align: center;
      font-weight: bold;
      background-color: #e8f4f8;
    }
  </style>
</head>
<body>`;

      // Procesar cada hoja
      workbook.eachSheet((worksheet) => {
        html += `<div class="worksheet">`;
        html += `<div class="worksheet-title">${this.escapeHtml(worksheet.name)}</div>`;
        html += `<table>`;

        const rowCount = worksheet.rowCount;
        const colCount = worksheet.columnCount;

        for (let rowNumber = 1; rowNumber <= rowCount; rowNumber++) {
          const row = worksheet.getRow(rowNumber);

          if (row.hasValues) {
            html += `<tr>`;

            for (let colNumber = 1; colNumber <= colCount; colNumber++) {
              const cell = row.getCell(colNumber);
              let cellValue = '';
              let cellClass = '';
              let cellStyle = '';

              // Obtener valor de celda
              if (cell.value !== null && cell.value !== undefined) {
                if (typeof cell.value === 'object') {
                  if (cell.value.text) {
                    cellValue = cell.value.text;
                  } else if (cell.value.richText) {
                    cellValue = cell.value.richText.map(rt => rt.text).join('');
                  } else if (cell.value.formula) {
                    cellValue = cell.value.result || '';
                  }
                } else if (typeof cell.value === 'number') {
                  cellValue = cell.value.toString();
                  cellClass = 'number';
                } else {
                  cellValue = cell.value.toString();
                }
              }

              // Aplicar estilos básicos
              if (cell.font) {
                if (cell.font.bold) cellClass += ' bold';
              }

              // Manejar celdas combinadas
              if (cell.master !== cell) {
                continue; // Saltar celdas que son parte de una combinación
              }

              let colspan = 1;
              let rowspan = 1;

              if (cell.model.merge) {
                const [startRow, startCol, endRow, endCol] = this.parseMergeAddress(cell.address, cell.model.merge);
                colspan = endCol - startCol + 1;
                rowspan = endRow - startRow + 1;
                cellClass += ' merged-cell';
              }

              cellValue = this.escapeHtml(cellValue);

              html += `<td class="${cellClass}"`;
              if (colspan > 1) html += ` colspan="${colspan}"`;
              if (rowspan > 1) html += ` rowspan="${rowspan}"`;
              html += `>${cellValue}</td>`;
            }

            html += `</tr>`;
          }
        }

        html += `</table>`;
        html += `</div>`;
      });

      html += `</body></html>`;
      return html;

    } catch (error) {
      console.error('[EXCEL-TO-PDF] ❌ Error convirtiendo Excel a HTML:', error.message);
      throw error;
    }
  }

  /**
   * Parsear dirección de celdas combinadas
   */
  parseMergeAddress(address, merge) {
    // Implementación simplificada
    return [1, 1, 1, 1];
  }

  /**
   * Escapar HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

module.exports = new ExcelToPdfService();