// أصوات تنبيه بسيطة عبر WebAudio — بدون ملفات صوتية
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    const audioContext = ctx;
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  } catch { return null; }
}

export function isSoundEnabled(): boolean {
  return localStorage.getItem('pos_sound_alerts') !== 'off';
}

export function setSoundEnabled(on: boolean) {
  localStorage.setItem('pos_sound_alerts', on ? 'on' : 'off');
}

function tone(freq: number, startMs: number, durationMs: number, gain = 0.08) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, c.currentTime + startMs / 1000);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (startMs + durationMs) / 1000);
  osc.connect(g); g.connect(c.destination);
  osc.start(c.currentTime + startMs / 1000);
  osc.stop(c.currentTime + (startMs + durationMs) / 1000 + 0.05);
}

/** تنبيه الجلسة الطويلة (نغمتان) */
export function playWarnBeep() {
  if (!isSoundEnabled()) return;
  tone(880, 0, 180); tone(660, 220, 220);
}

/** تنبيه الجلسة الحرجة جداً (ثلاث نغمات) */
export function playDangerBeep() {
  if (!isSoundEnabled()) return;
  tone(988, 0, 150); tone(988, 180, 150); tone(740, 380, 320);
}
