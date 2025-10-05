/* =====================================================================
   Smart Robot Innovators – Glowbit + Blockly Global Engine (GitHub)
   ---------------------------------------------------------------------
   - Production global script for all steps (1–8)
   - Always starts with an EMPTY workspace (kids drag blocks themselves)
   - Includes Stop button fix (kills intervals/animations immediately)
   - Provides a compact Glowbit simulator (8×8) + Blockly toolbox
   - Exposes a simple API: Glowbit.createLessonUI(containerId, options)
   - Options:
       {
         title: '',              // sidebar heading text
         instructions: '',       // sidebar paragraph
         pixelSize: 26,          // LED pixels size
         toolboxXml: null,       // optional custom toolbox (XML text)
         // defaultXml/defaultJson are IGNORED on purpose to keep empty start
       }
   - Internal helpers preserve your working logic and block set.
   ===================================================================== */

(function () {
  /* --------------------------------------------------------------
   * 1) Small util: wait for Blockly to be present before init
   * -------------------------------------------------------------- */
  function waitForBlockly(cb, timeout = 20000) {
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

  /* --------------------------------------------------------------
   * 2) Main init, one-time
   * -------------------------------------------------------------- */
  function init() {
    if (window.Glowbit && window.Glowbit._initialized) {
      console.log("Glowbit: already initialized");
      return;
    }

    /* ------------------------------------------------------------
     * 2.1) Internal state (kept small & predictable)
     * ------------------------------------------------------------ */
    const state = {
      canvases: {},            // id -> { ctx, w, h, pixelSize }
      queue: [],               // future: if you want step-wise queued ops
      running: false,          // high-level run flag (not strictly required)
      eventHandlers: {         // A/B/Shake... arrays of callbacks
        A: [], B: [],
        shake: [],
        tilt_up: [], tilt_down: [], tilt_left: [], tilt_right: [],
        screen_up: [], screen_down: []
      },
      defaultColor: "#00ff00",
      brightness: 255,
      tempoBPM: 120,
      lastGesture: null,
      count: 0
    };

    /* ------------------------------------------------------------
     * 2.2) Simulator (8×8)
     * ------------------------------------------------------------ */
    const MATRIX_W = 8;
    const MATRIX_H = 8;

    // The "framebuffer" for each canvasId
    const fb = {};

    function makeFB() {
      const arr = [];
      for (let y = 0; y < MATRIX_H; y++) {
        const row = [];
        for (let x = 0; x < MATRIX_W; x++) row.push("#000000");
        arr.push(row);
      }
      return arr;
    }

    function ensureFB(canvasId) {
      if (!fb[canvasId]) fb[canvasId] = makeFB();
      return fb[canvasId];
    }

    function attachCanvas(canvasId, opts) {
      const cv = document.getElementById(canvasId);
      if (!cv) return;
      const ctx = cv.getContext("2d");
      const pixelSize = Math.max(16, Number(opts.pixelSize || 26));
      const pad = 2;

      const w = MATRIX_W * (pixelSize + pad) + pad;
      const h = MATRIX_H * (pixelSize + pad) + pad;

      cv.width = w;
      cv.height = h;

      state.canvases[canvasId] = { ctx, w, h, pixelSize, pad };
      clearCanvas(canvasId); // also builds empty fb
      render(canvasId);
    }

    function clearCanvas(canvasId) {
      ensureFB(canvasId);
      const data = fb[canvasId];
      for (let y = 0; y < MATRIX_H; y++) for (let x = 0; x < MATRIX_W; x++) data[y][x] = "#000000";
      render(canvasId);
    }

    function setPixel(canvasId, x, y, color) {
      const data = ensureFB(canvasId);
      if (x < 0 || x >= MATRIX_W || y < 0 || y >= MATRIX_H) return;
      data[y][x] = color || state.defaultColor;
      render(canvasId);
    }

    function render(canvasId) {
      const cv = document.getElementById(canvasId);
      if (!cv) return;
      const entry = state.canvases[canvasId];
      if (!entry) return;

      const { ctx, pixelSize, pad } = entry;
      ctx.clearRect(0, 0, cv.width, cv.height);

      const data = ensureFB(canvasId);
      for (let y = 0; y < MATRIX_H; y++) {
        for (let x = 0; x < MATRIX_W; x++) {
          const color = data[y][x] || "#000000";
          const dx = pad + x * (pixelSize + pad);
          const dy = pad + y * (pixelSize + pad);
          ctx.fillStyle = color;
          ctx.fillRect(dx, dy, pixelSize, pixelSize);

          // little outline
          ctx.strokeStyle = "#111";
          ctx.lineWidth = 1;
          ctx.strokeRect(dx + 0.5, dy + 0.5, pixelSize - 1, pixelSize - 1);
        }
      }
    }

    /* ------------------------------------------------------------
     * 2.3) Text scroller (basic 5×7 font, left-to-right)
     *      We keep it very simple for teaching purposes.
     *      The ticker is tracked so STOP can cancel.
     * ------------------------------------------------------------ */
    // Minimal font map (only a subset; extend as needed)
    const FONT = {
      " ": [0,0,0,0,0],
      "0": [0x3E,0x51,0x49,0x45,0x3E],
      "1": [0x00,0x42,0x7F,0x40,0x00],
      "2": [0x62,0x51,0x49,0x49,0x46],
      "3": [0x22,0x41,0x49,0x49,0x36],
      "4": [0x18,0x14,0x12,0x7F,0x10],
      "5": [0x27,0x45,0x45,0x45,0x39],
      "6": [0x3C,0x4A,0x49,0x49,0x30],
      "7": [0x01,0x71,0x09,0x05,0x03],
      "8": [0x36,0x49,0x49,0x49,0x36],
      "9": [0x06,0x49,0x49,0x29,0x1E],
      "A": [0x7E,0x09,0x09,0x09,0x7E],
      "B": [0x7F,0x49,0x49,0x49,0x36],
      "C": [0x3E,0x41,0x41,0x41,0x22],
      "D": [0x7F,0x41,0x41,0x22,0x1C],
      "E": [0x7F,0x49,0x49,0x49,0x41],
      "F": [0x7F,0x09,0x09,0x09,0x01],
      "G": [0x3E,0x41,0x49,0x49,0x7A],
      "H": [0x7F,0x08,0x08,0x08,0x7F],
      "I": [0x00,0x41,0x7F,0x41,0x00],
      "J": [0x20,0x40,0x41,0x3F,0x01],
      "K": [0x7F,0x08,0x14,0x22,0x41],
      "L": [0x7F,0x40,0x40,0x40,0x40],
      "M": [0x7F,0x02,0x0C,0x02,0x7F],
      "N": [0x7F,0x04,0x08,0x10,0x7F],
      "O": [0x3E,0x41,0x41,0x41,0x3E],
      "P": [0x7F,0x09,0x09,0x09,0x06],
      "Q": [0x3E,0x41,0x51,0x21,0x5E],
      "R": [0x7F,0x09,0x19,0x29,0x46],
      "S": [0x46,0x49,0x49,0x49,0x31],
      "T": [0x01,0x01,0x7F,0x01,0x01],
      "U": [0x3F,0x40,0x40,0x40,0x3F],
      "V": [0x1F,0x20,0x40,0x20,0x1F],
      "W": [0x7F,0x20,0x18,0x20,0x7F],
      "X": [0x63,0x14,0x08,0x14,0x63],
      "Y": [0x03,0x04,0x78,0x04,0x03],
      "Z": [0x61,0x51,0x49,0x45,0x43]
    };

    function drawCharToFB(canvasId, ch, offsetX, color) {
      const pattern = FONT[ch] || FONT[" "];
      // 5x7 (use y=1..7 to vertically center in 8px)
      for (let col = 0; col < 5; col++) {
        const bits = pattern[col] || 0;
        for (let row = 0; row < 7; row++) {
          const on = (bits >> row) & 1;
          const x = offsetX + col;
          const y = 1 + row; // vertical offset
          if (on) setPixel(canvasId, x, y, color);
        }
      }
    }

    function scrollText(canvasId, text, color, speedMs) {
      stopScroll(); // don’t overlap scroll intervals
      const scrollColor = color || state.defaultColor;
      const speed = Math.max(40, Number(speedMs || 120));
      const str = String(text || "").toUpperCase();

      // We shift a larger virtual area across 8×8
      let xOffset = MATRIX_W; // start off the right side
      Glowbit._scrollTicker = setInterval(() => {
        if (!Glowbit.isRunning) { stopScroll(); return; }

        clearCanvas(canvasId);
        // write text starting at xOffset
        let cx = xOffset;
        for (let i = 0; i < str.length; i++) {
          drawCharToFB(canvasId, str[i], cx, scrollColor);
          cx += 6; // 5 columns + 1 spacing
        }
        render(canvasId);
        xOffset -= 1;
        if (cx < 0) xOffset = MATRIX_W; // loop continuously
      }, speed);
      trackInterval(Glowbit._scrollTicker);
    }

    function stopScroll() {
      if (Glowbit._scrollTicker) {
        clearInterval(Glowbit._scrollTicker);
        Glowbit._scrollTicker = null;
      }
    }

    /* ------------------------------------------------------------
     * 2.4) Audio (simple tone)
     * ------------------------------------------------------------ */
    let audioCtx = null;
    function toneOnce(freq = 261.63, ms = 500) {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = Number(freq) || 261.63;
        gain.gain.value = 0.15;
        osc.connect(gain).connect(audioCtx.destination);
        const now = audioCtx.currentTime;
        osc.start(now);
        osc.stop(now + (ms / 1000));
      } catch(e) {
        // ignore if autoplay blocked
      }
    }

    function bpmToMs(bpm, beats) {
      const b = Number(bpm || 120);
      const n = Number(beats || 1);
      const msPerBeat = (60_000 / b);
      return Math.round(msPerBeat * n);
    }

    /* ------------------------------------------------------------
     * 2.5) Intervals bookkeeping & STOP fix
     * ------------------------------------------------------------ */
    Glowbit = {}; // ensure global reference (we overwrite at the end)
    Glowbit._intervals = [];
    Glowbit.isRunning = false;

    function trackInterval(id) {
      if (!id) return;
      if (!Glowbit._intervals) Glowbit._intervals = [];
      Glowbit._intervals.push(id);
    }

    function clearTrackedIntervals() {
      if (!Glowbit._intervals || !Glowbit._intervals.length) return;
      for (const id of Glowbit._intervals) clearInterval(id);
      Glowbit._intervals = [];
    }

    function stopAllAnimations() {
      clearTrackedIntervals();
      stopScroll();
      // any requestAnimationFrame?
      if (Glowbit._animationFrame) {
        cancelAnimationFrame(Glowbit._animationFrame);
        Glowbit._animationFrame = null;
      }
      console.log("🛑 Glowbit animations stopped.");
    }

    /* ------------------------------------------------------------
     * 2.6) Public Glowbit API object
     * ------------------------------------------------------------ */
    const GlowbitAPI = {
      _initialized: true,
      _state: state,
      _intervals: Glowbit._intervals,

      // canvas attach + control
      attachCanvas,
      clear: function (canvasId) {
        if (!canvasId) {
          // clear all
          Object.keys(state.canvases).forEach(cId => clearCanvas(cId));
        } else {
          clearCanvas(canvasId);
        }
      },
      setPixel: function (canvasId, x, y, color) { setPixel(canvasId, x, y, color); },

      // text, icons, arrows, plot API
      showText: function (canvasId, text, color, speedMs) {
        Glowbit.isRunning = true;
        scrollText(canvasId, text, color, speedMs);
      },

      showIcon: function (canvasId, name, color) {
        // sample icons; extend with more patterns as needed
        const icons = {
          "smile": [
            "........",
            ".#....#.",
            "........",
            "........",
            ".#....#.",
            "..####..",
            "........",
            "........"
          ],
          "heart": [
            ".##..##.",
            "#######.",
            "#######.",
            ".#####..",
            "..###...",
            "...#....",
            "........",
            "........"
          ],
          "arrow_left": [
            "..#.....",
            "...#....",
            "#######.",
            "...#....",
            "..#.....",
            "........",
            "........",
            "........"
          ],
          "arrow_right": [
            ".....#..",
            "....#...",
            ".#######",
            "....#...",
            ".....#..",
            "........",
            "........",
            "........"
          ]
        };
        const pattern = icons[name] || icons["smile"];
        // draw pattern where # = on, . = off
        const col = color || state.defaultColor;
        // clear first (explicit to be visible immediately)
        Object.keys(state.canvases).forEach(cid => clearCanvas(cid));
        for (let y = 0; y < pattern.length; y++) {
          for (let x = 0; x < pattern[y].length; x++) {
            if (pattern[y][x] === "#") {
              Object.keys(state.canvases).forEach(cid => setPixel(cid, x, y, col));
            }
          }
        }
      },

      plotXY: function (canvasId, x, y, color) {
        setPixel(canvasId, x, y, color || state.defaultColor);
      },

      // sound/music helpers
      playTone: function (noteFreq, beats) {
        const ms = bpmToMs(state.tempoBPM, beats || 1);
        toneOnce(noteFreq, ms);
      },

      // events
      on: function (evtName, fn) {
        if (!state.eventHandlers[evtName]) state.eventHandlers[evtName] = [];
        state.eventHandlers[evtName].push(fn);
      },
      trigger: function (evtName) {
        const arr = state.eventHandlers[evtName] || [];
        if (!arr.length) {
          console.warn("⚠️ Glowbit: No handlers registered for", evtName);
          return;
        }
        arr.forEach(fn => {
          try { fn(); } catch(e) {}
        });
      },

      // STOP logic
      stopAll: function () {
        state.queue.length = 0;
        state.running = false;
        Glowbit.isRunning = false;
        stopAllAnimations();
        // clear LED matrices
        Object.keys(state.canvases).forEach(cid => clearCanvas(cid));
        console.log("🛑 Glowbit: program stopped.");
      },

      /* ----------------------------------------------------------
       * UI Factory: createLessonUI(containerId, options)
       *  - Builds: left (title+instructions) + right (editor+sim+buttons)
       *  - Injects workspace
       *  - Always starts empty (ignores defaultXml/defaultJson on purpose)
       * ---------------------------------------------------------- */
      createLessonUI: function (containerId, options) {
        options = options || {};
        const container = document.getElementById(containerId);
        if (!container) { console.error("Glowbit.createLessonUI: container not found:", containerId); return; }
        container.innerHTML = "";
        container.classList.add("glowbit-lesson");

        // left pane
        const left = document.createElement("div");
        left.className = "glowbit-left";

        const title = document.createElement("h3");
        title.textContent = options.title || "GlowBit Lesson";
        const instr = document.createElement("div");
        instr.textContent = options.instructions || "Follow the steps on the right.";
        left.append(title, instr);

        // right pane
        const right = document.createElement("div");
        right.className = "glowbit-right";

        // editor + controls + sim
        const editorWrap = document.createElement("div");
        editorWrap.className = "glowbit-editor-wrap";

        const editorBox = document.createElement("div");
        editorBox.id = containerId + "-editor";
        editorBox.className = "glowbit-editor";

        const controls = document.createElement("div");
        controls.className = "glowbit-controls";

        const runBtn = Object.assign(document.createElement("button"), { className: "glowbit-btn gb-button-start", textContent: "Run Program" });
        const stopBtn = Object.assign(document.createElement("button"), { className: "glowbit-btn secondary gb-button-stop", textContent: "Stop" });
        const btnA = Object.assign(document.createElement("button"), { className: "glowbit-btn event gb-button-a", textContent: "Button A" });
        const btnB = Object.assign(document.createElement("button"), { className: "glowbit-btn event gb-button-b", textContent: "Button B" });
        const shakeBtn = Object.assign(document.createElement("button"), { className: "glowbit-btn secondary gb-button-shake", textContent: "Shake" });
        controls.append(runBtn, stopBtn, btnA, btnB, shakeBtn);

        const canvasWrap = document.createElement("div");
        canvasWrap.className = "glowbit-canvas-wrap";
        const canvas = document.createElement("canvas");
        canvas.id = containerId + "-canvas";
        canvas.className = "glowbit-canvas";
        const simText = Object.assign(document.createElement("div"), { className: "glowbit-sim-text" });
        canvasWrap.append(canvas, simText);

        editorWrap.append(editorBox, controls, canvasWrap);
        right.append(editorWrap);
        container.append(left, right);

        // attach sim
        attachCanvas(canvas.id, { pixelSize: options.pixelSize || 26 });

        // inject Blockly workspace (with toolbox)
        const workspace = createWorkspace(editorBox.id, options.toolboxXml);

        // *** ALWAYS START EMPTY ***
        try {
          workspace.clear(); // ignore any defaults — per requirement
        } catch(e) {}

        // Wire buttons
        runBtn.addEventListener("click", () => {
          try {
            Glowbit.stopAll();           // clear previous runs
            Glowbit.isRunning = true;    // mark running
            const code = Blockly.JavaScript.workspaceToCode(workspace);
            new Function("Glowbit", code)(GlowbitAPI);
            console.log("✅ Glowbit: program loaded, event handlers active");
          } catch (e) {
            console.error("Glowbit.run error", e);
          }
        });

        stopBtn.addEventListener("click", Glowbit.stopAll);
        btnA.addEventListener("click", () => GlowbitAPI.trigger("A"));
        btnB.addEventListener("click", () => GlowbitAPI.trigger("B"));
        shakeBtn.addEventListener("click", () => GlowbitAPI.trigger("shake"));

        return { workspace, canvasId: canvas.id, runBtn, stopBtn };
      }
    };

    /* ------------------------------------------------------------
     * 2.7) Blockly Toolbox (XML)
     *      - Logic, Loops, Math, Variables, Basic, LED, Music, Input
     * ------------------------------------------------------------ */
    function defaultToolboxXml() {
      return `
<xml id="toolbox" style="display:none">
  <category name="Logic" colour="#5C81A6">
    <block type="controls_if"></block>
    <block type="logic_compare"></block>
    <block type="logic_operation"></block>
    <block type="logic_boolean"></block>
    <block type="logic_negate"></block>
  </category>
  <category name="Loops" colour="#5CA65C">
    <block type="forever"></block>
    <block type="repeat_loop">
      <field name="COUNT">5</field>
    </block>
  </category>
  <category name="Math" colour="#5C68A6">
    <block type="math_number"><field name="NUM">0</field></block>
    <block type="math_arithmetic"></block>
    <block type="math_number_property"></block>
    <block type="math_random_int"></block>
  </category>
  <category name="Variables" custom="VARIABLE" colour="#A65C81"></category>

  <sep></sep>
  <category name="Basic" colour="#7B2CBF">
    <block type="on_start"></block>
    <block type="pause"><field name="MS">300</field></block>
    <block type="clear_screen"></block>
    <block type="show_text"><field name="TEXT">Hello!</field></block>
    <block type="show_number">
      <value name="NUM"><block type="math_number"><field name="NUM">42</field></block></value>
    </block>
  </category>

  <category name="LED" colour="#D97706">
    <block type="set_pixel">
      <field name="X">0</field>
      <field name="Y">0</field>
      <field name="COLOUR">#00FF00</field>
    </block>
    <block type="plot_xy">
      <field name="X">0</field>
      <field name="Y">0</field>
      <field name="COLOUR">#00FF00</field>
    </block>
    <block type="show_icon"><field name="ICON">smile</field><field name="COLOUR">#00FF00</field></block>
    <block type="show_arrow"><field name="DIR">arrow_right</field><field name="COLOUR">#00FF00</field></block>
  </category>

  <category name="Music" colour="#06B6D4">
    <block type="set_tempo"><field name="BPM">120</field></block>
    <block type="play_tone">
      <field name="NOTE">Middle C</field>
      <field name="BEATS">1</field>
    </block>
  </category>

  <category name="Input" colour="#10B981">
    <block type="on_button"><field name="BTN">A</field></block>
    <block type="on_shake"></block>
    <block type="gesture_is"><field name="GEST">screen_up</field></block>
    <block type="sound_level"></block>
  </category>
</xml>
      `;
    }

    /* ------------------------------------------------------------
     * 2.8) Workspace inject helper
     * ------------------------------------------------------------ */
    function createWorkspace(editorDivId, customToolboxXmlText) {
      const editorDiv = document.getElementById(editorDivId);
      const toolboxXmlText = (customToolboxXmlText && String(customToolboxXmlText).trim())
        ? customToolboxXmlText
        : defaultToolboxXml();

      const toolboxDom = Blockly.utils.xml.textToDom(toolboxXmlText);
      const workspace = Blockly.inject(editorDiv, {
        toolbox: toolboxDom,
        trashcan: true,
        scrollbars: true,
        zoom: { controls: true, wheel: true, startScale: 0.95, maxScale: 2.0, minScale: 0.5, pinch: true }
      });

      // Ensure Variables flyout works as expected
      workspace.registerToolboxCategoryCallback('VARIABLE', function(ws) {
        return Blockly.Variables.flyoutCategory(ws);
      });

      return workspace;
    }

    /* ------------------------------------------------------------
     * 2.9) Custom Blocks (definitions + JS generators)
     *      All "GlowBit" specific blocks live here.
     * ------------------------------------------------------------ */
    const B = Blockly.Blocks;
    const G = Blockly.JavaScript;

    // ---- Helpers for generators
    function reg(name, fn) { G[name] = fn; }

    // ========== Basic
    B.on_start = {
      init: function () {
        this.appendDummyInput().appendField("on start");
        this.appendStatementInput("DO");
        this.setColour("#7B2CBF");
        this.setTooltip("Run the blocks below once when program starts.");
      }
    };
    reg("on_start", (b) => {
      const body = G.statementToCode(b, "DO") || "";
      return `${body}\n`;
    });

    B.pause = {
      init: function () {
        this.appendDummyInput()
          .appendField("pause (ms)")
          .appendField(new Blockly.FieldNumber(300, 0, 60000, 10), "MS");
        this.setColour("#7B2CBF");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      }
    };
    reg("pause", (b) => {
      const ms = Number(b.getFieldValue("MS") || 300);
      // Simple asynchronous delay
      return `await (async ()=> new Promise(r => setTimeout(r, ${ms})))();\n`;
    });

    B.clear_screen = {
      init: function () {
        this.appendDummyInput().appendField("clear screen");
        this.setColour("#7B2CBF");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      }
    };
    reg("clear_screen", () => {
      // clear all canvases
      return `Glowbit.clear();\n`;
    });

    // ========== Loops
    B.forever = {
      init: function () {
        this.appendDummyInput().appendField("forever");
        this.appendStatementInput("DO");
        this.setColour("#5CA65C");
      }
    };
    reg("forever", (b) => {
      const body = G.statementToCode(b, "DO") || "";
      // Stop-aware forever loop (tracked interval)
      return `
(function(){
  const _loopId = setInterval(async function(){
    if (!Glowbit.isRunning) { clearInterval(_loopId); return; }
    ${body}
  }, 400);
  if (!Glowbit._intervals) Glowbit._intervals = [];
  Glowbit._intervals.push(_loopId);
})();
`;
    });

    B.repeat_loop = {
      init: function () {
        this.appendDummyInput()
          .appendField("repeat")
          .appendField(new Blockly.FieldNumber(5, 1, 100, 1), "COUNT")
          .appendField("times");
        this.appendStatementInput("DO");
        this.setColour("#5CA65C");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      }
    };
    reg("repeat_loop", (b) => {
      const n = Number(b.getFieldValue("COUNT") || 1);
      const body = G.statementToCode(b, "DO") || "";
      return `
for(let i=0;i<${n};i++){
  if (!Glowbit.isRunning) break;
  ${body}
}
`;
    });

    // ========== Basic display
    B.show_text = {
      init: function () {
        this.appendDummyInput()
          .appendField("show text")
          .appendField(new Blockly.FieldTextInput("Hello!"), "TEXT");
        this.setColour("#7B2CBF");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      }
    };
    reg("show_text", (b) => {
      const t = JSON.stringify(b.getFieldValue("TEXT") || "");
      return `Glowbit.showText(/* any canvas */ Object.keys(Glowbit._state.canvases)[0], ${t});\n`;
    });

    B.show_number = {
      init: function () {
        this.appendValueInput("NUM").appendField("show number");
        this.setColour("#7B2CBF");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      }
    };
    reg("show_number", (b) => {
      const n = G.valueToCode(b, "NUM", G.ORDER_NONE) || "0";
      return `Glowbit.showText(Object.keys(Glowbit._state.canvases)[0], String(${n}));\n`;
    });

    // ========== LED
    B.set_pixel = {
      init: function () {
        this.appendDummyInput()
          .appendField("set pixel x")
          .appendField(new Blockly.FieldNumber(0, 0, 7, 1), "X")
          .appendField("y")
          .appendField(new Blockly.FieldNumber(0, 0, 7, 1), "Y")
          .appendField("color")
          .appendField(new Blockly.FieldColour("#00FF00"), "COLOUR");
        this.setColour("#D97706");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      }
    };
    reg("set_pixel", (b) => {
      const x = Number(b.getFieldValue("X") || 0);
      const y = Number(b.getFieldValue("Y") || 0);
      const col = JSON.stringify(b.getFieldValue("COLOUR") || "#00FF00");
      return `Glowbit.setPixel(Object.keys(Glowbit._state.canvases)[0], ${x}, ${y}, ${col});\n`;
    });

    B.plot_xy = {
      init: function () {
        this.appendDummyInput()
          .appendField("plot x")
          .appendField(new Blockly.FieldNumber(0, 0, 7, 1), "X")
          .appendField("y")
          .appendField(new Blockly.FieldNumber(0, 0, 7, 1), "Y")
          .appendField("color")
          .appendField(new Blockly.FieldColour("#00FF00"), "COLOUR");
        this.setColour("#D97706");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      }
    };
    reg("plot_xy", (b) => {
      const x = Number(b.getFieldValue("X") || 0);
      const y = Number(b.getFieldValue("Y") || 0);
      const col = JSON.stringify(b.getFieldValue("COLOUR") || "#00FF00");
      return `Glowbit.plotXY(Object.keys(Glowbit._state.canvases)[0], ${x}, ${y}, ${col});\n`;
    });

    B.show_icon = {
      init: function () {
        this.appendDummyInput()
          .appendField("show icon")
          .appendField(new Blockly.FieldDropdown([
            ["smile","smile"],["heart","heart"],
            ["arrow_left","arrow_left"],["arrow_right","arrow_right"]
          ]), "ICON")
          .appendField("color")
          .appendField(new Blockly.FieldColour("#00FF00"), "COLOUR");
        this.setColour("#D97706");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      }
    };
    reg("show_icon", (b) => {
      const icon = JSON.stringify(b.getFieldValue("ICON") || "smile");
      const col = JSON.stringify(b.getFieldValue("COLOUR") || "#00FF00");
      return `Glowbit.showIcon(Object.keys(Glowbit._state.canvases)[0], ${icon}, ${col});\n`;
    });

    B.show_arrow = {
      init: function () {
        this.appendDummyInput()
          .appendField("show arrow")
          .appendField(new Blockly.FieldDropdown([
            ["arrow_left","arrow_left"],["arrow_right","arrow_right"]
          ]), "DIR")
          .appendField("color")
          .appendField(new Blockly.FieldColour("#00FF00"), "COLOUR");
        this.setColour("#D97706");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      }
    };
    reg("show_arrow", (b) => {
      const dir = JSON.stringify(b.getFieldValue("DIR") || "arrow_right");
      const col = JSON.stringify(b.getFieldValue("COLOUR") || "#00FF00");
      return `Glowbit.showIcon(Object.keys(Glowbit._state.canvases)[0], ${dir}, ${col});\n`;
    });

    // ========== Music
    B.set_tempo = {
      init: function () {
        this.appendDummyInput()
          .appendField("set tempo (BPM)")
          .appendField(new Blockly.FieldNumber(120, 20, 360, 1), "BPM");
        this.setColour("#06B6D4");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      }
    };
    reg("set_tempo", (b) => {
      const bpm = Number(b.getFieldValue("BPM") || 120);
      return `Glowbit._state.tempoBPM = ${bpm};\n`;
    });

    // Middle C… simplified mapping
    const NOTE_FREQ = {
      "Middle C": 261.63,
      "D": 293.66,
      "E": 329.63,
      "F": 349.23,
      "G": 392.00,
      "A": 440.00,
      "B": 493.88,
      "High C": 523.25
    };

    B.play_tone = {
      init: function () {
        this.appendDummyInput()
          .appendField("play tone")
          .appendField(new Blockly.FieldDropdown(Object.keys(NOTE_FREQ).map(k => [k,k])), "NOTE")
          .appendField("for")
          .appendField(new Blockly.FieldDropdown([["1","1"],["1/2","0.5"],["2","2"]]), "BEATS")
          .appendField("beat(s)");
        this.setColour("#06B6D4");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      }
    };
    reg("play_tone", (b) => {
      const note = b.getFieldValue("NOTE") || "Middle C";
      const beats = Number(b.getFieldValue("BEATS") || 1);
      const freq = NOTE_FREQ[note] || NOTE_FREQ["Middle C"];
      const ms = `(${beats})* (60000 / (Glowbit._state.tempoBPM || 120))`;
      return `Glowbit.playTone(${freq}, ${ms});\n`;
    });

    // ========== Input / Events / Gestures
    B.on_button = {
      init: function () {
        this.appendDummyInput()
          .appendField("on button")
          .appendField(new Blockly.FieldDropdown([["A","A"],["B","B"]]), "BTN");
        this.appendStatementInput("DO");
        this.setColour("#10B981");
      }
    };
    reg("on_button", (b) => {
      const btn = b.getFieldValue("BTN") || "A";
      const body = G.statementToCode(b, "DO") || "";
      const key = JSON.stringify(btn);
      return `Glowbit.on(${key}, async function(){ if(!Glowbit.isRunning) return; ${body} });\n`;
    });

    B.on_shake = {
      init: function () {
        this.appendDummyInput().appendField("on shake");
        this.appendStatementInput("DO");
        this.setColour("#10B981");
      }
    };
    reg("on_shake", (b) => {
      const body = G.statementToCode(b, "DO") || "";
      return `Glowbit.on("shake", async function(){ if(!Glowbit.isRunning) return; ${body} });\n`;
    });

    B.gesture_is = {
      init: function () {
        this.appendDummyInput()
          .appendField("gesture is")
          .appendField(new Blockly.FieldDropdown([
            ["screen_up","screen_up"],["screen_down","screen_down"],
            ["tilt_up","tilt_up"],["tilt_down","tilt_down"],
            ["tilt_left","tilt_left"],["tilt_right","tilt_right"]
          ]), "GEST");
        this.setOutput(true, "Boolean");
        this.setColour("#10B981");
      }
    };
    reg("gesture_is", (b) => {
      const g = JSON.stringify(b.getFieldValue("GEST") || "screen_up");
      return [`(Glowbit._state.lastGesture === ${g})`, G.ORDER_ATOMIC];
    });

    B.sound_level = {
      init: function () {
        this.appendDummyInput().appendField("sound level");
        this.setOutput(true, "Number");
        this.setColour("#10B981");
      }
    };
    reg("sound_level", () => {
      // simple fake (random 0..100)
      return ["(Math.floor(Math.random()*101))", G.ORDER_ATOMIC];
    });

    // ========== Variables (built-in UI handles creation)
    // Toolbox uses custom="VARIABLE", no extra blocks needed here.

    /* ------------------------------------------------------------
     * 2.10) Minimal styles (keep things usable without external CSS)
     * ------------------------------------------------------------ */
    injectMinimalStyles();

    function injectMinimalStyles() {
      if (document.getElementById("glowbit-min-css")) return;
      const css = `
.glowbit-lesson{display:grid;grid-template-columns:1fr 2fr;gap:14px;margin-top:8px;}
.glowbit-left{background:#f5f7fb;border-radius:8px;padding:12px;color:#374151}
.glowbit-right{}
.glowbit-editor-wrap{background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:10px;}
.glowbit-editor{height:420px;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:10px;overflow:hidden;}
.glowbit-controls{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.glowbit-btn{background:#4B0082;color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700}
.glowbit-btn.secondary{background:#6b7280}
.glowbit-btn.event{background:#10B981}
.glowbit-canvas-wrap{display:flex;gap:10px;align-items:center}
.glowbit-canvas{background:#111;border-radius:6px}
.glowbit-sim-text{color:#4B0082;font-weight:700}
@media (max-width: 960px){.glowbit-lesson{grid-template-columns:1fr}}
      `.trim();
      const style = document.createElement("style");
      style.id = "glowbit-min-css";
      style.textContent = css;
      document.head.appendChild(style);
    }

    /* ------------------------------------------------------------
     * 2.11) Expose public API
     * ------------------------------------------------------------ */
    GlowbitAPI.createWorkspace = createWorkspace; // (exposed for future steps)
    GlowbitAPI.defaultToolboxXml = defaultToolboxXml;

    // attach STOP helpers
    GlowbitAPI.stopAllAnimations = stopAllAnimations;

    // finalize global
    window.Glowbit = GlowbitAPI;

    console.log("✅ Glowbit Global.js loaded and ready.");
  }
})();
