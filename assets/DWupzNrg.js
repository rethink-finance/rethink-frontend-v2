import{m as h,p as S,cc as O,cd as p,cy as x,g as e,r as T,q as u,C,D as k,cz as w,ch as A,cj as d,a as I}from"./8VZ5Nj8u.js";const R=S({id:String,text:String,...w(A({closeOnBack:!1,location:"end",locationStrategy:"connected",eager:!0,minWidth:0,offset:10,openOnClick:!1,openOnHover:!0,origin:"auto",scrim:!1,scrollStrategy:"reposition",transition:!1}),["absolute","persistent"])},"VTooltip"),j=h()({name:"VTooltip",props:R(),emits:{"update:modelValue":t=>!0},setup(t,v){let{slots:a}=v;const n=O(t,"modelValue"),{scopeId:g}=p(),m=x(),r=e(()=>t.id||`v-tooltip-${m}`),l=T(),f=e(()=>t.location.split(" ").length>1?t.location:t.location+" center"),V=e(()=>t.origin==="auto"||t.origin==="overlap"||t.origin.split(" ").length>1||t.location.split(" ").length>1?t.origin:t.origin+" center"),y=e(()=>t.transition?t.transition:n.value?"scale-transition":"fade-transition"),P=e(()=>u({"aria-describedby":r.value},t.activatorProps));return C(()=>{const b=d.filterProps(t);return I(d,u({ref:l,class:["v-tooltip",t.class],style:t.style,id:r.value},b,{modelValue:n.value,"onUpdate:modelValue":o=>n.value=o,transition:y.value,absolute:!0,location:f.value,origin:V.value,persistent:!0,role:"tooltip",activatorProps:P.value,_disableGlobalStack:!0},g),{activator:a.activator,default:function(){var c;for(var o=arguments.length,s=new Array(o),i=0;i<o;i++)s[i]=arguments[i];return((c=a.default)==null?void 0:c.call(a,...s))??t.text}})}),k({},l)}});export{j as V};
