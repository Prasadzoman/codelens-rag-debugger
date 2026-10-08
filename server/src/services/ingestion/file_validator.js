import path from 'path';

export const ALLOWED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx',
  '.py', '.java', '.cpp', '.c',
  '.go', '.rs', '.json', '.md'
]);

export const MAX_FILE_SIZE = 500 * 1024; // 500 KB per file
export const MAX_TOTAL_FILES = 20;

/**
 * Validates a single file for extension, size, path traversal, and binary content.
 */
export function validateFile(fileName, contentOrBuffer) {
  // 1. Path traversal check
  const sanitizedName = path.basename(fileName);
  if (!sanitizedName || sanitizedName !== fileName.replace(/[/\\]/g, '/').split('/').pop()) {
    throw new Error(`Invalid file path or potential path traversal: ${fileName}`);
  }
  if (fileName.includes('..') || fileName.includes('\0')) {
    throw new Error(`Illegal characters in filename: ${fileName}`);
  }

  // 2. Extension check
  const ext = path.extname(sanitizedName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file type '${ext}' for file '${sanitizedName}'. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`);
  }

  // 3. Size check
  const byteLength = Buffer.isBuffer(contentOrBuffer)
    ? contentOrBuffer.length
    : Buffer.byteLength(contentOrBuffer, 'utf8');

  if (byteLength > MAX_FILE_SIZE) {
    throw new Error(`File '${sanitizedName}' exceeds maximum size of ${MAX_FILE_SIZE / 1024} KB`);
  }

  // 4. Binary check (detect null bytes in initial 512 bytes)
  const buffer = Buffer.isBuffer(contentOrBuffer)
    ? contentOrBuffer
    : Buffer.from(contentOrBuffer);

  const sampleSize = Math.min(buffer.length, 512);
  for (let i = 0; i < sampleSize; i++) {
    if (buffer[i] === 0) {
      throw new Error(`File '${sanitizedName}' appears to be a binary file. Only source text files are supported.`);
    }
  }

  return {
    valid: true,
    fileName: sanitizedName,
    extension: ext,
    size: byteLength,
    content: buffer.toString('utf8')
  };
}

/**
 * Validates a batch of files.
 */
export function validateFiles(files) {
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new Error('At least one source file must be provided.');
  }

  if (files.length > MAX_TOTAL_FILES) {
    throw new Error(`Cannot upload more than ${MAX_TOTAL_FILES} files at once.`);
  }

  return files.map(file => {
    const name = file.originalname || file.name || file.fileName;
    const content = file.buffer || file.content;
    return validateFile(name, content);
  });
}
