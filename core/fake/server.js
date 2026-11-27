// The fake server for ?fake=<role> (spec 7.2). It replaces core/http.js's transport, so every screen runs its real code
// against made-up answers. It only starts on localhost / 127.0.0.1 / *.test (boot.js decides), never on the real address.
import { createGuardianData } from './guardian-data.js';
import { createStudentData } from './student-data.js';
import { createTeacherData } from './teacher-data.js';
import { createExamData } from './exams-data.js';
import { createOfficeData } from './office-data.js';
import { ACCOUNTS, KIDS, PREVIEW, ATTENDANCE, FAKE_PIN, notices, messages, guardianNotes, directorMessages, staffNotes, STAFF, STUDENTS, EXAM } from './fixtures.js';

export const fakeAllowed = host => host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost') || host.endsWith('.test');
const eqv = (q, k) => { const v = q.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };
const ok = (data, status = 200) => ({ status, data });
const tokensFor = acc => ({ access_token: 'fake-access-' + acc.uid, refresh_token: 'fake-refresh-' + acc.uid, expires_in: 3600, user: { id: acc.uid } });
const accountOf = uid => Object.values(ACCOUNTS).find(a => a.uid === uid);

// params: URLSearchParams-like object. memory: per-run state (consents, pin flag...).
export function createFake(params, { now = () => Date.now() } = {}) {
  const p = k => (params.get ? params.get(k) : params[k]);
  const mem = {
    state: p('state') || 'ok', consentGiven: p('consent') !== 'pending', mustPin: p('pin') === 'forced', consents: new Set(), notesRead: new Set(),
    sent: [], chat: [], fees: null,
  };
  const gd = createGuardianData({ p, now, mem });
  const sd = createStudentData({ p, now, mem, gd });
  const td = createTeacherData({ p, now, mem });
  const ed = createExamData({ p, now, mem });
  const od = createOfficeData({ p, now, mem });
  // Test hooks: the page can flip the state while it runs (offline banner demos).
  const api = { mem, setState(s) { mem.state = s; }, calls: [] };
  const kidsOf = acc => {
    const n = p('kids');
    const ids = n === '0' ? [] : n === '1' ? ['k1'] : n === '3' ? ['k1', 'k2', 'k3'] : acc.kids;
    return ids.map(id => KIDS[id]);
  };
  const delay = ms => new Promise(r => setTimeout(r, ms));
  let me = null;   // the account whose token was last used
  const profile = acc => ({ id: acc.uid, full_name: acc.full_name, role: acc.role, login_id: acc.login_id, phone: acc.phone, coaching_id: 'c1', must_change_pin: mem.mustPin });

  api.transport = async (method, path, { headers = {}, body } = {}) => {
    api.calls.push({ method, path, body });
    const url = new URL(path, 'http://x');
    const route = url.pathname;
    const q = url.searchParams;
    const bearer = (headers.Authorization || '').replace('Bearer fake-access-', '');
    const acc = bearer ? accountOf(bearer) : null;
    const authed = !!acc;
    if (acc) me = acc;
    if (mem.state === 'offline') return { status: 0, data: null };

    // ---- auth ----
    if (route === '/functions/v1/login') {
      const id = String(body?.login_id || '');
      if (id === 'locked') return ok({ error: 'too many tries', retry_after: 600 }, 429);
      if (id === 'busy') return ok({ error: 'try again' }, 503);
      const a = ACCOUNTS[id];
      if (a && String(body.pin) === FAKE_PIN) { me = a; return ok(tokensFor(a)); }
      return ok({ error: 'wrong login id or PIN' }, 401);
    }
    if (route === '/auth/v1/token') {
      const a = accountOf(String(body?.refresh_token || '').replace('fake-refresh-', ''));
      return a ? ok(tokensFor(a)) : ok({ error: 'bad refresh' }, 400);
    }
    if (route === '/auth/v1/user' && method === 'PUT') return authed ? ok({ id: acc.uid }) : ok({}, 401);
    if (route === '/auth/v1/logout') return ok(null, 204);
    // ---- public ----
    if (route === '/rest/v1/rpc/submit_admission_inquiry') {
      if (!body?.p_child_name || !body?.p_phone) return ok({ message: 'invalid inquiry' }, 400);
      if (body.p_phone === '01700000000') return ok({ message: 'too many requests' }, 400);
      mem.sent.push(body);
      if (mem.state === 'error') return ok({ message: 'boom' }, 500);
      return ok(null);
    }
    if (!authed) return ok({ message: 'JWT required' }, 401);

    // the app's own start-up calls are not part of the state demos (a stuck start would hide the screen being demonstrated)
    if (route === '/rest/v1/profiles' && !url.searchParams.get('role')) return ok([profile(acc)]);
    if (route === '/rest/v1/rpc/my_features') return ok(['attendance', 'ratings', 'reports', 'fees', 'notices', 'chat', 'games', 'battles', 'decor', 'tournament'].map(key => ({ key, tier: 'core' })));
    if (route === '/rest/v1/rpc/log_app_open') return ok(null);
    if (route === '/rest/v1/rpc/pin_changed') { mem.mustPin = false; return ok(null); }
    if (route === '/rest/v1/consents') { if (method === 'POST') { mem.consentGiven = true; return ok(null, 201); } return ok(mem.consentGiven ? [{ profile_id: acc.uid }] : []); }
    if (route === '/rest/v1/weather_now' && mem.state !== 'offline') { const w = p('weather'); if (w === 'none') return ok([]); if (w === 'missing') return ok({ message: 'no table' }, 404); return ok([{ id: 1, fetched_at: new Date(now() - (w === 'old' ? 5 * 3600e3 : 30 * 60e3)).toISOString(), weather_code: 2, temperature_c: 26, cloud_cover_pct: 40, precipitation_mm: 0, sunrise: '06:27', sunset: '17:08' }]); }
    // ---- states for data calls ----
    if (mem.state === 'loading') return new Promise(() => {});
    if (mem.state === 'slow') await delay(12000);
    if (mem.state === 'error') return ok({ message: 'boom' }, 500);
    if (mem.state === 'forbidden') return ok({ message: 'forbidden' }, 403);
    const empty = mem.state === 'empty';
    const t = route.replace('/rest/v1/', '');
    const need = (...roles) => (roles.includes(acc.role) ? null : ok({ message: 'only' }, 403));

    if (route.startsWith('/rest/v1/rpc/')) {
      const name = t.replace('rpc/', '');
      if (acc.role === 'student') { const r = sd.rpc(name, body); if (r) return r; }
      if (acc.role === 'teacher') { const r = ed.rpc(name, body) || td.rpc(name, body); if (r) return r; }
      if (acc.role === 'admin') { const r = od.rpc(name, body, acc); if (r) return r; }
      switch (name) {
        case 'my_features': return ok(['attendance', 'ratings', 'reports', 'fees', 'notices', 'chat', 'games', 'battles', 'decor', 'tournament'].map(key => ({ key, tier: 'core' })));
        case 'log_app_open': case 'mark_notes_read': case 'mark_staff_notes_read': return ok(null);
        case 'pin_changed': mem.mustPin = false; return ok(null);
        case 'today_guardian': {
          const forbid = need('guardian'); if (forbid) return forbid;
          const kids = empty ? [] : kidsOf(acc);
          return ok({ day: '2026-11-22', children: kids.map(k => ({
            student_id: k.student_id, name: k.name, class_level: k.class_level, attendance: ATTENDANCE[k.student_id], checked_in_at: ATTENDANCE[k.student_id] === 'present' ? new Date(now()).toISOString() : null,
            excused_absence: false, early_leave_confirmed: false,
            latest_notice: { id: 'n0', title: 'শুক্রবার মডেল টেস্ট, সকাল ৯টায় আসবে।', created_at: new Date(now() - 2 * 3600e3).toISOString() },
            report: k.student_id === 'k1' ? { id: 'rc-k1-0', title: 'সাপ্তাহিক রিপোর্ট কার্ড', seen: !!mem.seen?.has('rc-k1-0') } : null,
            fees_unpaid: (() => { const o = (gd.fees()[k.student_id] || []).filter(f => f.paid_amount < f.amount); return { months: o.length, due: o.reduce((a, f) => a + f.amount - f.paid_amount, 0) }; })(),
            preview: p('preview') === 'derived' ? undefined : PREVIEW[k.student_id] || null,
          })) });
        }
        case 'today_student': return ok({ day: '2026-11-22', tasks: [{ id: 'h1', title: 'গণিত অনুশীলনী ৫.২', due_date: '2026-11-23' }], next_exam: null, rewards: { stars: 12, streak_days: 5, last_active_date: '2026-11-22' } });
        case 'today_teacher': return ok({ day: '2026-11-22', current: null, next: null, roster: [], not_rated: 0, marks_due: [] });
        case 'today_admin': return ok({ needs_review: 3, early_leave_open: 1, fee_call: 12, chat_reports_open: 0, report_drafts: 2 });
        case 'student_consent_on': return ok(mem.consents.has(body.p_student + '|' + body.p_purpose) && !(body.p_student === 'k2' && body.p_purpose === 'photo_publish'));   // k2 photo: the other guardian said no
        case 'set_student_consent': mem.consents[body.p_granted ? 'add' : 'delete'](body.p_student_id + '|' + body.p_purpose); if (p('consent') === 'fail') return ok({ message: 'boom' }, 500); return ok(null);
        case 'start_exam': {
          if (body?.p_exam === 'oe-taken') return ok({ message: 'exam already taken' }, 409);
          if (body?.p_exam === 'oe-limit') return ok({ message: 'daily practice exam limit reached' }, 400);
          return ok({ ...EXAM, deadline_at: new Date(now() + 15 * 60e3).toISOString() });
        }
        case 'log_exam_event': return ok(null);
        case 'submit_exam': {
          mem.submitted ||= new Set();
          if (mem.submitted.has(body.p_attempt)) return ok({ message: 'already submitted' }, 400);   // once per attempt, as the server does
          mem.submitted.add(body.p_attempt);
          mem.st?.attempts.unshift({ id: body.p_attempt, exam_id: 'oe1', score: Math.min(body.p_answers.length, 3), total: EXAM.questions.length, submitted_at: new Date(now()).toISOString(), exam: { title: EXAM.title, kind: 'practice' } });
          return ok({ submitted: true });
        }
        default: { const g = gd.rpc(name, body); return g || ok({ message: 'function not found' }, 404); }
      }
    }
    if (route.startsWith('/storage/v1/object/sources/')) return acc.role === 'teacher' || acc.role === 'admin' ? ed.upload(route) : ok({ message: 'forbidden' }, 403);
    if (route === '/functions/v1/extract-source') return acc.role === 'teacher' || acc.role === 'admin' ? ed.worker() : ok({ message: 'staff only' }, 403);
    if (route.startsWith('/functions/v1/')) { const g = gd.fn(route.replace('/functions/v1/', ''), body); return g || ok({ message: 'function not found' }, 404); }
    const tname = t.split('?')[0];
    if (acc.role === 'teacher') { const g = ed.table(tname, q, method, body) || od.table(tname, q, method, body, acc) || td.table(tname, q, method, body); if (g) return g; }
    if (acc.role === 'admin') { const g = od.table(tname, q, method, body, acc); if (g) return g; }
    if (acc.role === 'student' && tname !== 'fees') { const g = sd.table(tname, q, method, body) || gd.table(tname, q); if (g) return g; }
    if (acc.role === 'guardian' && tname !== 'messages') { const g = gd.table(tname, q); if (g) return g; }
    switch (tname) {
      case 'profiles': return ok([profile(acc)]);
      case 'weather_now': {
        const w = p('weather');
        if (w === 'none' || w === 'missing') return w === 'missing' ? ok({ message: 'no table' }, 404) : ok([]);
        return ok([{ id: 1, fetched_at: new Date(now() - (w === 'old' ? 5 * 3600e3 : 30 * 60e3)).toISOString(), weather_code: 2, temperature_c: 26, cloud_cover_pct: 40, precipitation_mm: 0, sunrise: '06:27', sunset: '17:08' }]);
      }
      case 'consents':
        if (method === 'POST') { mem.consentGiven = true; return ok(null, 201); }
        return ok(mem.consentGiven ? [{ profile_id: acc.uid }] : []);
      case 'student_consents': { const sid = (q.get('student_id') || '').replace('eq.', ''); return ok([...mem.consents].filter(x => x.startsWith(sid + '|')).map(x => ({ purpose: x.split('|')[1] }))); }
      case 'deletion_requests': return ok(null, 201);
      case 'guardian_students': return ok(kidsOf(acc).map(k => ({ student_id: k.student_id })));
      case 'students': {
        if (!['teacher', 'admin'].includes(acc.role)) return ok(kidsOf(acc).map(k => ({ id: k.student_id, class_level: k.class_level, roll: k.roll, active: true, batch: { shift: k.shift === 'সকাল' ? 'morning' : 'afternoon' }, profile: { full_name: k.name, login_id: k.login_id, phone: null } })));
        return ok(empty ? [] : STUDENTS);
      }
      case 'notices': return ok(empty ? [] : notices(now(), p('inbox') === 'many' ? 70 : p('inbox') === 'empty' ? 0 : 8).filter(n => n.audience === 'all' || n.audience === { guardian: 'guardians', student: 'students', teacher: 'teachers', admin: 'teachers' }[acc.role]));
      case 'messages':
        if (p('inbox') === 'partial') return ok({ message: 'boom' }, 500);
        if (method === 'POST') { mem.chat.push({ ...body, created_at: new Date(now()).toISOString() }); return ok(null, 201); }
        return ok(empty || p('inbox') === 'empty' || !['guardian', 'teacher', 'admin'].includes(acc.role) ? [] : [...messages(now()), ...mem.chat].filter(m => !eqv(q, 'thread_student_id') || m.thread_student_id === eqv(q, 'thread_student_id')));
      case 'staff_public': return ok(STAFF);
      case 'guardian_notes': return ok(empty || p('inbox') === 'empty' || acc.role !== 'guardian' ? [] : guardianNotes(now()));
      case 'director_messages': return ok(empty || p('inbox') === 'empty' || acc.role !== 'guardian' ? [] : directorMessages(now()));
      case 'staff_notes': return ok(empty || p('inbox') === 'empty' || !['teacher', 'admin'].includes(acc.role) ? [] : staffNotes(now()));
      default: return ok({ message: 'relation not found' }, 404);
    }
  };
  api.session = acc => (acc ? { access: 'fake-access-' + acc.uid, refresh: 'fake-refresh-' + acc.uid, uid: acc.uid } : null);
  return api;
}
