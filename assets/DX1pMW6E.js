import{_ as A}from"./CWzajw3t.js";import{P as S,n as F}from"./Dj5gZ7JV.js";import{V as T}from"./SojCOUPn.js";import{d as V,e as c,a as p,c6 as n,w as r,cF as b,c7 as _,o as s,_ as C,f as w,g,c as f,b as l,cE as v,B as y,cC as x,c8 as P}from"./8VZ5Nj8u.js";import{r as N,d as U}from"./cf8ygKud.js";import{u as D}from"./BzyWEJ-O.js";import{a as I}from"./DasfT5QR.js";import{i as L,a as B,A as k}from"./MCsVctob.js";import"./DWupzNrg.js";import"./d83d49xf.js";import"./DD_OkHzZ.js";import"./BHNqivV5.js";import"./DpZW8PmA.js";import"./B3AY9_4W.js";import"./CHTMADqs.js";import"./Cacv_Wr7.js";import"./Upo9clss.js";import"./C47DkxAG.js";import"./DisNLAgY.js";const R={class:"fund_name"},$=["src"],O={class:"title_wrapper"},z={key:0,class:"strategist_url"},E=V({__name:"FundNameCell",props:{image:{type:String,default:""},title:{type:String,default:""},strategistName:{type:String,default:""},strategistUrl:{type:String,default:""}},setup(e){const d=e;return(u,m)=>(s(),c("div",R,[p(T,{size:"3.75rem",rounded:!0,class:"fund_name__avatar"},{default:r(()=>[n("img",{cover:"",src:d.image},null,8,$)]),_:1}),n("div",O,[n("h4",null,_(e.title),1),e.strategistName?(s(),c("div",z,[n("h5",null," by "+_(e.strategistName),1)])):b("",!0)])]))}}),j=C(E,[["__scopeId","data-v-66fea354"]]),W={key:1,class:"nav_entries__no_data"},K=V({__name:"TableFunds",props:{items:{type:Array,default:()=>[]},loading:{type:Boolean,default:!1}},setup(e){const{getFundDetailsUrl:d}=D(),u=w(),m=g(()=>[{title:"OIV Name",key:"name",sortable:!1,maxWidth:300,minWidth:200},{title:"Chain",key:"chainShort",width:62,maxWidth:62,align:"end"},{title:"Latest NAV",key:"lastNAVUpdateTotalNAV",align:"end"},{title:"Inception",key:"inceptionDate",value:a=>a.inceptionDate,align:"end"},{title:"Cumulative",key:"cumulativeReturnPercent",value:a=>N(a.cumulativeReturnPercent,!0),align:"end"},{title:"Position Types",key:"positionTypeCounts",align:"end"}]),h=(a,i)=>{const o=a.target;if(o.tagName.toLowerCase()==="a"||o.closest("a"))return;const t=d(i.item.chainId,i.item.fundToken.symbol,i.item.address);a.button===1||a.metaKey||a.ctrlKey?window.open(t,"_blank"):u.push(t)};return(a,i)=>{const o=A;return e.items.length||e.loading?(s(),f(I,{key:0,class:"table_all_funds",headers:l(m),hover:"",items:e.items,loading:e.loading&&e.items.length===0,"loading-text":"Loading OIVs","items-per-page":"-1","onMousedown:row":h},{"item.name":r(({item:t})=>[p(j,{image:t.photoUrl,title:t.title,"strategist-name":t.strategistName,"strategist-url":t.strategistUrl},null,8,["image","title","strategist-name","strategist-url"])]),"item.chainShort":r(({item:t})=>[p(o,{"chain-short":t.chainShort,class:"mr-2"},null,8,["chain-short"])]),"item.lastNAVUpdateTotalNAV":r(({item:t})=>[n("div",{class:y({"justify-center":t.isNavUpdatesLoading})},[t.isNavUpdatesLoading?(s(),f(v,{key:0,size:"18",width:"2",indeterminate:""})):(s(),c(x,{key:1},[P(_(l(U)(t.lastNAVUpdateTotalNAV,t.baseToken.decimals)+" "+t.baseToken.symbol),1)],64))],2)]),"item.cumulativeReturnPercent":r(({item:t})=>[n("div",{class:y({"justify-center":t.isNavUpdatesLoading})},[t.isNavUpdatesLoading?(s(),f(v,{key:0,size:"18",width:"2",indeterminate:""})):(s(),c("div",{key:1,class:y(l(F)(t.cumulativeReturnPercent))},_(l(N)(t.cumulativeReturnPercent,!0)??"N/A"),3))],2)]),"item.positionTypeCounts":r(({item:t})=>[p(S,{"position-type-counts":t.positionTypeCounts??[],class:"position_types_bar"},null,8,["position-type-counts"])]),bottom:r(()=>i[0]||(i[0]=[])),_:2},1032,["headers","items","loading"])):e.items.length===0&&!e.loading?(s(),c("div",W," No OIVs available. ")):b("",!0)}}}),M=C(K,[["__scopeId","data-v-4451080c"]]),q={class:"discover"},G={key:0,class:"w-100 d-flex justify-center flex-column"},pt={__name:"index",setup(e){const d=g(()=>u.funds),u=L(),m=B(),h=g(()=>m.isActionState("fetchFundsAction",k.Loading)),a=g(()=>m.isActionState("fetchFundsAction",k.Error));return console.log("on created"),u.fetchFunds(),(i,o)=>{const t=M;return s(),c("div",q,[l(a)?(s(),c("div",G,o[0]||(o[0]=[n("h3",null,"Oops, something went wrong while getting OIVs data",-1),n("span",null," Maybe the current RPC is down? ",-1)]))):(s(),f(t,{key:1,loading:l(h),items:l(d)},null,8,["loading","items"]))])}}};export{pt as default};
