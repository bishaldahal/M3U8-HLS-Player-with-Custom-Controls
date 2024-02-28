/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /js/hls-video-element@1.0.0/hls-video-element.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{CustomVideoElement as e}from"/js/custom-media-element@1.0.0.js";import{MediaTracksMixin as i}from"/js/media-tracks@0.2.3.js";import t from"/js/hls-1.4.0.js";export{default as Hls}from"/js/hls-1.4.0.js";class s extends(i(e)){attributeChangedCallback(e,i,t){"src"!==e&&super.attributeChangedCallback(e,i,t),"src"===e&&i!=t&&this.load()}#e(){this.api&&(this.api.detachMedia(),this.api.destroy(),this.api=null)}async load(){if(this.#e(),this.src)if(t.isSupported()){switch(this.api=new t({liveDurationInfinity:!0}),await Promise.resolve(),this.nativeEl.preload){case"none":{const e=()=>this.api.loadSource(this.src);this.nativeEl.addEventListener("play",e,{once:!0}),this.api.on(t.Events.DESTROYING,(()=>{this.nativeEl.removeEventListener("play",e)}));break}case"metadata":{const e=this.api.config.maxBufferLength,i=this.api.config.maxBufferSize;this.api.config.maxBufferLength=1,this.api.config.maxBufferSize=1;const s=()=>{this.api.config.maxBufferLength=e,this.api.config.maxBufferSize=i};this.nativeEl.addEventListener("play",s,{once:!0}),this.api.on(t.Events.DESTROYING,(()=>{this.nativeEl.removeEventListener("play",s)})),this.api.loadSource(this.src);break}default:this.api.loadSource(this.src)}this.api.attachMedia(this.nativeEl);const e=new WeakMap;this.api.on(t.Events.MANIFEST_PARSED,((i,t)=>{a();const s=this.addVideoTrack("main");s.selected=!0;for(const[i,a]of t.levels.entries()){const t=s.addRendition(a.url[0],a.width,a.height,a.videoCodec,a.bitrate);e.set(a,`${i}`),t.id=`${i}`}for(let[e,i]of t.audioTracks.entries()){const t=i.default?"main":"alternative",s=this.addAudioTrack(t,i.name,i.lang);s.id=`${e}`,i.default&&(s.enabled=!0)}})),this.audioTracks.addEventListener("change",(()=>{const e=[...this.audioTracks].find((e=>e.enabled))?.id;null!=e&&e!=this.api.audioTrack&&(this.api.audioTrack=+e)})),this.api.on(t.Events.LEVELS_UPDATED,((i,t)=>{const s=this.videoTracks[this.videoTracks.selectedIndex??0];if(!s)return;const a=t.levels.map((i=>e.get(i)));for(const e of this.videoRenditions)e.id&&!a.includes(e.id)&&s.removeRendition(e)}));const i=e=>{const i=e.target.selectedIndex;i!=this.api.nextLevel&&s(i)},s=e=>{const i=this.currentTime;let s=!1;const a=(e,i)=>{s||=!Number.isFinite(i.endOffset)};this.api.on(t.Events.BUFFER_FLUSHING,a),this.api.nextLevel=e,this.api.off(t.Events.BUFFER_FLUSHING,a),s||this.api.trigger(t.Events.BUFFER_FLUSHING,{startOffset:i+10,endOffset:1/0,type:"video"})};this.videoRenditions?.addEventListener("change",i);const a=()=>{for(const e of this.videoTracks)this.removeVideoTrack(e);for(const e of this.audioTracks)this.removeAudioTrack(e)};this.api.once(t.Events.DESTROYING,a)}else await Promise.resolve(),this.nativeEl.canPlayType("application/vnd.apple.mpegurl")&&(this.nativeEl.src=this.src)}}globalThis.customElements&&!globalThis.customElements.get("hls-video")&&globalThis.customElements.define("hls-video",s);export{s as default};
//# sourceMappingURL=/sm/7b3a7b8a6283637c25671eff98027481848bcbcd9c8804a67789bed1a601025e.map