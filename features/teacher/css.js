// The teacher's stylesheet loads with the teacher's first page (not in the first download). Resolves when it is ready (or failed: the pages still work).
export const ready = new Promise(res => {
  if (typeof document === 'undefined' || document.querySelector('link[data-teacher-css]')) return res();
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = 'ui/teacher.css'; l.dataset.teacherCss = '1';
  l.onload = l.onerror = () => res();
  document.head.append(l);
});
