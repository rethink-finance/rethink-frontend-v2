import{S as d}from"./8VZ5Nj8u.js";function _(e,t){if(!d)return;const n=t.modifiers||{},s=t.value,{handler:i,options:f}=typeof s=="object"?s:{handler:s,options:{}},u=new IntersectionObserver(function(){var a;let c=arguments.length>0&&arguments[0]!==void 0?arguments[0]:[],m=arguments.length>1?arguments[1]:void 0;const r=(a=e._observe)==null?void 0:a[t.instance.$.uid];if(!r)return;const o=c.some(b=>b.isIntersecting);i&&(!n.quiet||r.init)&&(!n.once||o||r.init)&&i(o,c,m),o&&n.once?v(e,t):r.init=!0},f);e._observe=Object(e._observe),e._observe[t.instance.$.uid]={init:!1,observer:u},u.observe(e)}function v(e,t){var s;const n=(s=e._observe)==null?void 0:s[t.instance.$.uid];n&&(n.observer.unobserve(e),delete e._observe[t.instance.$.uid])}const p={mounted:_,unmounted:v};export{p as I};
