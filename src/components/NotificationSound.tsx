import React, { useEffect } from 'react';

interface NotificationSoundProps {
  playSound: boolean;
  soundType?: 'default' | 'success' | 'warning' | 'error' | 'urgent';
  onSoundPlayed?: () => void;
}

// AudioContext عالمي واحد فقط
let audioContext: AudioContext | null = null;
const getAudioContext = () => {
  if (!audioContext) {
    const win = window as unknown as { webkitAudioContext?: typeof AudioContext };
    audioContext = new (window.AudioContext || win.webkitAudioContext)();
  }
  return audioContext;
};

// دالة مساعدة لتشغيل الصوت بعد تفاعل المستخدم إذا لزم الأمر
const resumeAudioContextIfNeeded = async (): Promise<void> => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    return new Promise((resolve) => {
      const resume = () => {
        ctx.resume().then(resolve);
        window.removeEventListener('click', resume);
        window.removeEventListener('keydown', resume);
      };
      window.addEventListener('click', resume);
      window.addEventListener('keydown', resume);
    });
  }
};

const NotificationSound: React.FC<NotificationSoundProps> = ({
  playSound,
  soundType = 'default',
  onSoundPlayed
}) => {
  // تشغيل الصوت
  const playNotificationSound = async () => {
    try {
      await resumeAudioContextIfNeeded();
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // تحديد التردد والمدة حسب نوع الصوت
      let frequency = 800;
      let duration = 0.3;

      switch (soundType) {
        case 'success':
          frequency = 1000;
          duration = 0.2;
          break;
        case 'warning':
          frequency = 600;
          duration = 0.4;
          break;
        case 'error':
          frequency = 400;
          duration = 0.6;
          break;
        case 'urgent':
          frequency = 800;
          duration = 0.5;
          // نغمة متكررة للعاجل
          for (let i = 0; i < 3; i++) {
            setTimeout(() => {
              const urgentOscillator = ctx.createOscillator();
              const urgentGainNode = ctx.createGain();
              urgentOscillator.connect(urgentGainNode);
              urgentGainNode.connect(ctx.destination);
              urgentOscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
              urgentGainNode.gain.setValueAtTime(0.2, ctx.currentTime);
              urgentGainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
              urgentOscillator.start(ctx.currentTime);
              urgentOscillator.stop(ctx.currentTime + 0.1);
            }, i * 150);
          }
          onSoundPlayed?.();
          return;
        default:
          frequency = 800;
          duration = 0.3;
          break;
      }

      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);

      // تنظيف بعد التشغيل
      setTimeout(() => {
        onSoundPlayed?.();
      }, duration * 1000);

    } catch (error) {
      onSoundPlayed?.();
    }
  };

  // تشغيل الصوت عند تغيير playSound
  useEffect(() => {
    if (playSound) {
      playNotificationSound();
    }
  }, [playSound, soundType]);

  return null; // هذا المكون لا يعرض أي شيء مرئي
};

export default NotificationSound;
