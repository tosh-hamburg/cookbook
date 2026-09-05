import { describe, expect, test } from 'vitest';
import { assertPublicHttpUrl, BlockedUrlError, isPrivateIPv4, isPrivateIPv6 } from './url-guard.js';

describe('assertPublicHttpUrl', () => {
  test.each([
    'https://www.chefkoch.de/rezepte/123/Lasagne.html',
    'http://gesuender-kochen.faz.net/?recipeId=97348',
    'https://example.test:8443/rezept?a=1#zutaten',
  ])('lässt öffentliche http(s)-Adressen durch: %s', (url) => {
    expect(assertPublicHttpUrl(url)).toContain('example.test' in {} ? '' : '');
    expect(() => assertPublicHttpUrl(url)).not.toThrow();
  });

  test.each([
    ['file:///etc/passwd', /Protokoll/],
    ['ftp://example.test/rezept', /Protokoll/],
    ['gopher://example.test/1', /Protokoll/],
  ])('blockt fremde Protokolle: %s', (url, expected) => {
    expect(() => assertPublicHttpUrl(url)).toThrow(expected);
  });

  test.each([
    'http://localhost:4002/api/recipes',
    'http://LOCALHOST/api',
    'http://synology.local/geheim',
    'http://dienst.internal/geheim',
  ])('blockt lokale Namen: %s', (url) => {
    expect(() => assertPublicHttpUrl(url)).toThrow(/lokalen Netz/);
  });

  test.each([
    'http://127.0.0.1:4002/api/recipes',
    'http://10.0.0.5/admin',
    'http://192.168.4.59/webman',
    'http://172.20.0.3:4002/api',
    'http://169.254.169.254/latest/meta-data/', // Cloud-Metadaten
    'http://[::1]:4002/api',
    'http://[fd00::1]/api',
  ])('blockt private und reservierte Adressen: %s', (url) => {
    expect(() => assertPublicHttpUrl(url)).toThrow(/privaten oder reservierten/);
  });

  test('blockt Docker-Dienstnamen ohne Punkt', () => {
    expect(() => assertPublicHttpUrl('http://backend:4002/api/recipes')).toThrow(/kein öffentlicher Name/);
  });

  test('blockt einen Punkt am Ende, der die lokale Endung verstecken soll', () => {
    expect(() => assertPublicHttpUrl('http://localhost./api')).toThrow(/lokalen Netz/);
  });

  test('meldet unsinnige Eingaben als BlockedUrlError', () => {
    expect(() => assertPublicHttpUrl('gar keine url')).toThrow(BlockedUrlError);
  });

  test('nennt die abgelehnte URL in der Meldung', () => {
    expect(() => assertPublicHttpUrl('http://10.1.2.3/x')).toThrow(/http:\/\/10\.1\.2\.3\/x/);
  });
});

describe('isPrivateIPv4', () => {
  test.each(['0.0.0.0', '10.255.255.254', '127.0.0.1', '100.64.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.1.1', '224.0.0.1'])(
    'erkennt %s als nicht öffentlich',
    (host) => {
      expect(isPrivateIPv4(host)).toBe(true);
    },
  );

  test.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '192.167.1.1'])(
    'erkennt %s als öffentlich',
    (host) => {
      expect(isPrivateIPv4(host)).toBe(false);
    },
  );

  test('behandelt Hostnamen, die keine IPv4-Adresse sind, als öffentlich', () => {
    expect(isPrivateIPv4('example.test')).toBe(false);
  });
});

describe('isPrivateIPv6', () => {
  test.each(['::1', '[::1]', 'fe80::1', 'fd00::1', 'fc00::1', '::ffff:127.0.0.1'])(
    'erkennt %s als nicht öffentlich',
    (host) => {
      expect(isPrivateIPv6(host)).toBe(true);
    },
  );

  test.each(['2001:4860:4860::8888', '2606:4700:4700::1111'])('erkennt %s als öffentlich', (host) => {
    expect(isPrivateIPv6(host)).toBe(false);
  });

  test('ignoriert Werte ohne Doppelpunkt', () => {
    expect(isPrivateIPv6('example.test')).toBe(false);
  });
});
