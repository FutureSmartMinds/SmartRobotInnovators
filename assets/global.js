(function () {
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

  waitForBlockly(function () {
    if (window.Glowbit && window.Glowbit._initialized) {
      console.log("Glowbit: already initialized");
      return;
    }

    const state = {
      canvases: {},
      eventHandlers: { A: [], B: [], shake: [] },
    };

    function createCanvas(id, size = 8, pixelSize = 30) {
      const canvas = document.getElementById(id);
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const pixels = Array.from({ length: size }, () => Array(size).fill("#000"));
      state.canvases[id] = { ctx, pixels, size, pixelSize };
      drawCanvas(id);
    }

    function drawCanvas(id) {
      const c = state.canvases[id];
      if (!c) return;
      const { ctx, size, pixelSize, pixels } = c;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, size * pixelSize, size * pixelSize);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          ctx.fillStyle = pixels[y][x];
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize - 2, pixelSize - 2);
        }
      }
    }

    window.Glowbit = {
      _initialized: true,

      createLessonUI(containerId, opts) {
        const div = document.createElement("div");
        div.id = containerId + "-ws";
        div.style.width = "600px";
        div.style.height = "480px";
        document.getElementById(containerId).appendChild(div);

        const workspace = Blockly.inject(div, {
          toolbox: `<xml xmlns="https://developers.google.com/blockly/xml">
                      <category name="Basic" colour="#0284C7">
                        <block type="show_text"></block>
                      </category>
                    </xml>`,
          media: "lib/media/",
        });

        if (opts.defaultJson)
          Blockly.serialization.workspaces.load(opts.defaultJson, workspace);

        const sim = document.createElement("canvas");
        sim.id = containerId + "-canvas";
        sim.width = 300;
        sim.height = 300;
        sim.style.border = "1px solid #ccc";
        document.getElementById(containerId).appendChild(sim);
        createCanvas(sim.id, 8, 30);

        return { workspace, sim };
      },

      showIcon(icon) {
        console.log("Show icon:", icon);
      },

      onButton(btn, handler) {
        if (state.eventHandlers[btn]) state.eventHandlers[btn].push(handler);
      },

      trigger(event) {
        (state.eventHandlers[event] || []).forEach((fn) => fn());
      },
    };

    console.log("✅ Glowbit Global Script Initialized");
  });
})();
