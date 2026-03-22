import test from 'node:test';
import assert from 'node:assert/strict';
import { clientPackages } from '../public/packages.js';
import {
  buildWixLandingElement,
  buildWixPreviewHtml,
  DEFAULT_WIX_APP_BASE_URL,
  WIX_WIDGET_TAG_NAME,
} from '../scripts/_lib/wix-custom-element.mjs';

test('wix custom element build includes the TraceWorks package catalog and widget tag', () => {
  const source = buildWixLandingElement();

  assert.ok(source.includes(`customElements.define(WIDGET_TAG, TraceworksLanding)`));
  assert.ok(source.includes(DEFAULT_WIX_APP_BASE_URL));
  assert.ok(source.includes(WIX_WIDGET_TAG_NAME));

  for (const pkg of clientPackages) {
    assert.ok(source.includes(pkg.id), `Missing package id ${pkg.id} in Wix bundle`);
    assert.ok(source.includes(pkg.name), `Missing package name ${pkg.name} in Wix bundle`);
  }
});

test('wix preview build references the generated custom element bundle', () => {
  const html = buildWixPreviewHtml();

  assert.ok(html.includes('<traceworks-landing'));
  assert.ok(html.includes('traceworks-landing.element.js'));
  assert.ok(html.includes(DEFAULT_WIX_APP_BASE_URL));
});
