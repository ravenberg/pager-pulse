import 'reflect-metadata';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import {
  EncryptHistory,
  SkipCsrf,
  Ssr,
  ValidSignature,
  View,
  always,
  deepMerge,
  defer,
  merge,
  once,
  optional,
  prepend,
  scroll,
} from 'nestjs-mvc';
import { z } from 'zod';
import { Public } from '../auth/public.decorator.js';
import { Responder } from '../auth/roles.decorator.js';
import { XrayService } from './xray.service.js';

const Schema = z.object({ title: z.string(), severity: z.string() });

@Controller('things')
class ThingsController {
  @Get(':id')
  @Ssr()
  @EncryptHistory()
  @View('Things/Show')
  show() {}

  @Post()
  @Responder()
  store(@Body({ schema: Schema }) _body: unknown) {}

  @Public()
  @SkipCsrf()
  @ValidSignature()
  @Post('hook')
  hook() {}
}

const service = () => {
  const discovery = {
    getControllers: () => [{ metatype: ThingsController }],
  } as unknown as DiscoveryService;
  const xray = new XrayService(discovery, new Reflector());
  xray.onApplicationBootstrap();
  return xray;
};

describe('XrayService', () => {
  it('labels every prop helper, at any depth', () => {
    const props = service().describeProps({
      title: 'plain',
      timeline: () => [],
      stats: defer(() => 1, 'charts'),
      tab: optional(() => 1),
      badge: always(1),
      feed: merge([], { matchOn: 'id' }),
      alerts: prepend([]),
      settings: deepMerge({}),
      list: scroll(() => ({ data: [] })),
      users: once(() => [], { as: 'users' }),
      nested: { plain: 1, lazy: defer(() => 1) },
    });

    expect(props).toEqual([
      { path: 'title', kind: 'eager' },
      { path: 'timeline', kind: 'lazy' },
      { path: 'stats', kind: 'defer', detail: 'group charts' },
      { path: 'tab', kind: 'optional' },
      { path: 'badge', kind: 'always' },
      { path: 'feed', kind: 'merge', detail: 'match on id' },
      { path: 'alerts', kind: 'prepend', detail: undefined },
      { path: 'settings', kind: 'deep-merge', detail: undefined },
      { path: 'list', kind: 'scroll', detail: 'data' },
      { path: 'users', kind: 'once', detail: 'users' },
      { path: 'nested.plain', kind: 'eager' },
      { path: 'nested.lazy', kind: 'defer', detail: 'group default' },
    ]);
  });

  it('reads routes from their decorators', () => {
    const routes = service().catalog();
    const by = (handler: string) =>
      routes.find((route) => route.handler === `ThingsController#${handler}`);

    expect(by('show')).toMatchObject({
      method: 'GET',
      path: '/things/:id',
      view: 'Things/Show',
      ssr: true,
      encryptHistory: true,
      public: false,
      props: null,
    });
    expect(by('store')).toMatchObject({
      method: 'POST',
      path: '/things',
      roles: ['admin', 'responder'],
      schema: ['title', 'severity'],
    });
    expect(by('hook')).toMatchObject({
      public: true,
      skipCsrf: true,
      signedUrl: true,
      schema: null,
    });
  });

  it('finds the route of a path, for requests that skip the handler', () => {
    const xray = service();
    expect(xray.routeFor('POST', '/things/hook')).toBe('ThingsController#hook');
    expect(xray.routeFor('GET', '/things/12')).toBe('ThingsController#show');
    expect(xray.routeFor('GET', '/things/12/more')).toBeUndefined();
  });

  it('remembers what it saw a route do', () => {
    const xray = service();
    xray.observe('ThingsController#show', {
      props: [{ path: 'stats', kind: 'defer' }],
    });
    xray.observe('ThingsController#store', { runtime: 'flash' });
    xray.observe('ThingsController#store', { runtime: 'precognition' });

    const routes = xray.catalog();
    expect(routes.find((r) => r.handler.endsWith('#show'))?.props).toEqual([
      { path: 'stats', kind: 'defer' },
    ]);
    expect(routes.find((r) => r.handler.endsWith('#store'))?.runtime).toEqual([
      'flash',
      'precognition',
    ]);
    expect(xray.siblings(ThingsController).map((r) => r.handler)).toEqual([
      'ThingsController#store',
      'ThingsController#hook',
    ]);
  });
});
