// print.html: reads the card(s) the app left on this phone (key de.next.print, set by the report page), draws them and opens the print dialog.
// Nothing is sent anywhere (this page's CSP has connect-src 'none'). The print dialog also offers "Save as PDF".
import { sheets } from './features/study/card-print.js';
import { store } from './core/store.js';

const hint = document.getElementById('hint');
const job = store.json('de.next.print');
if (!job?.cards?.length) hint.textContent = 'ছাপার মতো কার্ড পাওয়া যায়নি। রিপোর্ট কার্ডের পাতা থেকে আবার চেষ্টা করুন।';
else {
  document.title = job.title || 'রিপোর্ট কার্ড';
  document.getElementById('sheets').replaceChildren(...sheets(job.cards, { noRank: !!job.noRank }));
  hint.textContent = 'নিচে কার্ড দেখা যাচ্ছে। প্রিন্ট বোতাম চাপুন; "PDF করুন" বেছে নিলে ফাইল হয়ে যাবে।';
  document.getElementById('go').addEventListener('click', () => window.print());
  if (!new URLSearchParams(location.search).has('nodialog')) setTimeout(() => window.print(), 600);
}
