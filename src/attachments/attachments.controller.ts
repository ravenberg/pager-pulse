// Brings in multer's Express.Multer.File type.
import type {} from 'multer';
import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { ViewService } from 'nestjs-mvc';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Responder } from '../auth/roles.decorator.js';
import { Attachment, User } from '../database/entities/index.js';
import { IncidentsService } from '../incidents/incidents.service.js';
import { FilePipe, MAX_BYTES } from './file.pipe.js';

const storage = () => process.env.STORAGE_PATH ?? 'storage';

/** Files on an incident: uploaded with a form, served to whoever may see it. */
@Controller('incidents/:id/attachments')
export class AttachmentsController {
  constructor(
    private readonly incidents: IncidentsService,
    private readonly view: ViewService,
    @InjectRepository(Attachment)
    private readonly attachments: Repository<Attachment>,
  ) {}

  /**
   * A multipart form post, from the same useForm as any other: the file is
   * read into memory (with a hard cap well above the real limit), checked
   * by FilePipe, and only then written to disk.
   */
  @Post()
  @Responder()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_BYTES * 2, files: 1 } }),
  )
  async upload(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile(new FilePipe()) file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    const incident = await this.incidents.find(id, user);
    const storageKey = join('attachments', String(incident.id), randomUUID());
    await mkdir(join(storage(), 'attachments', String(incident.id)), {
      recursive: true,
    });
    await writeFile(join(storage(), storageKey), file.buffer);
    await this.attachments.save(
      this.attachments.create({
        incident,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey,
        uploadedBy: user,
      }),
    );
    return this.view.flash('success', `${file.originalname} attached.`).back();
  }

  /** The file itself: a plain download, for whoever may see the incident. */
  @Get(':attachmentId')
  async download(
    @Param('id', ParseIntPipe) id: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() user: User,
  ) {
    const attachment = await this.attachment(id, attachmentId, user);
    const inline = attachment.mimeType.startsWith('image/');
    return new StreamableFile(
      createReadStream(join(storage(), attachment.storageKey)),
      {
        type: attachment.mimeType,
        length: attachment.size,
        disposition: `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(attachment.filename)}"`,
      },
    );
  }

  @Delete(':attachmentId')
  @Responder()
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() user: User,
  ) {
    const attachment = await this.attachment(id, attachmentId, user);
    await this.attachments.remove(attachment);
    await rm(join(storage(), attachment.storageKey), { force: true });
    return this.view.flash('success', `${attachment.filename} removed.`).back();
  }

  private async attachment(id: number, attachmentId: number, user: User) {
    // Throws 404 for an incident this user may not see.
    const incident = await this.incidents.find(id, user);
    const attachment = await this.attachments.findOneBy({
      id: attachmentId,
      incident: { id: incident.id },
    });
    if (!attachment) throw new NotFoundException('That file is gone.');
    return attachment;
  }
}
