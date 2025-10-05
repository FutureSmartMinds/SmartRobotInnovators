/* =====================================================================
   Smart Robot Innovators – Glowbit + Blockly Global Engine (GitHub)
   - Standalone JS (no HTML wrappers)
   - Supports defaultJson + defaultXml preloads
   - 8×8 LED simulator, scrolling text, icons, handlers, tones
   - Blocks: on_start, forever, repeat_loop, show_text, show_number,
             set_pixel, unplot, show_leds, set_brightness, change_color,
             pause_block, clear_screen, on_button_pressed, on_shake,
             on_gesture, sound_level, play_tone, pick_random,
             plus Math/Logic/Loops/Variables essentials
   ===================================================================== */

(function () {
  // ---------- Guard: wait for Blockly ----------
  function waitForBlockly(cb, timeout = 15000) {
    const start = Date.now();
    (function check() {
      if (window.Blockly && Blockly.inject && Blockly.JavaScript) return cb();
      if (Date.now() - start > timeout) {
        console.error("Glowbit: Blockly failed to load within timeout.");
        return;
      }
      setTimeout(check, 40);
    })();
  }

  waitForBlockly(init);

  function init() {
    if (window.Glowbit && window.Glowbit._initialized) {
      console.log("Glowbit: already initialized");
      return;
    }

    // ---------- Internal state ----------
    const state = {
      canvases: {}, // id -> { canvas, ctx, pixelSize, padding, gridSize, pixels }
      queue: [],
      running: false,
      eventHandlers: {
        A: [], B: [],
        shake: [],
        tilt_up: [], tilt_down: [], tilt_left: [], tilt_right: []
      },
      defaultColor: "#00ff00",
      brightness: 255
    };

    // ---------- Font (5×7) + icons (8×8) ----------
    const FONT5x7 = makeFont5x7();
    const ICONS = makeIcons();

    function makeFont5x7() {
      // Subset + essentials; extend as needed.
      return {
        "A":["01110","10001","10001","11111","10001","10001","10001"],
        "B":["11110","10001","10001","11110","10001","10001","11110"],
        "C":["01110","10001","10000","10000","10000","10001","01110"],
        "D":["11100","10010","10001","10001","10001","10010","11100"],
        "E":["11111","10000","10000","11110","10000","10000","11111"],
        "F":["11111","10000","10000","11110","10000","10000","10000"],
        "G":["01110","10001","10000","10011","10001","10001","01110"],
        "H":["10001","10001","10001","11111","10001","10001","10001"],
        "I":["01110","00100","00100","00100","00100","00100","01110"],
        "J":["00111","00010","00010","00010","10010","10010","01100"],
        "K":["10001","10010","10100","11000","10100","10010","10001"],
        "L":["10000","10000","10000","10000","10000","10000","11111"],
        "M":["10001","11011","10101","10101","10001","10001","10001"],
        "N":["10001","10001","11001","10101","10011","10001","10001"],
        "O":["01110","10001","10001","10001","10001","10001","01110"],
        "P":["11110","10001","10001","11110","10000","10000","10000"],
        "Q":["01110","10001","10001","10001","10101","10010","01101"],
        "R":["11110","10001","10001","11110","10100","10010","10001"],
        "S":["01111","10000","10000","01110","00001","00001","11110"],
        "T":["11111","00100","00100","00100","00100","00100","00100"],
        "U":["10001","10001","10001","10001","10001","10001","01110"],
        "V":["10001","10001","10001","10001","10001","01010","00100"],
        "W":["10001","10001","10001","10101","10101","11011","10001"],
        "X":["10001","10001","01010","00100","01010","10001","10001"],
        "Y":["10001","10001","01010","00100","00100","00100","00100"],
        "Z":["11111","00001","00010","00100","01000","10000","11111"],
        "0":["01110","10001","10011","10101","11001","10001","01110"],
        "1":["00100","01100","00100","00100","00100","00100","01110"],
        "2":["01110","10001","00001","00010","00100","01000","11111"],
        "3":["01110","10001","00001","00110","00001","10001","01110"],
        "4":["00010","00110","01010","10010","11111","00010","00010"],
        "5":["11111","10000","10000","11110","00001","00001","11110"],
        "6":["01110","10000","10000","11110","10001","10001","01110"],
        "7":["11111","00001","00010","00100","01000","10000","10000"],
        "8":["01110","10001","10001","01110","10001","10001","01110"],
        "9":["01110","10001","10001","01111","00001","00001","01110"],
        " ":["00000","00000","00000","00000","00000","00000","00000"],
        "!":["00100","00100","00100","00100","00100","00000","00100"],
        "?":["01110","10001","00001","00010","00100","00000","00100"],
        ".":["00000","00000","00000","00000","00000","00110","00110"],
        "-":["00000","00000","00000","11111","00000","00000","00000"]
      };
    }

    function makeIcons() {
      return {
        heart: [
          [0,0,1,1,0,1,1,0],
          [0,1,1,1,1,1,1,0],
          [1,1,1,1,1,1,1,1],
          [1,1,1,1,1,1,1,1],
          [0,1,1,1,1,1,1,0],
          [0,0,1,1,1,1,0,0],
          [0,0,0,1,1,0,0,0],
          [0,0,0,0,0,0,0,0]
        ],
        smile: [
          [0,0,0,0,0,0,0,0],
          [0,1,0,0,0,0,1,0],
          [0,1,0,0,0,0,1,0],
          [0,0,0,0,0,0,0,0],
          [0,1,0,0,0,0,1,0],
          [0,0,1,1,1,1,0,0],
          [0,0,0,0,0,0,0,0],
          [0,0,0,0,0,0,0,0]
        ],
        arrow_right: [
          [0,0,0,0,1,0,0,0],
          [0,0,0,0,1,1,0,0],
          [0,0,0,0,1,1,1,0],
          [0,1,1,1,1,1,1,1],
          [0,0,0,0,1,1,1,0],
          [0,0,0,0,1,1,0,0],
          [0,0,0,0,1,0,0,0],
          [0,0,0,0,0,0,0,0]
        ]
      };
    }

    // ---------- Canvas helpers ----------
    function createEmpty(n) {
      const a = [];
      for (let y = 0; y < n; y++) {
        a[y] = [];
        for (let x = 0; x < n; x++) a[y][x] = null;
      }
      return a;
    }

    function createGrid(canvasId, pixelSize = 26, padding = 6) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) throw new Error("Glowbit.createGrid: canvas not found: " + canvasId);
      const gridSize = 8;
      canvas.width = gridSize * pixelSize + padding * 2;
      canvas.height = gridSize * pixelSize + padding * 2;
      const ctx = canvas.getContext("2d");
      state.canvases[canvasId] = { canvas, ctx, pixelSize, padding, gridSize, pixels: createEmpty(gridSize) };
      clearCanvas(canvasId);
    }

    function clearCanvas(canvasId) {
      const o = state.canvases[canvasId];
      if (!o) return;
      const { ctx, canvas } = o;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      o.pixels = createEmpty(o.gridSize);
    }

    function drawPixel(canvasId, x, y, color) {
      const o = state.canvases[canvasId];
      if (!o) return;
      const { ctx, pixelSize, padding } = o;
      const gx = padding + x * pixelSize;
      const gy = padding + y * pixelSize;
      // background
      ctx.fillStyle = "#000";
      ctx.fillRect(gx, gy, pixelSize, pixelSize);

      if (color) {
        // Apply brightness scale
        const scaled = applyBrightness(color, state.brightness);
        ctx.fillStyle = scaled;
        ctx.shadowColor = scaled;
        ctx.shadowBlur = Math.max(6, pixelSize / 6);
        ctx.fillRect(gx + 2, gy + 2, pixelSize - 4, pixelSize - 4);
        ctx.shadowBlur = 0;
      }
      o.pixels[y][x] = color || null;
    }

    function applyBrightness(hex, val) {
      // hex like #RRGGBB, val 0-255
      if (!hex || hex[0] !== "#" || hex.length !== 7) return hex || "#00ff00";
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const scale = Math.max(0, Math.min(255, val)) / 255;
      const nr = Math.round(r * scale);
      const ng = Math.round(g * scale);
      const nb = Math.round(b * scale);
      const toHex = (n) => n.toString(16).padStart(2, "0");
      return "#" + toHex(nr) + toHex(ng) + toHex(nb);
    }

    function drawPixelsFromMatrix(canvasId, matrix, color) {
      const o = state.canvases[canvasId];
      if (!o) return;
      const n = o.gridSize;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const on = matrix[y] && matrix[y][x];
          drawPixel(canvasId, x, y, on ? (color || state.defaultColor) : null);
        }
      }
    }

    // ---------- Text rendering ----------
    function textToColumns(text) {
      const cols = [];
      const chars = ("" + text).toUpperCase().split("");
      for (let ch of chars) {
        const pattern = FONT5x7[ch] || FONT5x7[" "];
        const charCols = [];
        for (let c = 0; c < pattern[0].length; c++) {
          const col = [];
          for (let r = 0; r < pattern.length; r++) col.push(pattern[r][c] === "1" ? 1 : 0);
          col.push(0); // expand to 8 rows
          charCols.push(col);
        }
        for (let cc of charCols) cols.push(cc);
        cols.push([0, 0, 0, 0, 0, 0, 0, 0]); // spacer
      }
      return cols.length ? cols : [[0, 0, 0, 0, 0, 0, 0, 0]];
    }

    // ---------- Queue ----------
    function processQueue() {
      if (state.running) return;
      state.running = true;
      (function next() {
        const cmd = state.queue.shift();
        if (!cmd) { state.running = false; return; }
        executeCmd(cmd).then(() => setTimeout(next, 8)).catch((err) => {
          console.error("Glowbit: executeCmd error", err);
          setTimeout(next, 8);
        });
      })();
    }

    function executeCmd(cmd) {
      return new Promise((resolve) => {
        try {
          const canvasId = cmd.canvasId || Object.keys(state.canvases)[0];
          switch (cmd.type) {
            case "text": {
              if (Glowbit._scrollTicker) { clearInterval(Glowbit._scrollTicker); Glowbit._scrollTicker = null; }
              const columns = textToColumns(cmd.text);
              const speed = cmd.speed ?? 120;
              let pos = -8;
              const total = columns.length + 8;
              Glowbit._scrollTicker = setInterval(() => {
                const matrix = Array.from({ length: 8 }, () => Array(8).fill(0));
                for (let c = 0; c < 8; c++) {
                  const idx = pos + c;
                  if (idx >= 0 && idx < columns.length) {
                    const col = columns[idx];
                    for (let r = 0; r < 8; r++) matrix[r][c] = col[r] || 0;
                  }
                }
                drawPixelsFromMatrix(canvasId, matrix, cmd.color || state.defaultColor);
                pos++;
                if (pos > total) {
                  clearInterval(Glowbit._scrollTicker);
                  Glowbit._scrollTicker = null;
                  setTimeout(resolve, 10);
                }
              }, speed);
              break;
            }
            case "icon": {
              const matrix = ICONS[cmd.icon] || ICONS.heart;
              drawPixelsFromMatrix(canvasId, matrix, cmd.color || state.defaultColor);
              setTimeout(resolve, cmd.duration || 700);
              break;
            }
            case "clear": {
              clearCanvas(canvasId);
              setTimeout(resolve, 10);
              break;
            }
            case "setPixel": {
              drawPixel(canvasId, cmd.x, cmd.y, cmd.color || null);
              setTimeout(resolve, 5);
              break;
            }
            case "sound": {
              try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                const actx = new AudioCtx();
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = "sine";
                osc.frequency.value = cmd.freq || 600;
                gain.gain.value = 0.05;
                osc.connect(gain); gain.connect(actx.destination);
                osc.start();
                setTimeout(() => { osc.stop(); actx.close(); resolve(); }, cmd.duration || 200);
              } catch (e) { console.warn("Glowbit: audio failed", e); setTimeout(resolve, 1); }
              break;
            }
            case "pause": {
              setTimeout(resolve, cmd.ms || 200);
              break;
            }
            default: setTimeout(resolve, 1);
          }
        } catch (err) {
          console.error("Glowbit executeCmd error:", err);
          setTimeout(resolve, 1);
        }
      });
    }

    // ---------- Public API ----------
    const GlowbitAPI = {
      _initialized: true,
      _state: state,

      // UI
      createLessonUI: function (containerId, options) {
        options = options || {};
        const container = document.getElementById(containerId);
        if (!container) { console.error("Glowbit.createLessonUI: container not found:", containerId); return; }
        container.innerHTML = "";
        container.classList.add("glowbit-lesson");

        // basic styles if host page didn't include them
        injectBaseStylesOnce();

        // left (title/instructions)
        const left = el("div", "glowbit-left");
        const title = el("h3", "glowbit-title", options.title || "GlowBit Lesson");
        const instr = el("div", "glowbit-instructions", options.instructions || "Follow the steps on the right.");
        left.appendChild(title); left.appendChild(instr);

        // right (editor + controls + canvas)
        const right = el("div", "glowbit-right");
        const editorWrap = el("div", "glowbit-editor-wrap");
        const editorBox = el("div", "glowbit-editor"); editorBox.id = containerId + "-editor";

        const controls = el("div", "glowbit-controls");
        const runBtn = button("Run Program", "glowbit-btn");
        const stopBtn = button("Stop", "glowbit-btn secondary");
        const btnA = button("Button A", "glowbit-btn event");
        const btnB = button("Button B", "glowbit-btn event");
        const shakeBtn = button("Shake", "glowbit-btn secondary");
        controls.append(runBtn, stopBtn, btnA, btnB, shakeBtn);

        const canvasWrap = el("div", "glowbit-canvas-wrap");
        const canvas = document.createElement("canvas"); canvas.id = containerId + "-canvas"; canvas.className = "glowbit-canvas";
        const simText = el("div", "glowbit-sim-text", "");
        canvasWrap.append(canvas, simText);

        editorWrap.append(editorBox, controls, canvasWrap);
        right.appendChild(editorWrap);
        container.append(left, right);

        // workspace + canvas
        this.attachCanvas(canvas.id, { pixelSize: options.pixelSize || 26, padding: options.padding || 6 });
        const workspace = this.createWorkspace(editorBox.id, options.toolboxXml);

        // preload blocks
        try {
          if (options.defaultXml) {
            const dom = Blockly.utils.xml.textToDom(options.defaultXml);
            Blockly.Xml.domToWorkspace(dom, workspace);
            console.log("✅ Glowbit: defaultXml loaded.");
          } else if (options.defaultJson && Blockly.serialization && Blockly.serialization.workspaces && Blockly.serialization.workspaces.load) {
            Blockly.serialization.workspaces.load(options.defaultJson, workspace);
            console.log("✅ Glowbit: defaultJson loaded.");
          } else {
            // nothing to preload
          }
        } catch (e) {
          console.error("❌ Glowbit preload failed", e);
        }

        // run/stop + events
        runBtn.addEventListener("click", () => {
          try {
            resetRuntime();
            const code = Blockly.JavaScript.workspaceToCode(workspace);
            new Function(code)();
            console.log("✅ Glowbit: program loaded, event handlers active");
          } catch (e) { console.error("Glowbit.run error", e); }
        });

        stopBtn.addEventListener("click", () => {
          try {
            // stop queue + scrolling + clear screen
            state.queue.length = 0;
            state.running = false;
            if (Glowbit._scrollTicker) { clearInterval(Glowbit._scrollTicker); Glowbit._scrollTicker = null; }
            Glowbit.clear();
            console.log("🛑 Glowbit: program stopped.");
          } catch (e) { console.error("Glowbit.stop error", e); }
        });

        btnA.addEventListener("click", () => Glowbit.trigger("A"));
        btnB.addEventListener("click", () => Glowbit.trigger("B"));
        shakeBtn.addEventListener("click", () => Glowbit.trigger("shake"));

        return { workspace, canvasId: canvas.id, runBtn, stopBtn, btnA, btnB, shakeBtn, simText };
      },

      createWorkspace: function (blocklyDivId, toolboxXml) {
        const defaultToolbox = `
          <xml xmlns="https://developers.google.com/blockly/xml">
            <category name="Basic" colour="#5CA699">
              <block type="on_start"></block>
              <block type="forever"></block>
              <block type="repeat_loop"></block>
              <block type="show_text"></block>
              <block type="show_number"></block>
              <block type="pause_block"></block>
              <block type="clear_screen"></block>
              <block type="change_color"></block>
            </category>
            <category name="LED" colour="#8B5CF6">
              <block type="set_pixel"></block>
              <block type="unplot"></block>
              <block type="show_leds"></block>
              <block type="set_brightness"></block>
            </category>
            <category name="Input" colour="#FFAB00">
              <block type="on_button_pressed"></block>
              <block type="on_shake"></block>
              <block type="on_gesture"></block>
              <block type="sound_level"></block>
            </category>
            <category name="Music" colour="#F97316">
              <block type="play_tone"></block>
            </category>
            <sep></sep>
            <category name="Logic" colour="#5C81A6">
              <block type="controls_if"></block>
              <block type="logic_compare"></block>
              <block type="logic_boolean"></block>
            </category>
            <category name="Loops" colour="#5CA65C">
              <block type="controls_repeat_ext"></block>
              <block type="controls_whileUntil"></block>
            </category>
            <category name="Math" colour="#F59E0B">
              <block type="math_number"></block>
              <block type="math_arithmetic"></block>
              <block type="pick_random"></block>
            </category>
            <category name="Variables" custom="VARIABLE" colour="#A65C81"></category>
          </xml>
        `;
        // Ensure variables toolbox works
        if (Blockly && Blockly.Variables && Blockly.Variables.flyoutCategory) {
          // OK
        }
        const workspace = Blockly.inject(blocklyDivId, {
          toolbox: toolboxXml || defaultToolbox,
          trashcan: true,
          grid: { spacing: 20, length: 3, colour: "#ccc", snap: true },
          zoom: { controls: true, wheel: true, startScale: 1.0 }
        });
        return workspace;
      },

      attachCanvas: function (canvasId, opts) {
        opts = opts || {};
        createGrid(canvasId, opts.pixelSize || 26, opts.padding || 6);
      },

      enqueue: function (cmd) { state.queue.push(cmd); if (!state.running) processQueue(); },

      // Output helpers
      showText: function (text, speed, color, canvasId) {
        this.enqueue({ type: "text", text: String(text || ""), speed: speed || 120, color: color || state.defaultColor, canvasId });
      },
      showIcon: function (name, color, canvasId) {
        this.enqueue({ type: "icon", icon: name, color: color || state.defaultColor, canvasId });
      },
      clear: function (canvasId) { this.enqueue({ type: "clear", canvasId }); },
      setPixel: function (x, y, color, canvasId) {
        this.enqueue({ type: "setPixel", x: Number(x), y: Number(y), color: color || state.defaultColor, canvasId });
      },
      playSound: function (nameOrFreq, duration, canvasId) {
        // Accept names or numeric frequencies
        const tones = { beep: 600, boop: 900, ding: 1200 };
        const freq = (typeof nameOrFreq === "number") ? nameOrFreq : (tones[nameOrFreq] || 700);
        this.enqueue({ type: "sound", freq, duration: duration || 200, canvasId });
      },
      pause: function (ms) { this.enqueue({ type: "pause", ms: Number(ms || 300) }); },

      // Events
      on: function (evt, handler) {
        if (!state.eventHandlers[evt]) state.eventHandlers[evt] = [];
        state.eventHandlers[evt].push(handler);
      },
      trigger: function (evt) {
        const handlers = (state.eventHandlers[evt] || []);
        if (!handlers.length) console.log("⚠️ Glowbit: No handlers registered for", evt);
        handlers.forEach(fn => {
          try { state.queue.push({ type: "pause", ms: 0 }); fn(); if (!state.running) processQueue(); }
          catch (e) { console.error("Glowbit event handler error", e); }
        });
      }
    };

    function resetRuntime() {
      state.queue.length = 0;
      state.running = false;
      if (Glowbit._scrollTicker) { clearInterval(Glowbit._scrollTicker); Glowbit._scrollTicker = null; }
      state.eventHandlers = { A: [], B: [], shake: [], tilt_up: [], tilt_down: [], tilt_left: [], tilt_right: [] };
    }

    // ---------- Utilities ----------
    function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
    function button(text, cls) { const b = document.createElement("button"); b.className = cls; b.textContent = text; return b; }

    let _stylesInjected = false;
    function injectBaseStylesOnce() {
      if (_stylesInjected) return; _stylesInjected = true;
      const css = `
      .glowbit-lesson{display:flex;gap:18px;align-items:flex-start;font-family:Inter,Arial,sans-serif}
      .glowbit-left{flex:0 0 30%;background:#fff;border-radius:12px;padding:14px;box-shadow:0 6px 18px rgba(0,0,0,.06)}
      .glowbit-right{flex:1 1 70%;background:linear-gradient(180deg,#f7fbff,#fff);padding:12px;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.04)}
      .glowbit-title{font-size:20px;margin:0 0 8px 0;color:#0b2340}
      .glowbit-instructions{font-size:14px;color:#334155;line-height:1.45}
      .glowbit-editor-wrap{display:flex;flex-direction:column;gap:12px}
      .glowbit-editor{height:520px;border-radius:8px;overflow:hidden;border:1px solid #e6eef7;background:#fff}
      .glowbit-controls{display:flex;gap:10px;align-items:center;justify-content:center;margin-top:6px;flex-wrap:wrap}
      .glowbit-btn{background:#00A1D6;color:#fff;border:none;padding:10px 14px;border-radius:10px;cursor:pointer;font-weight:600;box-shadow:0 6px 14px rgba(0,161,214,.16)}
      .glowbit-btn.secondary{background:#6B7280}
      .glowbit-btn.event{background:#FFA857;color:#061826}
      .glowbit-canvas-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:6px;overflow:visible}
      .glowbit-canvas{background:#000;border-radius:10px;box-shadow:0 0 26px 6px rgba(0,255,0,.65)}
      .glowbit-sim-text{color:#0f0;font-family:monospace;margin-top:4px;min-height:18px}
      .blocklySvg{height:100%!important}
      @media (max-width:900px){.glowbit-lesson{flex-direction:column}.glowbit-left,.glowbit-right{width:100%}}
      `;
      const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
    }

    // ---------- Custom Blocks ----------
    try {
      Blockly.defineBlocksWithJsonArray([
        // Program structure
        { "type":"on_start","message0":"on start %1","args0":[{"type":"input_statement","name":"DO"}],"colour":200,"nextStatement":null },
        { "type":"forever","message0":"forever %1","args0":[{"type":"input_statement","name":"DO"}],"colour":120,"nextStatement":null },
        { "type":"repeat_loop","message0":"repeat %1 times %2","args0":[{"type":"field_number","name":"COUNT","value":5,"min":1},{"type":"input_statement","name":"DO"}],"colour":120,"previousStatement":null,"nextStatement":null },

        // Display / LED
        { "type":"show_text","message0":"show text %1","args0":[{"type":"field_input","name":"TEXT","text":"Hello"}],"previousStatement":null,"nextStatement":null,"colour":160 },
        { "type":"show_number","message0":"show number %1","args0":[{"type":"input_value","name":"NUM"}],"previousStatement":null,"nextStatement":null,"colour":160 },
        { "type":"set_pixel","message0":"set pixel x %1 y %2 color %3","args0":[{"type":"field_number","name":"X","value":0,"min":0,"max":7},{"type":"field_number","name":"Y","value":0,"min":0,"max":7},{"type":"field_colour","name":"COL","colour":"#00FF00"}],"previousStatement":null,"nextStatement":null,"colour":290 },
        { "type":"unplot","message0":"unplot x %1 y %2","args0":[{"type":"field_number","name":"X","value":0,"min":0,"max":7},{"type":"field_number","name":"Y","value":0,"min":0,"max":7}],"previousStatement":null,"nextStatement":null,"colour":290 },
        { "type":"show_leds","message0":"show leds %1","args0":[{"type":"field_multilinetext","name":"MATRIX","text":"# . . . #\n. # . # .\n. . # . .\n. # . # .\n# . . . #"}],"previousStatement":null,"nextStatement":null,"colour":20 },
        { "type":"set_brightness","message0":"set brightness %1","args0":[{"type":"field_number","name":"VAL","value":255,"min":0,"max":255}],"previousStatement":null,"nextStatement":null,"colour":230 },
        { "type":"change_color","message0":"set color %1","args0":[{"type":"field_colour","name":"COL","colour":"#00FF00"}],"previousStatement":null,"nextStatement":null,"colour":230 },
        { "type":"pause_block","message0":"pause (ms) %1","args0":[{"type":"field_number","name":"MS","value":300,"min":0}],"previousStatement":null,"nextStatement":null,"colour":120 },
        { "type":"clear_screen","message0":"clear screen","previousStatement":null,"nextStatement":null,"colour":0 },

        // Events / Input / Sound
        { "type":"on_button_pressed","message0":"on button %1 do %2","args0":[{"type":"field_dropdown","name":"BTN","options":[["A","A"],["B","B"]]},{"type":"input_statement","name":"DO"}],"colour":20,"previousStatement":null,"nextStatement":null },
        { "type":"on_shake","message0":"on shake do %1","args0":[{"type":"input_statement","name":"DO"}],"colour":20,"previousStatement":null,"nextStatement":null },
        { "type":"on_gesture","message0":"on gesture %1 do %2","args0":[{"type":"field_dropdown","name":"GEST","options":[["tilt up","tilt_up"],["tilt down","tilt_down"],["tilt left","tilt_left"],["tilt right","tilt_right"]]},{"type":"input_statement","name":"DO"}],"colour":20,"previousStatement":null,"nextStatement":null },
        { "type":"sound_level","message0":"sound level","output":"Number","colour":60 },
        { "type":"play_tone","message0":"play tone %1 Hz for %2 ms","args0":[{"type":"field_number","name":"FREQ","value":440,"min":50,"max":2000},{"type":"field_number","name":"DUR","value":200,"min":50,"max":2000}],"previousStatement":null,"nextStatement":null,"colour":60 }
      ]);
    } catch (e) {
      console.warn("Glowbit: blocks may already be defined", e);
    }

    // ---------- Generators ----------
    try {
      const G = Blockly.JavaScript;

      function reg(name, fn) {
        if (G.forBlock) G.forBlock[name] = fn;
        G[name] = fn;
      }

      // Structure
      reg("on_start", (b) => {
        const body = G.statementToCode(b, "DO") || "";
        return `${body}\n`;
      });
      reg("forever", (b) => {
        const body = G.statementToCode(b, "DO") || "";
        return `setInterval(function(){\n${body}}, 400);\n`;
      });
      reg("repeat_loop", (b) => {
        const n = Number(b.getFieldValue("COUNT") || 1);
        const body = G.statementToCode(b, "DO") || "";
        return `for(let i=0;i<${n};i++){\n${body}}\n`;
      });

      // Display / LED
      reg("show_text", (b) => {
        const t = b.getFieldValue("TEXT") || "";
        return `Glowbit.showText(${JSON.stringify(t)}, 120);\n`;
      });
      reg("show_number", (b) => {
        const v = G.valueToCode(b, "NUM", G.ORDER_NONE) || 0;
        return `Glowbit.showText(String(${v}), 120);\n`;
      });
      reg("set_pixel", (b) => {
        const x = Number(b.getFieldValue("X") || 0);
        const y = Number(b.getFieldValue("Y") || 0);
        const c = b.getFieldValue("COL") || "#00ff00";
        return `Glowbit.setPixel(${x}, ${y}, ${JSON.stringify(c)});\n`;
      });
      reg("unplot", (b) => {
        const x = b.getFieldValue("X") || 0;
        const y = b.getFieldValue("Y") || 0;
        return `Glowbit.setPixel(${x}, ${y}, null);\n`;
      });
      reg("show_leds", (b) => {
        const matrix = (b.getFieldValue("MATRIX") || "").trim().split(/[\r\n]+/).slice(0,5);
        let js = "";
        matrix.forEach((row, y) => {
          const cells = row.trim().split(/\s+/).slice(0,5);
          for (let x = 0; x < 5; x++) {
            const cell = cells[x] || ".";
            if (cell === "#") js += `Glowbit.setPixel(${x}, ${y}, Glowbit._state.defaultColor);\n`;
            else js += `Glowbit.setPixel(${x}, ${y}, null);\n`;
          }
        });
        return js;
      });
      reg("set_brightness", (b) => {
        const v = Number(b.getFieldValue("VAL") || 255);
        return `Glowbit._state.brightness = ${v};\n`;
      });
      reg("change_color", (b) => {
        const c = b.getFieldValue("COL") || "#00ff00";
        return `Glowbit._state.defaultColor = ${JSON.stringify(c)};\n`;
      });
      reg("pause_block", (b) => {
        const ms = Number(b.getFieldValue("MS") || 300);
        return `Glowbit.pause(${ms});\n`;
      });
      reg("clear_screen", () => `Glowbit.clear();\n`);

      // Events / Sound
      reg("on_button_pressed", (b) => {
        const btn = b.getFieldValue("BTN") || "A";
        const body = G.statementToCode(b, "DO") || "";
        return `Glowbit.on(${JSON.stringify(btn)}, function(){\n${body}});\n`;
      });
      reg("on_shake", (b) => {
        const body = G.statementToCode(b, "DO") || "";
        return `Glowbit.on("shake", function(){\n${body}});\n`;
      });
      reg("on_gesture", (b) => {
        const g = b.getFieldValue("GEST") || "tilt_up";
        const body = G.statementToCode(b, "DO") || "";
        return `Glowbit.on(${JSON.stringify(g)}, function(){\n${body}});\n`;
      });
      reg("sound_level", () => [`Math.floor(Math.random()*200)`, G.ORDER_FUNCTION_CALL]);
      reg("play_tone", (b) => {
        const f = Number(b.getFieldValue("FREQ") || 440);
        const d = Number(b.getFieldValue("DUR") || 200);
        return `Glowbit.playSound(${f}, ${d});\n`;
      });

      // Built-in math helpers used by toolbox
      G["math_number"] = (block) => [Number(block.getFieldValue("NUM")), G.ORDER_ATOMIC];
      if (!G["math_arithmetic"]) {
        G["math_arithmetic"] = function (block) {
          const OPERATORS = {
            "ADD": [" + ", G.ORDER_ADDITION],
            "MINUS": [" - ", G.ORDER_SUBTRACTION],
            "MULTIPLY": [" * ", G.ORDER_MULTIPLICATION],
            "DIVIDE": [" / ", G.ORDER_DIVISION],
            "POWER": [null, G.ORDER_NONE]
          };
          const op = OPERATORS[block.getFieldValue("OP")] || OPERATORS.ADD;
          const a = G.valueToCode(block, "A", op[1]) || "0";
          const b = G.valueToCode(block, "B", op[1]) || "0";
          if (block.getFieldValue("OP") === "POWER") {
            return [`Math.pow(${a}, ${b})`, G.ORDER_FUNCTION_CALL];
          }
          return [`${a}${op[0]}${b}`, op[1]];
        };
      }
      if (!G["logic_compare"]) {
        G["logic_compare"] = function (block) {
          const OPERATORS = {
            "EQ": "==", "NEQ": "!=", "LT": "<",
            "LTE": "<=", "GT": ">", "GTE": ">="
          };
          const op = OPERATORS[block.getFieldValue("OP")] || "==";
          const order = (op === "==" || op === "!=") ? G.ORDER_EQUALITY : G.ORDER_RELATIONAL;
          const a = G.valueToCode(block, "A", order) || "0";
          const b = G.valueToCode(block, "B", order) || "0";
          return [`${a} ${op} ${b}`, order];
        };
      }
      if (!G["controls_if"]) {
        G["controls_if"] = function (block) {
          let n = 0;
          let code = "", branchCode, conditionCode;
          do {
            conditionCode = G.valueToCode(block, 'IF' + n, G.ORDER_NONE) || 'false';
            branchCode = G.statementToCode(block, 'DO' + n) || '';
            code += (n ? ' else ' : '') + `if (${conditionCode}) {\n${branchCode}}`;
            n++;
          } while (block.getInput('IF' + n));
          if (block.getInput('ELSE')) {
            branchCode = G.statementToCode(block, 'ELSE') || '';
            code += ' else {\n' + branchCode + '}';
          }
          code += '\n';
          return code;
        };
      }
    } catch (e) {
      console.error("Glowbit: generator registration failed", e);
    }

    // ---------- Expose API ----------
    window.Glowbit = GlowbitAPI;
    console.log("✅ Glowbit Global.js loaded and ready.");
  }
})();
