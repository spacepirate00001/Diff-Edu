// ডিফি the mascot. Fills .de-mascot boxes from assets/diffy-sprite.svg (one fetch, offline-cacheable).
// Diffy.make("happy"|"cheering"|"encouraging"|"sleepy"|"oops") -> span; Diffy.set(span, expr); Diffy.attachTap(button, bubble, mascotSpan).
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var sprite = null, waiting = [];
  // Tap pool: short, kind, never shaming, fine for a class 9 student too.
  var LINES = [
    "চেষ্টা করতে থাকো, তুমি পারবে!",
    "একটু একটু করেই তো বড় হওয়া।",
    "ভুল করলে শিখি, এটাই তো মজা!",
    "আজ নতুন কিছু শেখা হোক!",
    "ক্লাসে আসাই অর্ধেক জয়।",
    "ছোট্ট বিরতি নাও, পানি খেয়ে নাও।",
    "দারুণ হচ্ছে, থেমো না!",
    "তোমার হাসিটাই সেরা!"
  ];
  var at = Math.floor(Math.random() * LINES.length);

  function paint(box) {
    var svg = box.firstChild, sym = sprite && sprite.querySelector('[id="df-' + box.getAttribute("data-expr") + '"]');
    if (!sym) { if (!sprite) waiting.push(box); return; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    for (var n = sym.firstChild; n; n = n.nextSibling) svg.appendChild(document.importNode(n, true));
  }
  function set(box, expr) { box.setAttribute("data-expr", expr); paint(box); }
  function make(expr, cls) {
    var box = document.createElement("span");
    box.className = "de-mascot" + (cls ? " " + cls : "");
    box.setAttribute("aria-hidden", "true");
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    svg.setAttribute("focusable", "false");
    box.appendChild(svg);
    set(box, expr);
    return box;
  }
  function attachTap(button, bubble, box) {
    button.addEventListener("click", function () {
      at = (at + 1) % LINES.length;   // always a different line from the last one
      bubble.textContent = LINES[at];
      box.classList.remove("is-hop");
      void box.offsetWidth;
      box.classList.add("is-hop");
    });
    box.addEventListener("animationend", function (e) { if (e.animationName === "de-hop") box.classList.remove("is-hop"); });
  }

  window.Diffy = { make: make, set: set, attachTap: attachTap };

  fetch("ui/assets/diffy-sprite.svg").then(function (r) { return r.text(); }).then(function (t) {
    sprite = new DOMParser().parseFromString(t, "image/svg+xml");
    waiting.splice(0).forEach(paint);
    [].forEach.call(document.querySelectorAll("[data-diffy]"), function (h) {
      var box = make(h.getAttribute("data-diffy"));
      h.appendChild(box);
    });
  }).catch(function () { /* no mascot, the screen still works */ });
})();
