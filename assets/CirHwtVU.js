import{u as n,_ as l,n as a,h as i,j as o,p as d,co as p,cb as s,ca as r,cG as u,cH as f}from"./CKPNdySy.js";import{V as y}from"./D3JyZ2Hp.js";const m={name:"CopyButton",props:{title:{type:String,default:""},value:{type:String,default:""},tooltipText:{type:String,default:""},size:{type:String,default:"default"}},setup(){return{toastStore:n()}},methods:{async copyToClipboard(){try{await navigator.clipboard.writeText(this.value),this.toastStore.addToast(`Copied to clipboard: ${this.value}.`)}catch(e){console.error(e)}}}};function x(e,_,t,T,C,c){return a(),i(f,{class:"d-flex justify-space-between text-secondary",variant:"outlined",size:t.size,onClick:c.copyToClipboard},{append:o(()=>[d(p,{icon:"mdi-link",size:"1.5rem"})]),default:o(()=>[s(r(t.title)+" ",1),t.tooltipText?(a(),i(y,{key:0,activator:"parent",location:"bottom"},{default:o(()=>[s(r(t.tooltipText),1)]),_:1})):u("",!0)]),_:1},8,["size","onClick"])}const b=l(m,[["render",x]]);export{b as default};