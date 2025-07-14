import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import type { FastifyRequest } from 'fastify';
import { BadRequestError } from '@/types/errors';

export interface UploadOptions {
  allowedTypes: string[];
  maxFileSize: number;
  destination: string;
}

export interface UploadedFile {
  fieldname: string;
  originalName: string;
  encoding: string;
  mimetype: string;
  size: number;
  filename: string;
  path: string;
  url: string;
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// Create multer instance
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    // Basic file type validation
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

/**
 * Handle file upload for Fastify
 */
export async function uploadHandler(
  request: FastifyRequest,
  options: UploadOptions
): Promise<UploadedFile[]> {
  return new Promise((resolve, reject) => {
    // Create upload directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'uploads', options.destination);
    fs.mkdir(uploadDir, { recursive: true }).catch(reject);

    // Configure multer for this request
    const customStorage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-');
        cb(null, `${name}-${uniqueSuffix}${ext}`);
      }
    });

    const customUpload = multer({
      storage: customStorage,
      limits: {
        fileSize: options.maxFileSize
      },
      fileFilter: (req, file, cb) => {
        if (options.allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestError(`File type ${file.mimetype} is not allowed`));
        }
      }
    });

    // Handle multiple file upload
    const uploadMiddleware = customUpload.array('files', 10);
    
    // Convert Fastify request to Express-like request for multer
    const req = request.raw as any;
    const res = {} as any;

    uploadMiddleware(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            reject(new BadRequestError('File size exceeds limit'));
          } else {
            reject(new BadRequestError(err.message));
          }
        } else {
          reject(err);
        }
        return;
      }

      // Process uploaded files
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        reject(new BadRequestError('No files uploaded'));
        return;
      }

      const uploadedFiles: UploadedFile[] = files.map(file => ({
        fieldname: file.fieldname,
        originalName: file.originalname,
        encoding: file.encoding,
        mimetype: file.mimetype,
        size: file.size,
        filename: file.filename,
        path: file.path,
        url: `/uploads/${options.destination}/${file.filename}`
      }));

      resolve(uploadedFiles);
    });
  });
}

/**
 * Delete uploaded file
 */
export async function deleteUploadedFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // Ignore if file doesn't exist
    if ((error as any).code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Single file upload middleware
 */
export function singleFileUpload(fieldName: string = 'file') {
  return upload.single(fieldName);
}

/**
 * Multiple file upload middleware
 */
export function multipleFileUpload(fieldName: string = 'files', maxCount: number = 10) {
  return upload.array(fieldName, maxCount);
}

/**
 * Mixed file upload middleware
 */
export function mixedFileUpload(fields: Array<{ name: string; maxCount: number }>) {
  return upload.fields(fields);
}