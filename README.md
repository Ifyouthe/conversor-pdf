# Conversor PDF - Sumate

Microservicio de conversión de documentos a PDF para el sistema Sumate.

## 🚀 Características

- ✅ Conversión de Excel a PDF
- ✅ Conversión de Word a PDF
- ✅ **Conversión de imágenes a PDF**
- ✅ **Collage de múltiples imágenes**
- ✅ **Optimización automática de imágenes**
- ✅ Múltiples métodos de conversión (Puppeteer, iLovePDF, pdf-lib)
- ✅ Fallback automático entre métodos
- ✅ Integración con constructor-de-documentos
- ✅ API REST completa
- ✅ Manejo de archivos grandes
- ✅ Limpieza automática de archivos temporales
- ✅ Soporte para formatos: JPG, PNG, WebP, TIFF, GIF, BMP, SVG

## 📋 Requisitos

- Node.js >= 20.0.0
- npm o yarn
- Credenciales de iLovePDF (opcional)
- Constructor de documentos Sumate (para integración)

## 🔧 Instalación

1. Clonar el repositorio
2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
```

4. Editar `.env` con tus configuraciones:
```env
PORT=3004
ILOVEPDF_PUBLIC_KEY=tu_clave_publica
ILOVEPDF_SECRET_KEY=tu_clave_secreta
CONSTRUCTOR_DOCUMENTOS_URL=http://localhost:3003
```

## 🏃‍♂️ Ejecución

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```

## 🔐 Secreto compartido (X-API-Key)

Con `CONVERSOR_API_KEY` definida, toda petición salvo `GET /health` debe traer la cabecera `X-API-Key` con ese valor; si falta o no coincide, **401**. Sin la variable el servicio queda abierto (solo para desarrollo local) y lo avisa al arrancar. Si el conversor llama al constructor (`/api/convert/from-url` con `data`, `/api/generate-and-convert`), le reenvía `CONSTRUCTOR_API_KEY`.

```bash
curl -X POST http://sumate-conversor:3004/api/convert/image-to-pdf \
  -H "X-API-Key: $CONVERSOR_API_KEY" -F "image=@foto.jpg" --output foto.pdf
```

| Variable | Por defecto | Para qué |
|---|---|---|
| `CONVERSOR_API_KEY` | vacía (abierto) | Secreto de la cabecera `X-API-Key` |
| `NODE_ENV` | `production` | En `development` los 500 devuelven el mensaje interno |
| `CONSTRUCTOR_DOCUMENTOS_URL`, `CONSTRUCTOR_API_KEY` | `http://constructor-documentos:3003`, vacía | Solo para los endpoints que llaman al constructor |
| `ILOVEPDF_PUBLIC_KEY`, `ILOVEPDF_SECRET_KEY` | vacías | Solo Excel/Word con `ilovepdf` (la Herramienta no los usa) |
| `MAX_FILE_SIZE_MB` | `10` | Límite de archivo subido |
| `PORT` | `3004` | |

## 🖥️ Despliegue en el 207

- Rama `refactor/207` (no `main`: `main` se autodespliega en el Dokploy del 195).
- `docker compose -p sumate-conversor -f docker-compose.yml -f docker-compose.207.yml up -d --build`, con `.env` 600.
- Contenedor `sumate-conversor`, puerto **3004** sin publicar, solo en la red externa `sumate_servicios` (tiene que existir antes); sistema de archivos de solo lectura con `/tmp` en memoria.
- La Herramienta: `PDF_CONVERTER_URL=http://sumate-conversor:3004/api/convert/image-to-pdf` y la cabecera `X-API-Key`.
- Equivalencia: `node scripts/comparar-pdf.js a.pdf b.pdf` compara dos PDFs ignorando solo `CreationDate`/`ModDate`.

## 📚 API Endpoints

### Conversión directa de archivos

#### Excel a PDF
```bash
POST /api/convert/excel-to-pdf
Content-Type: multipart/form-data

Form Data:
- file: archivo.xlsx
- fileName: nombre_salida (opcional)
- method: puppeteer | ilovepdf (opcional)
```

#### Word a PDF
```bash
POST /api/convert/word-to-pdf
Content-Type: multipart/form-data

Form Data:
- file: archivo.docx
- fileName: nombre_salida (opcional)
```

#### Detección automática
```bash
POST /api/convert/file
Content-Type: multipart/form-data

Form Data:
- file: archivo.xlsx o archivo.docx
- fileName: nombre_salida (opcional)
- method: puppeteer | ilovepdf (opcional)
```

#### Imagen única a PDF
```bash
POST /api/convert/image-to-pdf
Content-Type: multipart/form-data

Form Data:
- image: imagen.jpg
- fileName: nombre_salida (opcional)
- pageSize: A4 | A3 | Letter (opcional)
- orientation: portrait | landscape (opcional)
- margin: 20 (pixels, opcional)
- quality: 90 (1-100, opcional)
- fit: contain | cover | fill (opcional)
```

#### Múltiples imágenes a PDF
```bash
POST /api/convert/images-to-pdf
Content-Type: multipart/form-data

Form Data:
- images: imagen1.jpg, imagen2.png, imagen3.webp
- fileName: nombre_salida (opcional)
- pageSize: A4 | A3 | Letter (opcional)
- orientation: portrait | landscape (opcional)
- margin: 20 (opcional)
- quality: 90 (opcional)
- fit: contain | cover | fill (opcional)
```

#### Collage de imágenes
```bash
POST /api/convert/images-collage
Content-Type: multipart/form-data

Form Data:
- images: imagen1.jpg, imagen2.png...
- columns: 2 (opcional)
- rows: 2 (opcional)
- spacing: 10 (pixels, opcional)
- pageSize: A4 (opcional)
- orientation: portrait (opcional)
- margin: 20 (opcional)
- backgroundColor: #FFFFFF (opcional)
```

#### Convertir imágenes desde URLs
```bash
POST /api/convert/images-from-urls
Content-Type: application/json

{
  "urls": [
    "https://ejemplo.com/imagen1.jpg",
    "https://ejemplo.com/imagen2.png"
  ],
  "fileName": "imagenes_descargadas",
  "pageSize": "A4",
  "quality": 90
}
```

### Integración con constructor-de-documentos

#### Generar y convertir en un paso
```bash
POST /api/generate-and-convert
Content-Type: application/json

{
  "data": {
    // Datos para el documento
    "cliente": {
      "nombre": "Juan",
      "apellido_paterno": "García"
    }
  },
  "formato": "general", // general | con_HC | sin_HC | seguimiento
  "method": "puppeteer" // puppeteer | ilovepdf
}
```

#### Convertir desde URL
```bash
POST /api/convert/from-url
Content-Type: application/json

{
  "url": "http://localhost:3003/documento.xlsx",
  "fileName": "documento_convertido",
  "method": "puppeteer"
}
```

### Health Check
```bash
GET /health
```

### Estadísticas
```bash
GET /api/stats
```

## 🔨 Ejemplos de uso con curl

### Convertir Excel local a PDF
```bash
curl -X POST http://localhost:3004/api/convert/excel-to-pdf \
  -F "file=@documento.xlsx" \
  -F "method=puppeteer" \
  --output documento.pdf
```

### Generar documento desde datos y convertir a PDF
```bash
curl -X POST http://localhost:3004/api/generate-and-convert \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "cliente": {
        "nombre": "Ana",
        "apellido_paterno": "López",
        "edad": 35
      },
      "buro": {
        "BC_score": 650
      }
    },
    "formato": "con_HC",
    "method": "puppeteer"
  }' \
  --output documento_con_HC.pdf
```

### Convertir imagen a PDF
```bash
curl -X POST http://localhost:3004/api/convert/image-to-pdf \
  -F "image=@foto.jpg" \
  -F "pageSize=A4" \
  -F "orientation=portrait" \
  -F "fit=contain" \
  --output imagen.pdf
```

### Convertir múltiples imágenes a PDF
```bash
curl -X POST http://localhost:3004/api/convert/images-to-pdf \
  -F "images=@foto1.jpg" \
  -F "images=@foto2.png" \
  -F "images=@foto3.webp" \
  -F "fileName=album_fotos" \
  --output album_fotos.pdf
```

### Crear collage de imágenes
```bash
curl -X POST http://localhost:3004/api/convert/images-collage \
  -F "images=@foto1.jpg" \
  -F "images=@foto2.jpg" \
  -F "images=@foto3.jpg" \
  -F "images=@foto4.jpg" \
  -F "columns=2" \
  -F "rows=2" \
  -F "spacing=10" \
  --output collage.pdf
```

### Convertir imágenes desde URLs
```bash
curl -X POST http://localhost:3004/api/convert/images-from-urls \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://picsum.photos/800/600?random=1",
      "https://picsum.photos/800/600?random=2"
    ],
    "fileName": "imagenes_web",
    "pageSize": "A4",
    "quality": 85
  }' \
  --output imagenes_web.pdf
```

## 🐳 Docker

### Build
```bash
docker build -t conversor-pdf-sumate .
```

### Run
```bash
docker run -p 3004:3004 \
  -e ILOVEPDF_PUBLIC_KEY=tu_clave \
  -e ILOVEPDF_SECRET_KEY=tu_secreto \
  conversor-pdf-sumate
```

## 🛠️ Métodos de conversión

### Puppeteer (Por defecto para Excel)
- ✅ No requiere API externa
- ✅ Mejor control sobre el formato
- ✅ Ideal para Excel con estilos complejos
- ❌ Mayor uso de recursos

### iLovePDF (Para Word e imágenes)
- ✅ Conversión profesional
- ✅ Menor uso de recursos locales
- ✅ Mejor para Word
- ✅ Soporte nativo para imágenes
- ❌ Requiere credenciales API
- ❌ Límite de conversiones según plan

### pdf-lib (Por defecto para imágenes)
- ✅ No requiere API externa
- ✅ Control total sobre el layout
- ✅ Soporte para collages y composiciones
- ✅ Optimización automática de imágenes
- ✅ Manejo de metadatos EXIF

## 📝 Notas

- Los archivos temporales se limpian automáticamente cada 5 minutos
- El límite de tamaño por defecto es 10MB (configurable)
- Se recomienda usar Puppeteer para Excel e iLovePDF para Word
- El fallback automático está habilitado por defecto

## 🤝 Integración con otros servicios

Este servicio está diseñado para trabajar con:
- **constructor-de-documentos**: Para generar documentos Excel/Word
- **Sumate API**: Para obtener datos de clientes
- **Sistema de notificaciones**: Para enviar PDFs generados

## 📞 Soporte

Para soporte y consultas:
- Email: soporte@evolvedigital.cloud
- Documentación: https://sumate.evolvedigital.cloud/docs
