import oe from"./BGbJ9kMx.js";import re from"./CSGMlgVt.js";import ne from"./DO3lz6aC.js";import{e as ie,u as ce,v as h,r as c,t as m,q as s,c9 as i,p as o,s as C,h as A,j as d,y as H,cH as V,cG as y,dr as ue,cb as u,cc as _e,cd as fe,n as r,ds as pe,co as K,J as $,dt as me,ca as z,f as g,_ as he}from"./CKPNdySy.js";import{h as F,g as G}from"./Bz337Xdv.js";import{V as J}from"./Dq_okOaE.js";import{V as ve,a as we}from"./DCd2ChjC.js";import{V as Ae}from"./QenfcGu_.js";import{V as Q}from"./D3JyZ2Hp.js";import{V as Ve}from"./BO8eFM9f.js";import"./BODy9WeZ.js";import"./DxnYGecs.js";import"./C7I-dr7Q.js";import"./MMLB91jm.js";import"./hIYWcsGX.js";import"./BvPnmu6E.js";const T=b=>(_e("data-v-293211cd"),b=b(),fe(),b),ye={key:0,class:"section_whitelist"},ge={class:"header"},be={class:"header__actions"},ke={key:0,class:"header__new-address"},xe=T(()=>i("div",{class:"label_required row-title__title"}," Enter New Address ",-1)),Ce={class:"header__actions"},Ne={key:0,class:"header__new-address"},Ie=T(()=>i("div",{class:"label_required row-title__title"}," Enter New Addresses ",-1)),Le={class:"header__actions"},Se={class:"td_index"},Te={class:"address"},Be={class:"address__text"},Ue={key:0,class:"address__state"},Ee={key:0,class:"address__state__deleted"},Re={key:1,class:"address__state__new"},De={key:3,class:"section_whitelist__no_data"},We=T(()=>i("br",null,null,-1)),qe=T(()=>i("br",null,null,-1)),Me={key:1},Oe=ie({__name:"SectionWhitelist",props:{modelValue:{type:Array,default:()=>[]},whitelistEnabled:{type:Boolean,default:!1}},emits:["update:modelValue","update:whitelistEnabled"],setup(b,{emit:X}){const B=ce(),N=b,U=X,_=h({get:()=>(N==null?void 0:N.modelValue)||[],set:e=>{U("update:modelValue",e)}}),w=h({get:()=>N.whitelistEnabled||!1,set:e=>{U("update:whitelistEnabled",e)}}),Y=c(!1),I=c(""),L=c(1),Z=h(()=>{const e=_.value.length;return e==null?0:Math.ceil(e/10)}),E=c(),R=c(),k=c(!1),v=c(!1),n=c(""),D=c([]),x=c(!1),W=h(()=>[g.isValidAddress,g.required,g.notSameAs(_.value.map(e=>e.address),"This address is already in the whitelist")]),q=h(()=>{const e=n.value.split(/\r?\n/).map(l=>l),t=e.reduce((l,p)=>(l[p]=(l[p]||0)+1,l),{}),f=e.filter(l=>t[l]>=2);return[g.isValidAddress,g.required,g.notSameAs(f,"This address is already in the whitelist")]}),ee=h(()=>[{title:"",key:"index",sortable:!0},{title:"",key:"address",sortable:!0},{title:"",key:"delete",align:"end"}]),se=({item:e})=>e.deleted?{class:"tr_deleted"}:e.isNew?{class:"tr_is_new"}:{},M=h(()=>W.value.every(e=>e(n.value)===!0)),te=h(()=>{const e=n.value.split(/\r?\n/).map(l=>l),t=e.every(l=>q.value.every(p=>p(l)===!0)),f=e.map(l=>{const p=q.value.map(a=>a(l)).filter(a=>typeof a=="string");return p.length>0?{address:l,errors:p}:null}).filter(l=>l!==null);return D.value=f.map(l=>l.address?l.address+": "+l.errors.join(", "):"List is empty or contains empty lines"),t}),ae=()=>{x.value=!0},O=()=>{k.value=!k.value,v.value=!1},P=()=>{v.value=!v.value,k.value=!1,v.value&&(n.value="")},le=e=>{if(e.isNew){_.value=_.value.filter(t=>t.address!==e.address);return}e.deleted=!e.deleted},j=()=>{var e;try{const t={address:n.value,isNew:!0,deleted:!1};_.value=[..._.value,t],n.value="",(e=E.value)==null||e.resetValidation(),B.successToast("New address added to the whitelist.")}catch(t){console.log(t)}},de=()=>{var e;try{const t=n.value.split(/\r?\n/).map(f=>f);_.value=t.map(f=>({address:f,isNew:!0,deleted:!1})),n.value="",x.value=!1,(e=R.value)==null||e.resetValidation(),B.successToast("New addresses added to the whitelist."),v.value=!1}catch(t){console.log(t)}};return(e,t)=>{const f=oe,l=re,p=ne;return r(),m("div",null,[s(w)?(r(),m("div",ye,[i("div",ge,[i("div",be,[o(F,{modelValue:s(I),"onUpdate:modelValue":t[0]||(t[0]=a=>C(I)?I.value=a:null),label:"Search","prepend-inner-icon":"mdi-magnify",variant:"outlined","hide-details":"","single-line":""},null,8,["modelValue"]),s(w)?(r(),A(V,{key:0,color:"#ffffff",variant:"text",class:H({"v-btn--active":s(v)}),onClick:P},{default:d(()=>[u(" Add Address List + ")]),_:1},8,["class"])):y("",!0),s(w)?(r(),A(V,{key:1,color:"#ffffff",variant:"text",class:H({"v-btn--active":s(k)}),onClick:O},{default:d(()=>[u(" Add Address + ")]),_:1},8,["class"])):y("",!0)]),s(k)&&s(w)?(r(),m("div",ke,[o(J,{cols:"12"},{default:d(()=>[o(G,{class:"row-title"},{default:d(()=>[xe]),_:1}),o(F,{ref_key:"newAddressInputRef",ref:E,modelValue:s(n),"onUpdate:modelValue":t[1]||(t[1]=a=>C(n)?n.value=a:null),label:"Address",variant:"outlined","single-line":"",rules:s(W),onKeydown:t[2]||(t[2]=pe(a=>s(M)?j():null,["enter"]))},null,8,["modelValue","rules"]),i("div",Ce,[o(V,{color:"red",variant:"text",onClick:O},{default:d(()=>[u(" Cancel ")]),_:1}),o(V,{color:"#ffffff",variant:"outlined",disabled:!s(M),onClick:j},{default:d(()=>[u(" Add Address ")]),_:1},8,["disabled"])])]),_:1})])):y("",!0)]),s(v)&&s(w)?(r(),m("div",Ne,[o(J,{cols:"12"},{default:d(()=>[o(G,{class:"row-title"},{default:d(()=>[Ie]),_:1}),o(Ae,{ref_key:"newAddressListInputRef",ref:R,modelValue:s(n),"onUpdate:modelValue":t[3]||(t[3]=a=>C(n)?n.value=a:null),label:"Addresses",variant:"outlined","single-line":"","error-messages":s(D)},null,8,["modelValue","error-messages"]),i("div",Le,[o(V,{color:"red",variant:"text",onClick:P},{default:d(()=>[u(" Cancel ")]),_:1}),o(V,{color:"#ffffff",variant:"outlined",disabled:!s(te),onClick:ae},{default:d(()=>[u(" Add New Address List ")]),_:1},8,["disabled"])])]),_:1}),o(f,{modelValue:s(x),"onUpdate:modelValue":t[4]||(t[4]=a=>C(x)?x.value=a:null),title:"Heads Up!","confirm-text":"Add Address List","cancel-text":"Cancel",message:"By proceeding with <strong>'Add Address List'</strong>, all the previous addresses will be removed!",onConfirm:de},null,8,["modelValue"])])):y("",!0),s(Y)?(r(),A(Ve,{key:1,type:"table"})):s(_).length?(r(),A(ve,{key:2,class:"section_whitelist__table",headers:s(ee),items:s(_),"cell-props":se,search:s(I),"hide-default-header":"",hover:"","hide-actions":"","items-per-page":"10",page:s(L)},ue({"item.index":d(({index:a})=>[i("strong",Se,z(a+1),1)]),"item.address":d(({item:a})=>[i("div",Te,[i("span",Be,z(a.address),1),a.deleted||a.isNew?(r(),m("div",Ue,[a.deleted?(r(),m("span",Ee,"Removed")):a.isNew?(r(),m("span",Re,"Added")):y("",!0)])):y("",!0)])]),bottom:d(()=>[o(we,{modelValue:s(L),"onUpdate:modelValue":t[5]||(t[5]=a=>C(L)?L.value=a:null),length:s(Z)},null,8,["modelValue","length"])]),_:2},[s(w)?{name:"item.delete",fn:d(({item:a})=>[o(l,{small:"",onClick:me(S=>le(a),["stop"])},{default:d(()=>[a.deleted?(r(),A(Q,{key:0,activator:"parent",location:"bottom"},{default:d(()=>[u(" Undo Delete ")]),activator:d(({props:S})=>[o(K,$({class:"icon_delete",icon:"mdi-arrow-u-left-top",color:"secondary"},S),null,16)]),_:1})):(r(),A(Q,{key:1,activator:"parent",location:"bottom"},{default:d(()=>[u(" Delete Address ")]),activator:d(({props:S})=>[o(K,$({class:"icon_delete",icon:"mdi-delete",color:"error"},S),null,16)]),_:1}))]),_:2},1032,["onClick"])]),key:"0"}:void 0]),1032,["headers","items","search","page"])):(r(),m("div",De,[u(" Currently there are no addresses in the whitelist. "),We,u(" This means that all addresses are allowed to participate in the OIV. "),qe]))])):(r(),m("div",Me,[o(p,{class:"info-box",info:`Whitelist is disabled. This means that anyone can deposit into the OIV. <br>
                      If you want to enable the whitelist, please toggle the switch above. <br>
                      Whitelist is a list of addresses that are allowed to deposit into the OIV.`})]))])}}}),as=he(Oe,[["__scopeId","data-v-293211cd"]]);export{as as default};