import{_ as v,r as d,cM as f,n as a,t as s,p as l,j as i,c9 as c,ca as _,cH as g,cm as w,d3 as b,y as h,cG as k,T as y}from"./CKPNdySy.js";const C={name:"Dropdown",props:{label:{type:String,default:""},options:{type:Array,required:!0}},setup(p,{emit:r}){const e=d(!1),n=d(null);return{isOpen:e,selectedOption:n,toggleDropdown:()=>{e.value=!e.value},selectOption:o=>{n.value=o,e.value=!1,r("update:selected",o)}}}},O={class:"dropdown"},x={class:"create_proposal_btn"},D={key:0,class:"dropdown-menu"},B=["onClick"];function V(p,r,e,n,u,m){const o=f("Icon");return a(),s("div",O,[l(g,{class:"text-secondary",variant:"outlined",onClick:n.toggleDropdown},{default:i(()=>[c("div",x,[c("div",null,_(e.label),1),l(o,{icon:n.isOpen?"octicon:triangle-up-16":"octicon:triangle-down-16",width:"1rem"},null,8,["icon"])])]),_:1},8,["onClick"]),l(y,{name:"fade-slide"},{default:i(()=>[n.isOpen?(a(),s("div",D,[(a(!0),s(w,null,b(e.options,t=>(a(),s("div",{key:t.label,class:h("dropdown-item"+(t.disabled?" disabled":"")),onClick:I=>t.disabled?null:n.selectOption(t.label)},[c("div",null,_(t.label),1),l(o,{class:"arrow-icon",icon:"mdi:arrow-right"})],10,B))),128))])):k("",!0)]),_:1})])}const S=v(C,[["render",V],["__scopeId","data-v-0197aa40"]]);export{S as default};