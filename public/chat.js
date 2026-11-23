// "Ask about Elijah" chat panel. Talks to /api/chat (see lib/chat.ts).
// The panel only appears when GET /api/chat says the chat is on. The conversation
// is kept in localStorage so it survives refreshes and page changes for 7 days.
(function () {
  "use strict";

  var STORE_KEY = "chat:v1";
  var STATUS_KEY = "chat:status";
  var ENABLED_KEY = "chat:enabled";
  var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  var STATUS_TTL_MS = 5 * 60 * 1000;
  var MAX_MESSAGES = 40;
  var SUGGESTIONS = [
    "What has Elijah built with AI?",
    "What does he work on at Amazon?",
    "Is he a good fit for a backend role?"
  ];

  var root = document.documentElement;
  var state = loadState();
  var status = null;
  var els = {};
  var busy = false;
  var controller = null;
  var botReady = null;

  // - Storage ---------------------------------------------------------

  function newSessionId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Array.from({ length: 32 }, function () {
      return Math.floor(Math.random() * 16).toString(16);
    }).join("");
  }

  function freshState() {
    return { sessionId: newSessionId(), messages: [], open: false, updatedAt: Date.now() };
  }

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (saved && saved.sessionId && Array.isArray(saved.messages) && Date.now() - saved.updatedAt < MAX_AGE_MS) {
        return saved;
      }
    } catch (e) {
      // Storage blocked or corrupt: start fresh.
    }
    return freshState();
  }

  function saveState() {
    state.updatedAt = Date.now();
    state.messages = state.messages.slice(-MAX_MESSAGES);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      // Private mode or full storage: the chat still works for this page.
    }
  }

  // - Status ----------------------------------------------------------

  function getStatus() {
    try {
      var cached = JSON.parse(sessionStorage.getItem(STATUS_KEY) || "null");
      if (cached && Date.now() - cached.at < STATUS_TTL_MS) return Promise.resolve(cached.status);
    } catch (e) {}
    return fetch("/api/chat", { headers: { accept: "application/json" } })
      .then(function (res) {
        return res.ok ? res.json() : { enabled: false };
      })
      .catch(function () {
        return { enabled: false };
      })
      .then(function (result) {
        try {
          sessionStorage.setItem(STATUS_KEY, JSON.stringify({ at: Date.now(), status: result }));
          sessionStorage.setItem(ENABLED_KEY, result.enabled ? "1" : "0");
        } catch (e) {}
        return result;
      });
  }

  // - DOM helpers -----------------------------------------------------

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "text") node.textContent = attrs[key];
      else if (key === "html") node.innerHTML = attrs[key]; // static markup only, never model output
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) {
      node.appendChild(child);
    });
    return node;
  }

  var ICONS = {
    spark:
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 1.5 9.4 6.6 14.5 8 9.4 9.4 8 14.5 6.6 9.4 1.5 8 6.6 6.6Z"/></svg>',
    close:
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    send: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg>',
    stop: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="4" y="4" width="8" height="8" rx="1.5"/></svg>'
  };

  // Writes model text as plain text, turning https:// links into anchors.
  function setText(node, text) {
    node.textContent = "";
    var parts = String(text).split(/(https:\/\/[^\s<>"')\]]+)/g);
    parts.forEach(function (part, i) {
      if (i % 2 === 0) {
        if (part) node.appendChild(document.createTextNode(part));
        return;
      }
      var url = part.replace(/[.,;:!?]+$/, "");
      var trailing = part.slice(url.length);
      var link = el("a", { href: url, target: "_blank", rel: "noopener noreferrer", text: url });
      node.appendChild(link);
      if (trailing) node.appendChild(document.createTextNode(trailing));
    });
  }

  // - Build -----------------------------------------------------------

  function build() {
    els.launcher = el("button", {
      type: "button",
      class: "chat-launcher",
      "aria-controls": "chat-panel",
      "aria-expanded": "false"
    });
    els.launcher.innerHTML = ICONS.spark + "<span>Ask about Elijah</span>";

    els.log = el("div", { class: "chat-log", role: "log", "aria-label": "Conversation" });
    els.live = el("div", { class: "visually-hidden", "aria-live": "polite" });

    els.input = el("textarea", {
      id: "chat-input",
      rows: "1",
      maxlength: "4000",
      placeholder: "Ask about Elijah's work…",
      "aria-label": "Ask a question about Elijah"
    });
    els.send = el("button", { type: "submit", class: "chat-send", "aria-label": "Send" });
    els.send.innerHTML = ICONS.send;
    els.form = el("form", { class: "chat-form" }, [
      el("div", { class: "chat-input-row" }, [els.input, els.send]),
      el("p", {
        class: "chat-note",
        text: "AI answers from this site, so they can be wrong. Questions are saved for 90 days to improve answers."
      })
    ]);

    var close = el("button", { type: "button", class: "chat-icon-button", "aria-label": "Close chat" });
    close.innerHTML = ICONS.close;
    els.clear = el("button", { type: "button", class: "chat-text-button", text: "Clear chat" });

    els.panel = el(
      "aside",
      { id: "chat-panel", class: "chat-panel", "aria-label": "Ask about Elijah", "aria-hidden": "true" },
      [
        el("div", { class: "chat-head" }, [
          el("div", {}, [
            el("p", { class: "chat-title", text: "Ask about Elijah" }),
            el("p", { class: "chat-sub", text: "Answers from his site, by AI" })
          ]),
          el("div", { class: "chat-actions" }, [els.clear, close])
        ]),
        els.log,
        els.form,
        els.live
      ]
    );

    // Pages with a slot (under the home and projects grids) show the launcher there,
    // centered in the page; elsewhere it floats in the corner.
    var slot = document.querySelector("[data-chat-slot]");
    if (slot) {
      els.launcher.classList.add("is-inline");
      slot.appendChild(els.launcher);
    } else {
      document.body.appendChild(els.launcher);
    }
    document.body.appendChild(els.panel);

    els.launcher.addEventListener("click", function () {
      setOpen(true, { focus: true });
    });
    close.addEventListener("click", function () {
      setOpen(false, { focus: true });
    });
    els.clear.addEventListener("click", clearChat);
    els.panel.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false, { focus: true });
    });
    els.form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (busy) stop();
      else ask(els.input.value);
    });
    els.input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        if (!busy) ask(els.input.value);
      }
    });
    els.input.addEventListener("input", autosize);
    window.addEventListener("pagehide", function () {
      if (busy && controller) controller.abort();
    });
  }

  function autosize() {
    els.input.style.height = "auto";
    els.input.style.height = Math.min(els.input.scrollHeight, 144) + "px";
  }

  // - Rendering -------------------------------------------------------

  function renderAll() {
    els.log.textContent = "";
    if (state.messages.length === 0) {
      var list = el("div", { class: "chat-suggestions" });
      SUGGESTIONS.forEach(function (text) {
        var button = el("button", { type: "button", class: "chat-suggestion", text: text });
        button.addEventListener("click", function () {
          ask(text);
        });
        list.appendChild(button);
      });
      els.log.appendChild(
        el("div", { class: "chat-empty" }, [
          el("p", {
            text: "Ask anything about Elijah's experience, projects, or whether he fits a role. Answers come only from this site."
          }),
          list
        ])
      );
    }
    state.messages.forEach(function (message) {
      els.log.appendChild(renderMessage(message));
    });
    if (status && status.resting) {
      els.log.appendChild(
        el("p", { class: "chat-msg chat-notice", text: "The chat is resting for today. Please try again tomorrow." })
      );
    }
    updateControls();
    scrollToEnd();
  }

  function renderMessage(message) {
    var node = el("div", { class: "chat-msg " + message.role + (message.status ? " is-" + message.status : "") });
    setText(node, message.text);
    if (message.status === "stopped") node.appendChild(el("span", { class: "chat-flag", text: " (stopped)" }));
    return node;
  }

  function updateControls() {
    var resting = !!(status && status.resting);
    els.input.disabled = resting;
    els.send.disabled = resting;
    els.send.innerHTML = busy ? ICONS.stop : ICONS.send;
    els.send.setAttribute("aria-label", busy ? "Stop answer" : "Send");
    els.send.classList.toggle("is-stop", busy);
    els.clear.hidden = state.messages.length === 0;
  }

  function scrollToEnd() {
    els.log.scrollTop = els.log.scrollHeight;
  }

  // - Open / close ----------------------------------------------------

  function setOpen(open, opts) {
    state.open = open;
    saveState();
    root.classList.toggle("chat-open", open);
    els.panel.setAttribute("aria-hidden", open ? "false" : "true");
    els.panel.inert = !open;
    els.launcher.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      scrollToEnd();
      if (opts && opts.focus) els.input.focus();
    } else if (opts && opts.focus) {
      els.launcher.focus();
    }
  }

  function clearChat() {
    if (busy) stop();
    state = freshState();
    state.open = true;
    saveState();
    renderAll();
    els.input.focus();
  }

  // - Bot check (Vercel BotID) ----------------------------------------

  // /botid.js marks this page's requests to /api/chat as coming from a real browser.
  function loadBotId() {
    botReady = new Promise(function (resolve) {
      var script = el("script", { src: "/botid.js", async: "" });
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    });
  }

  // Waits for the script before the first question, but never more than 5 seconds.
  function waitForBotId() {
    return Promise.race([
      botReady || Promise.resolve(),
      new Promise(function (resolve) {
        setTimeout(resolve, 5000);
      })
    ]);
  }

  // - Asking ----------------------------------------------------------

  function stop() {
    if (controller) controller.abort();
  }

  async function ask(raw) {
    var question = String(raw || "").trim();
    if (!question || busy || (status && status.resting)) return;

    els.input.value = "";
    autosize();
    if (state.messages.length === 0) els.log.textContent = "";
    var userMessage = { role: "user", text: question };
    state.messages.push(userMessage);
    saveState();
    els.log.appendChild(renderMessage(userMessage));

    var answer = { role: "assistant", text: "" };
    var bubble = el("div", { class: "chat-msg assistant is-pending" });
    bubble.appendChild(el("span", { class: "chat-typing", "aria-label": "Answering" }, [el("i"), el("i"), el("i")]));
    els.log.appendChild(bubble);
    scrollToEnd();

    busy = true;
    controller = new AbortController();
    updateControls();

    try {
      await waitForBotId();
      var res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId, message: question }),
        signal: controller.signal
      });

      if (!res.ok) {
        var problem = await res.json().catch(function () {
          return {};
        });
        if (problem.error === "resting") {
          status = Object.assign({}, status, { resting: true });
          try {
            sessionStorage.removeItem(STATUS_KEY);
          } catch (e) {}
        }
        answer.text = problem.message || "Something went wrong. Please try again.";
        answer.status = "error";
        return;
      }

      await readStream(res, answer, bubble);
    } catch (err) {
      if (err && err.name === "AbortError") {
        answer.status = "stopped";
      } else {
        answer.text = answer.text || "Couldn't reach the chat. Check your connection and try again.";
        answer.status = "error";
      }
    } finally {
      busy = false;
      controller = null;
      if (answer.text || answer.status) {
        state.messages.push(answer);
        bubble.replaceWith(renderMessage(answer));
        if (answer.text && answer.status !== "error") els.live.textContent = answer.text;
      } else {
        bubble.remove();
      }
      saveState();
      updateControls();
      scrollToEnd();
      if (state.open && document.activeElement === document.body) els.input.focus();
    }
  }

  // Reads the NDJSON stream: {"type":"text"} pieces, then "done" or "error".
  async function readStream(res, answer, bubble) {
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";
    for (;;) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      var lines = buffer.split("\n");
      buffer = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        if (!lines[i]) continue;
        var event = JSON.parse(lines[i]);
        if (event.type === "text") {
          answer.text += event.text;
          bubble.classList.remove("is-pending");
          setText(bubble, answer.text);
          scrollToEnd();
        } else if (event.type === "error") {
          answer.text += (answer.text ? "\n\n" : "") + event.message;
          answer.status = "error";
        }
      }
    }
  }

  // - Start -----------------------------------------------------------

  getStatus().then(function (result) {
    status = result;
    if (!status || !status.enabled) {
      root.classList.remove("chat-open");
      return;
    }
    loadBotId();
    build();
    renderAll();
    // Reopen without animation when the visitor moves between pages.
    if (state.open) {
      root.classList.add("chat-no-anim");
      setOpen(true);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          root.classList.remove("chat-no-anim");
        });
      });
    } else {
      setOpen(false);
    }
  });
})();
