import { Injectable, Logger } from '@nestjs/common';

/** Statuspage's indicator: how bad it is at the provider right now. */
export type UpstreamIndicator = 'none' | 'minor' | 'major' | 'critical';

export interface UpstreamStatus {
  name: string;
  url: string;
  indicator: UpstreamIndicator | 'unknown';
  description: string;
}

/** Tools we depend on, all on Statuspage: the same JSON at /api/v2/status.json. */
export const PROVIDERS = [
  { name: 'GitHub', url: 'https://www.githubstatus.com' },
  { name: 'Cloudflare', url: 'https://www.cloudflarestatus.com' },
  { name: 'Datadog', url: 'https://status.datadoghq.com' },
  { name: 'Twilio', url: 'https://status.twilio.com' },
];

const TIMEOUT_MS = 3000;
const FRESH_MS = 60_000;

/**
 * Is it us or them? The status of the providers we depend on, fetched from
 * their public status pages. Their outage must not become ours: when none of
 * them answers this throws, and the dashboard's defer(…, { rescue: true })
 * leaves the widget out instead of failing the page.
 */
@Injectable()
export class UpstreamService {
  private readonly logger = new Logger(UpstreamService.name);
  private cache: { at: number; statuses: UpstreamStatus[] } | null = null;

  async statuses(): Promise<UpstreamStatus[]> {
    if (this.cache && Date.now() - this.cache.at < FRESH_MS)
      return this.cache.statuses;

    const statuses = await Promise.all(
      PROVIDERS.map((provider) => this.fetchOne(provider)),
    );
    if (statuses.every((status) => status.indicator === 'unknown'))
      throw new Error('No status page answered.');
    this.cache = { at: Date.now(), statuses };
    return statuses;
  }

  private async fetchOne(provider: {
    name: string;
    url: string;
  }): Promise<UpstreamStatus> {
    try {
      const response = await fetch(`${provider.url}/api/v2/status.json`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as {
        status: { indicator: UpstreamIndicator; description: string };
      };
      return { ...provider, ...body.status };
    } catch (error) {
      this.logger.debug(`${provider.name}: ${String(error)}`);
      return { ...provider, indicator: 'unknown', description: 'No answer' };
    }
  }
}
