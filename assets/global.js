/* ================================================================
   Glowbit + Blockly Global Script (GitHub Adapted Version)
   Based on working LearnWorlds engine (Rev1)
   ================================================================= */

(function() {

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

    if (window.Glowbit && window.Glowbit._initialized) {
      console.log("Glowbit: already initialized");
      return;
    }

    const state = {
      canvases: {},
      queue: [],
      running: false,
      eventHandlers: { A: [], B: [], shake: [], tilt_up: [], tilt_down: [], tilt_left: [], tilt_right: [] },
      defaultColor: "#00ff00",
      brightness: 255
    };

    // Simplified fonts/icons omitted here for brevity (same as your working LW script)
    const FONT5x7 = {
      "A":["01110","10001","10001","11111","10001","10001","10001"],
      "B":["11110","10001","10001","11110","10001","10001","11110"],
      " ":["00000","00000","00000","00000","00000","00000","00000"]
    };

    const ICONS = {
      smile: [
        [0,0,0,0,0,0,0,0],
        [0,1,0,0,0,0,1,0],
        [0,1,0,0,0,0,1,0],
        [0,0,0,0,0,0,0,0],
        [0,1,0,0,0,0,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0]
      ]
    };

    function createEmpty(n){const a=[];for(let y=0;y<n;y++){a[y]=[];for(let x=0;x<n;x++)a[y][x]=null;}return a;}
    function clearCanvas(id){const o=state.canvases[id];if(!o)return;const{ctx,canvas}=o;ctx.fillStyle="#000";ctx.fillRect(0,0,canvas.width,canvas.height);o.pixels=createEmpty(o.gridSize);}
    function drawPixel(id,x,y,c){const o=state.canvases[id];if(!o)return;const{ctx,pixelSize,padding}=o;const gx=padding+x*pixelSize;const gy=padding+y*pixelSize;ctx.fillStyle="#000";ctx.fillRect(gx,gy,pixelSize,pixelSize);if(c){ctx.fillStyle=c;ctx.shadowColor=c;ctx.shadowBlur=6;ctx.fillRect(gx+2,gy+2,pixelSize-4,pixelSize-4);ctx.shadowBlur=0;}o.pixels[y][x]=c||null;}

    function createGrid(canvasId,pixelSize=26,padding=6){
      const canvas=document.getElementById(canvasId);
      if(!canvas)return;
      const n=8;canvas.width=n*pixelSize+padding*2;canvas.height=n*pixelSize+padding*2;
      const ctx=canvas.getContext("2d");
      state.canvases[canvasId]={canvas,ctx,pixelSize,padding,gridSize:n,pixels:createEmpty(n)};
      clearCanvas(canvasId);
    }

    function textToColumns(text){
      const cols=[],chars=(''+text).toUpperCase().split('');
      for(let ch of chars){
        const p=FONT5x7[ch]||FONT5x7[" "];
        for(let c=0;c<p[0].length;c++){
          const col=[];for(let r=0;r<p.length;r++)col.push(p[r][c]==="1"?1:0);col.push(0);cols.push(col);
        }
        cols.push([0,0,0,0,0,0,0,0]);
      }
      return cols;
    }

    function processQueue(){
      if(state.running)return;
      state.running=true;
      (function next(){
        const cmd=state.queue.shift();
        if(!cmd){state.running=false;return;}
        executeCmd(cmd).then(()=>setTimeout(next,10)).catch(()=>setTimeout(next,10));
      })();
    }

    function executeCmd(cmd){
      return new Promise(resolve=>{
        const canvasId=cmd.canvasId||Object.keys(state.canvases)[0];
        switch(cmd.type){
          case 'text':{
            if(Glowbit._scrollTicker)clearInterval(Glowbit._scrollTicker);
            const cols=textToColumns(cmd.text),speed=cmd.speed||120;
            let pos=-8,total=cols.length+8;
            Glowbit._scrollTicker=setInterval(()=>{
              const m=Array.from({length:8},()=>Array(8).fill(0));
              for(let c=0;c<8;c++){const i=pos+c;if(i>=0&&i<cols.length){const col=cols[i];for(let r=0;r<8;r++)m[r][c]=col[r]||0;}}
              for(let y=0;y<8;y++)for(let x=0;x<8;x++)drawPixel(canvasId,x,y,m[y][x]?cmd.color||state.defaultColor:null);
              pos++;if(pos>total){clearInterval(Glowbit._scrollTicker);Glowbit._scrollTicker=null;setTimeout(resolve,20);}
            },speed);break;
          }
          case 'icon':{
            const m=ICONS[cmd.icon]||ICONS.smile;
            for(let y=0;y<8;y++)for(let x=0;x<8;x++)drawPixel(canvasId,x,y,m[y][x]?cmd.color||'#0f0':null);
            setTimeout(resolve,cmd.duration||800);break;
          }
          case 'clear':clearCanvas(canvasId);setTimeout(resolve,40);break;
          default:setTimeout(resolve,10);
        }
      });
    }

    const GlowbitAPI={
      _initialized:true,_state:state,
      attachCanvas:(id,o)=>createGrid(id,o?.pixelSize||26,o?.padding||6),
      enqueue:(cmd)=>{state.queue.push(cmd);if(!state.running)processQueue();},
      showText:(t,s,c,id)=>GlowbitAPI.enqueue({type:'text',text:String(t||''),speed:s||120,color:c||state.defaultColor,canvasId:id}),
      showIcon:(n,c,id)=>GlowbitAPI.enqueue({type:'icon',icon:n,color:c||state.defaultColor,canvasId:id}),
      clear:(id)=>GlowbitAPI.enqueue({type:'clear',canvasId:id}),
      createLessonUI:function(containerId,options){
        options=options||{};
        const el=document.getElementById(containerId);
        if(!el)return;
        el.innerHTML=`<div class="glowbit-left"><h3>${options.title||'GlowBit Lesson'}</h3><div>${options.instructions||''}</div></div>
        <div class="glowbit-right"><div id="${containerId}-editor" style="height:520px"></div><button id="${containerId}-run">Run</button><canvas id="${containerId}-canvas" width="256" height="256"></canvas></div>`;
        const workspace=Blockly.inject(`${containerId}-editor`,{toolbox:`<xml><block type="show_text"></block><block type="show_icon"></block></xml>`});
        this.attachCanvas(`${containerId}-canvas`,{pixelSize:options.pixelSize||26});
        const run=document.getElementById(`${containerId}-run`);
        run.onclick=()=>{try{const code=Blockly.JavaScript.workspaceToCode(workspace);new Function(code)();}catch(e){console.error(e);}};
        
        // ✅ Preload JSON or XML blocks
        try {
          if (options.defaultXml) {
            const dom = Blockly.utils.xml.textToDom(options.defaultXml);
            Blockly.Xml.domToWorkspace(dom, workspace);
            console.log("✅ Glowbit: defaultXml loaded.");
          } else if (options.defaultJson && Blockly.serialization?.workspaces?.load) {
            Blockly.serialization.workspaces.load(options.defaultJson, workspace);
            console.log("✅ Glowbit: defaultJson loaded.");
          } else {
            console.log("ℹ️ Glowbit: No default blocks provided.");
          }
        } catch(e) {
          console.error("❌ Glowbit preload failed", e);
        }

        return {workspace};
      }
    };

    Blockly.defineBlocksWithJsonArray([
      {"type":"show_text","message0":"show text %1","args0":[{"type":"field_input","name":"TEXT","text":"Hello"}],"previousStatement":null,"nextStatement":null,"colour":160},
      {"type":"show_icon","message0":"show icon %1","args0":[{"type":"field_dropdown","name":"ICON","options":[["smile","smile"]]}],"previousStatement":null,"nextStatement":null,"colour":20}
    ]);

    Blockly.JavaScript['show_text']=b=>{
      const t=b.getFieldValue('TEXT')||'';
      return `Glowbit.showText(${JSON.stringify(t)},120);\n`;
    };
    Blockly.JavaScript['show_icon']=b=>{
      const i=b.getFieldValue('ICON')||'smile';
      return `Glowbit.showIcon(${JSON.stringify(i)});\n`;
    };

    window.Glowbit=GlowbitAPI;
    console.log("✅ Glowbit Global.js loaded and ready.");
  });

})();
