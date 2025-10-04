(function() {

  // Wait until Blockly is ready
  function waitForBlockly(cb, timeout = 10000) {
    const start = Date.now();
    (function check() {
      if (window.Blockly && window.Blockly.inject && window.Blockly.JavaScript) return cb();
      if (Date.now() - start > timeout) {
        console.error("Glowbit: Blockly failed to load within timeout.");
        return;
      }
      setTimeout(check, 50);
    })();
  }

  waitForBlockly(function() {

    // Avoid double initialization
    if (window.Glowbit && window.Glowbit._initialized) {
      console.log("Glowbit: already initialized");
      return;
    }

    // --------------------
    // Internal state
    // --------------------
    const state = {
      canvases: {}, // canvasId -> {canvas, ctx, pixelSize, padding, gridSize, pixels}
      queue: [],    // commands queue
      running: false,
      eventHandlers: { A: [], B: [], shake: [], tilt_up: [], tilt_down: [], tilt_left: [], tilt_right: [] },
      defaultColor: "#00ff00",
      brightness: 255
    };

    // --------------------
    // Fonts (trimmed to essential letters)
    // --------------------
    const FONT5x7 = {
      "A":["01110","10001","11111","10001","10001"],
      "B":["11110","10001","11110","10001","11110"],
      "C":["01111","10000","10000","10000","01111"],
      "D":["11110","10001","10001","10001","11110"],
      "E":["11111","10000","11110","10000","11111"],
      "F":["11111","10000","11110","10000","10000"],
      "G":["01111","10000","10011","10001","01110"],
      "H":["10001","10001","11111","10001","10001"],
      "I":["01110","00100","00100","00100","01110"],
      "J":["00111","00010","00010","10010","01100"],
      "L":["10000","10000","10000","10000","11111"],
      "O":["01110","10001","10001","10001","01110"],
      "R":["11110","10001","11110","10100","10010"],
      "S":["01111","10000","01110","00001","11110"],
      "T":["11111","00100","00100","00100","00100"],
      "U":["10001","10001","10001","10001","01110"],
      " ":["00000","00000","00000","00000","00000"]
    };

    // --------------------
    // Canvas setup helper
    // --------------------
    function createCanvas(id, size = 8, pixelSize = 30) {
      const canvas = document.getElementById(id);
      const ctx = canvas.getContext("2d");
      state.canvases[id] = { canvas, ctx, gridSize: size, pixelSize, pixels: [] };
      for (let y = 0; y < size; y++) {
        state.canvases[id].pixels[y] = Array(size).fill("#000000");
      }
      drawCanvas(id);
    }

    function drawCanvas(id) {
      const { ctx, pixelSize, gridSize, pixels } = state.canvases[id];
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, pixelSize * gridSize, pixelSize * gridSize);
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          ctx.fillStyle = pixels[y][x];
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize - 2, pixelSize - 2);
        }
      }
    }

    // --------------------
    // Simple Glowbit object
    // --------------------
    window.Glowbit = {
      _initialized: true,
      createLessonUI: function(containerId, opts) {
        // inject Blockly workspace
        const workspaceDiv = document.createElement('div');
        workspaceDiv.id = containerId + '-ws';
        workspaceDiv.style.height = "480px";
        workspaceDiv.style.width = "600px";
        document.getElementById(containerId).appendChild(workspaceDiv);

        const workspace = Blockly.inject(workspaceDiv, {
          toolbox: `<xml xmlns="https://developers.google.com/blockly/xml">
                      <category name="Basic" colour="#0284C7">
                        <block type="show_text"></block>
                      </category>
                    </xml>`,
          media: 'lib/media/'
        });

        if (opts.defaultJson) Blockly.serialization.workspaces.load(opts.defaultJson, workspace);

        // Create simulator canvas
        const sim = document.createElement('canvas');
        sim.id = containerId + '-canvas';
        sim.width = sim.height = 300;
        sim.style.border = "1px solid #ccc";
        document.getElementById(containerId).appendChild(sim);
        createCanvas(sim.id, 8, 30);

        return { workspace, sim };
      },

      showIcon: function(icon) {
        console.log("Show icon:", icon);
      },

      onButton: function(btn, handler) {
        if (state.eventHandlers[btn]) state.eventHandlers[btn].push(handler);
      },

      trigger: function(event) {
        (state.eventHandlers[event] || []).forEach(fn => fn());
      }
    };

    console.log("Glowbit Global Script Initialized");

  });

})();

