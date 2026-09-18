import type { ScrollPage } from 'nestjs-mvc';
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/**
 * Pagination over TypeORM query builders, shaped for `scroll()`: the rows under
 * `data` plus the cursor fields the adapter reads (`currentPage`, `previousPage`,
 * `nextPage`, `pageName`). Anything else (`total`, `perPage`) rides along to the
 * client as ordinary props.
 */

export interface OffsetOptions<T, R> {
  /** The requested page, straight from `@Query('page')`; anything invalid means 1. */
  page?: string | number;
  perPage?: number;
  /** Query parameter the client uses to ask for a page. Defaults to `page`. */
  pageName?: string;
  map?: (row: T) => R;
}

export interface OffsetPage<R> extends ScrollPage<R> {
  data: R[];
  currentPage: number;
  previousPage: number | null;
  nextPage: number | null;
  total: number;
  perPage: number;
  lastPage: number;
}

/** Classic page-number pagination; both directions are known, so the client can scroll either way. */
export async function paginate<T extends ObjectLiteral, R = T>(
  query: SelectQueryBuilder<T>,
  options: OffsetOptions<T, R> = {},
): Promise<OffsetPage<R>> {
  const perPage = options.perPage ?? 15;
  const currentPage = Math.max(1, Math.floor(Number(options.page)) || 1);

  const [rows, total] = await query
    .skip((currentPage - 1) * perPage)
    .take(perPage)
    .getManyAndCount();
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const map = options.map ?? ((row: T) => row as unknown as R);

  return {
    data: rows.map(map),
    pageName: options.pageName ?? 'page',
    currentPage,
    previousPage: currentPage > 1 ? currentPage - 1 : null,
    nextPage: currentPage < lastPage ? currentPage + 1 : null,
    total,
    perPage,
    lastPage,
  };
}
