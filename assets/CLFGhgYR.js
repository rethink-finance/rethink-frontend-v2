import{d as _,g as w,e as n,c8 as s,b as f,cC as c,a as l,M as v,o as a,_ as V}from"./8VZ5Nj8u.js";const g=_({__name:"ShowMoreButton",props:{modelValue:Boolean},emits:["update:modelValue"],setup(d,{emit:u}){const o=d,p=u,t=w({get:()=>(o==null?void 0:o.modelValue)??"0",set:r=>{p("update:modelValue",r)}}),i=()=>{t.value=!t.value};return(r,e)=>{const m=v("Icon");return a(),n("span",{class:"show_more",onClick:i},[e[2]||(e[2]=s(" Show ")),f(t)?(a(),n(c,{key:0},[e[0]||(e[0]=s(" Less ")),l(m,{icon:"ion:chevron-up",width:"1rem"})],64)):(a(),n(c,{key:1},[e[1]||(e[1]=s(" More ")),l(m,{icon:"ion:chevron-down",width:"1rem"})],64))])}}}),x=V(g,[["__scopeId","data-v-7a539882"]]);export{x as default};
