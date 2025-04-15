import{dC as Y,m as H,p as _,cK as M,dD as A,cL as O,dE as j,r as S,g as h,cQ as b,cf as F,a as m,O as w,C as V,cU as k,cV as D,cN as z,G as K,E as R,db as U,dF as J,dG as Q,dH as q,dI as N,dJ as Z,dK as p,cg as ee,cS as X,dL as te}from"./8VZ5Nj8u.js";import{u as ne}from"./DpZW8PmA.js";const oe=e=>{const{touchstartX:o,touchendX:t,touchstartY:n,touchendY:i}=e,u=.5,s=16;e.offsetX=t-o,e.offsetY=i-n,Math.abs(e.offsetY)<u*Math.abs(e.offsetX)&&(e.left&&t<o-s&&e.left(e),e.right&&t>o+s&&e.right(e)),Math.abs(e.offsetX)<u*Math.abs(e.offsetY)&&(e.up&&i<n-s&&e.up(e),e.down&&i>n+s&&e.down(e))};function se(e,o){var n;const t=e.changedTouches[0];o.touchstartX=t.clientX,o.touchstartY=t.clientY,(n=o.start)==null||n.call(o,{originalEvent:e,...o})}function ie(e,o){var n;const t=e.changedTouches[0];o.touchendX=t.clientX,o.touchendY=t.clientY,(n=o.end)==null||n.call(o,{originalEvent:e,...o}),oe(o)}function ae(e,o){var n;const t=e.changedTouches[0];o.touchmoveX=t.clientX,o.touchmoveY=t.clientY,(n=o.move)==null||n.call(o,{originalEvent:e,...o})}function ue(){let e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};const o={touchstartX:0,touchstartY:0,touchendX:0,touchendY:0,touchmoveX:0,touchmoveY:0,offsetX:0,offsetY:0,left:e.left,right:e.right,up:e.up,down:e.down,start:e.start,move:e.move,end:e.end};return{touchstart:t=>se(t,o),touchend:t=>ie(t,o),touchmove:t=>ae(t,o)}}function ce(e,o){var d;const t=o.value,n=t!=null&&t.parent?e.parentElement:e,i=(t==null?void 0:t.options)??{passive:!0},u=(d=o.instance)==null?void 0:d.$.uid;if(!n||!u)return;const s=ue(o.value);n._touchHandlers=n._touchHandlers??Object.create(null),n._touchHandlers[u]=s,Y(s).forEach(r=>{n.addEventListener(r,s[r],i)})}function le(e,o){var u,s;const t=(u=o.value)!=null&&u.parent?e.parentElement:e,n=(s=o.instance)==null?void 0:s.$.uid;if(!(t!=null&&t._touchHandlers)||!n)return;const i=t._touchHandlers[n];Y(i).forEach(d=>{t.removeEventListener(d,i[d])}),delete t._touchHandlers[n]}const W={mounted:ce,unmounted:le},L=Symbol.for("vuetify:v-window"),P=Symbol.for("vuetify:v-window-group"),re=_({continuous:Boolean,nextIcon:{type:[Boolean,String,Function,Object],default:"$next"},prevIcon:{type:[Boolean,String,Function,Object],default:"$prev"},reverse:Boolean,showArrows:{type:[Boolean,String],validator:e=>typeof e=="boolean"||e==="hover"},touch:{type:[Object,Boolean],default:void 0},direction:{type:String,default:"horizontal"},modelValue:null,disabled:Boolean,selectedClass:{type:String,default:"v-window-item--active"},mandatory:{type:[Boolean,String],default:"force"},...R(),...K(),...z()},"VWindow"),he=H()({name:"VWindow",directives:{Touch:W},props:re(),emits:{"update:modelValue":e=>!0},setup(e,o){let{slots:t}=o;const{themeClasses:n}=M(e),{isRtl:i}=A(),{t:u}=O(),s=j(e,P),d=S(),r=h(()=>i.value?!e.reverse:e.reverse),v=b(!1),y=h(()=>{const a=e.direction==="vertical"?"y":"x",f=(r.value?!v.value:v.value)?"-reverse":"";return`v-window-${a}${f}-transition`}),T=b(0),C=S(void 0),g=h(()=>s.items.value.findIndex(a=>s.selected.value.includes(a.id)));F(g,(a,l)=>{const f=s.items.value.length,B=f-1;f<=2?v.value=a<l:a===B&&l===0?v.value=!0:a===0&&l===B?v.value=!1:v.value=a<l}),U(L,{transition:y,isReversed:v,transitionCount:T,transitionHeight:C,rootRef:d});const c=h(()=>e.continuous||g.value!==0),x=h(()=>e.continuous||g.value!==s.items.value.length-1);function E(){c.value&&s.prev()}function I(){x.value&&s.next()}const $=h(()=>{const a=[],l={icon:i.value?e.nextIcon:e.prevIcon,class:`v-window__${r.value?"right":"left"}`,onClick:s.prev,"aria-label":u("$vuetify.carousel.prev")};a.push(c.value?t.prev?t.prev({props:l}):m(w,l,null):m("div",null,null));const f={icon:i.value?e.prevIcon:e.nextIcon,class:`v-window__${r.value?"left":"right"}`,onClick:s.next,"aria-label":u("$vuetify.carousel.next")};return a.push(x.value?t.next?t.next({props:f}):m(w,f,null):m("div",null,null)),a}),G=h(()=>e.touch===!1?e.touch:{...{left:()=>{r.value?E():I()},right:()=>{r.value?I():E()},start:l=>{let{originalEvent:f}=l;f.stopPropagation()}},...e.touch===!0?{}:e.touch});return V(()=>k(m(e.tag,{ref:d,class:["v-window",{"v-window--show-arrows-on-hover":e.showArrows==="hover"},n.value,e.class],style:e.style},{default:()=>{var a,l;return[m("div",{class:"v-window__container",style:{height:C.value}},[(a=t.default)==null?void 0:a.call(t,{group:s}),e.showArrows!==!1&&m("div",{class:"v-window__controls"},[$.value])]),(l=t.additional)==null?void 0:l.call(t,{group:s})]}}),[[D("touch"),G.value]])),{group:s}}}),de=_({reverseTransition:{type:[Boolean,String],default:void 0},transition:{type:[Boolean,String],default:void 0},...R(),...p(),...Z()},"VWindowItem"),me=H()({name:"VWindowItem",directives:{Touch:W},props:de(),emits:{"group:selected":e=>!0},setup(e,o){let{slots:t}=o;const n=J(L),i=Q(e,P),{isBooted:u}=ne();if(!n||!i)throw new Error("[Vuetify] VWindowItem must be used inside VWindow");const s=b(!1),d=h(()=>u.value&&(n.isReversed.value?e.reverseTransition!==!1:e.transition!==!1));function r(){!s.value||!n||(s.value=!1,n.transitionCount.value>0&&(n.transitionCount.value-=1,n.transitionCount.value===0&&(n.transitionHeight.value=void 0)))}function v(){var c;s.value||!n||(s.value=!0,n.transitionCount.value===0&&(n.transitionHeight.value=X((c=n.rootRef.value)==null?void 0:c.clientHeight)),n.transitionCount.value+=1)}function y(){r()}function T(c){s.value&&ee(()=>{!d.value||!s.value||!n||(n.transitionHeight.value=X(c.clientHeight))})}const C=h(()=>{const c=n.isReversed.value?e.reverseTransition:e.transition;return d.value?{name:typeof c!="string"?n.transition.value:c,onBeforeEnter:v,onAfterEnter:r,onEnterCancelled:y,onBeforeLeave:v,onAfterLeave:r,onLeaveCancelled:y,onEnter:T}:!1}),{hasContent:g}=q(e,i.isSelected);return V(()=>m(N,{transition:C.value,disabled:!u.value},{default:()=>{var c;return[k(m("div",{class:["v-window-item",i.selectedClass.value,e.class],style:e.style},[g.value&&((c=t.default)==null?void 0:c.call(t))]),[[te,i.isSelected.value]])]}})),{groupItem:i}}});export{he as V,me as a,de as b,re as m};
