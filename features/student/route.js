// Which page /learn/*, /play/* and /me/* shows (student only). Loaded when one of these pages is first opened. -> { tab, title, back, result } | null
import { ready } from './css.js';

const T = {
  syllabus: ['study', 'সিলেবাস'], materials: ['study', 'নোট ও ভিডিও'], quiz: ['study', 'কুইজ'], mistakes: ['study', 'ভুল শুধরে নেওয়ার খাতা'], revision: ['study', 'পড়ার পরিকল্পনা'], exams: ['study', 'অনলাইন পরীক্ষা'],
  results: ['study', 'পরীক্ষার ফল'], report: ['study', 'রিপোর্ট কার্ড'], homework: ['study', 'বাড়ির কাজ'], merit: ['study', 'মেধা তালিকা'], ratings: ['more', 'রেটিং ও প্রশংসা'], goals: ['more', 'আমার লক্ষ্য'], certs: ['more', 'সার্টিফিকেট'],
  flash: ['study', 'ফ্ল্যাশকার্ড'], doubts: ['study', 'প্রশ্ন বক্স'], focus: ['study', 'ফোকাস টাইমার'], diffy: ['study', 'ডিফি'],
};
const P = { tournament: 'সাপ্তাহিক টুর্নামেন্ট', teams: 'দল ও লড়াই', games: 'শেখার খেলা', board: 'ক্লাসের তালিকা', shop: 'পয়েন্টের দোকান', decor: 'সাজঘর', chat: 'বন্ধুদের সাথে চ্যাট', duel: 'কুইজ ডুয়েল' };

export async function studentPageFor(segs, ctx, query = {}) {
  await ready;
  const [area, name, arg] = segs;
  if (area === 'learn') {
    const [tab, title] = T[name] || [];
    if (!tab) return null;
    const L = await import('./learn.js'), X = ['flash', 'doubts', 'focus', 'diffy'].includes(name) ? await import('./extra.js') : null;
    const study = ['materials', 'revision', 'results', 'ratings', 'goals', 'certs'].includes(name) ? await import('../study/pages.js') : null;
    const result = name === 'flash' ? X.flashPage() : name === 'doubts' ? X.doubtsPage(ctx) : name === 'focus' ? X.focusPage() : name === 'diffy' ? X.diffyPage(ctx) : name === 'syllabus' ? L.syllabusPage(ctx) : name === 'homework' ? L.homeworkPage() : name === 'mistakes' ? L.mistakesPage(ctx) : name === 'exams' ? L.examsPage(ctx) : name === 'merit' ? L.meritPage(ctx)
      : name === 'quiz' ? (arg ? L.quizPage(ctx, arg) : L.quizListPage(ctx)) : name === 'report' ? (await import('../study/report.js')).reportPage()
      : name === 'materials' ? study.materialsPage(query.kind) : name === 'revision' ? study.revisionPage() : name === 'results' ? study.resultsPage() : name === 'ratings' ? study.ratingsPage() : name === 'goals' ? study.goalsPage() : study.certsPage();
    return { tab, title: name === 'quiz' && arg ? 'কুইজ খেলো' : title, back: true, result };
  }
  if (area === 'play') {
    if (!P[name]) return null;
    const PL = ['tournament', 'teams', 'board', 'shop', 'decor'].includes(name) ? await import('./play.js') : null;
    let result;
    if (name === 'duel') result = (await import('./extra.js')).duelPage();
    else if (name === 'games') { const G = await import('./games.js'); result = arg ? G.gamePage(ctx, arg) : G.gamesPage(ctx); }
    else if (name === 'chat') { const C = await import('./chat.js'); result = arg ? C.chatPage(ctx, arg) : C.chatListPage(ctx); }
    else result = name === 'tournament' ? PL.tournamentPage(ctx) : name === 'teams' ? PL.teamsPage() : name === 'board' ? PL.boardPage() : name === 'shop' ? PL.shopPage() : PL.decorPage();
    return { tab: 'play', title: P[name], back: true, result };
  }
  if (area === 'me' && name === 'profile') return { tab: 'more', title: 'আমার প্রোফাইল', back: true, result: (await import('./profile.js')).profilePage(ctx) };
  return null;
}
