import React, { useEffect } from 'react';

interface NotificationSoundProps {
  playSound: boolean;
  soundType?: 'default' | 'success' | 'warning' | 'error' | 'urgent';
  onSoundPlayed?: () => void;
}

const NotificationSound: React.FC<NotificationSoundProps> = ({
  playSound,
  soundType = 'default',
  onSoundPlayed
}) => {
  // تشغيل الصوت
  const playNotificationSound = async () => {
    try {
      // إنشاء نغمة بسيطة باستخدام Web Audio API
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

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
              const urgentOscillator = audioContext.createOscillator();
              const urgentGainNode = audioContext.createGain();
              urgentOscillator.connect(urgentGainNode);
              urgentGainNode.connect(audioContext.destination);
              urgentOscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
              urgentGainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
              urgentGainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
              urgentOscillator.start(audioContext.currentTime);
              urgentOscillator.stop(audioContext.currentTime + 0.1);
            }, i * 150);
          }
          onSoundPlayed?.();
          return;
        default:
          frequency = 800;
          duration = 0.3;
          break;
      }

      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);

      // تنظيف بعد التشغيل
      setTimeout(() => {
        onSoundPlayed?.();
      }, duration * 1000);

    } catch (error) {
      console.error('Error playing notification sound:', error);
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
