// The student's own stylesheet loads with the student's first page (not in the first download). Resolves when it is ready (or failed: the pages still work).
export const ready = new Promise(res => {
  if (typeof document === 'undefined' || document.querySelector('link[data-student-css]')) return res();
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = 'ui/student.css'; l.dataset.studentCss = '1';
  l.onload = l.onerror = () => res();
  document.head.append(l);
});
