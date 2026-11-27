// "পড়ে শোনাও": reads a text aloud in Bangla when the phone can.
import { toast } from '../../ui/toast.js';

export function speak(text) {
  if (!('speechSynthesis' in window)) return toast('এই ব্রাউজারে পড়ে শোনানো যায় না');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'bn-BD';
  const v = speechSynthesis.getVoices().find(x => x.lang.startsWith('bn'));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
