const r=Symbol(),e=Object.getPrototypeOf,o=new WeakMap,y=t=>t&&(o.has(t)?o.get(t):e(t)===Object.prototype||e(t)===Array.prototype),c=t=>y(t)&&t[r]||null,s=(t,p=!0)=>{o.set(t,p)};export{s as h,c as y};
