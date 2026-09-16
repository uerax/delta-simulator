System.register("chunks:///_virtual/WatermelonRules.ts",["cc","./index.js"],(function(e){var t,r,n,_;return{setters:[function(e){t=e.cclegacy,r=e.assetManager},function(e){n=e.loadCoreFromBytes,_=e.loadCoreFromUrl}],execute:function(){e({loadWatermelonCore:function(e,t){if(!a){var r;const E=globalThis,A=function(e,t,r,n){if(n){if(t){const e=/\/$/.test(t)?t:`${t}/`;return u(l(n),e)}return u(n,r)}if(e||t){return u(e||o,t?/\/$/.test(t)?t:`${t}/`:r)}return i(s)}(E.__MAKE_WATERMELON_RULES_WASM_URL__,E.__MAKE_WATERMELON_ASSET_BASE_URL__,null==(r=E.location)?void 0:r.href,e),f=(c=t)instanceof ArrayBuffer||ArrayBuffer.isView(c)?n(t):_(A);a=f.then((e=>{if(!e)throw new Error("This runtime cannot execute the watermelon WASM core.");return e}))}var c;return a},resolveCocosWasmAssetUrl:i}),t._RF.push({},"7c853Svd8pCcaYDX5Lk7UUq","WatermelonRules",void 0);const o="wasm/watermelon-rules.wasm",s="49adad64-03db-4502-8cf8-e1453db44f3a";let a=null;function i(e,t=".wasm"){var n;const _=globalThis,o=r.utils.getUrlWithUuid(e,{isNative:!0,nativeExt:t});if(_.__MAKE_WATERMELON_ASSET_BASE_URL__){const e=/\/$/.test(_.__MAKE_WATERMELON_ASSET_BASE_URL__)?_.__MAKE_WATERMELON_ASSET_BASE_URL__:`${_.__MAKE_WATERMELON_ASSET_BASE_URL__}/`;return u(l(o),e)}return u(o,null==(n=_.location)?void 0:n.href)}function l(e){const t=e.replace(/\\/g,"/"),r=t.lastIndexOf("/assets/");return r>=0?t.slice(r+1):t.replace(/^\.\//,"").replace(/^\//,"")}function u(e,t){if(/^[a-z][a-z\d+.-]*:/i.test(e))return new URL(e);if(t)return new URL(e,t);throw new Error(`Unable to resolve the WASM URL: ${e}`)}t._RF.pop()}}}));

(function(r) {
  r('virtual:///prerequisite-imports/main', 'chunks:///_virtual/main'); 
})(function(mid, cid) {
    System.register(mid, [cid], function (_export, _context) {
    return {
        setters: [function(_m) {
            var _exportObj = {};

            for (var _key in _m) {
              if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _m[_key];
            }
      
            _export(_exportObj);
        }],
        execute: function () { }
    };
    });
});