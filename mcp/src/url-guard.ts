/**
 * Schutz gegen SSRF beim Import.
 *
 * Die Import-URL wird vom Backend serverseitig abgerufen. Ein Modell, das eine
 * URL aus einem fremden Dokument übernimmt, könnte das Backend sonst dazu
 * bringen, interne Adressen abzurufen (Docker-Dienste, Router-Oberflächen,
 * Metadaten-Endpunkte von Cloud-Anbietern). Deshalb lässt der MCP-Server nur
 * http(s) auf öffentlich erreichbare Hosts durch.
 *
 * Das ist eine zusätzliche Schicht, kein Ersatz für Prüfungen im Backend: Ein
 * öffentlicher Name kann per DNS weiterhin auf eine interne Adresse zeigen.
 */

/** Hostnamen, die immer auf den eigenen Rechner zeigen. */
const LOCAL_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback']);

/** Endungen, die per Konvention nur im lokalen Netz aufgelöst werden. */
const LOCAL_SUFFIXES = ['.local', '.localhost', '.internal', '.intranet', '.home.arpa'];

export class BlockedUrlError extends Error {
  constructor(url: string, reason: string) {
    super(`Diese URL wird nicht abgerufen (${reason}): ${url}`);
    this.name = 'BlockedUrlError';
  }
}

/** Prüft, ob eine IPv4-Adresse in einem privaten oder sonst nicht routbaren Bereich liegt. */
export function isPrivateIPv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;

  const [a, b] = match.slice(1, 3).map(Number);
  if (a === undefined || b === undefined) return false;

  return (
    a === 0 || // "dieses Netz"
    a === 10 || // privat
    a === 127 || // Loopback
    (a === 100 && b >= 64 && b <= 127) || // Carrier-Grade NAT
    (a === 169 && b === 254) || // Link-Local, inkl. Cloud-Metadaten 169.254.169.254
    (a === 172 && b >= 16 && b <= 31) || // privat
    (a === 192 && b === 168) || // privat
    a >= 224 // Multicast und reserviert
  );
}

/** Prüft, ob eine IPv6-Adresse lokal oder eindeutig lokal ist. */
export function isPrivateIPv6(host: string): boolean {
  const address = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!address.includes(':')) return false;
  return (
    address === '::1' ||
    address === '::' ||
    address.startsWith('fe80:') || // Link-Local
    address.startsWith('fc') || // Unique Local
    address.startsWith('fd') ||
    address.startsWith('::ffff:') // IPv4-gemappt
  );
}

/**
 * Gibt die URL normalisiert zurück oder wirft {@link BlockedUrlError}.
 */
export function assertPublicHttpUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError(raw, 'keine gültige URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedUrlError(raw, `Protokoll ${url.protocol} ist nicht erlaubt, nur http und https`);
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');

  if (LOCAL_HOSTNAMES.has(hostname) || LOCAL_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new BlockedUrlError(raw, 'Host liegt im lokalen Netz');
  }
  if (isPrivateIPv4(hostname) || isPrivateIPv6(url.hostname)) {
    throw new BlockedUrlError(raw, 'IP-Adresse liegt in einem privaten oder reservierten Bereich');
  }
  // Ein Name ohne Punkt ist im Docker-Netz ein Dienstname (z. B. "backend").
  if (!hostname.includes('.') && !hostname.includes(':')) {
    throw new BlockedUrlError(raw, 'Host ist kein öffentlicher Name');
  }

  return url.toString();
}
