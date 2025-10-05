/* Blockly XML Patch — ensures textToDom and domToWorkspace exist */
(function(){
  if(!window.Blockly) return;
  if(!Blockly.Xml) Blockly.Xml={};
  if(!Blockly.Xml.textToDom){
    Blockly.Xml.textToDom=function(text){
      const parser=new DOMParser();
      return parser.parseFromString(text,"text/xml").documentElement;
    };
  }
  if(!Blockly.Xml.domToWorkspace){
    Blockly.Xml.domToWorkspace=function(dom,workspace){
      if(!workspace||!dom)return;
      try{Blockly.Xml.appendDomToWorkspace(dom,workspace);}catch(e){
        console.warn("⚠️ appendDomToWorkspace failed:",e);
      }
      workspace.render?.();
    };
  }
  console.log("✅ Blockly XML Patch Loaded.");
})();
