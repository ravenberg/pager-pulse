import { Body, Controller, Post, Res } from '@nestjs/common';
import { type AnyResponse, ViewService } from 'nestjs-mvc';
import { z } from 'zod';
import { Public } from '../auth/public.decorator.js';
import { XrayService } from './xray.service.js';

const ToggleSchema = z.object({ enabled: z.boolean() });

@Controller()
export class XrayController {
  constructor(
    private readonly xray: XrayService,
    private readonly view: ViewService,
  ) {}

  /** Turns the overlay on or off for this browser, then reloads the page it came from. */
  @Public()
  @Post('xray')
  toggle(
    @Body({ schema: ToggleSchema }) body: z.infer<typeof ToggleSchema>,
    @Res({ passthrough: true }) res: AnyResponse,
  ) {
    this.xray.remember(res, body.enabled);
    return this.view.back();
  }
}
