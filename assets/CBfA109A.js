import{u as N}from"./MCsVctob.js";import{d as Y,u as $,L as I,r as V,g as D,e as _,a as g,w as i,c6 as b,M as q,b as t,cF as v,c as h,c8 as T,cE as U,O as y,i as H,Z as F,o as n,_ as O}from"./8VZ5Nj8u.js";import{f as B}from"./BHNqivV5.js";import{V as z}from"./DkUoFf1W.js";import{b as G}from"./Cacv_Wr7.js";import{b as S}from"./B3AY9_4W.js";const Z={class:"page-governance"},W={class:"main_card di-card"},j={class:"di-card__header-container"},J={class:"di-card__content"},K=["innerHTML"],Q={key:1,class:"di-card__button-container"},X={key:2,class:"di-card__someone-else-container"},ee=Y({__name:"ModalDelegateVotes",props:{modelValue:Boolean},emits:["update:modelValue","delegate-success"],setup(E,{emit:L}){const A=L,s=N(),c=$();I();const a=V(!1),l=V(!1),u=V(""),x=[B.required,B.isValidAddress],M=D(()=>x.every(o=>o(u.value)===!0)),P=D(()=>(s==null?void 0:s.fundUserData.fundDelegateAddress.toLowerCase())===s.activeAccountAddress),R=D(()=>{const o=s==null?void 0:s.fundUserData.fundDelegateAddress;console.log("delegateAddress: ",o);let e=`You have delegated to ${o}`;return s!=null&&s.shouldUserDelegate?e="You have not delegated to anyone yet.<br><br><strong>NOTE: </strong>You must always delegate to yourself first, even if you want to delegate to someone else!":o.toLowerCase()===s.activeAccountAddress&&(e="You have delegated to yourself."),e}),k=()=>{l.value=!1,u.value="",A("update:modelValue",!1)},C=async(o=!1)=>{var e,p;try{a.value=!0;const r=o?s.activeAccountAddress:u.value,m=(e=s.fund)==null?void 0:e.governanceToken.address,d=(p=s.fund)==null?void 0:p.address;if(d===F){c.errorToast("The OIV address is not available. Please contact the Rethink Finance support.");return}let w=s.fundContract;m!==d&&m!==F&&(w=s.fundGovernanceTokenContract),await w.send("delegate",{},r).on("transactionHash",function(f){console.log("tx hash: "+f),c.addToast("The transaction has been submitted. Please wait for it to be confirmed.")}).on("receipt",function(f){console.log(f),f.status?(c.successToast("Delegation of Governance Tokens Succeeded"),A("delegate-success"),k(),r&&(s.fundUserData.fundDelegateAddress=r)):c.errorToast("The delegateTo tx has failed. Please contact the Rethink Finance support."),a.value=!1}).on("error",function(f){console.error(f),a.value=!1,c.errorToast("There has been an error. Please contact the Rethink Finance support.")})}catch(r){console.error("Error delegating to external gov token: ",r),a.value=!1,c.errorToast("There has been an error. Please contact the Rethink Finance support.")}};return(o,e)=>{const p=q("Icon");return n(),_("div",Z,[g(z,{"model-value":E.modelValue,scrim:"black",opacity:"0.3","max-width":"600","onUpdate:modelValue":k},{default:i(()=>{var r,m;return[b("div",W,[b("div",j,[e[5]||(e[5]=b("div",{class:"di-card__header"}," Delegate ",-1)),g(p,{icon:"material-symbols:close",class:"di-card__close-icon",width:"1.5rem",onClick:e[0]||(e[0]=d=>t(l)?l.value=!1:k())})]),b("div",J,[!t(l)||t(l)&&((r=t(s))!=null&&r.shouldUserDelegate)?(n(),_("div",{key:0,class:"di-card",innerHTML:t(R)},null,8,K)):v("",!0),t(l)?(n(),_("div",X,[g(G,{class:"di-card__label label_required"},{default:i(()=>e[8]||(e[8]=[T(" Address ")])),_:1}),g(S,{modelValue:t(u),"onUpdate:modelValue":e[3]||(e[3]=d=>H(u)?u.value=d:null),placeholder:"Enter the address of the delegate",rules:x,required:""},null,8,["modelValue"]),g(y,{disabled:!t(M)||t(a),class:"di-card__delegate-votes",variant:"flat",color:"rgba(210, 223, 255, 1)",onClick:e[4]||(e[4]=d=>C())},{prepend:i(()=>[t(a)?(n(),h(U,{key:0,class:"d-flex",size:"20",width:"3",indeterminate:""})):v("",!0)]),default:i(()=>[e[9]||(e[9]=T(" Delegate votes "))]),_:1},8,["disabled"])])):(n(),_("div",Q,[t(P)?v("",!0):(n(),h(y,{key:0,disabled:t(a),class:"di-card__submit-button",variant:"outlined",onClick:e[1]||(e[1]=d=>C(!0))},{prepend:i(()=>[t(a)?(n(),h(U,{key:0,class:"d-flex",size:"20",width:"3",indeterminate:""})):v("",!0)]),default:i(()=>[e[6]||(e[6]=T(" Myself "))]),_:1},8,["disabled"])),(m=t(s))!=null&&m.shouldUserDelegate?v("",!0):(n(),h(y,{key:1,disabled:t(a),class:"di-card__submit-button",variant:"outlined",onClick:e[2]||(e[2]=d=>l.value=!0)},{default:i(()=>e[7]||(e[7]=[T(" Someone else ")])),_:1},8,["disabled"]))]))])])]}),_:1},8,["model-value"])])}}}),ne=O(ee,[["__scopeId","data-v-313ac959"]]);export{ne as _};
