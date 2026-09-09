/* 콘서 CBT. 주차별 예/복습 테스트 문제은행 앱
 *
 * 문항은 data/weekNN.js 가 window.QUIZ_BANK 에 밀어 넣습니다.
 * 주차를 추가할 때는 파일을 만들고 index.html 에 script 태그 한 줄만 더하면 됩니다.
 *
 * 채점하지 않습니다. 빈칸에 키워드를 적어 보고 `정답 확인`을 누르면 답이 나옵니다.
 */
(function () {
  "use strict";

  /* ================= 문항 불러오기 ================= */

  var BANK = (window.QUIZ_BANK || []).slice().sort(function (a, b) { return a.week - b.week; });

  var ALL = [];
  BANK.forEach(function (wk) {
    (wk.items || []).forEach(function (it, i) {
      var copy = {};
      for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) copy[k] = it[k];
      copy.week = wk.week;
      copy.weekTitle = wk.title || "";
      copy.no = copy.no || String(i + 1);
      copy.id = copy.id || ("w" + wk.week + "-" + (i + 1));
      copy.blanks = copy.blanks || [];
      ALL.push(copy);
    });
  });

  var BY_ID = {};
  ALL.forEach(function (q) { BY_ID[q.id] = q; });

  /* ================= 저장소 ================= */
  /* 화면 설정과 오답노트만 기억합니다. 점수나 푼 내용은 저장하지 않습니다. */

  var LS_PREF = "konseo.pref.v1";
  var LS_WRONG = "konseo.wrong.v2";

  function lsGet(key, dflt) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : dflt;
    } catch (e) { return dflt; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 저장 불가. 무시 */ }
  }

  var pref = lsGet(LS_PREF, {});

  /* 오답노트. 문항 id 목록이고, 버튼을 눌러야만 들어갑니다 */
  var wrongSet = lsGet(LS_WRONG, []).filter(function (id) { return BY_ID[id]; });

  function saveWrong() { lsSet(LS_WRONG, wrongSet); }
  function inWrong(id) { return wrongSet.indexOf(id) >= 0; }

  function toggleWrong(id) {
    var i = wrongSet.indexOf(id);
    if (i >= 0) wrongSet.splice(i, 1); else wrongSet.push(id);
    saveWrong();
  }

  /* ================= 설정 상태 ================= */

  var sel = {
    weeks: Array.isArray(pref.weeks) && pref.weeks.length ? pref.weeks : BANK.map(function (w) { return w.week; }),
    count: typeof pref.count === "number" ? pref.count : 0
  };

  function savePref() { lsSet(LS_PREF, sel); }

  /* ================= 도우미 ================= */

  var $ = function (id) { return document.getElementById(id); };

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function show(name) {
    ["home", "quiz", "done"].forEach(function (s) {
      $("screen-" + s).hidden = (s !== name);
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ================= 홈 화면 ================= */

  function poolFor(weeks) {
    return ALL.filter(function (q) { return weeks.indexOf(q.week) >= 0; });
  }

  function renderWeekChips() {
    var box = $("weekChips");
    box.textContent = "";

    if (!BANK.length) {
      box.appendChild(el("p", "hint", "문항 파일이 없습니다. data/ 폴더를 확인해 주세요."));
      return;
    }

    BANK.forEach(function (wk) {
      var b = el("button", "chip", wk.week + "주차");
      b.type = "button";
      b.setAttribute("aria-pressed", String(sel.weeks.indexOf(wk.week) >= 0));
      b.addEventListener("click", function () {
        var i = sel.weeks.indexOf(wk.week);
        if (i >= 0) sel.weeks.splice(i, 1); else sel.weeks.push(wk.week);
        if (!sel.weeks.length) sel.weeks = [wk.week];
        savePref();
        renderHome();
      });
      box.appendChild(b);
    });

    if (BANK.length > 1) {
      var all = el("button", "chip", "종합 (전체)");
      all.type = "button";
      all.setAttribute("aria-pressed", String(sel.weeks.length === BANK.length));
      all.addEventListener("click", function () {
        sel.weeks = BANK.map(function (w) { return w.week; });
        savePref();
        renderHome();
      });
      box.appendChild(all);
    }
  }

  function renderHome() {
    renderWeekChips();

    var pool = poolFor(sel.weeks);
    $("poolHint").textContent = sel.weeks.length
      ? sel.weeks.slice().sort(function (a, b) { return a - b; }).join("주차, ") + "주차, 모두 " + pool.length + "문항"
      : "주차를 골라 주세요.";

    // 문항 수: 풀보다 큰 선택지는 잠급니다
    Array.prototype.forEach.call($("countSeg").querySelectorAll("button"), function (b) {
      var c = Number(b.getAttribute("data-c"));
      var tooBig = c > 0 && c > pool.length;
      b.disabled = tooBig;
      if (tooBig && sel.count === c) sel.count = 0;
      b.setAttribute("aria-pressed", String(sel.count === c));
      b.style.opacity = tooBig ? ".35" : "";
    });

    // 오답노트
    var live = wrongSet.filter(function (id) { return BY_ID[id]; });
    if (live.length !== wrongSet.length) { wrongSet = live; saveWrong(); }
    $("btnWrong").hidden = !wrongSet.length;
    $("btnWrong").textContent = "오답노트만 풀기 (" + wrongSet.length + ")";
    $("wrongFoot").hidden = !wrongSet.length;
  }

  $("countSeg").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || b.disabled) return;
    sel.count = Number(b.getAttribute("data-c"));
    savePref(); renderHome();
  });

  $("btnStart").addEventListener("click", function () {
    var pool = poolFor(sel.weeks);
    if (!pool.length) return;
    startSession(pool, sel.count);
  });

  $("btnWrong").addEventListener("click", function () {
    var pool = wrongSet.map(function (id) { return BY_ID[id]; }).filter(Boolean);
    if (!pool.length) return;
    startSession(pool, 0);
  });

  $("btnClearWrong").addEventListener("click", function () {
    if (!window.confirm("오답노트를 비울까요?")) return;
    wrongSet = [];
    saveWrong();
    renderHome();
  });

  /* ================= 세션 ================= */

  var S = null;

  function prepare(q) {
    return {
      q: q,
      locked: false,
      value: q.blanks.map(function () { return ""; })
    };
  }

  function startSession(pool, count) {
    var qs = shuffle(pool);
    if (count > 0 && count < qs.length) qs = qs.slice(0, count);
    S = {
      list: qs.map(prepare),
      idx: 0,
      weeks: (function () {
        var ws = {};
        qs.forEach(function (q) { ws[q.week] = 1; });
        return Object.keys(ws).map(Number).sort(function (a, b) { return a - b; });
      })()
    };
    $("totalNo").textContent = String(S.list.length);
    $("gridPanel").hidden = true;
    show("quiz");
    renderQuestion();
  }

  /* 빈칸을 하나라도 채웠는지. 문항 목록에 점을 찍는 데만 씁니다 */
  function hasAny(p) {
    return p.value.some(function (v) { return String(v || "").trim() !== ""; });
  }

  /* ---------- 문항 렌더 ---------- */

  function renderQuestion() {
    var p = S.list[S.idx], q = p.q;

    $("curNo").textContent = String(S.idx + 1);
    $("progressFill").style.width = ((S.idx) / S.list.length * 100) + "%";
    $("qWeek").textContent = q.week + "주차 " + q.no + "번";
    $("qTag").textContent = q.tag || "";
    $("qType").textContent = q.blanks.length ? "빈칸 " + q.blanks.length + "개" : "";
    $("qText").innerHTML = q.q;

    var body = $("qBody");
    body.textContent = "";
    renderBlanks(body, p);

    // 해설
    if (p.locked) showWhy(p);
    else { $("verdict").hidden = true; $("verdict").textContent = ""; }

    syncNoteBtn();

    // 버튼
    $("btnPrev").disabled = (S.idx === 0);
    $("btnCheck").hidden = p.locked;
    $("btnNext").textContent = (S.idx === S.list.length - 1) ? "다 봤어요" : "다음";

    renderGrid();
  }

  function blankCell(p, i, skipLabel) {
    var b = p.q.blanks[i];
    var cell = el("div", "blank-cell");

    var top = el("div", "blank-top");
    if (b.label && !skipLabel) top.appendChild(el("span", "blank-label", b.label));

    var input = document.createElement("input");
    input.className = "blank-in";
    input.type = "text";
    input.autocomplete = "off";
    input.value = p.value[i] || "";
    input.placeholder = p.locked ? "" : "답을 적어 보세요";
    input.setAttribute("aria-label", (b.label ? b.label + " " : "") + "답 입력");

    if (p.locked) {
      input.readOnly = true;
    } else {
      input.addEventListener("input", function () {
        p.value[i] = input.value;
        renderGrid();
      });
      input.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        revealNow();
      });
    }
    top.appendChild(input);
    cell.appendChild(top);

    if (p.locked) {
      var ans = el("div", "ans");
      ans.appendChild(el("span", "anslabel", "정답"));
      ans.appendChild(document.createTextNode(b.answer));
      cell.appendChild(ans);
    }
    return cell;
  }

  function renderBlanks(body, p) {
    var q = p.q;
    var pair = (q.layout === "pair");
    var box = el("div", "blanks");

    for (var i = 0; i < q.blanks.length;) {
      // 짝 배치일 때는 시험지 표처럼 번호를 두 칸 앞에 한 번만 답니다
      if (pair && i + 1 < q.blanks.length) {
        var prow = el("div", "blank-row pair");
        if (q.blanks[i].label) prow.appendChild(el("span", "pair-no", q.blanks[i].label));
        prow.appendChild(blankCell(p, i, true));
        prow.appendChild(el("span", "arrow", "→"));
        prow.appendChild(blankCell(p, i + 1, true));
        box.appendChild(prow);
        i += 2;
      } else {
        var row = el("div", "blank-row");
        row.appendChild(blankCell(p, i));
        box.appendChild(row);
        i += 1;
      }
    }
    body.appendChild(box);
  }

  /* ---------- 오답노트 담기 ---------- */

  function syncNoteBtn() {
    var b = $("btnNote");
    var on = inWrong(S.list[S.idx].q.id);
    b.setAttribute("data-on", on ? "1" : "0");
    b.textContent = on ? "오답노트에 담김. 빼려면 누르세요" : "오답노트로 보내기";
  }

  $("btnNote").addEventListener("click", function () {
    if (!S) return;
    toggleWrong(S.list[S.idx].q.id);
    syncNoteBtn();
  });

  /* ---------- 정답 공개 ---------- */

  function showWhy(p) {
    var vd = $("verdict");
    vd.className = "verdict reveal";
    vd.textContent = "";

    if (!p.q.why) { vd.hidden = true; return; }

    vd.appendChild(el("span", "vhead", "해설"));
    var why = el("div", "why");
    why.innerHTML = p.q.why;
    vd.appendChild(why);
    vd.hidden = false;
  }

  function revealNow() {
    var p = S.list[S.idx];
    if (p.locked) return;
    p.locked = true;
    renderQuestion();
    var vd = $("verdict");
    if (!vd.hidden) vd.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /* ---------- 이동 ---------- */

  function goNext() {
    if (S.idx === S.list.length - 1) { finishUp(); return; }
    S.idx++;
    renderQuestion();
  }

  $("btnCheck").addEventListener("click", revealNow);
  $("btnNext").addEventListener("click", goNext);
  $("btnPrev").addEventListener("click", function () {
    if (S.idx === 0) return;
    S.idx--;
    renderQuestion();
  });

  $("btnQuit").addEventListener("click", function () {
    if (!window.confirm("그만두고 홈으로 갈까요? 지금까지 적은 내용은 사라집니다.")) return;
    S = null;
    renderHome();
    show("home");
  });

  $("btnGrid").addEventListener("click", function () {
    $("gridPanel").hidden = !$("gridPanel").hidden;
    renderGrid();
  });

  function renderGrid() {
    var panel = $("gridPanel");
    if (panel.hidden) return;
    panel.textContent = "";
    S.list.forEach(function (p, i) {
      var b = el("button", null, String(i + 1));
      b.type = "button";
      if (p.locked || hasAny(p)) b.classList.add("done");
      if (i === S.idx) b.classList.add("here");
      b.addEventListener("click", function () {
        S.idx = i;
        panel.hidden = true;
        renderQuestion();
      });
      panel.appendChild(b);
    });
  }

  document.addEventListener("keydown", function (e) {
    if ($("screen-quiz").hidden || !S) return;
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;

    if (e.key === "Enter") {
      if (S.list[S.idx].locked) goNext(); else revealNow();
    } else if (e.key === "ArrowLeft") {
      if (S.idx > 0) { S.idx--; renderQuestion(); }
    } else if (e.key === "ArrowRight") {
      goNext();
    }
  });

  /* ================= 다 본 뒤 ================= */

  function finishUp() {
    $("doneScope").textContent = S.weeks.join("주차, ") + "주차, " + S.list.length + "문항";
    show("done");
  }

  $("btnAgain").addEventListener("click", function () {
    var pool = S.list.map(function (p) { return p.q; });
    if (!pool.length) return;
    startSession(pool, 0);
  });

  $("btnHome").addEventListener("click", function () {
    S = null;
    renderHome();
    show("home");
  });

  /* ================= 시작 ================= */

  if (!ALL.length) {
    $("btnStart").disabled = true;
  }
  renderHome();
  show("home");
})();
