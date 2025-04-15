import{V as ie}from"./DWupzNrg.js";import{d as D,c as k,w as y,e as _,cF as w,c6 as c,c7 as B,o as n,r as x,g as N,a as h,M as se,N as de,c8 as b,b as o,i as P,O as q,_ as J,c9 as oe,cR as le,cC as V,cY as j,B as Z,d8 as F,db as re,u as ce,cf as L,cE as ne,d5 as Q,j as ue,cl as me,eI as _e}from"./8VZ5Nj8u.js";import{_ as pe}from"./3_nFkgGH.js";import fe from"./DQYWqaXh.js";import{f as X}from"./BHNqivV5.js";import{V as ve}from"./DkUoFf1W.js";import{b as ge}from"./Cacv_Wr7.js";import{b as be}from"./B3AY9_4W.js";import{t as ee}from"./BjIfPQ7A.js";import{u as ae,o as U,h as M,C as Y,g as he,F as ye,a as Ce,z as Ae,B as Ie}from"./MCsVctob.js";import{a as z}from"./CJ_4TdCq.js";import ke from"./Dwxw_2pV.js";import{_ as xe}from"./lIeBTEe1.js";import{V as Te}from"./DCIY6Kkr.js";import{V as Se}from"./BFjMtrG4.js";import{g as Ve}from"./CmnXHd9E.js";const $e={key:0},Be=D({__name:"AddressLabelTooltip",props:{label:{type:String,default:""},address:{type:String,default:""}},setup(a){return(v,m)=>(n(),k(ie,{activator:"parent",location:"right"},{default:y(()=>[a.label?(n(),_("strong",$e,B(a.label),1)):w("",!0),c("div",null,B(a.address),1)]),_:1}))}}),Ee={class:"main_card di-card"},Oe={class:"di-card__header-container"},Re={class:"di-card__header"},we={class:"di-card__content"},Me={class:"di-card"},Ne={class:"di-card__someone-else-container"},Le=D({__name:"AddAddressModal",props:{modelValue:{type:Boolean,default:!1},type:{type:String,default:"Target"}},emits:["update:modelValue","addressAdded"],setup(a,{emit:v}){const m=v,s=x(""),d=[X.required,X.isValidAddress],r=N(()=>d.every(p=>p(s.value)===!0)),u=()=>{s.value="",m("update:modelValue",!1)},l=()=>{m("addressAdded",s.value),u()};return(p,T)=>{const I=se("Icon");return n(),k(ve,{"model-value":a.modelValue,scrim:"black",opacity:"0.3","max-width":"600","onUpdate:modelValue":u},{default:y(()=>[c("div",Ee,[c("div",Oe,[c("div",Re," Add a "+B(a.type),1),h(I,{icon:"material-symbols:close",class:"di-card__close-icon",width:"1.5rem",onClick:u})]),c("div",we,[c("div",Me,[de(p.$slots,"description",{},void 0,!0)]),c("div",Ne,[h(ge,{class:"di-card__label label_required"},{default:y(()=>[b(B(a.type)+" Address ",1)]),_:1}),h(be,{modelValue:o(s),"onUpdate:modelValue":T[0]||(T[0]=f=>P(s)?s.value=f:null),placeholder:"0x...",rules:d,required:""},null,8,["modelValue"]),h(q,{disabled:!o(r),class:"di-card__submit_button",variant:"flat",color:"rgba(210, 223, 255, 1)",onClick:l},{default:y(()=>[b(" Add "+B(a.type),1)]),_:1},8,["disabled"])])])])]),_:3},8,["model-value"])}}}),De=J(Le,[["__scopeId","data-v-91d50552"]]),Fe={class:"permissions_menu"},Ue={class:"permissions_menu__section"},qe={class:"permissions__list"},Pe={class:"mx-auto my-2"},je={class:"permissions_menu__section"},Je={class:"permissions__list"},ze=["onClick"],We={class:"permissions_menu__list_item_label"},He={class:"mx-auto my-2"},Ge=D({__name:"MenuLeft",props:{role:{type:Object,default:()=>{}},chainId:{type:String,required:!0},disabled:{type:Boolean,default:!1}},emits:["targetRemoved"],setup(a,{emit:v}){const m=a,s=ae(),d=x({}),r=x(!1),u=x(!1),l=z(),{getTargetStatus:p,getMemberStatus:T,activeTargetId:I}=oe(l),f=N(()=>[...l.targets.list,...l.targets.add]),S=N(()=>[...l.members.list,...l.members.add]),O=g=>{I.value=g},R=g=>[{"permissions_menu__list_item--deleted":p.value(g)===U.REMOVE},{"permissions_menu__list_item--selected":g.id===I.value}],W=g=>[{"permissions_menu__list_item--deleted":T.value(g)===U.REMOVE}],H=g=>{console.warn("NEW);",g),l.handleAddTarget({id:`${g}_${Date.now()}`,address:g,type:Y.WILDCARDED,executionOption:M.NONE,conditions:{}})};return le(async()=>{for(const g of f.value){const e=await s.getAddressLabel(g.address,m.chainId);e&&(d.value[g.address]=e)}}),(g,e)=>{const t=Be,C=pe,$=fe,E=De;return n(),_("div",Fe,[c("div",Ue,[e[6]||(e[6]=c("strong",null,"Members",-1)),c("div",qe,[(n(!0),_(V,null,j(o(S),i=>(n(),_("div",{key:i,class:Z(["permissions_menu__list_item",W(i)])},[h(t,{label:o(d)[i],address:i},null,8,["label","address"]),b(" "+B(o(d)[i]||o(ee)(i))+" ",1),a.disabled?w("",!0):(n(),_(V,{key:0},[o(T)(i)===o(U).REMOVE?(n(),k(C,{key:0,xs:"","is-undo":"",onClick:F(A=>o(l).handleRemoveMember(i,!1),["stop"])},null,8,["onClick"])):(n(),k(C,{key:1,xs:"",onClick:F(A=>o(l).handleRemoveMember(i),["stop"])},null,8,["onClick"]))],64))],2))),128))]),c("div",Pe,[a.disabled?w("",!0):(n(),k($,{key:0,class:"ms-3 mt-2",onClick:e[0]||(e[0]=i=>r.value=!0)},{default:y(()=>e[4]||(e[4]=[b(" Add Member ")])),_:1})),h(E,{modelValue:o(r),"onUpdate:modelValue":e[1]||(e[1]=i=>P(r)?r.value=i:null),type:"Member",onAddressAdded:o(l).handleAddMember},{description:y(()=>e[5]||(e[5]=[b(" Members are accounts that that the role is assigned to. ")])),_:1},8,["modelValue","onAddressAdded"])])]),c("div",je,[e[9]||(e[9]=c("strong",null,"Targets",-1)),c("div",Je,[(n(!0),_(V,null,j(o(f),i=>(n(),_("div",{key:i.id,class:Z(["permissions_menu__list_item",R(i)]),onClick:A=>O(i.id)},[c("div",We,[h(t,{label:o(d)[i.address],address:i.address},null,8,["label","address"]),b(" "+B(o(d)[i.address]||o(ee)(i.address)),1)]),a.disabled?w("",!0):(n(),_(V,{key:0},[o(p)(i)===o(U).REMOVE?(n(),k(C,{key:0,xs:"","is-undo":"",onClick:F(A=>o(l).handleRemoveTarget(i,!1),["stop"])},null,8,["onClick"])):(n(),k(C,{key:1,xs:"",onClick:F(A=>o(l).handleRemoveTarget(i),["stop"])},null,8,["onClick"]))],64))],10,ze))),128))]),c("div",He,[a.disabled?w("",!0):(n(),k($,{key:0,class:"ms-3 mt-2",onClick:e[2]||(e[2]=i=>u.value=!0)},{default:y(()=>e[7]||(e[7]=[b(" Add Target ")])),_:1})),h(E,{modelValue:o(u),"onUpdate:modelValue":e[3]||(e[3]=i=>P(u)?u.value=i:null),type:"Target",onAddressAdded:H},{description:y(()=>e[8]||(e[8]=[b(" Targets are the accounts that the members can interact with on behalf of the avatar. ")])),_:1},8,["modelValue"])])])])}}}),Ke=J(Ge,[["__scopeId","data-v-87e9e241"]]),Qe={class:"target"},Ye={class:"d-flex align-center"},Ze={class:"json_field ms-2"},Xe={class:"target__abi_fetch_text"},et={class:"target__abi_fetch_card_body"},tt={class:"d-flex"},st={key:2,class:"json_field"},ot={key:0,class:"permissions__list"},nt=D({__name:"Target",props:{conditions:{type:Object,default:()=>{}},chainId:{type:String,required:!0},disabled:{type:Boolean,default:!1}},setup(a){const v=a,m=z();re("chainId",v.chainId);const s=N(()=>m.activeTarget),d=ce(),r=ae(),u=x([]),l=x(""),p=x(!1),T=e=>{var t;return((t=s==null?void 0:s.value)==null?void 0:t.conditions[e])||{sighash:e,type:Y.BLOCKED,executionOption:M.NONE,params:[]}},I=()=>{var e,t;try{u.value=JSON.parse(l.value),console.log("Custom ABI targetABIJson",u.value),p.value=!1,(e=s.value)!=null&&e.address&&(m.customAbiMap[s.value.address]=u.value)}catch(C){console.error("Error parsing custom ABI",C),d.errorToast("Error parsing custom ABI: "+C.message),(t=s.value)!=null&&t.address&&delete m.customAbiMap[s.value.address]}},f=()=>{l.value=JSON.stringify(S.value,null,4),p.value=!p.value},S=x([]),O=x([]),R=x(!1),W=async()=>{var e;if(u.value=[],!!((e=s.value)!=null&&e.address)){R.value=!0;try{const t=await r.fetchAddressSourceCode(v.chainId,s.value.address);u.value=(t==null?void 0:t.ABI)||[],R.value=!1}catch(t){H(t)}}},H=e=>{const t="Something went wrong fetching target ABI.";R.value=!1,console.error(t,e),d.errorToast(t+e.message)};L(()=>u.value,()=>{var t;const e=he(u.value);S.value=e,O.value=Object.keys(((t=s.value)==null?void 0:t.conditions)||{}).filter(C=>!(e!=null&&e.some($=>$.selector===C)))},{immediate:!0,deep:!0}),L(()=>m.activeTargetId,()=>{W(),p.value=!1},{immediate:!0});const g=(e,t)=>{var C,$,E;console.log("[FATHER] Conditions changed for sighash",e,"New:",t),(C=s.value)!=null&&C.id&&(($=s.value)!=null&&$.address)&&(console.log("[FATHER] Conditions changed for",s.value,"New:",{sighash:e,conditions:Q(t)}),m.handleTargetConditions(s.value.id,{...(E=s.value)==null?void 0:E.conditions,[e]:t}))};return(e,t)=>{var i;const C=se("Icon"),$=ke,E=xe;return n(),_("div",Qe,[c("div",Ye,[t[1]||(t[1]=c("strong",null,"Target Address:",-1)),c("div",Ze,B((i=o(s))==null?void 0:i.address),1)]),h($,{"no-body-padding":"","bg-transparent":"",class:"target__abi_fetch_card"},{title:y(()=>[c("div",Xe,[o(R)?(n(),_(V,{key:0},[h(ne,{indeterminate:"",color:"gray",size:"18",width:"2"}),t[2]||(t[2]=b(" Fetching contract ABI "))],64)):o(S).length?(n(),_(V,{key:1},[h(C,{icon:"weui:done-filled",width:"1rem",height:"1rem",color:"var(--color-success)",class:"mt-1"}),t[3]||(t[3]=b(" Contract ABI detected "))],64)):(n(),_(V,{key:2},[b(" Unable to fetch ABI for this address. Upload contract ABI. ")],64))])]),actionText:y(()=>t[4]||(t[4]=[b(" Show ABI ")])),body:y(()=>[c("div",et,[o(p)?w("",!0):(n(),k(q,{key:0,color:"primary",class:"target__abi_edit_button",onClick:f},{default:y(()=>t[5]||(t[5]=[b(" Edit ABI ")])),_:1})),o(p)?(n(),k(Te,{key:1},{default:y(()=>[h(Se,{modelValue:o(l),"onUpdate:modelValue":t[0]||(t[0]=A=>P(l)?l.value=A:null),label:"Custom ABI",placeholder:"Enter the contract ABI here",rows:"25"},null,8,["modelValue"]),c("div",tt,[h(q,{color:"primary",class:"mr-2",onClick:I},{default:y(()=>t[6]||(t[6]=[b(" Submit custom ABI ")])),_:1}),h(q,{variant:"text",onClick:f},{default:y(()=>t[7]||(t[7]=[b(" Cancel ")])),_:1})])]),_:1})):(n(),_("pre",st,B(JSON.stringify(o(S),null,4)),1))])]),_:1}),o(R)?w("",!0):(n(),_("div",ot,[(n(!0),_(V,null,j(o(S),(A,G)=>(n(),k(E,{key:G,func:A,disabled:a.disabled,"func-conditions":T(A.selector),"onUpdate:funcConditions":K=>g(A.selector,K)},null,8,["func","disabled","func-conditions","onUpdate:funcConditions"]))),128)),(n(!0),_(V,null,j(o(O),(A,G)=>(n(),k(E,{key:G,sighash:A,disabled:a.disabled,"func-conditions":T(A),"onUpdate:funcConditions":K=>g(A,K)},null,8,["sighash","disabled","func-conditions","onUpdate:funcConditions"]))),128))]))])}}}),at=J(nt,[["__scopeId","data-v-d68d1d03"]]),it={class:"permissions"},dt={key:0},lt={class:"permissions__menu_left"},rt={key:1},ct=D({__name:"index",props:{chainId:{type:String,required:!0},isLoading:{type:Boolean,default:!1},disabled:{type:Boolean,default:!1}},setup(a){const v=z(),{activeTargetId:m}=oe(v);return(s,d)=>{const r=Ke,u=at;return n(),_("div",it,[a.isLoading?(n(),_("div",dt,[d[0]||(d[0]=b(" Loading permissions... ")),h(ne,{class:"d-flex",size:"32",width:"3",indeterminate:""})])):(n(),_(V,{key:1},[c("div",lt,[h(r,{"selected-target":o(m),role:o(v).role,disabled:a.disabled,"chain-id":a.chainId},null,8,["selected-target","role","disabled","chain-id"])]),o(m)?(n(),k(u,{key:0,class:"permissions__content",disabled:a.disabled,"chain-id":a.chainId},null,8,["disabled","chain-id"])):(n(),_("div",rt," Select a target. "))],64))])}}}),$t=J(ct,[["__scopeId","data-v-76c513dc"]]),ut=Ve`
    query ($id: ID!) {
        rolesModifier(id: $id) {
            id
            address
            avatar
            roles {
                id
                name
                targets {
                    id
                    address
                    executionOptions
                    clearance
                    functions {
                        sighash
                        executionOptions
                        wildcarded
                        parameters {
                            index
                            type
                            comparison
                            comparisonValue
                        }
                    }
                }
                members {
                    id
                    member {
                        id
                        address
                    }
                }
            }
        }
    }
`,mt=async(a,v)=>{if(v==null||!ue(v))return[];const m=me().$getApolloClient(a,_e.Zodiac);try{const s=await m.query({query:ut,variables:{id:v.toLowerCase()},fetchPolicy:"network-only"});return!s.data||!s.data.rolesModifier?[]:s.data.rolesModifier.roles.map(d=>({...d,members:d.members.map(r=>r.member),targets:d.targets.map(r=>{const u=Object.fromEntries(r.functions.map(l=>{const p=l.parameters.map(I=>({index:I.index,condition:I.comparison,value:I.comparisonValue,type:I.type})),T={sighash:l.sighash,type:l.wildcarded?Y.WILDCARDED:ye(p),executionOption:te(l.executionOptions),params:p};return[l.sighash,T]}));return{id:r.id,address:r.address,type:r.clearance,executionOption:te(r.executionOptions),conditions:u}})}))}catch(s){throw console.log("error fetchRoles from zodiac subgraph",s),s}};function te(a){switch(a){case"Both":return M.BOTH;case"Send":return M.SEND;case"DelegateCall":return M.DELEGATE_CALL}return M.NONE}function Bt(a,v){const m=z(),s=Ce(),d=x([]),r=x(void 0),u=x(!0),l=N(()=>d.value.find(f=>f.name==="1")),p=N(()=>s.isActionStateLoading("fetchRolesAction"));function T(f,S){return Ie("fetchRolesAction",()=>mt(f,S))}const I=async f=>{d.value=[],f&&(d.value=await T(a,f),console.log("Fetched Roles",Q(d.value)))};return L(()=>d.value.length,()=>{r.value=l.value||d.value[0]}),L(()=>r.value,()=>{var f,S,O;m.initRoleState(m.getRoleId((f=r.value)==null?void 0:f.name,d.value),Q(r.value)),m.activeTargetId=(O=(S=r.value)==null?void 0:S.targets)==null?void 0:O[0].id}),L(()=>v,()=>{v&&(m.customAbiMap[v.toLowerCase()]=JSON.parse(JSON.stringify(Ae.abi)))},{immediate:!0}),{roles:d,selectedRole:r,isEditDisabled:u,isFetchingPermissions:p,fetchPermissions:I}}export{$t as _,Bt as u};
