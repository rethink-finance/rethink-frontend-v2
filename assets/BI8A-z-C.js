import d from"./BNQn13vn.js";import{e as c,v as n,x as u,n as r,h as _,q as t,y as m}from"./CKPNdySy.js";const b=c({__name:"PositionTypeBadge",props:{value:{type:String,default:void 0},disabled:{type:Boolean,default:!1}},setup(o){const e=o,i=n(()=>e.value?u(e.value):void 0),l=n(()=>{const s=`position_type_${e.value||"unknown"}`;return e.disabled?`${s} position_type--disabled`:s});return(s,v)=>{var a;const p=d;return r(),_(p,{value:((a=t(i))==null?void 0:a.name)||"N/A",class:m(t(l)),disabled:o.disabled},null,8,["value","class","disabled"])}}});export{b as _};