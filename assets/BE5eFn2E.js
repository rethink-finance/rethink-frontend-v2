import H from"./Bm456F8C.js";import O from"./ByUnv_xz.js";import{_ as G}from"./7SFAbU4K.js";import{d as Y,L as j,u as J,cZ as K,c9 as Q,r as T,d2 as C,g as ee,cf as ae,e as E,a,c6 as m,w as o,i as R,b as t,B as x,M as oe,o as y,cC as te,c8 as i,c as se,cF as le,c7 as D,O as U,d3 as ne,_ as re}from"./8VZ5Nj8u.js";import{u as ie,E as de}from"./MCsVctob.js";import{f as S}from"./BHNqivV5.js";import{b as P,d as I}from"./cf8ygKud.js";import{V as W}from"./C-53RV9c.js";import{V as B}from"./CquYmSaK.js";import{V as p}from"./DCIY6Kkr.js";import{b as _}from"./Cacv_Wr7.js";import{b as g}from"./B3AY9_4W.js";import{V as Z}from"./DWupzNrg.js";import"./DisNLAgY.js";import"./DD_OkHzZ.js";import"./CHTMADqs.js";import"./d83d49xf.js";const ue={class:"execution-app"},ce={class:"data_bar__item"},me={class:"switch_to_zodiac_notification"},fe={key:1},pe={class:"main_header__title"},be={class:"tooltip__link",href:"https://docs.rethink.finance/rethink.finance",target:"_blank"},ve={class:"inputs"},_e={class:"main_header__title"},Ve={class:"tooltip__link",href:"https://docs.rethink.finance/rethink.finance",target:"_blank"},Te={class:"inputs"},ge=Y({__name:"index",setup(he){const h=ie(),$=j(),f=J(),N=K(),{isUsingZodiacPilotExtension:b}=Q(h),k=T(!1),A=T(!1),c=C({contractAddress:"",txData:"",amountValue:""}),F=T(!1),w=T(!1),d=C({to:"",inputTokenAddress:"",depositValue:""}),u={required:S.required,isValidAddress:S.isValidAddress,isNonNegativeNumber:S.isNonNegativeNumber,enoughBalance:l=>{if(!n.value.name)return"Please enter valid token address first.";let e;try{e=P(l,n.value.decimals)}catch{return`Make sure the value has max ${n.value.decimals} decimals.`}if(e<=0)return"Value must be positive.";if(console.log("decimals: ",n.value.decimals),console.log("valueWei: ",e),console.log("userBaseTokenBalance: ",n.value.balance),console.log("valueWei > userBaseTokenBalance: ",e>n.value.balance),n.value.balance<e){const r=I(n.value.balance,n.value.decimals,!1);return`Your ${n.value.symbol} balance is too low: ${r}.`}return!0}},L=async()=>{F.value=!0;const l=n.value.decimals,e=P(d.depositValue,l);await q.value.send("transfer",{},d.to,e).on("transactionHash",r=>{console.log("tx hash: "+r),f.addToast("The transaction has been submitted. Please wait for it to be confirmed.")}).on("receipt",r=>{console.log(r),r.status?f.successToast("The transfer was successfull."):f.errorToast("The transaction has failed. Please contact the Rethink Finance support."),F.value=!1}).on("error",r=>{console.log("error: ",r),F.value=!1,f.errorToast("There has been an error. Please contact the Rethink Finance support.")})},M=async()=>{var l;try{if(k.value=!0,console.log("to:",c.contractAddress),console.log("data:",c.txData),console.log("from:",h.activeAccountAddress),console.log("value:",parseInt(c.amountValue)),!N.connectedWalletWeb3){console.log("Send trx raw no connected wallet"),f.errorToast("Connect your wallet.");return}await N.connectedWalletWeb3.eth.sendTransaction({to:c.contractAddress,data:c.txData,from:h.activeAccountAddress,maxFeePerGas:"",value:parseInt(c.amountValue)},ne,{checkRevertBeforeSending:!1}).on("transactionHash",e=>{console.log("tx hash: "+e),f.addToast("The transaction has been submitted. Please wait for it to be confirmed.")}).on("receipt",e=>{console.log("receipt: ",e),e.status?f.successToast("The transaction was successfull."):f.errorToast("The transaction has failed. Please contact the Rethink Finance support."),k.value=!1}).on("error",e=>{k.value=!1,console.log(e),f.errorToast("There has been an error. Please contact the Rethink Finance support.")})}catch(e){console.error(e),k.value=!1,(l=e==null?void 0:e.data)!=null&&l.message?f.errorToast(e.data.message,15e3):f.errorToast("There has been an error. Please contact the Rethink Finance support.")}},q=T(),n=T({name:"",symbol:"",decimals:0,balance:0n,formattedBalance:""}),X=async()=>{if(d.inputTokenAddress)try{const l=$.getCustomContract(h.selectedFundChain,de,d.inputTokenAddress);q.value=l;const e=await l.methods.name().call(),r=await l.methods.symbol().call(),v=await l.methods.decimals().call(),V=await l.methods.balanceOf(h.activeAccountAddress??"").call(),s=I(V,Number(v),!1);console.log("name: ",e),console.log("symbol: ",r),console.log("decimals: ",v),console.log("balance: ",V),console.log("formattedBalance: ",s),n.value={name:e,symbol:r,decimals:Number(v),balance:V,formattedBalance:s}}catch(l){console.error(l)}},z=ee(()=>{const l=u.required(d.inputTokenAddress)===!0,e=u.isValidAddress(d.inputTokenAddress)===!0;return l&&e});return ae(()=>d.inputTokenAddress,async l=>{z.value?await X():n.value={name:"",symbol:"",decimals:0,balance:0n,formattedBalance:""}}),(l,e)=>{const r=oe("Icon"),v=H,V=O;return y(),E("div",ue,[a(v,null,{default:o(()=>[m("div",ce,[m("div",me,[e[9]||(e[9]=m("img",{src:G,class:"img_zodiac_pilot"},null,-1)),t(b)?(y(),E(te,{key:0},[e[8]||(e[8]=m("div",null,"Connected to the Zodiac Pilot",-1)),a(r,{icon:"octicon:check-circle-fill-16",width:"1rem",height:"1rem",color:"var(--color-success)"})],64)):(y(),E("div",fe," Switch to the Zodiac Pilot extension to activate the execution app "))])])]),_:1}),m("div",{class:x(`main_card ${t(b)?"":"disabled"}`)},[a(v,null,{default:o(()=>[m("div",pe,[e[12]||(e[12]=i(" Transfer ")),a(V,{location:"right","hide-after":6e3},{tooltip:o(()=>[e[11]||(e[11]=i(" Transfer any token from Safe Contract to approved destination ")),m("a",be,[e[10]||(e[10]=i(" Learn More ")),a(r,{icon:"maki:arrow",color:"primary",width:"1rem"})])]),default:o(()=>[a(r,{icon:"material-symbols:info-outline",class:x("main_header__info-icon"),width:"1.5rem"})]),_:1})])]),_:1}),m("div",ve,[a(W,{ref:"form",modelValue:t(w),"onUpdate:modelValue":e[3]||(e[3]=s=>R(w)?w.value=s:null)},{default:o(()=>[a(B,null,{default:o(()=>[a(p,{cols:"12",sm:"4"},{default:o(()=>[a(_,{class:"label_required mb-2"},{default:o(()=>e[13]||(e[13]=[i(" To ")])),_:1}),a(g,{modelValue:t(d).to,"onUpdate:modelValue":e[0]||(e[0]=s=>t(d).to=s),placeholder:"E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",rules:[u.required,u.isValidAddress],required:""},null,8,["modelValue","rules"])]),_:1}),a(p,{cols:"12",sm:"4"},{default:o(()=>[a(_,{class:"label_required mb-2"},{default:o(()=>e[14]||(e[14]=[i(" Input Token Address ")])),_:1}),a(g,{modelValue:t(d).inputTokenAddress,"onUpdate:modelValue":e[1]||(e[1]=s=>t(d).inputTokenAddress=s),placeholder:"E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",rules:[u.required,u.isValidAddress],required:""},null,8,["modelValue","rules"])]),_:1}),a(p,{cols:"12",sm:"4"},{default:o(()=>[a(_,{class:"label_required mb-2"},{default:o(()=>e[15]||(e[15]=[i(" Amount ")])),_:1}),a(g,{modelValue:t(d).depositValue,"onUpdate:modelValue":e[2]||(e[2]=s=>t(d).depositValue=s),placeholder:"E.g. 10",rules:[u.required,u.enoughBalance],required:""},null,8,["modelValue","rules"]),t(n).formattedBalance&&t(n).symbol?(y(),se(_,{key:0,class:"available_balance"},{default:o(()=>[i(" Available Balance: "+D(t(n).formattedBalance)+" "+D(t(n).symbol),1)]),_:1})):le("",!0)]),_:1})]),_:1}),a(B,null,{default:o(()=>[a(p,{class:"btn-submit"},{default:o(()=>[a(Z,{activator:"parent",location:"bottom",disabled:t(b)},{activator:o(({props:s})=>[a(U,{disabled:!t(w)||!t(b),color:"primary",variant:"outlined",onClick:L},{default:o(()=>e[16]||(e[16]=[i(" Transfer ")])),_:1},8,["disabled"])]),default:o(()=>e[17]||(e[17]=[i(" Switch to the Zodiac Pilot Extension to Update NAV and Settle Flows. ")])),_:1},8,["disabled"])]),_:1})]),_:1})]),_:1},8,["modelValue"])])],2),m("div",{class:x(`main_card ${t(b)?"":"disabled"}`)},[a(v,null,{default:o(()=>[m("div",_e,[e[20]||(e[20]=i(" Submit Raw Transaction ")),a(V,{location:"right","hide-after":6e3},{tooltip:o(()=>[e[19]||(e[19]=i(" Submit any approved Raw TXN on behalf of Safe Contract ")),m("a",Ve,[e[18]||(e[18]=i(" Learn More ")),a(r,{icon:"maki:arrow",color:"primary",width:"1rem"})])]),default:o(()=>[a(r,{icon:"material-symbols:info-outline",class:x("main_header__info-icon"),width:"1.5rem"})]),_:1})])]),_:1}),m("div",Te,[a(W,{ref:"form",modelValue:t(A),"onUpdate:modelValue":e[7]||(e[7]=s=>R(A)?A.value=s:null)},{default:o(()=>[a(B,null,{default:o(()=>[a(p,{cols:"12",sm:"4"},{default:o(()=>[a(_,{class:"label_required mb-2"},{default:o(()=>e[21]||(e[21]=[i(" To ")])),_:1}),a(g,{modelValue:t(c).contractAddress,"onUpdate:modelValue":e[4]||(e[4]=s=>t(c).contractAddress=s),placeholder:"E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",rules:[u.required,u.isValidAddress],required:""},null,8,["modelValue","rules"])]),_:1}),a(p,{cols:"12",sm:"4"},{default:o(()=>[a(_,{class:"label_required mb-2"},{default:o(()=>e[22]||(e[22]=[i(" Submit (Calldata) ")])),_:1}),a(g,{modelValue:t(c).txData,"onUpdate:modelValue":e[5]||(e[5]=s=>t(c).txData=s),placeholder:"E.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",rules:[u.required],required:""},null,8,["modelValue","rules"])]),_:1}),a(p,{cols:"12",sm:"4"},{default:o(()=>[a(_,{class:"label_required mb-2"},{default:o(()=>e[23]||(e[23]=[i(" Amount ")])),_:1}),a(g,{modelValue:t(c).amountValue,"onUpdate:modelValue":e[6]||(e[6]=s=>t(c).amountValue=s),placeholder:"E.g. 10",rules:[u.required,u.isNonNegativeNumber],required:""},null,8,["modelValue","rules"])]),_:1})]),_:1}),a(B,null,{default:o(()=>[a(p,{class:"btn-submit"},{default:o(()=>[a(Z,{activator:"parent",location:"bottom",disabled:t(b)},{activator:o(({props:s})=>[a(U,{disabled:!t(A)||!t(b),color:"primary",variant:"outlined",loading:t(k),onClick:M},{default:o(()=>e[24]||(e[24]=[i(" Submit ")])),_:1},8,["disabled","loading"])]),default:o(()=>e[25]||(e[25]=[i(" Switch to the Zodiac Pilot Extension to Update NAV and Settle Flows. ")])),_:1},8,["disabled"])]),_:1})]),_:1})]),_:1},8,["modelValue"])])],2)])}}}),We=re(ge,[["__scopeId","data-v-5002a555"]]);export{We as default};
