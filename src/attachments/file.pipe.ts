// Brings in multer's Express.Multer.File type.
import type {} from 'multer';
import { type PipeTransform } from '@nestjs/common';
import { ValidationException } from 'nestjs-mvc';

export const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED = [
  /^image\/(png|jpeg|gif|webp)$/,
  /^text\/(plain|csv)$/,
  /^application\/(json|pdf|zip|gzip|x-gzip)$/,
];

/**
 * Checks an uploaded file the way a form field is checked: a problem is a
 * ValidationException on `file`, so nestjs-mvc sends it back to the form's
 * errors like any other field, instead of an error page.
 */
export class FilePipe implements PipeTransform<
  Express.Multer.File | undefined
> {
  transform(file: Express.Multer.File | undefined) {
    if (!file) throw new ValidationException({ file: 'Pick a file first.' });
    if (file.size > MAX_BYTES)
      throw new ValidationException({
        file: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 10 MB.`,
      });
    if (!ALLOWED.some((type) => type.test(file.mimetype)))
      throw new ValidationException({
        file: 'Images, text, CSV, JSON, PDF and archives only.',
      });
    return file;
  }
}
