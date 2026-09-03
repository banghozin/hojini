/* 콘서 CBT — 주차별 예/복습 테스트 문제은행 앱
 *
 * 문항은 data/weekNN.js 가 window.QUIZ_BANK 에 밀어 넣습니다.
 * 주차를 추가할 때는 파일을 만들고 index.html 에 script 태그 한 줄만 더하면 됩니다.
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
      ALL.push(copy);
    });
  });

  var BY_ID = {};
  ALL.forEach(function (q) { BY_ID[q.id] = q; });

  var TYPE_KO = { choice: "객관식", multi: "복수 정답", match: "짝짓기", order: "순서 배열", short: "단답" };

  /* ================= 저장소 ================= */

  var LS_WRONG = "konseo.wrong.v1";
  var LS_HIST = "konseo.history.v1";
  var LS_PREF = "konseo.pref.v1";

  function lsGet(key, dflt) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : dflt;
    } catch (e) { return dflt; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 저장 불가 — 무시 */ }
  }

  var wrongSet = lsGet(LS_WRONG, []);
  var history = lsGet(LS_HIST, []);
  var pref = lsGet(LS_PREF, {});

  /* ================= 설정 상태 ================= */

  var sel = {
    weeks: Array.isArray(pref.weeks) && pref.weeks.length ? pref.weeks : BANK.map(function (w) { return w.week; }),
    mode: pref.mode === "exam" ? "exam" : "study",
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

  function norm(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[.,!?·・‧「」『』()（）\[\]{}"'`~\-–—_/\\]/g, "");
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function show(name) {
    ["home", "quiz", "result"].forEach(function (s) {
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
      ? sel.weeks.slice().sort(function (a, b) { return a - b; }).join("주차, ") + "주차 — 모두 " + pool.length + "문항"
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

    Array.prototype.forEach.call($("modeSeg").querySelectorAll("button"), function (b) {
      b.setAttribute("aria-pressed", String(sel.mode === b.getAttribute("data-m")));
    });
    $("modeHint").textContent = sel.mode === "study"
      ? "한 문항씩 바로 정답과 해설을 확인하며 넘어갑니다."
      : "끝까지 다 푼 뒤에 한꺼번에 채점합니다. 실제 시험처럼 연습할 때.";

    // 오답노트
    var wrongLive = wrongSet.filter(function (id) { return BY_ID[id]; });
    if (wrongLive.length !== wrongSet.length) { wrongSet = wrongLive; lsSet(LS_WRONG, wrongSet); }
    $("btnWrong").hidden = !wrongSet.length;
    $("btnWrong").textContent = "오답만 풀기 (" + wrongSet.length + ")";

    // 기록
    var stats = $("statRow");
    stats.textContent = "";
    if (history.length) {
      $("statsBlock").hidden = false;
      var last = history[history.length - 1];
      var best = history.reduce(function (m, h) { return Math.max(m, h.pct); }, 0);
      var avg = Math.round(history.reduce(function (s, h) { return s + h.pct; }, 0) / history.length);

      [["최근", last.pct + "점"], ["최고", best + "점"], ["평균", avg + "점"], ["푼 횟수", history.length + "회"]]
        .forEach(function (t) {
          var d = el("div", "stat");
          d.appendChild(el("b", null, t[1]));
          d.appendChild(el("span", null, t[0]));
          stats.appendChild(d);
        });
    } else {
      $("statsBlock").hidden = true;
    }
  }

  $("modeSeg").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    sel.mode = b.getAttribute("data-m");
    savePref(); renderHome();
  });

  $("countSeg").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || b.disabled) return;
    sel.count = Number(b.getAttribute("data-c"));
    savePref(); renderHome();
  });

  $("btnReset").addEventListener("click", function () {
    if (!window.confirm("기록과 오답노트를 모두 지울까요?")) return;
    wrongSet = []; history = [];
    lsSet(LS_WRONG, wrongSet); lsSet(LS_HIST, history);
    renderHome();
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

  /* ================= 세션 ================= */

  var S = null;

  function prepare(q) {
    // 이번 판에서 쓸 표시 순서를 미리 정해 둡니다 (푸는 도중 흔들리지 않도록)
    var p = { q: q, answered: false, locked: false };
    if (q.type === "choice" || q.type === "multi") {
      p.options = shuffle(q.options);
      p.value = (q.type === "multi") ? [] : null;
    } else if (q.type === "match") {
      p.lefts = q.pairs.map(function (pr) { return pr[0]; });
      p.rights = shuffle(q.pairs.map(function (pr) { return pr[1]; }));
      p.value = {};
    } else if (q.type === "order") {
      p.pool = shuffle(q.seq);
      p.value = [];
    } else if (q.type === "short") {
      p.value = "";
    }
    return p;
  }

  function startSession(pool, count) {
    var qs = shuffle(pool);
    if (count > 0 && count < qs.length) qs = qs.slice(0, count);
    S = {
      list: qs.map(prepare),
      idx: 0,
      mode: sel.mode,
      startedAt: Date.now(),
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

  /* ---------- 채점 ---------- */

  function grade(p) {
    var q = p.q, v = p.value, i;

    if (q.type === "choice") {
      return v == null ? 0 : (norm(v) === norm(q.answer) ? 1 : 0);
    }

    if (q.type === "multi") {
      var want = q.answers.map(norm);
      var got = (v || []).map(norm);
      var hit = 0, miss = 0;
      for (i = 0; i < got.length; i++) {
        if (want.indexOf(got[i]) >= 0) hit++; else miss++;
      }
      var sc = (hit - miss) / want.length;
      return Math.max(0, Math.min(1, sc));
    }

    if (q.type === "match") {
      var okc = 0;
      q.pairs.forEach(function (pr) {
        if (v && norm(v[pr[0]]) === norm(pr[1])) okc++;
      });
      return okc / q.pairs.length;
    }

    if (q.type === "order") {
      if (!v || v.length !== q.seq.length) {
        var partial = 0;
        for (i = 0; i < q.seq.length; i++) if (v && norm(v[i]) === norm(q.seq[i])) partial++;
        return partial / q.seq.length;
      }
      var n = 0;
      for (i = 0; i < q.seq.length; i++) if (norm(v[i]) === norm(q.seq[i])) n++;
      return n / q.seq.length;
    }

    if (q.type === "short") {
      var mine = norm(v);
      if (!mine) return 0;
      for (i = 0; i < q.accept.length; i++) {
        var a = norm(q.accept[i]);
        if (!a) continue;
        if (mine === a) return 1;
        if (a.length >= 2 && mine.indexOf(a) >= 0) return 1; // 조사·어미가 붙어도 통과
      }
      return 0;
    }

    return 0;
  }

  function verdictOf(score) {
    if (score >= 0.999) return "right";
    if (score > 0) return "partial";
    return "wrong";
  }

  function hasAnswer(p) {
    var v = p.value;
    if (p.q.type === "multi") return !!(v && v.length);
    if (p.q.type === "match") return !!(v && Object.keys(v).length);
    if (p.q.type === "order") return !!(v && v.length);
    if (p.q.type === "short") return !!String(v || "").trim();
    return v != null;
  }

  /* ---------- 문항 렌더 ---------- */

  function renderQuestion() {
    var p = S.list[S.idx], q = p.q;

    $("curNo").textContent = String(S.idx + 1);
    $("progressFill").style.width = ((S.idx) / S.list.length * 100) + "%";
    $("qWeek").textContent = q.week + "주차 " + q.no + "번";
    $("qTag").textContent = q.tag || "";
    $("qType").textContent = TYPE_KO[q.type] || "";
    $("qText").innerHTML = q.q;

    var body = $("qBody");
    body.textContent = "";

    if (q.type === "choice" || q.type === "multi") renderOptions(body, p);
    else if (q.type === "match") renderMatch(body, p);
    else if (q.type === "order") renderOrder(body, p);
    else if (q.type === "short") renderShort(body, p);

    // 판정 영역
    var vd = $("verdict");
    if (p.locked) {
      showVerdict(p);
    } else {
      vd.hidden = true;
      vd.textContent = "";
    }

    // 버튼
    $("btnPrev").disabled = (S.idx === 0);
    var last = (S.idx === S.list.length - 1);

    if (S.mode === "study" && !p.locked) {
      $("btnCheck").hidden = false;
      $("btnCheck").disabled = !hasAnswer(p);
      $("btnNext").hidden = true;
    } else {
      $("btnCheck").hidden = true;
      $("btnNext").hidden = false;
      $("btnNext").textContent = last ? "제출하고 결과 보기" : "다음";
    }

    renderGrid();
  }

  function syncCheckBtn() {
    var p = S.list[S.idx];
    if (S.mode === "study" && !p.locked) $("btnCheck").disabled = !hasAnswer(p);
  }

  function renderOptions(body, p) {
    var q = p.q;
    var wrapEl = el("div", "opts");
    var multi = (q.type === "multi");

    if (multi) {
      var h = el("p", "order-hint", "정답을 모두 고르세요. 틀린 것을 함께 고르면 점수가 깎입니다.");
      body.appendChild(h);
    }

    p.options.forEach(function (opt, i) {
      var b = el("button", "opt");
      b.type = "button";
      var mark = el("span", "mark", multi ? "" : String(i + 1));
      b.appendChild(mark);
      b.appendChild(el("span", null, opt));

      var chosen = multi ? (p.value.indexOf(opt) >= 0) : (p.value === opt);
      if (chosen) b.setAttribute("data-sel", "1");
      if (multi && chosen) mark.textContent = "✓";

      if (p.locked) {
        b.disabled = true;
        var isRight = multi ? (q.answers.indexOf(opt) >= 0) : (opt === q.answer);
        if (chosen && isRight) b.setAttribute("data-state", "right");
        else if (chosen && !isRight) b.setAttribute("data-state", "wrong");
        else if (!chosen && isRight) b.setAttribute("data-state", "missed");
      } else {
        b.addEventListener("click", function () {
          if (multi) {
            var k = p.value.indexOf(opt);
            if (k >= 0) p.value.splice(k, 1); else p.value.push(opt);
          } else {
            p.value = opt;
          }
          p.answered = true;
          renderQuestion();
        });
      }
      wrapEl.appendChild(b);
    });

    body.appendChild(wrapEl);
  }

  function renderMatch(body, p) {
    var q = p.q;
    body.appendChild(el("p", "order-hint", "왼쪽 속성마다 대응하는 방법을 고르세요."));

    p.lefts.forEach(function (left) {
      var row = el("div", "match-row");
      row.appendChild(el("div", "match-left", left));

      var s = document.createElement("select");
      s.setAttribute("aria-label", left + "에 대응하는 방법");
      var blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "— 고르기 —";
      s.appendChild(blank);

      p.rights.forEach(function (r) {
        var o = document.createElement("option");
        o.value = r;
        o.textContent = r;
        if (p.value[left] === r) o.selected = true;
        s.appendChild(o);
      });

      if (p.locked) {
        s.disabled = true;
        var right = null;
        q.pairs.forEach(function (pr) { if (pr[0] === left) right = pr[1]; });
        row.setAttribute("data-state", norm(p.value[left]) === norm(right) ? "right" : "wrong");
      } else {
        s.addEventListener("change", function () {
          if (s.value) p.value[left] = s.value; else delete p.value[left];
          p.answered = true;
          syncCheckBtn();
          renderGrid();
        });
      }

      row.appendChild(s);
      body.appendChild(row);
    });
  }

  function renderOrder(body, p) {
    var q = p.q;
    body.appendChild(el("p", "order-hint", "순서대로 눌러 배열하세요. 배열된 항목을 누르면 되돌립니다."));

    var slots = el("div", "order-slots");
    p.value.forEach(function (item, i) {
      var b = el("button", "order-slot");
      b.type = "button";
      b.appendChild(el("span", "idx", String(i + 1)));
      b.appendChild(el("span", null, item));
      if (p.locked) {
        b.disabled = true;
        b.setAttribute("data-state", norm(q.seq[i]) === norm(item) ? "right" : "wrong");
      } else {
        b.addEventListener("click", function () {
          p.value.splice(i, 1);
          renderQuestion();
        });
      }
      slots.appendChild(b);
    });
    body.appendChild(slots);

    if (!p.locked) {
      var pool = el("div", "order-pool");
      p.pool.forEach(function (item) {
        if (p.value.indexOf(item) >= 0) return;
        var b = el("button", null, item);
        b.type = "button";
        b.addEventListener("click", function () {
          p.value.push(item);
          p.answered = true;
          renderQuestion();
        });
        pool.appendChild(b);
      });
      body.appendChild(pool);
    }
  }

  function renderShort(body, p) {
    var input = document.createElement("input");
    input.className = "short-in";
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = "답을 입력하세요";
    input.value = p.value || "";
    input.setAttribute("aria-label", "답 입력");
    if (p.locked) {
      input.disabled = true;
    } else {
      input.addEventListener("input", function () {
        p.value = input.value;
        p.answered = true;
        syncCheckBtn();
        renderGrid();
      });
      input.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (S.mode === "study") { if (hasAnswer(p)) checkNow(); }
        else goNext();
      });
    }
    body.appendChild(input);
  }

  /* ---------- 판정 표시 ---------- */

  function answerText(q) {
    if (q.type === "choice") return q.answer;
    if (q.type === "multi") return q.answers.join(" · ");
    if (q.type === "match") return q.pairs.map(function (pr) { return pr[0] + " → " + pr[1]; }).join(" / ");
    if (q.type === "order") return q.seq.join(" → ");
    if (q.type === "short") return q.accept[0];
    return "";
  }

  function myAnswerText(p) {
    var q = p.q, v = p.value;
    if (!hasAnswer(p)) return "(무응답)";
    if (q.type === "choice") return v;
    if (q.type === "multi") return v.join(" · ");
    if (q.type === "match") return q.pairs.map(function (pr) { return pr[0] + " → " + (v[pr[0]] || "?"); }).join(" / ");
    if (q.type === "order") return v.join(" → ");
    if (q.type === "short") return v;
    return "";
  }

  function showVerdict(p) {
    var sc = grade(p);
    var v = verdictOf(sc);
    var vd = $("verdict");
    vd.className = "verdict " + v;
    vd.textContent = "";

    var head = el("span", "vhead",
      v === "right" ? "정답" : v === "partial" ? "부분 정답 (" + Math.round(sc * 100) + "%)" : "오답");
    vd.appendChild(head);

    if (v !== "right") {
      var ans = el("div", null);
      ans.appendChild(el("b", null, "정답 "));
      ans.appendChild(document.createTextNode(answerText(p.q)));
      vd.appendChild(ans);
    }

    var why = el("div", "why");
    why.innerHTML = p.q.why || "";
    vd.appendChild(why);

    vd.hidden = false;
  }

  function checkNow() {
    var p = S.list[S.idx];
    if (!hasAnswer(p)) return;
    p.locked = true;
    renderQuestion();
    $("verdict").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /* ---------- 이동 ---------- */

  function goNext() {
    if (S.idx === S.list.length - 1) { finish(); return; }
    S.idx++;
    renderQuestion();
  }

  $("btnCheck").addEventListener("click", checkNow);
  $("btnNext").addEventListener("click", goNext);
  $("btnPrev").addEventListener("click", function () {
    if (S.idx === 0) return;
    S.idx--;
    renderQuestion();
  });

  $("btnQuit").addEventListener("click", function () {
    if (!window.confirm("그만두고 홈으로 갈까요? 지금까지 푼 내용은 사라집니다.")) return;
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
      if (hasAnswer(p)) b.classList.add("done");
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

    if (e.key >= "1" && e.key <= "9" && !p.locked && (p.q.type === "choice" || p.q.type === "multi")) {
      var i = Number(e.key) - 1;
      if (i < p.options.length) {
        var opt = p.options[i];
        if (p.q.type === "multi") {
          var k = p.value.indexOf(opt);
          if (k >= 0) p.value.splice(k, 1); else p.value.push(opt);
        } else {
          p.value = opt;
        }
        p.answered = true;
        renderQuestion();
      }
    } else if (e.key === "Enter") {
      if (S.mode === "study" && !p.locked) { if (hasAnswer(p)) checkNow(); }
      else goNext();
    } else if (e.key === "ArrowLeft") {
      if (S.idx > 0) { S.idx--; renderQuestion(); }
    } else if (e.key === "ArrowRight") {
      if (!(S.mode === "study" && !p.locked)) goNext();
    }
  });

  /* ================= 결과 ================= */

  function finish() {
    var total = 0;
    var counts = { right: 0, partial: 0, wrong: 0 };
    var newWrong = wrongSet.slice();

    S.list.forEach(function (p) {
      p.score = grade(p);
      p.verdict = verdictOf(p.score);
      total += p.score;
      counts[p.verdict]++;

      var i = newWrong.indexOf(p.q.id);
      if (p.verdict === "right") { if (i >= 0) newWrong.splice(i, 1); }
      else if (i < 0) newWrong.push(p.q.id);
    });

    wrongSet = newWrong;
    lsSet(LS_WRONG, wrongSet);

    var pct = Math.round(total / S.list.length * 100);

    history.push({ t: Date.now(), weeks: S.weeks, n: S.list.length, pct: pct });
    if (history.length > 30) history = history.slice(-30);
    lsSet(LS_HIST, history);

    renderResult(pct, counts);
    show("result");
  }

  function renderResult(pct, counts) {
    $("resPct").textContent = String(pct);
    $("resScope").textContent = S.weeks.join("주차 · ") + "주차 · " + S.list.length + "문항";

    var meta = $("resMeta");
    meta.textContent = "";
    var mins = Math.max(1, Math.round((Date.now() - S.startedAt) / 60000));
    [["정답", counts.right], ["부분", counts.partial], ["오답", counts.wrong], ["걸린 시간", mins + "분"]]
      .forEach(function (t) {
        var d = el("div");
        d.appendChild(el("b", null, String(t[1])));
        d.appendChild(document.createTextNode(t[0]));
        meta.appendChild(d);
      });

    $("btnRetryWrong").hidden = (counts.right === S.list.length);

    var list = $("resList");
    list.textContent = "";

    S.list.forEach(function (p, i) {
      var card = el("div", "rcard " + p.verdict);

      var head = el("div", "rhead");
      head.appendChild(el("span", "qno", p.q.week + "주차 " + p.q.no + "번"));
      var pill = el("span", "pill " + p.verdict,
        p.verdict === "right" ? "정답" : p.verdict === "partial" ? "부분 정답 " + Math.round(p.score * 100) + "%" : "오답");
      head.appendChild(pill);
      card.appendChild(head);

      var q = el("p", "rq");
      q.innerHTML = p.q.q;
      card.appendChild(q);

      var mine = el("p", "rline " + (p.verdict === "right" ? "ok" : "no"));
      mine.appendChild(el("b", null, "내 답 "));
      mine.appendChild(document.createTextNode(myAnswerText(p)));
      card.appendChild(mine);

      if (p.verdict !== "right") {
        var ans = el("p", "rline ok");
        ans.appendChild(el("b", null, "정답 "));
        ans.appendChild(document.createTextNode(answerText(p.q)));
        card.appendChild(ans);
      }

      if (p.q.why) {
        var why = el("div", "rwhy");
        why.innerHTML = p.q.why;
        card.appendChild(why);
      }

      list.appendChild(card);
    });
  }

  $("btnHome").addEventListener("click", function () {
    S = null;
    renderHome();
    show("home");
  });

  $("btnRetryWrong").addEventListener("click", function () {
    var pool = S.list.filter(function (p) { return p.verdict !== "right"; }).map(function (p) { return p.q; });
    if (!pool.length) return;
    startSession(pool, 0);
  });

  /* ================= 시작 ================= */

  if (!ALL.length) {
    $("btnStart").disabled = true;
  }
  renderHome();
  show("home");
})();
