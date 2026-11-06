// "See your ad": reading a brand's page, and refusing anything that is not a public website.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePage, privateIp, readSite } from '../lib/preview.mjs';

test('reads the brand name, line, picture and colour from a page', () => {
  const html = `<html><head><title>Juniper Coffee | Small-batch beans from Austin</title>
    <meta property="og:site_name" content="Juniper Coffee"><meta name="description" content="Roasted on Tuesday, at your door by Friday &amp; never stale.">
    <meta property="og:image" content="/img/share.jpg"><meta name="theme-color" content="#2F5D50"></head>`;
  const ad = parsePage(html, new URL('https://www.juniper.example/shop'));
  assert.deepEqual(ad, { name: 'Juniper Coffee', line: 'Roasted on Tuesday, at your door by Friday & never stale.', image: 'https://www.juniper.example/img/share.jpg', color: '#2f5d50', host: 'juniper.example' });
  const bare = parsePage('<title>Smoke + Salt — Texas barbecue</title>', new URL('http://smoke.example'));
  assert.equal(bare.name, 'Smoke + Salt');
  assert.equal(bare.line, 'Texas barbecue');
  assert.equal(bare.image, '');
});

test('refuses private and local addresses, also after a redirect', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.9', '172.20.0.1', '169.254.169.254', '100.107.93.83', '::1', 'fd00::1', '::ffff:127.0.0.1']) assert.ok(privateIp(ip), ip);
  for (const ip of ['129.146.26.28', '8.8.8.8', '2606:4700::1111']) assert.ok(!privateIp(ip), ip);
  const resolve = async (h) => [{ address: h === 'inside.example' ? '10.0.0.5' : '93.184.216.34' }];
  await assert.rejects(readSite('http://127.0.0.1/', fetch, resolve), /not a public website/);
  await assert.rejects(readSite('inside.example', fetch, resolve), /not a public website/);
  await assert.rejects(readSite('https://brand.example:8080/', fetch, resolve), /normal web address/);
  const hops = [];
  const fake = async (u) => { hops.push(String(u)); return new Response('', { status: 302, headers: { location: 'https://inside.example/' } }); };
  await assert.rejects(readSite('brand.example', fake, resolve), /not a public website/);
  assert.deepEqual(hops, ['https://brand.example/']);
  const ok = async () => new Response('<title>Brand</title><meta name="description" content="A line">');
  assert.deepEqual(await readSite('brand.example', ok, resolve), { name: 'Brand', line: 'A line', image: '', color: '', host: 'brand.example' });
});
