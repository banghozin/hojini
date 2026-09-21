/* 호지니. 과목별, 주차별 문제은행 앱
 *
 * 문항은 data/<과목>-w<주차>.js 가 window.QUIZ_BANK 에 밀어 넣습니다.
 * 주차를 추가할 때는 파일을 만들고 index.html 에 script 태그 한 줄만 더하면 됩니다.
 *
 * 문항 형식 세 가지
 *   blanks  : 빈칸에 키워드를 적는 형식 (콘텐츠서비스디자인)
 *   choices : 4지선다 (멀티미디어사운드테크닉)
 *   model   : 사례형 서술. 적어 보고 모범답안과 견줌 (미디어마케팅개론)
 *
 * 채점하지 않습니다. 정답 확인을 누르면 답이 나옵니다.
 */
(function () {
  "use strict";

  /* ================= 문항 불러오기 ================= */

  var BANK = (window.QUIZ_BANK || []).slice().sort(function (a, b) {
    if (a.subjectKey !== b.subjectKey) return (a.subjectKey || "").localeCompare(b.subjectKey || "");
    return a.week - b.week;
  });

  /* 과목 목록. 등장 순서를 유지합니다 */
  var SUBJECTS = [];
  BANK.forEach(function (wk) {
    var key = wk.subjectKey || "etc";
    var found = null;
    SUBJECTS.forEach(function (s) { if (s.key === key) found = s; });
    if (!found) {
      found = { key: key, name: wk.subject || "과목 없음", weeks: [], count: 0 };
      SUBJECTS.push(found);
    }
    found.weeks.push(wk);
    found.count += (wk.items || []).length;
  });

  var ALL = [];
  BANK.forEach(function (wk) {
    (wk.items || []).forEach(function (it, i) {
      var copy = {};
      for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) copy[k] = it[k];
      copy.subject = wk.subject || "";
      copy.subjectKey = wk.subjectKey || "etc";
      copy.week = wk.week;
      copy.weekTitle = wk.title || "";
      copy.no = copy.no || String(i + 1);
      copy.id = copy.id || (copy.subjectKey + "-w" + wk.week + "-" + (i + 1));
      copy.kind = copy.blanks ? "blanks" : (copy.choices ? "choices" : "open");
      copy.blanks = copy.blanks || [];
      ALL.push(copy);
    });
  });

  var BY_ID = {};
  ALL.forEach(function (q) { BY_ID[q.id] = q; });

  /* ================= 저장소 ================= */
  /* 화면 설정과 오답노트만 기억합니다. 점수나 푼 내용은 저장하지 않습니다. */

  var LS_PREF = "hojin.pref.v1";
  var LS_WRONG = "hojin.wrong.v1";

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
  var wrongSet = lsGet(LS_WRONG, []).filter(function (id) { return BY_ID[id]; });

  function saveWrong() { lsSet(LS_WRONG, wrongSet); }
  function inWrong(id) { return wrongSet.indexOf(id) >= 0; }
  function toggleWrong(id) {
    var i = wrongSet.indexOf(id);
    if (i >= 0) wrongSet.splice(i, 1); else wrongSet.push(id);
    saveWrong();
  }

  /* ================= 설정 상태 ================= */

  function subjectByKey(key) {
    var out = null;
    SUBJECTS.forEach(function (s) { if (s.key === key) out = s; });
    return out;
  }

  var sel = {
    subject: (pref.subject && subjectByKey(pref.subject)) ? pref.subject : (SUBJECTS[0] ? SUBJECTS[0].key : ""),
    weeks: [],
    count: typeof pref.count === "number" ? pref.count : 0
  };

  /* 저장된 주차가 지금 과목에 없으면 그 과목 전체로 되돌립니다 */
  (function initWeeks() {
    var s = subjectByKey(sel.subject);
    if (!s) { sel.weeks = []; return; }
    var mine = s.weeks.map(function (w) { return w.week; });
    var saved = (pref.weeks || {})[sel.subject];
    sel.weeks = (Array.isArray(saved) ? saved.filter(function (w) { return mine.indexOf(w) >= 0; }) : []);
    if (!sel.weeks.length) sel.weeks = mine.slice();
  })();

  function savePref() {
    var weeks = (pref.weeks && typeof pref.weeks === "object") ? pref.weeks : {};
    weeks[sel.subject] = sel.weeks;
    pref = { subject: sel.subject, weeks: weeks, count: sel.count };
    lsSet(LS_PREF, pref);
  }

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
    ["home", "quiz", "sheet", "done"].forEach(function (s) {
      $("screen-" + s).hidden = (s !== name);
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ================= 홈 화면 ================= */

  function poolFor(subjectKey, weeks) {
    return ALL.filter(function (q) {
      return q.subjectKey === subjectKey && weeks.indexOf(q.week) >= 0;
    });
  }

  /* 「콘텐츠서비스디자인 2주차, 3주차」 같은 범위 문구 */
  function scopeOf(list) {
    var subs = {}, ws = {};
    list.forEach(function (q) { subs[q.subject] = 1; ws[q.week] = 1; });
    return Object.keys(subs).join(", ") + " " +
           Object.keys(ws).map(Number).sort(function (a, b) { return a - b; }).join("주차, ") + "주차";
  }

  function kindLabel(s) {
    var kinds = {};
    s.weeks.forEach(function (wk) {
      (wk.items || []).forEach(function (it) {
        kinds[it.blanks ? "빈칸" : (it.choices ? "4지선다" : "서술")] = 1;
      });
    });
    return Object.keys(kinds).join(", ");
  }

  function renderSubjects() {
    var box = $("subjectList");
    box.textContent = "";

    if (!SUBJECTS.length) {
      box.appendChild(el("p", "hint", "문항 파일이 없습니다. data 폴더를 확인해 주세요."));
      return;
    }

    SUBJECTS.forEach(function (s) {
      var b = el("button", "subject");
      b.type = "button";
      b.setAttribute("aria-pressed", String(sel.subject === s.key));

      b.appendChild(el("span", "subject-name", s.name));
      var meta = el("span", "subject-meta");
      meta.appendChild(el("span", null, s.weeks.length + "개 주차"));
      meta.appendChild(el("span", "dot", ""));
      meta.appendChild(el("span", null, s.count + "문항"));
      meta.appendChild(el("span", "dot", ""));
      meta.appendChild(el("span", null, kindLabel(s)));
      b.appendChild(meta);

      b.addEventListener("click", function () {
        if (sel.subject === s.key) return;
        sel.subject = s.key;
        sel.weeks = s.weeks.map(function (w) { return w.week; });
        savePref();
        renderHome();
      });
      box.appendChild(b);
    });
  }

  function renderWeekChips() {
    var box = $("weekChips");
    box.textContent = "";

    var s = subjectByKey(sel.subject);
    if (!s) return;

    s.weeks.forEach(function (wk) {
      var b = el("button", "chip", wk.week + "주차");
      b.type = "button";
      b.setAttribute("aria-pressed", String(sel.weeks.indexOf(wk.week) >= 0));
      b.title = wk.title || "";
      b.addEventListener("click", function () {
        var i = sel.weeks.indexOf(wk.week);
        if (i >= 0) sel.weeks.splice(i, 1); else sel.weeks.push(wk.week);
        if (!sel.weeks.length) sel.weeks = [wk.week];
        savePref();
        renderHome();
      });
      box.appendChild(b);
    });

    if (s.weeks.length > 1) {
      var all = el("button", "chip", "전체");
      all.type = "button";
      all.setAttribute("aria-pressed", String(sel.weeks.length === s.weeks.length));
      all.addEventListener("click", function () {
        sel.weeks = s.weeks.map(function (w) { return w.week; });
        savePref();
        renderHome();
      });
      box.appendChild(all);
    }
  }

  function renderHome() {
    renderSubjects();
    renderWeekChips();

    var s = subjectByKey(sel.subject);
    var pool = poolFor(sel.subject, sel.weeks);

    $("poolHint").textContent = (s && sel.weeks.length)
      ? s.name + " " + sel.weeks.slice().sort(function (a, b) { return a - b; }).join("주차, ") + "주차, 모두 " + pool.length + "문항"
      : "주차를 골라 주세요.";

    Array.prototype.forEach.call($("countSeg").querySelectorAll("button"), function (b) {
      var c = Number(b.getAttribute("data-c"));
      var tooBig = c > 0 && c > pool.length;
      b.disabled = tooBig;
      if (tooBig && sel.count === c) sel.count = 0;
      b.setAttribute("aria-pressed", String(sel.count === c));
      b.style.opacity = tooBig ? ".35" : "";
    });

    var live = wrongSet.filter(function (id) { return BY_ID[id]; });
    if (live.length !== wrongSet.length) { wrongSet = live; saveWrong(); }
    $("btnWrong").hidden = !wrongSet.length;
    $("btnWrong").textContent = "오답노트만 풀기 (" + wrongSet.length + ")";
    $("wrongFoot").hidden = !wrongSet.length;
    $("btnStart").disabled = !pool.length;
  }

  $("countSeg").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || b.disabled) return;
    sel.count = Number(b.getAttribute("data-c"));
    savePref(); renderHome();
  });

  $("btnStart").addEventListener("click", function () {
    var pool = poolFor(sel.subject, sel.weeks);
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

  /* ================= 한눈에 보기 ================= */
  /* 푸는 화면이 아니라 문제와 답을 전부 펼쳐 둔 읽기용 화면입니다.
   * 순서를 섞지 않고 주차별, 번호순 그대로 둡니다. */

  function renderSheet(pool) {
    $("sheetScope").textContent = scopeOf(pool);
    $("sheetCount").textContent = pool.length + "문항";

    var box = $("sheetList");
    box.textContent = "";

    var lastWeek = null;
    pool.forEach(function (q) {
      if (q.week !== lastWeek) {
        lastWeek = q.week;
        var h = el("h2", "sheet-week");
        h.appendChild(el("span", "sheet-week-no", q.week + "주차"));
        if (q.weekTitle) h.appendChild(el("span", "sheet-week-title", q.weekTitle));
        box.appendChild(h);
      }
      box.appendChild(sheetItem(q));
    });
  }

  function sheetItem(q) {
    var art = el("article", "sheet-item");

    /* 번호와 문제를 한 줄에 붙여 세로 길이를 줄입니다 */
    var qt = el("div", "sheet-q");
    qt.appendChild(el("span", "sheet-no", q.no));
    var body = el("span", "sheet-qtext");
    body.innerHTML = q.q;
    if (q.tag) body.appendChild(el("span", "qtag", q.tag));
    qt.appendChild(body);
    art.appendChild(qt);

    var ans = el("div", "sheet-a");

    if (q.kind === "blanks") {
      /* layout "pair" 는 「속성 → 대응 방법」처럼 두 칸이 한 쌍입니다 */
      var pair = (q.layout === "pair");
      for (var i = 0; i < q.blanks.length;) {
        var row = el("div", "sheet-blank");
        if (pair && i + 1 < q.blanks.length) {
          if (q.blanks[i].label) row.appendChild(el("span", "sheet-blank-label", q.blanks[i].label));
          row.appendChild(el("span", "sheet-blank-ans", q.blanks[i].answer));
          row.appendChild(el("span", "arrow", "→"));
          row.appendChild(el("span", "sheet-blank-ans", q.blanks[i + 1].answer));
          i += 2;
        } else {
          if (q.blanks[i].label) row.appendChild(el("span", "sheet-blank-label", q.blanks[i].label));
          row.appendChild(el("span", "sheet-blank-ans", q.blanks[i].answer));
          i += 1;
        }
        ans.appendChild(row);
      }

    } else if (q.kind === "choices") {
      q.choices.forEach(function (text, i) {
        var row = el("div", "sheet-choice" + (i === q.answer ? " correct" : ""));
        row.appendChild(el("span", "choice-no", String(i + 1)));
        row.appendChild(el("span", "choice-text", text));
        if (i === q.answer) row.appendChild(el("span", "choice-mark", "정답"));
        ans.appendChild(row);
      });

    } else {
      if (q.keys && q.keys.length) {
        var keys = el("div", "keys");
        keys.appendChild(el("span", "keys-head", "핵심어"));
        q.keys.forEach(function (k) { keys.appendChild(el("span", "key", k)); });
        ans.appendChild(keys);
      }
      if (q.model) {
        var m = el("div", "model");
        m.appendChild(el("span", "anslabel", "모범답안"));
        m.appendChild(el("p", null, q.model));
        ans.appendChild(m);
      }
    }
    art.appendChild(ans);

    if (q.why) {
      var why = el("div", "sheet-why");
      why.appendChild(el("span", "vhead", "해설"));
      var body = el("div", "why");
      body.innerHTML = q.why;
      why.appendChild(body);
      art.appendChild(why);
    }
    return art;
  }

  /* 두 토글은 화면에 클래스만 붙입니다. 다시 그리지 않습니다 */
  function bindSheetToggle(btnId, cls) {
    $(btnId).addEventListener("click", function () {
      var on = $(btnId).getAttribute("aria-pressed") !== "true";
      $(btnId).setAttribute("aria-pressed", String(on));
      $("screen-sheet").classList.toggle(cls, !on);
    });
  }
  bindSheetToggle("btnToggleWhy", "no-why");
  bindSheetToggle("btnToggleQ", "no-distractor");

  $("btnSheet").addEventListener("click", function () {
    var pool = poolFor(sel.subject, sel.weeks);
    if (!pool.length) return;
    renderSheet(pool);
    show("sheet");
  });

  $("btnPrint").addEventListener("click", function () { window.print(); });

  function backHome() {
    renderHome();
    show("home");
  }
  $("btnSheetQuit").addEventListener("click", backHome);
  $("btnSheetHome").addEventListener("click", backHome);

  /* ================= 세션 ================= */

  var S = null;

  function prepare(q) {
    return {
      q: q,
      locked: false,
      value: q.kind === "blanks" ? q.blanks.map(function () { return ""; }) : [""],
      pick: -1                     // 4지선다에서 고른 번호
    };
  }

  function startSession(pool, count) {
    var qs = shuffle(pool);
    if (count > 0 && count < qs.length) qs = qs.slice(0, count);
    S = {
      list: qs.map(prepare),
      idx: 0,
      scope: scopeOf(qs)
    };
    $("totalNo").textContent = String(S.list.length);
    $("gridPanel").hidden = true;
    show("quiz");
    renderQuestion();
  }

  /* 뭐라도 적었거나 골랐는지. 문항 목록에 점을 찍는 데만 씁니다 */
  function hasAny(p) {
    if (p.q.kind === "choices") return p.pick >= 0;
    return p.value.some(function (v) { return String(v || "").trim() !== ""; });
  }

  /* ---------- 문항 렌더 ---------- */

  var TYPE_LABEL = {
    blanks: function (q) { return "빈칸 " + q.blanks.length + "개"; },
    choices: function () { return "4지선다"; },
    open: function () { return "서술형"; }
  };

  function renderQuestion() {
    var p = S.list[S.idx], q = p.q;

    $("curNo").textContent = String(S.idx + 1);
    $("progressFill").style.width = ((S.idx) / S.list.length * 100) + "%";
    $("qSubject").textContent = q.subject || "";
    $("qWeek").textContent = q.week + "주차 " + q.no;
    $("qTag").textContent = q.tag || "";
    $("qType").textContent = TYPE_LABEL[q.kind](q);
    $("qText").innerHTML = q.q;

    var body = $("qBody");
    body.textContent = "";
    if (q.kind === "blanks") renderBlanks(body, p);
    else if (q.kind === "choices") renderChoices(body, p);
    else renderOpen(body, p);

    if (p.locked) showWhy(p);
    else { $("verdict").hidden = true; $("verdict").textContent = ""; }

    syncNoteBtn();

    $("btnPrev").disabled = (S.idx === 0);
    $("btnCheck").hidden = p.locked;
    $("btnNext").textContent = (S.idx === S.list.length - 1) ? "다 봤어요" : "다음";

    renderGrid();
  }

  /* ---------- 빈칸형 ---------- */

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

  /* ---------- 4지선다 ---------- */

  function renderChoices(body, p) {
    var q = p.q;
    var box = el("div", "choices");

    q.choices.forEach(function (text, i) {
      var b = el("button", "choice");
      b.type = "button";
      b.appendChild(el("span", "choice-no", String(i + 1)));
      b.appendChild(el("span", "choice-text", text));

      if (p.pick === i) b.classList.add("picked");

      if (p.locked) {
        b.disabled = true;
        if (i === q.answer) {
          b.classList.add("correct");
          b.appendChild(el("span", "choice-mark", "정답"));
        } else if (p.pick === i) {
          b.classList.add("wrong");
          b.appendChild(el("span", "choice-mark", "내가 고른 것"));
        }
      } else {
        b.addEventListener("click", function () {
          p.pick = i;
          renderQuestion();
        });
      }
      box.appendChild(b);
    });
    body.appendChild(box);
  }

  /* ---------- 서술형 ---------- */

  function renderOpen(body, p) {
    var q = p.q;
    var box = el("div", "openwrap");

    var ta = document.createElement("textarea");
    ta.className = "open-in";
    ta.rows = 5;
    ta.value = p.value[0] || "";
    ta.placeholder = p.locked ? "" : "상황에 맞는 대응을 적어 보세요";
    ta.setAttribute("aria-label", "답안 입력");
    if (p.locked) ta.readOnly = true;
    else ta.addEventListener("input", function () {
      p.value[0] = ta.value;
      renderGrid();
    });
    box.appendChild(ta);

    if (q.keys && q.keys.length) {
      var keys = el("div", "keys");
      keys.appendChild(el("span", "keys-head", p.locked ? "들어갔어야 할 핵심어" : "핵심어 힌트"));
      q.keys.forEach(function (k) { keys.appendChild(el("span", "key", k)); });

      /* 아직 안 풀었으면 힌트를 가려 둡니다. 눌러야 펴집니다 */
      if (p.locked || p.hint) {
        box.appendChild(keys);
      } else {
        var hintBtn = el("button", "hintbtn", "핵심어 힌트 보기");
        hintBtn.type = "button";
        hintBtn.addEventListener("click", function () {
          p.hint = true;
          box.replaceChild(keys, hintBtn);
        });
        box.appendChild(hintBtn);
      }
    }

    if (p.locked && q.model) {
      var m = el("div", "model");
      m.appendChild(el("span", "anslabel", "모범답안"));
      m.appendChild(el("p", null, q.model));
      box.appendChild(m);
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

    var p = S.list[S.idx];

    /* 4지선다는 숫자키로 고릅니다 */
    if (p.q.kind === "choices" && !p.locked && /^[1-4]$/.test(e.key)) {
      var i = Number(e.key) - 1;
      if (i < p.q.choices.length) { p.pick = i; renderQuestion(); }
      return;
    }

    if (e.key === "Enter") {
      if (p.locked) goNext(); else revealNow();
    } else if (e.key === "ArrowLeft") {
      if (S.idx > 0) { S.idx--; renderQuestion(); }
    } else if (e.key === "ArrowRight") {
      goNext();
    }
  });

  /* ================= 다 본 뒤 ================= */

  function finishUp() {
    $("doneScope").textContent = S.scope + ", " + S.list.length + "문항";
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

  renderHome();
  show("home");
})();
