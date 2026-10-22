/* =====================================================
   MINIGAME: Fael & Aii (gendong-gendongan)
   Cara pakai: taruh file ini sejajar index.html, lalu
   tambahkan SEBELUM </body> (setelah script utama):
   <script src="minigame.js"></script>
   ===================================================== */
(function () {
  "use strict";

  /* ---------- PENGATURAN ---------- */
  const TARGET = 23;                 // skor untuk menang
  const PESAN_MENANG = "Good Game Sayang";
  const COL_MAN = ["#ffffff", "#0b0b0f"];   // laki-laki: putih | hitam
  const COL_GIRL = ["#ffe14d", "#ff6fae"];  // perempuan: kuning | pink
  const GLOW_MAN = "rgba(255,255,255,.95)"; // glow laki-laki (putih)
  const GLOW_GIRL = "#ffa07a";              // glow perempuan (campuran kuning + pink)
  let glow = GLOW_MAN;

  /* ---------- INJEKSI CSS ---------- */
  const css = document.createElement("style");
  css.textContent = `
    nav{overflow-x:auto;scrollbar-width:none}
    nav::-webkit-scrollbar{display:none}
    nav button{flex:0 0 auto}
    #t4.on{display:flex;justify-content:center;align-items:flex-start;padding-left:10px;padding-right:10px}
    #gwrap{position:relative;width:min(720px,94vw);margin-top:6px;border-radius:22px;padding:5px;
      background:linear-gradient(135deg,#ff4d8d,#3a0f24,#ff9ec4);box-shadow:0 0 40px rgba(255,77,141,.55);
      touch-action:manipulation;user-select:none;-webkit-user-select:none}
    #gcv{display:block;width:100%;height:auto;border-radius:18px;background:#120810;cursor:pointer;touch-action:manipulation}
    #ghint{text-align:center;margin-top:10px;font-size:.85rem;opacity:.7}
  `;
  document.head.appendChild(css);

  /* ---------- INJEKSI NAVBAR + TAB ---------- */
  const nav = document.querySelector("nav");
  const main = document.querySelector("#main");
  const btn = document.createElement("button");
  btn.dataset.t = "t4";
  btn.textContent = "Game";
  nav.appendChild(btn);

  const tab = document.createElement("div");
  tab.className = "tab";
  tab.id = "t4";
  tab.innerHTML =
    '<div><div id="gwrap"><canvas id="gcv"></canvas></div>' +
    '<div id="ghint">Tap / klik layar / tekan Spasi untuk loncat ♥</div></div>';
  main.appendChild(tab);

  // handler sendiri (karena tombol dibuat setelah handler navbar utama terpasang)
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav button,.tab").forEach((x) => x.classList.remove("on"));
    btn.classList.add("on");
    tab.classList.add("on");
  });

  /* ---------- CANVAS ---------- */
  const W = 720, H = 360, GROUND = 296;
  const cv = document.getElementById("gcv");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr;
  cv.height = H * dpr;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);

  const R = (a, b) => a + Math.random() * (b - a);

  /* ---------- STATE ---------- */
  let state = "ready"; // ready | run | dead | win
  let score = 0, speed = 5.2, frame = 0, bgX = 0, hitFlash = 0;
  let obs = [], parts = [];
  const P = { x: 140, y: GROUND, vy: 0, ground: true };
  const stars = Array.from({ length: 28 }, () => ({ x: R(0, W), y: R(10, 190), s: R(5, 11), v: R(.2, .6) }));

  function reset() {
    score = 0; speed = 5.2; frame = 0; obs = []; parts = [];
    P.y = GROUND; P.vy = 0; P.ground = true; hitFlash = 0;
    state = "run";
  }

  function jump() {
    if (state === "ready" || state === "dead" || state === "win") { reset(); return; }
    if (P.ground) { P.vy = -15.5; P.ground = false; }
  }

  /* ---------- INPUT ---------- */
  cv.addEventListener("pointerdown", (e) => { e.preventDefault(); jump(); });
  document.addEventListener("keydown", (e) => {
    if ((e.code === "Space" || e.code === "ArrowUp") && tab.classList.contains("on")) {
      e.preventDefault(); jump();
    }
  });

  /* ---------- RINTANGAN ---------- */
  function spawn() {
    const k = Math.floor(R(0, 3));
    let o;
    if (k === 0) o = { k, w: R(30, 44), h: R(28, 40) };          // batu
    else if (k === 1) { const n = Math.floor(R(2, 4)); o = { k, n, w: n * 18, h: 30 }; } // duri
    else o = { k, w: 34, h: 34 };                                 // peti
    o.x = W + 20; o.done = false;
    obs.push(o);
  }

  /* ---------- GAMBAR ---------- */
  function heartPath(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y + s * .3);
    c.bezierCurveTo(x, y - s * .3, x - s, y - s * .3, x - s, y + s * .3);
    c.bezierCurveTo(x - s, y + s * .8, x, y + s * 1.0, x, y + s * 1.4);
    c.bezierCurveTo(x, y + s * 1.0, x + s, y + s * .8, x + s, y + s * .3);
    c.bezierCurveTo(x + s, y - s * .3, x, y - s * .3, x, y + s * .3);
    c.closePath();
  }

  // isi bentuk dengan 2 warna (kiri | kanan)
  function split(pathFn, cx, half, cols) {
    // glow menyatu di sekeliling bentuk
    ctx.save();
    pathFn();
    ctx.shadowColor = glow; ctx.shadowBlur = 20;
    ctx.fillStyle = cols[0];
    ctx.fill();
    ctx.restore();
    ctx.save();
    pathFn();
    ctx.clip();
    ctx.fillStyle = cols[0];
    ctx.fillRect(cx - half - 2, -200, half + 2, 400);
    ctx.fillStyle = cols[1];
    ctx.fillRect(cx, -200, half + 2, 400);
    ctx.restore();
  }

  function limb(x1, y1, x2, y2, w, color) {
    ctx.save();
    ctx.shadowColor = glow; ctx.shadowBlur = 14;
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  }

  function drawCouple() {
    const t = frame * 0.28;
    const run = P.ground && state === "run";
    const sw = run ? Math.sin(t) * 9 : 0;
    const bob = run ? Math.abs(Math.sin(t)) * -3 : 0;
    const air = !P.ground;

    ctx.save();
    ctx.translate(P.x, P.y + bob);

    // bayangan
    ctx.save(); ctx.translate(0, -bob - (P.y - GROUND) * 0 );
    ctx.restore();

    /* ----- PEREMPUAN (di punggung) ----- */
    glow = GLOW_GIRL;
    ctx.save();
    ctx.translate(-16, 0);
    ctx.rotate(-0.12);
    // rambut belakang (kuncir)
    const ph = Math.sin(frame * 0.2) * 4;
    ctx.fillStyle = COL_GIRL[0];
    ctx.beginPath();
    ctx.moveTo(-8, -92);
    ctx.quadraticCurveTo(-26, -86 + ph, -24, -66 + ph * 1.5);
    ctx.quadraticCurveTo(-16, -76, -6, -82);
    ctx.fill();
    // badan
    split(() => { ctx.beginPath(); ctx.roundRect(-10, -82, 20, 34, 7); }, 0, 10, COL_GIRL);
    // rok kecil
    ctx.fillStyle = COL_GIRL[1];
    ctx.beginPath(); ctx.moveTo(-11, -52); ctx.lineTo(11, -52); ctx.lineTo(15, -40); ctx.lineTo(-15, -40); ctx.closePath(); ctx.fill();
    // kepala
    split(() => { ctx.beginPath(); ctx.arc(0, -96, 10, 0, 7); }, 0, 10, COL_GIRL);
    // rambut atas
    ctx.fillStyle = "#c2467f";
    ctx.beginPath(); ctx.arc(0, -98, 10.5, Math.PI, 0); ctx.fill();
    // pita
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(-9, -102, 3.2, 0, 7); ctx.arc(-3, -106, 3.2, 0, 7); ctx.fill();
    // mata
    ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(4, -95, 1.4, 0, 7); ctx.fill();
    ctx.restore();

    /* ----- LAKI-LAKI ----- */
    glow = GLOW_MAN;
    // kaki (hitam), berayun saat lari
    const l1 = air ? 8 : sw, l2 = air ? -8 : -sw;
    limb(-3, -28, -3 + l1, -4, 9, COL_MAN[1]);
    limb(3, -28, 3 + l2, -4, 9, COL_MAN[1]);
    // sepatu pink
    ctx.fillStyle = COL_MAN[0];
    ctx.beginPath(); ctx.ellipse(-1 + l1, -2, 8, 4, 0, 0, 7); ctx.ellipse(5 + l2, -2, 8, 4, 0, 0, 7); ctx.fill();

    ctx.save();
    ctx.rotate(0.1); // membungkuk sedikit
    // badan (setengah pink | setengah hitam)
    split(() => { ctx.beginPath(); ctx.roundRect(-12, -64, 24, 38, 8); }, 0, 12, COL_MAN);
    // kepala
    split(() => { ctx.beginPath(); ctx.arc(2, -76, 12, 0, 7); }, 2, 12, COL_MAN);
    // rambut
    ctx.fillStyle = "#1a1a22";
    ctx.beginPath(); ctx.arc(2, -79, 12.5, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    // mata
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(8, -76, 2, 0, 7); ctx.fill();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(8.6, -76, 1, 0, 7); ctx.fill();
    ctx.restore();

    /* ----- kaki & tangan perempuan (di depan badan laki-laki) ----- */
    // kaki perempuan digendong (menggantung di sisi pinggang)
    glow = GLOW_GIRL;
    limb(-18, -48, -4 + sw * .2, -26, 7, COL_GIRL[0]);
    ctx.fillStyle = COL_GIRL[1];
    ctx.beginPath(); ctx.ellipse(-3 + sw * .2, -23, 5, 3.5, 0, 0, 7); ctx.fill();
    // tangan perempuan memeluk leher
    limb(-20, -78, 6, -62, 6, COL_GIRL[0]);
    // tangan laki-laki menahan kaki
    glow = GLOW_MAN;
    limb(-2, -52, -16, -42, 6, COL_MAN[1]);

    ctx.restore();
  }

  function drawObstacle(o) {
    const x = o.x, y = GROUND;
    ctx.save();
    ctx.shadowColor = "#ff4d8d"; ctx.shadowBlur = 10;
    if (o.k === 0) { // batu
      ctx.fillStyle = "#5b3a4b";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + o.w * .15, y - o.h * .7);
      ctx.lineTo(x + o.w * .5, y - o.h);
      ctx.lineTo(x + o.w * .85, y - o.h * .65);
      ctx.lineTo(x + o.w, y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#ff9ec4"; ctx.lineWidth = 2; ctx.stroke();
    } else if (o.k === 1) { // duri
      ctx.fillStyle = "#e8e0ff";
      for (let i = 0; i < o.n; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * 18, y);
        ctx.lineTo(x + i * 18 + 9, y - o.h);
        ctx.lineTo(x + i * 18 + 18, y);
        ctx.closePath(); ctx.fill();
      }
    } else { // peti
      ctx.fillStyle = "#3a1226";
      ctx.fillRect(x, y - o.h, o.w, o.h);
      ctx.strokeStyle = "#ff4d8d"; ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y - o.h + 1.5, o.w - 3, o.h - 3);
      ctx.beginPath(); ctx.moveTo(x, y - o.h); ctx.lineTo(x + o.w, y); ctx.moveTo(x + o.w, y - o.h); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBG() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1c0a15"); g.addColorStop(1, "#07050a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // love melayang
    ctx.fillStyle = "rgba(255,158,196,.35)";
    stars.forEach((s) => {
      heartPath(ctx, s.x, s.y, s.s * .6); ctx.fill();
    });
    // tanah
    ctx.fillStyle = "#12060d"; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.save();
    ctx.shadowColor = "#ff4d8d"; ctx.shadowBlur = 14;
    ctx.strokeStyle = "#ff4d8d"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, GROUND + 1); ctx.lineTo(W, GROUND + 1); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#5a1d38";
    for (let x = -(bgX % 60); x < W; x += 60) ctx.fillRect(x, GROUND + 18, 26, 3);
  }

  function drawHUD() {
    ctx.save();
    ctx.fillStyle = "#ff9ec4";
    ctx.shadowColor = "#ff4d8d"; ctx.shadowBlur = 12;
    ctx.font = "600 26px Quicksand, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("♥ " + score + " / " + TARGET, 18, 38);
    // progress bar
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#2a0f1c"; ctx.fillRect(18, 50, 160, 7);
    ctx.fillStyle = "#ff4d8d"; ctx.fillRect(18, 50, 160 * Math.min(1, score / TARGET), 7);
    ctx.restore();
  }

  function overlay(title, sub, big) {
    ctx.save();
    ctx.fillStyle = "rgba(7,5,10,.62)"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff9ec4";
    ctx.shadowColor = "#ff4d8d"; ctx.shadowBlur = 24;
    ctx.font = (big ? "700 64px" : "700 46px") + " 'Dancing Script', cursive";
    ctx.fillText(title, W / 2, H / 2 - 6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.font = "500 18px Quicksand, sans-serif";
    ctx.fillText(sub, W / 2, H / 2 + 36);
    ctx.restore();
  }

  function winBurst() {
    for (let i = 0; i < 90; i++)
      parts.push({ x: R(0, W), y: R(-300, -10), vy: R(1.5, 4), vx: R(-.8, .8), s: R(6, 16), a: R(.5, 1) });
  }

  /* ---------- UPDATE ---------- */
  function update(dt) {
    frame += dt;
    bgX += speed * dt;
    stars.forEach((s) => { s.x -= s.v * dt; if (s.x < -20) { s.x = W + 20; s.y = R(10, 190); } });

    // fisika
    P.vy += 0.9 * dt;
    P.y += P.vy * dt;
    if (P.y >= GROUND) { P.y = GROUND; P.vy = 0; P.ground = true; }

    // spawn
    const last = obs[obs.length - 1];
    if (!last || last.x < W - R(280, 430) - speed * 14) spawn();

    // gerak & skor & tabrakan
    const hb = { l: P.x - 17, r: P.x + 13, t: P.y - 100, b: P.y - 2 };
    for (const o of obs) {
      o.x -= speed * dt;
      if (!o.done && o.x + o.w < P.x - 20) {
        o.done = true; score++;
        speed = Math.min(8.2, 5.2 + score * 0.13);
        if (score >= TARGET) { state = "win"; winBurst(); return; }
      }
      const ol = o.x + 5, or = o.x + o.w - 5, ot = GROUND - o.h + 6;
      if (hb.r > ol && hb.l < or && hb.b > ot) { state = "dead"; hitFlash = 1; return; }
    }
    obs = obs.filter((o) => o.x > -80);
  }

  /* ---------- LOOP ---------- */
  let lastT = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    const visible = tab.classList.contains("on") && main.classList.contains("on");
    if (!visible) { lastT = t; return; }
    const dt = Math.min(2, (t - lastT) / 16.67 || 1);
    lastT = t;

    if (state === "run") update(dt);
    else if (state === "win") {
      parts.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; if (p.y > H + 20) { p.y = -20; p.x = R(0, W); } });
      frame += dt;
    } else if (state === "ready") frame += dt * 0.2;

    drawBG();
    obs.forEach(drawObstacle);
    drawCouple();
    drawHUD();

    if (state === "dead") {
      if (hitFlash > 0) { ctx.fillStyle = "rgba(255,77,141," + hitFlash * .4 + ")"; ctx.fillRect(0, 0, W, H); hitFlash -= .04; }
      overlay("Yahh kalah! 💔", "Tap untuk coba lagi", false);
    } else if (state === "ready") {
      overlay("Fael & Aii", "Tap untuk mulai — lewati " + TARGET + " rintangan ♥", false);
    } else if (state === "win") {
      ctx.fillStyle = "#ff9ec4";
      parts.forEach((p) => { ctx.globalAlpha = p.a; ctx.fillStyle = "#ff4d8d"; heartPath(ctx, p.x, p.y, p.s * .5); ctx.fill(); });
      ctx.globalAlpha = 1;
      overlay(PESAN_MENANG + " ♥", "Tap untuk main lagi", true);
    }
  }
  requestAnimationFrame(loop);
})();   