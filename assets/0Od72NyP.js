import{V as j}from"./C7I-dr7Q.js";import{z as q,B as E,ch as k,ci as J,r as O,cj as W,v as g,ck as $,C as G,cl as H,p as t,J as w,cm as K,cn as Q,co as X,cp as Y,cq as Z}from"./CKPNdySy.js";import{a as ee,u as te,V as C}from"./Bz337Xdv.js";import{m as ae,V as y}from"./hIYWcsGX.js";const le=q({indeterminate:Boolean,inset:Boolean,flat:Boolean,loading:{type:[Boolean,String],default:!1},...ee(),...ae()},"VSwitch"),ce=E()({name:"VSwitch",inheritAttrs:!1,props:le(),emits:{"update:focused":e=>!0,"update:modelValue":e=>!0,"update:indeterminate":e=>!0},setup(e,b){let{attrs:S,slots:a}=b;const n=k(e,"indeterminate"),o=k(e,"modelValue"),{loaderClasses:P}=J(e),{isFocused:_,focus:p,blur:B}=te(e),m=O(),h=W&&window.matchMedia("(forced-colors: active)").matches,I=g(()=>typeof e.loading=="string"&&e.loading!==""?e.loading:e.color),x=$(),A=g(()=>e.id||`switch-${x}`);function F(){n.value&&(n.value=!1)}function z(i){var c,r;i.stopPropagation(),i.preventDefault(),(r=(c=m.value)==null?void 0:c.input)==null||r.click()}return G(()=>{const[i,c]=H(S),r=C.filterProps(e),R=y.filterProps(e);return t(C,w({class:["v-switch",{"v-switch--flat":e.flat},{"v-switch--inset":e.inset},{"v-switch--indeterminate":n.value},P.value,e.class]},i,r,{modelValue:o.value,"onUpdate:modelValue":u=>o.value=u,id:A.value,focused:_.value,style:e.style}),{...a,default:u=>{let{id:D,messagesId:M,isDisabled:N,isReadonly:U,isValid:V}=u;const d={model:o,isValid:V};return t(y,w({ref:m},R,{modelValue:o.value,"onUpdate:modelValue":[s=>o.value=s,F],id:D.value,"aria-describedby":M.value,type:"checkbox","aria-checked":n.value?"mixed":void 0,disabled:N.value,readonly:U.value,onFocus:p,onBlur:B},c),{...a,default:s=>{let{backgroundColorClasses:v,backgroundColorStyles:l}=s;return t("div",{class:["v-switch__track",h?void 0:v.value],style:l.value,onClick:z},[a["track-true"]&&t("div",{key:"prepend",class:"v-switch__track-true"},[a["track-true"](d)]),a["track-false"]&&t("div",{key:"append",class:"v-switch__track-false"},[a["track-false"](d)])])},input:s=>{let{inputNode:v,icon:l,backgroundColorClasses:L,backgroundColorStyles:T}=s;return t(K,null,[v,t("div",{class:["v-switch__thumb",{"v-switch__thumb--filled":l||e.loading},e.inset||h?void 0:L.value],style:e.inset?void 0:T.value},[a.thumb?t(Q,{defaults:{VIcon:{icon:l,size:"x-small"}}},{default:()=>[a.thumb({...d,icon:l})]}):t(j,null,{default:()=>[e.loading?t(Y,{name:"v-switch",active:!0,color:V.value===!1?void 0:I.value},{default:f=>a.loader?a.loader(f):t(Z,{active:f.isActive,color:f.color,indeterminate:!0,size:"16",width:"2"},null)}):l&&t(X,{key:String(l),icon:l,size:"x-small"},null)]})])])}})}})}),{}}});export{ce as V};