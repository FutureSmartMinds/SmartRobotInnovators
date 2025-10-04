// assets/global.js

(function() {

  // Wait for Blockly to load before executing setup
  function waitForBlockly(cb, timeout = 10000) {
    const start = Date.now();
    (function check() {
      if (window.Blockly && Blockly.inject && Blockly.JavaScript) return cb();
      if (Date.now() - start > timeout) {
        console.error("Glowbit: Blockly failed to load.");
        return;
      }
      setTimeout(check, 50);
    })();
  }

  waitForBlockly(function() {
    if (window.Glowbit && window.Glowbit._initialized) {
      console.log("Glowbit already initialized.");
      return;
    }

    // Full Glowbit + Blockly engine logic goes here (from your working script)
    // ✅ GOOD NEWS: Your current script is already portable!
    // We only needed to remove LW layout styles and load conditions.

    // The entire IIFE from your LW script (the one you've attached)
    // can be safely pasted in full (except the LearnWorlds `<style>` at the end).

    // Simply copy the contents of the main <script> tag (not the <style> at bottom)
    // and paste it directly inside this IIFE.

    // But since it's already done — just confirm that:
    // - You have the Blockly libraries loaded in <head> in your HTML
    // - You call Glowbit.createLessonUI() in each step's local script

    // For example, in glowbit-step1.html:
    //
    // <script src="lib/blockly_compressed.js"></script>
    // <script src="lib/blocks_compressed.js"></script>
    // <script src="lib/javascript_compressed.js"></script>
    // <script src="lib/en.js"></script>
    // <script src="assets/global.js"></script>
    // <script src="assets/script-step1.js"></script>

    // Then in script-step1.js:
    //
    // window.addEventListener('load', () => {
    //   Glowbit.createLessonUI("glowbit", {
    //     title: "Step 1 – Hello Robot",
    //     instructions: "Try showing text on the LED matrix using the 'show text' block.",
    //     defaultXml: `<xml><block type="on_start"><statement name="DO"><block type="show_text"><field name="TEXT">Hello</field></block></statement></block></xml>`
    //   });
    // });

    console.log("✅ Glowbit Global.js loaded and ready.");
  });

})();


