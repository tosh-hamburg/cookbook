/**
 * Kurzer Signalton für den Timer im Kochmodus (Web Audio, keine Datei nötig).
 * Der AudioContext wird beim ersten Aufruf angelegt – idealerweise aus einer
 * Nutzeraktion heraus (Timer starten), damit Browser ihn nicht blockieren.
 */
let context: AudioContext | null = null;

export function primeChime(): void {
  if (typeof window === 'undefined') return;
  const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  context = context ?? new Ctor();
  if (context.state === 'suspended') {
    context.resume().catch(() => undefined);
  }
}

export function playChime(): void {
  primeChime();
  if (!context) return;

  const now = context.currentTime;
  const notes = [880, 1108.73, 1318.51]; // A5, C#6, E6
  notes.forEach((frequency, index) => {
    const oscillator = context!.createOscillator();
    const gain = context!.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    const start = now + index * 0.18;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
    oscillator.connect(gain).connect(context!.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.55);
  });
}
