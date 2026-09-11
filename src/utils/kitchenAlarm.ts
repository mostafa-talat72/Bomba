// منبه المطبخ: صوت متكرر (WebAudio، بلا ملفات) حتى التأكيد.
// يعمل لكل طلب بمفتاح مستقل — يُوقف يدوياً (تأكيد) أو تلقائياً (جاهز/ملغي/محذوف/موصّل).

const alarms = new Map<string, { timer: ReturnType<typeof setInterval> | null }>();

function playTripleBeep(): void {
  try {
    const AC = (window as any)?.AudioContext || (window as any)?.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    [0, 0.25, 0.5].forEach((dt: number, i: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = i === 2 ? 1200 : 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.001, now + dt);
      gain.gain.exponentialRampToValueAtTime(0.5, now + dt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dt + 0.18);
      osc.start(now + dt);
      osc.stop(now + dt + 0.2);
    });
    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 1500);
  } catch {}
}

export function startKitchenAlarm(key: string): void {
  try {
    if (!key || alarms.has(key)) return;
    playTripleBeep();
    const timer = setInterval(() => {
      try { playTripleBeep(); } catch {}
    }, 4000);
    alarms.set(key, { timer });
  } catch {}
}

export function stopKitchenAlarm(key?: string): void {
  try {
    if (!key) {
      alarms.forEach((a) => {
        try { if (a.timer) clearInterval(a.timer); } catch {}
      });
      alarms.clear();
      return;
    }
    const a = alarms.get(key);
    if (a) {
      try { if (a.timer) clearInterval(a.timer); } catch {}
      alarms.delete(key);
    }
  } catch {}
}

export function isKitchenAlarmRinging(key: string): boolean {
  try {
    return !!key && alarms.has(key);
  } catch {
    return false;
  }
}
