import{h as u}from"./Bz337Xdv.js";import{e as d,r as p,v as m,b as c,n as f,h,q as v,s as b,_ as g}from"./CKPNdySy.js";import"./C7I-dr7Q.js";import"./MMLB91jm.js";const V=d({__name:"Number",props:{modelValue:{type:[Number,String],default:""},placeholder:{type:String,default:"0"},hideDetails:{type:Boolean,default:!1}},emits:["update:modelValue","input"],setup(l,{emit:i}){const n=l,r=i,a=p(n.modelValue.toString()),o=m({get:()=>a.value,set:e=>{if(e&&(e=e.replace("-","")),e==="")a.value="";else{const t=parseFloat(e);isNaN(t)||(a.value=e.toString())}r("update:modelValue",a.value)}});return c(()=>n.modelValue,e=>{a.value=e.toString()}),(e,t)=>(f(),h(u,{modelValue:v(o),"onUpdate:modelValue":t[0]||(t[0]=s=>b(o)?o.value=s:null),class:"input_number",type:"number",min:"0","hide-spin-buttons":"",placeholder:l.placeholder,"hide-details":l.hideDetails,onInput:t[1]||(t[1]=s=>e.$emit("input",s))},null,8,["modelValue","placeholder","hide-details"]))}}),N=g(V,[["__scopeId","data-v-468b00a7"]]);export{N as default};