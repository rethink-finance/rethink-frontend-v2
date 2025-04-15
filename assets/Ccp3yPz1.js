import ee from"./DoaR_31W.js";import te from"./Dz9wLIBf.js";import oe from"./BvwXEXlu.js";import{_ as ae}from"./B3m5m3cm.js";import{d as se,u as le,r as _,g as N,cf as I,e as k,a as s,c6 as m,b as a,i as J,w as l,N as ie,c as v,cF as q,c8 as d,cC as P,cY as ne,c7 as de,B as pe,M as ue,d8 as re,V as me,O as B,k as ye,t as fe,o as p,_ as Te}from"./8VZ5Nj8u.js";import{d as ve}from"./DD_OkHzZ.js";import{i as Ve,P as y,j as F,V as ce,k as _e,l as S,m as Ne,n as ke,f as H,o as ge}from"./cf8ygKud.js";import{f as be}from"./BHNqivV5.js";import{V as Me}from"./C-53RV9c.js";import{V as r}from"./CquYmSaK.js";import{V as u}from"./DCIY6Kkr.js";import{b as g}from"./Cacv_Wr7.js";import{b as L}from"./B3AY9_4W.js";import{V as we,a as xe,b as Pe,c as Se}from"./BZCQ_TAI.js";const Ue={class:"main_card"},Ae={class:"method_details_title"},Ee={class:"me-1"},he={class:"buttons_container"},De=se({__name:"NewMethod",props:{fundAddress:{type:String,default:""},baseTokenAddress:{type:String,default:""}},emits:["newNavMethodCreated"],setup(O,{emit:X}){const U=O,R=X,b=le(),M=_([0]),$=Ve.filter(o=>o.key!==y.NFT),A=N(()=>F[t.value.positionType].map(o=>ce[o])),j=N(()=>_e[t.value.positionType][t.value.valuationType||"undefined"]||[]),E=N(()=>!t.value.details[t.value.positionType].some(o=>!o.isValid)),K=$.map(o=>({key:o.key,label:o.name})),z=N(()=>A.value.map(o=>({key:o.key,label:o.name}))),W=_(null),f=_(!1),w=(o,e)=>{const n={isValid:!1};return(Ne[o][e||"undefined"]||[]).forEach(c=>{n[c.key]=ve[c.type]}),n},t=_({positionName:"",valuationSource:"",positionType:y.Liquid,valuationType:S.DEXPair,details:{liquid:[w(y.Liquid,S.DEXPair)],illiquid:[],nft:[],composable:[]},detailsJson:"{}"}),x=()=>{const o={positionName:t.value.positionName,valuationSource:t.value.valuationSource,positionType:t.value.positionType,valuationType:t.value.valuationType,details:{},detailsJson:"{}"};for(const e of ke)o.details[e]=[];o.details[t.value.positionType].push(w(t.value.positionType,t.value.valuationType)),o.detailsJson=H(o.details),t.value=o},Y=o=>{console.log("remove0 method: ",o),t.value.details[t.value.positionType].splice([o])},G=()=>{t.value.details[t.value.positionType].push(w(t.value.positionType,t.value.valuationType))};I(()=>t.value.positionType,o=>{t.value.valuationType=F[o][0],x()}),I(()=>t.value.valuationType,()=>{x()});const h=[be.required],Q=()=>{if(console.log(t.value),!f.value||!E.value)return b.warningToast("Some form fields are not valid.");const o=JSON.parse(JSON.stringify(t.value));o.pastNAVUpdateEntryFundAddress=U.fundAddress,o.details.isPastNAVUpdate=!1,o.details.pastNAVUpdateIndex=0,o.details.pastNAVUpdateEntryIndex=0,o.details.entryType=ge[t.value.positionType],o.details.valuationType=t.value.valuationType,o.details.description=JSON.stringify({positionName:t.value.positionName,valuationSource:t.value.valuationSource});for(const e of o.details[o.positionType]){if(j.value.forEach(n=>{n.key in e||(e[n.key]=n.value)}),"pastNAVUpdateIndex"in e&&(o.details.pastNAVUpdateIndex=e.pastNAVUpdateIndex),"otcTxHashes"in e)try{e.otcTxHashes=e.otcTxHashes.split(",").map(n=>n.trim()).filter(n=>n!=="")||[]}catch{return b.errorToast("Something went wrong parsing the comma-separated list of TX hashes.")}o.positionType===y.Liquid&&o.valuationType===S.DEXPair&&(e.nonAssetTokenAddress=U.baseTokenAddress),delete e.isValid,delete e.valuationType}o.isNew=!0,o.detailsJson=H(o.details),o.detailsHash=ye(fe(o.detailsJson)),console.log("New Method JSON: ",o.detailsJson),b.addToast("New NAV method was created."),R("newNavMethodCreated",o),x()};return(o,e)=>{const n=ee,V=ue("Icon"),c=te,Z=oe,D=ae;return p(),k("div",Ue,[s(Me,{ref_key:"form",ref:W,modelValue:a(f),"onUpdate:modelValue":e[8]||(e[8]=i=>J(f)?f.value=i:null)},{default:l(()=>[s(r,null,{default:l(()=>[s(u,null,{default:l(()=>e[9]||(e[9]=[m("strong",null,"Define Position Method",-1)])),_:1})]),_:1}),s(r,null,{default:l(()=>[s(u,{cols:"12",sm:"6"},{default:l(()=>[s(g,{class:"label_required mb-2"},{default:l(()=>e[10]||(e[10]=[d(" Position Name ")])),_:1}),s(L,{modelValue:a(t).positionName,"onUpdate:modelValue":e[0]||(e[0]=i=>a(t).positionName=i),placeholder:"E.g. WETH",rules:h,required:""},null,8,["modelValue"])]),_:1}),s(u,{cols:"12",sm:"6"},{default:l(()=>[s(g,{class:"label_required mb-2"},{default:l(()=>e[11]||(e[11]=[d(" Valuation Source ")])),_:1}),s(L,{modelValue:a(t).valuationSource,"onUpdate:modelValue":e[1]||(e[1]=i=>a(t).valuationSource=i),placeholder:"E.g. Uniswap ETH/USDC",rules:h,required:""},null,8,["modelValue"])]),_:1})]),_:1}),s(r,null,{default:l(()=>[s(u,{cols:"12",sm:"6"},{default:l(()=>[s(g,{class:"mb-2"},{default:l(()=>e[12]||(e[12]=[d(" Position Type ")])),_:1}),s(n,{modelValue:a(t).positionType,"onUpdate:modelValue":[e[2]||(e[2]=i=>a(t).positionType=i),e[3]||(e[3]=i=>a(t).positionType=i)],items:a(K)},null,8,["modelValue","items"])]),_:1}),a(A).length?(p(),v(u,{key:0,cols:"12",sm:"6"},{default:l(()=>[s(g,{class:"mb-2"},{default:l(()=>e[13]||(e[13]=[d(" Valuation Type ")])),_:1}),s(n,{modelValue:a(t).valuationType,"onUpdate:modelValue":[e[4]||(e[4]=i=>a(t).valuationType=i),e[5]||(e[5]=i=>a(t).valuationType=i)],items:a(z)},null,8,["modelValue","items"])]),_:1})):q("",!0)]),_:1}),s(r,{class:"mt-10"},{default:l(()=>[s(u,null,{default:l(()=>e[14]||(e[14]=[m("strong",null,"Method Details",-1)])),_:1})]),_:1}),s(r,null,{default:l(()=>[a(t).positionType===a(y).Composable?(p(),v(u,{key:0},{default:l(()=>[s(we,{modelValue:a(M),"onUpdate:modelValue":e[6]||(e[6]=i=>J(M)?M.value=i:null)},{default:l(()=>[(p(!0),k(P,null,ne(a(t).details[a(t).positionType],(i,T)=>(p(),v(xe,{key:T,eager:""},{default:l(()=>[s(Pe,{static:""},{default:l(()=>[m("div",Ae,[m("span",null,[m("strong",Ee,de(T+1)+")",1),e[15]||(e[15]=d(" METHOD DETAILS "))]),s(c,{class:pe(["method_details_status",{"method_details_status--valid":i.isValid}])},{default:l(()=>[i.isValid?(p(),k(P,{key:0},[e[16]||(e[16]=d(" Provided ")),s(V,{icon:"octicon:check-circle-16",height:"1.2rem",width:"1.2rem"})],64)):(p(),k(P,{key:1},[e[17]||(e[17]=d(" Incomplete ")),s(V,{icon:"pajamas:error",height:"1.2rem",width:"1.2rem"})],64))]),_:2},1032,["class"]),s(Z,{small:"",onClick:re(C=>Y(T),["stop"])},{default:l(()=>[s(me,{icon:"mdi-delete",color:"error"})]),_:2},1032,["onClick"])])]),_:2},1024),s(Se,null,{default:l(()=>[s(D,{modelValue:a(t).details[a(t).positionType][T],"onUpdate:modelValue":C=>a(t).details[a(t).positionType][T]=C,"position-type":a(t).positionType,"valuation-type":a(t).valuationType},null,8,["modelValue","onUpdate:modelValue","position-type","valuation-type"])]),_:2},1024)]),_:2},1024))),128))]),_:1},8,["modelValue"])]),_:1})):(p(),v(D,{key:1,modelValue:a(t).details[a(t).positionType][0],"onUpdate:modelValue":e[7]||(e[7]=i=>a(t).details[a(t).positionType][0]=i),"position-type":a(t).positionType,"valuation-type":a(t).valuationType},null,8,["modelValue","position-type","valuation-type"]))]),_:1}),a(t).positionType===a(y).Composable?(p(),v(r,{key:0},{default:l(()=>[s(u,{class:"text-center"},{default:l(()=>[s(B,{class:"text-secondary",variant:"outlined",onClick:G},{append:l(()=>[s(V,{icon:"octicon:plus-circle-16",height:"1.2rem",width:"1.2rem"})]),default:l(()=>[e[18]||(e[18]=d(" Add Method Details "))]),_:1})]),_:1})]),_:1})):q("",!0),s(r,{class:"mt-4"},{default:l(()=>[s(u,{class:"text-end"},{default:l(()=>[s(B,{disabled:!a(f)||!a(E),onClick:Q},{default:l(()=>e[19]||(e[19]=[d(" Add Method ")])),_:1},8,["disabled"])]),_:1})]),_:1})]),_:1},8,["modelValue"]),m("div",he,[ie(o.$slots,"buttons",{},void 0,!0)])])}}}),ze=Te(De,[["__scopeId","data-v-a7fbaf0b"]]);export{ze as _};
