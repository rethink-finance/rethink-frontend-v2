import{s as mt}from"./D-ocKv1o.js";import{d4 as me,eg as ye,d7 as be,d6 as Kt,eh as Ee,ei as pe,ej as Jt}from"./CKPNdySy.js";/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */const Ft=BigInt(0),Bt=BigInt(1),Be=BigInt(2),xt=t=>t instanceof Uint8Array,xe=Array.from({length:256},(t,n)=>n.toString(16).padStart(2,"0"));function at(t){if(!xt(t))throw new Error("Uint8Array expected");let n="";for(let e=0;e<t.length;e++)n+=xe[t[e]];return n}function te(t){const n=t.toString(16);return n.length&1?`0${n}`:n}function $t(t){if(typeof t!="string")throw new Error("hex string expected, got "+typeof t);return BigInt(t===""?"0":`0x${t}`)}function ut(t){if(typeof t!="string")throw new Error("hex string expected, got "+typeof t);const n=t.length;if(n%2)throw new Error("padded hex string expected, got unpadded hex of length "+n);const e=new Uint8Array(n/2);for(let r=0;r<e.length;r++){const o=r*2,i=t.slice(o,o+2),a=Number.parseInt(i,16);if(Number.isNaN(a)||a<0)throw new Error("Invalid byte sequence");e[r]=a}return e}function C(t){return $t(at(t))}function Lt(t){if(!xt(t))throw new Error("Uint8Array expected");return $t(at(Uint8Array.from(t).reverse()))}function tt(t,n){return ut(t.toString(16).padStart(n*2,"0"))}function Ht(t,n){return tt(t,n).reverse()}function ve(t){return ut(te(t))}function Z(t,n,e){let r;if(typeof n=="string")try{r=ut(n)}catch(i){throw new Error(`${t} must be valid hex string, got "${n}". Cause: ${i}`)}else if(xt(n))r=Uint8Array.from(n);else throw new Error(`${t} must be hex string or Uint8Array`);const o=r.length;if(typeof e=="number"&&o!==e)throw new Error(`${t} expected ${e} bytes, got ${o}`);return r}function K(...t){const n=new Uint8Array(t.reduce((r,o)=>r+o.length,0));let e=0;return t.forEach(r=>{if(!xt(r))throw new Error("Uint8Array expected");n.set(r,e),e+=r.length}),n}function Se(t,n){if(t.length!==n.length)return!1;for(let e=0;e<t.length;e++)if(t[e]!==n[e])return!1;return!0}function vt(t){if(typeof t!="string")throw new Error(`utf8ToBytes expected string, got ${typeof t}`);return new Uint8Array(new TextEncoder().encode(t))}function Ie(t){let n;for(n=0;t>Ft;t>>=Bt,n+=1);return n}function Ae(t,n){return t>>BigInt(n)&Bt}const _e=(t,n,e)=>t|(e?Bt:Ft)<<BigInt(n),Zt=t=>(Be<<BigInt(t-1))-Bt,_t=t=>new Uint8Array(t),Mt=t=>Uint8Array.from(t);function ee(t,n,e){if(typeof t!="number"||t<2)throw new Error("hashLen must be a number");if(typeof n!="number"||n<2)throw new Error("qByteLen must be a number");if(typeof e!="function")throw new Error("hmacFn must be a function");let r=_t(t),o=_t(t),i=0;const a=()=>{r.fill(1),o.fill(0),i=0},c=(...l)=>e(o,r,...l),s=(l=_t())=>{o=c(Mt([0]),l),r=c(),l.length!==0&&(o=c(Mt([1]),l),r=c())},f=()=>{if(i++>=1e3)throw new Error("drbg: tried 1000 values");let l=0;const A=[];for(;l<n;){r=c();const x=r.slice();A.push(x),l+=r.length}return K(...A)};return(l,A)=>{a(),s(l);let x;for(;!(x=A(f()));)s();return a(),x}}const Oe={bigint:t=>typeof t=="bigint",function:t=>typeof t=="function",boolean:t=>typeof t=="boolean",string:t=>typeof t=="string",stringOrUint8Array:t=>typeof t=="string"||t instanceof Uint8Array,isSafeInteger:t=>Number.isSafeInteger(t),array:t=>Array.isArray(t),field:(t,n)=>n.Fp.isValid(t),hash:t=>typeof t=="function"&&Number.isSafeInteger(t.outputLen)};function lt(t,n,e={}){const r=(o,i,a)=>{const c=Oe[i];if(typeof c!="function")throw new Error(`Invalid validator "${i}", expected function`);const s=t[o];if(!(a&&s===void 0)&&!c(s,t))throw new Error(`Invalid param ${String(o)}=${s} (${typeof s}), expected ${i}`)};for(const[o,i]of Object.entries(n))r(o,i,!1);for(const[o,i]of Object.entries(e))r(o,i,!0);return t}const qe=Object.freeze(Object.defineProperty({__proto__:null,bitGet:Ae,bitLen:Ie,bitMask:Zt,bitSet:_e,bytesToHex:at,bytesToNumberBE:C,bytesToNumberLE:Lt,concatBytes:K,createHmacDrbg:ee,ensureBytes:Z,equalBytes:Se,hexToBytes:ut,hexToNumber:$t,numberToBytesBE:tt,numberToBytesLE:Ht,numberToHexUnpadded:te,numberToVarBytesBE:ve,utf8ToBytes:vt,validateObject:lt},Symbol.toStringTag,{value:"Module"}));/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */const H=BigInt(0),R=BigInt(1),rt=BigInt(2),Ne=BigInt(3),Nt=BigInt(4),Yt=BigInt(5),Dt=BigInt(8);BigInt(9);BigInt(16);function L(t,n){const e=t%n;return e>=H?e:n+e}function Te(t,n,e){if(e<=H||n<H)throw new Error("Expected power/modulo > 0");if(e===R)return H;let r=R;for(;n>H;)n&R&&(r=r*t%e),t=t*t%e,n>>=R;return r}function M(t,n,e){let r=t;for(;n-- >H;)r*=r,r%=e;return r}function Tt(t,n){if(t===H||n<=H)throw new Error(`invert: expected positive integers, got n=${t} mod=${n}`);let e=L(t,n),r=n,o=H,i=R;for(;e!==H;){const c=r/e,s=r%e,f=o-i*c;r=e,e=s,o=i,i=f}if(r!==R)throw new Error("invert: does not exist");return L(o,n)}function Ue(t){const n=(t-R)/rt;let e,r,o;for(e=t-R,r=0;e%rt===H;e/=rt,r++);for(o=rt;o<t&&Te(o,n,t)!==t-R;o++);if(r===1){const a=(t+R)/Nt;return function(s,f){const w=s.pow(f,a);if(!s.eql(s.sqr(w),f))throw new Error("Cannot find square root");return w}}const i=(e+R)/rt;return function(c,s){if(c.pow(s,n)===c.neg(c.ONE))throw new Error("Cannot find square root");let f=r,w=c.pow(c.mul(c.ONE,o),e),l=c.pow(s,i),A=c.pow(s,e);for(;!c.eql(A,c.ONE);){if(c.eql(A,c.ZERO))return c.ZERO;let x=1;for(let u=c.sqr(A);x<f&&!c.eql(u,c.ONE);x++)u=c.sqr(u);const b=c.pow(w,R<<BigInt(f-x-1));w=c.sqr(b),l=c.mul(l,b),A=c.mul(A,w),f=x}return l}}function Re(t){if(t%Nt===Ne){const n=(t+R)/Nt;return function(r,o){const i=r.pow(o,n);if(!r.eql(r.sqr(i),o))throw new Error("Cannot find square root");return i}}if(t%Dt===Yt){const n=(t-Yt)/Dt;return function(r,o){const i=r.mul(o,rt),a=r.pow(i,n),c=r.mul(o,a),s=r.mul(r.mul(c,rt),a),f=r.mul(c,r.sub(s,r.ONE));if(!r.eql(r.sqr(f),o))throw new Error("Cannot find square root");return f}}return Ue(t)}const $e=["create","isValid","is0","neg","inv","sqrt","sqr","eql","add","sub","mul","pow","div","addN","subN","mulN","sqrN"];function ne(t){const n={ORDER:"bigint",MASK:"bigint",BYTES:"isSafeInteger",BITS:"isSafeInteger"},e=$e.reduce((r,o)=>(r[o]="function",r),n);return lt(t,e)}function Le(t,n,e){if(e<H)throw new Error("Expected power > 0");if(e===H)return t.ONE;if(e===R)return n;let r=t.ONE,o=n;for(;e>H;)e&R&&(r=t.mul(r,o)),o=t.sqr(o),e>>=R;return r}function He(t,n){const e=new Array(n.length),r=n.reduce((i,a,c)=>t.is0(a)?i:(e[c]=i,t.mul(i,a)),t.ONE),o=t.inv(r);return n.reduceRight((i,a,c)=>t.is0(a)?i:(e[c]=t.mul(i,e[c]),t.mul(i,a)),o),e}function re(t,n){const e=n!==void 0?n:t.toString(2).length,r=Math.ceil(e/8);return{nBitLength:e,nByteLength:r}}function Ze(t,n,e=!1,r={}){if(t<=H)throw new Error(`Expected Field ORDER > 0, got ${t}`);const{nBitLength:o,nByteLength:i}=re(t,n);if(i>2048)throw new Error("Field lengths over 2048 bytes are not supported");const a=Re(t),c=Object.freeze({ORDER:t,BITS:o,BYTES:i,MASK:Zt(o),ZERO:H,ONE:R,create:s=>L(s,t),isValid:s=>{if(typeof s!="bigint")throw new Error(`Invalid field element: expected bigint, got ${typeof s}`);return H<=s&&s<t},is0:s=>s===H,isOdd:s=>(s&R)===R,neg:s=>L(-s,t),eql:(s,f)=>s===f,sqr:s=>L(s*s,t),add:(s,f)=>L(s+f,t),sub:(s,f)=>L(s-f,t),mul:(s,f)=>L(s*f,t),pow:(s,f)=>Le(c,s,f),div:(s,f)=>L(s*Tt(f,t),t),sqrN:s=>s*s,addN:(s,f)=>s+f,subN:(s,f)=>s-f,mulN:(s,f)=>s*f,inv:s=>Tt(s,t),sqrt:r.sqrt||(s=>a(c,s)),invertBatch:s=>He(c,s),cmov:(s,f,w)=>w?f:s,toBytes:s=>e?Ht(s,i):tt(s,i),fromBytes:s=>{if(s.length!==i)throw new Error(`Fp.fromBytes: expected ${i}, got ${s.length}`);return e?Lt(s):C(s)}});return Object.freeze(c)}function oe(t){if(typeof t!="bigint")throw new Error("field order must be bigint");const n=t.toString(2).length;return Math.ceil(n/8)}function ie(t){const n=oe(t);return n+Math.ceil(n/2)}function ke(t,n,e=!1){const r=t.length,o=oe(n),i=ie(n);if(r<16||r<i||r>1024)throw new Error(`expected ${i}-1024 bytes of input, got ${r}`);const a=e?C(t):Lt(t),c=L(a,n-R)+R;return e?Ht(c,o):tt(c,o)}/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */const Ce=BigInt(0),Ot=BigInt(1);function Ve(t,n){const e=(o,i)=>{const a=i.negate();return o?a:i},r=o=>{const i=Math.ceil(n/o)+1,a=2**(o-1);return{windows:i,windowSize:a}};return{constTimeNegate:e,unsafeLadder(o,i){let a=t.ZERO,c=o;for(;i>Ce;)i&Ot&&(a=a.add(c)),c=c.double(),i>>=Ot;return a},precomputeWindow(o,i){const{windows:a,windowSize:c}=r(i),s=[];let f=o,w=f;for(let l=0;l<a;l++){w=f,s.push(w);for(let A=1;A<c;A++)w=w.add(f),s.push(w);f=w.double()}return s},wNAF(o,i,a){const{windows:c,windowSize:s}=r(o);let f=t.ZERO,w=t.BASE;const l=BigInt(2**o-1),A=2**o,x=BigInt(o);for(let b=0;b<c;b++){const u=b*s;let h=Number(a&l);a>>=x,h>s&&(h-=A,a+=Ot);const d=u,m=u+Math.abs(h)-1,E=b%2!==0,v=h<0;h===0?w=w.add(e(E,i[d])):f=f.add(e(v,i[m]))}return{p:f,f:w}},wNAFCached(o,i,a,c){const s=o._WINDOW_SIZE||1;let f=i.get(o);return f||(f=this.precomputeWindow(o,s),s!==1&&i.set(o,c(f))),this.wNAF(s,f,a)}}}function se(t){return ne(t.Fp),lt(t,{n:"bigint",h:"bigint",Gx:"field",Gy:"field"},{nBitLength:"isSafeInteger",nByteLength:"isSafeInteger"}),Object.freeze({...re(t.n,t.nBitLength),...t,p:t.Fp.ORDER})}/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */function Pe(t){const n=se(t);lt(n,{a:"field",b:"field"},{allowedPrivateKeyLengths:"array",wrapPrivateKey:"boolean",isTorsionFree:"function",clearCofactor:"function",allowInfinityPoint:"boolean",fromBytes:"function",toBytes:"function"});const{endo:e,Fp:r,a:o}=n;if(e){if(!r.eql(o,r.ZERO))throw new Error("Endomorphism can only be defined for Koblitz curves that have a=0");if(typeof e!="object"||typeof e.beta!="bigint"||typeof e.splitScalar!="function")throw new Error("Expected endomorphism with beta: bigint and splitScalar: function")}return Object.freeze({...n})}const{bytesToNumberBE:ze,hexToBytes:je}=qe,ot={Err:class extends Error{constructor(n=""){super(n)}},_parseInt(t){const{Err:n}=ot;if(t.length<2||t[0]!==2)throw new n("Invalid signature integer tag");const e=t[1],r=t.subarray(2,e+2);if(!e||r.length!==e)throw new n("Invalid signature integer: wrong length");if(r[0]&128)throw new n("Invalid signature integer: negative");if(r[0]===0&&!(r[1]&128))throw new n("Invalid signature integer: unnecessary leading zero");return{d:ze(r),l:t.subarray(e+2)}},toSig(t){const{Err:n}=ot,e=typeof t=="string"?je(t):t;if(!(e instanceof Uint8Array))throw new Error("ui8a expected");let r=e.length;if(r<2||e[0]!=48)throw new n("Invalid signature tag");if(e[1]!==r-2)throw new n("Invalid signature: incorrect length");const{d:o,l:i}=ot._parseInt(e.subarray(2)),{d:a,l:c}=ot._parseInt(i);if(c.length)throw new n("Invalid signature: left bytes after parsing");return{r:o,s:a}},hexFromSig(t){const n=f=>Number.parseInt(f[0],16)&8?"00"+f:f,e=f=>{const w=f.toString(16);return w.length&1?`0${w}`:w},r=n(e(t.s)),o=n(e(t.r)),i=r.length/2,a=o.length/2,c=e(i),s=e(a);return`30${e(a+i+4)}02${s}${o}02${c}${r}`}},D=BigInt(0),U=BigInt(1),J=BigInt(2),yt=BigInt(3),Gt=BigInt(4);function Ke(t){const n=Pe(t),{Fp:e}=n,r=n.toBytes||((b,u,h)=>{const d=u.toAffine();return K(Uint8Array.from([4]),e.toBytes(d.x),e.toBytes(d.y))}),o=n.fromBytes||(b=>{const u=b.subarray(1),h=e.fromBytes(u.subarray(0,e.BYTES)),d=e.fromBytes(u.subarray(e.BYTES,2*e.BYTES));return{x:h,y:d}});function i(b){const{a:u,b:h}=n,d=e.sqr(b),m=e.mul(d,b);return e.add(e.add(m,e.mul(b,u)),h)}if(!e.eql(e.sqr(n.Gy),i(n.Gx)))throw new Error("bad generator point: equation left != right");function a(b){return typeof b=="bigint"&&D<b&&b<n.n}function c(b){if(!a(b))throw new Error("Expected valid bigint: 0 < bigint < curve.n")}function s(b){const{allowedPrivateKeyLengths:u,nByteLength:h,wrapPrivateKey:d,n:m}=n;if(u&&typeof b!="bigint"){if(b instanceof Uint8Array&&(b=at(b)),typeof b!="string"||!u.includes(b.length))throw new Error("Invalid key");b=b.padStart(h*2,"0")}let E;try{E=typeof b=="bigint"?b:C(Z("private key",b,h))}catch{throw new Error(`private key must be ${h} bytes, hex or bigint, not ${typeof b}`)}return d&&(E=L(E,m)),c(E),E}const f=new Map;function w(b){if(!(b instanceof l))throw new Error("ProjectivePoint expected")}class l{constructor(u,h,d){if(this.px=u,this.py=h,this.pz=d,u==null||!e.isValid(u))throw new Error("x required");if(h==null||!e.isValid(h))throw new Error("y required");if(d==null||!e.isValid(d))throw new Error("z required")}static fromAffine(u){const{x:h,y:d}=u||{};if(!u||!e.isValid(h)||!e.isValid(d))throw new Error("invalid affine point");if(u instanceof l)throw new Error("projective point not allowed");const m=E=>e.eql(E,e.ZERO);return m(h)&&m(d)?l.ZERO:new l(h,d,e.ONE)}get x(){return this.toAffine().x}get y(){return this.toAffine().y}static normalizeZ(u){const h=e.invertBatch(u.map(d=>d.pz));return u.map((d,m)=>d.toAffine(h[m])).map(l.fromAffine)}static fromHex(u){const h=l.fromAffine(o(Z("pointHex",u)));return h.assertValidity(),h}static fromPrivateKey(u){return l.BASE.multiply(s(u))}_setWindowSize(u){this._WINDOW_SIZE=u,f.delete(this)}assertValidity(){if(this.is0()){if(n.allowInfinityPoint&&!e.is0(this.py))return;throw new Error("bad point: ZERO")}const{x:u,y:h}=this.toAffine();if(!e.isValid(u)||!e.isValid(h))throw new Error("bad point: x or y not FE");const d=e.sqr(h),m=i(u);if(!e.eql(d,m))throw new Error("bad point: equation left != right");if(!this.isTorsionFree())throw new Error("bad point: not in prime-order subgroup")}hasEvenY(){const{y:u}=this.toAffine();if(e.isOdd)return!e.isOdd(u);throw new Error("Field doesn't support isOdd")}equals(u){w(u);const{px:h,py:d,pz:m}=this,{px:E,py:v,pz:I}=u,p=e.eql(e.mul(h,I),e.mul(E,m)),B=e.eql(e.mul(d,I),e.mul(v,m));return p&&B}negate(){return new l(this.px,e.neg(this.py),this.pz)}double(){const{a:u,b:h}=n,d=e.mul(h,yt),{px:m,py:E,pz:v}=this;let I=e.ZERO,p=e.ZERO,B=e.ZERO,S=e.mul(m,m),k=e.mul(E,E),T=e.mul(v,v),O=e.mul(m,E);return O=e.add(O,O),B=e.mul(m,v),B=e.add(B,B),I=e.mul(u,B),p=e.mul(d,T),p=e.add(I,p),I=e.sub(k,p),p=e.add(k,p),p=e.mul(I,p),I=e.mul(O,I),B=e.mul(d,B),T=e.mul(u,T),O=e.sub(S,T),O=e.mul(u,O),O=e.add(O,B),B=e.add(S,S),S=e.add(B,S),S=e.add(S,T),S=e.mul(S,O),p=e.add(p,S),T=e.mul(E,v),T=e.add(T,T),S=e.mul(T,O),I=e.sub(I,S),B=e.mul(T,k),B=e.add(B,B),B=e.add(B,B),new l(I,p,B)}add(u){w(u);const{px:h,py:d,pz:m}=this,{px:E,py:v,pz:I}=u;let p=e.ZERO,B=e.ZERO,S=e.ZERO;const k=n.a,T=e.mul(n.b,yt);let O=e.mul(h,E),V=e.mul(d,v),P=e.mul(m,I),G=e.add(h,d),g=e.add(E,v);G=e.mul(G,g),g=e.add(O,V),G=e.sub(G,g),g=e.add(h,m);let y=e.add(E,I);return g=e.mul(g,y),y=e.add(O,P),g=e.sub(g,y),y=e.add(d,m),p=e.add(v,I),y=e.mul(y,p),p=e.add(V,P),y=e.sub(y,p),S=e.mul(k,g),p=e.mul(T,P),S=e.add(p,S),p=e.sub(V,S),S=e.add(V,S),B=e.mul(p,S),V=e.add(O,O),V=e.add(V,O),P=e.mul(k,P),g=e.mul(T,g),V=e.add(V,P),P=e.sub(O,P),P=e.mul(k,P),g=e.add(g,P),O=e.mul(V,g),B=e.add(B,O),O=e.mul(y,g),p=e.mul(G,p),p=e.sub(p,O),O=e.mul(G,V),S=e.mul(y,S),S=e.add(S,O),new l(p,B,S)}subtract(u){return this.add(u.negate())}is0(){return this.equals(l.ZERO)}wNAF(u){return x.wNAFCached(this,f,u,h=>{const d=e.invertBatch(h.map(m=>m.pz));return h.map((m,E)=>m.toAffine(d[E])).map(l.fromAffine)})}multiplyUnsafe(u){const h=l.ZERO;if(u===D)return h;if(c(u),u===U)return this;const{endo:d}=n;if(!d)return x.unsafeLadder(this,u);let{k1neg:m,k1:E,k2neg:v,k2:I}=d.splitScalar(u),p=h,B=h,S=this;for(;E>D||I>D;)E&U&&(p=p.add(S)),I&U&&(B=B.add(S)),S=S.double(),E>>=U,I>>=U;return m&&(p=p.negate()),v&&(B=B.negate()),B=new l(e.mul(B.px,d.beta),B.py,B.pz),p.add(B)}multiply(u){c(u);let h=u,d,m;const{endo:E}=n;if(E){const{k1neg:v,k1:I,k2neg:p,k2:B}=E.splitScalar(h);let{p:S,f:k}=this.wNAF(I),{p:T,f:O}=this.wNAF(B);S=x.constTimeNegate(v,S),T=x.constTimeNegate(p,T),T=new l(e.mul(T.px,E.beta),T.py,T.pz),d=S.add(T),m=k.add(O)}else{const{p:v,f:I}=this.wNAF(h);d=v,m=I}return l.normalizeZ([d,m])[0]}multiplyAndAddUnsafe(u,h,d){const m=l.BASE,E=(I,p)=>p===D||p===U||!I.equals(m)?I.multiplyUnsafe(p):I.multiply(p),v=E(this,h).add(E(u,d));return v.is0()?void 0:v}toAffine(u){const{px:h,py:d,pz:m}=this,E=this.is0();u==null&&(u=E?e.ONE:e.inv(m));const v=e.mul(h,u),I=e.mul(d,u),p=e.mul(m,u);if(E)return{x:e.ZERO,y:e.ZERO};if(!e.eql(p,e.ONE))throw new Error("invZ was invalid");return{x:v,y:I}}isTorsionFree(){const{h:u,isTorsionFree:h}=n;if(u===U)return!0;if(h)return h(l,this);throw new Error("isTorsionFree() has not been declared for the elliptic curve")}clearCofactor(){const{h:u,clearCofactor:h}=n;return u===U?this:h?h(l,this):this.multiplyUnsafe(n.h)}toRawBytes(u=!0){return this.assertValidity(),r(l,this,u)}toHex(u=!0){return at(this.toRawBytes(u))}}l.BASE=new l(n.Gx,n.Gy,e.ONE),l.ZERO=new l(e.ZERO,e.ONE,e.ZERO);const A=n.nBitLength,x=Ve(l,n.endo?Math.ceil(A/2):A);return{CURVE:n,ProjectivePoint:l,normPrivateKeyToScalar:s,weierstrassEquation:i,isWithinCurveOrder:a}}function Me(t){const n=se(t);return lt(n,{hash:"hash",hmac:"function",randomBytes:"function"},{bits2int:"function",bits2int_modN:"function",lowS:"boolean"}),Object.freeze({lowS:!0,...n})}function Ye(t){const n=Me(t),{Fp:e,n:r}=n,o=e.BYTES+1,i=2*e.BYTES+1;function a(g){return D<g&&g<e.ORDER}function c(g){return L(g,r)}function s(g){return Tt(g,r)}const{ProjectivePoint:f,normPrivateKeyToScalar:w,weierstrassEquation:l,isWithinCurveOrder:A}=Ke({...n,toBytes(g,y,_){const N=y.toAffine(),q=e.toBytes(N.x),$=K;return _?$(Uint8Array.from([y.hasEvenY()?2:3]),q):$(Uint8Array.from([4]),q,e.toBytes(N.y))},fromBytes(g){const y=g.length,_=g[0],N=g.subarray(1);if(y===o&&(_===2||_===3)){const q=C(N);if(!a(q))throw new Error("Point is not on curve");const $=l(q);let z=e.sqrt($);const j=(z&U)===U;return(_&1)===1!==j&&(z=e.neg(z)),{x:q,y:z}}else if(y===i&&_===4){const q=e.fromBytes(N.subarray(0,e.BYTES)),$=e.fromBytes(N.subarray(e.BYTES,2*e.BYTES));return{x:q,y:$}}else throw new Error(`Point of length ${y} was invalid. Expected ${o} compressed bytes or ${i} uncompressed bytes`)}}),x=g=>at(tt(g,n.nByteLength));function b(g){const y=r>>U;return g>y}function u(g){return b(g)?c(-g):g}const h=(g,y,_)=>C(g.slice(y,_));class d{constructor(y,_,N){this.r=y,this.s=_,this.recovery=N,this.assertValidity()}static fromCompact(y){const _=n.nByteLength;return y=Z("compactSignature",y,_*2),new d(h(y,0,_),h(y,_,2*_))}static fromDER(y){const{r:_,s:N}=ot.toSig(Z("DER",y));return new d(_,N)}assertValidity(){if(!A(this.r))throw new Error("r must be 0 < r < CURVE.n");if(!A(this.s))throw new Error("s must be 0 < s < CURVE.n")}addRecoveryBit(y){return new d(this.r,this.s,y)}recoverPublicKey(y){const{r:_,s:N,recovery:q}=this,$=B(Z("msgHash",y));if(q==null||![0,1,2,3].includes(q))throw new Error("recovery id invalid");const z=q===2||q===3?_+n.n:_;if(z>=e.ORDER)throw new Error("recovery id 2 or 3 invalid");const j=q&1?"03":"02",W=f.fromHex(j+x(z)),X=s(z),it=c(-$*X),dt=c(N*X),Q=f.BASE.multiplyAndAddUnsafe(W,it,dt);if(!Q)throw new Error("point at infinify");return Q.assertValidity(),Q}hasHighS(){return b(this.s)}normalizeS(){return this.hasHighS()?new d(this.r,c(-this.s),this.recovery):this}toDERRawBytes(){return ut(this.toDERHex())}toDERHex(){return ot.hexFromSig({r:this.r,s:this.s})}toCompactRawBytes(){return ut(this.toCompactHex())}toCompactHex(){return x(this.r)+x(this.s)}}const m={isValidPrivateKey(g){try{return w(g),!0}catch{return!1}},normPrivateKeyToScalar:w,randomPrivateKey:()=>{const g=ie(n.n);return ke(n.randomBytes(g),n.n)},precompute(g=8,y=f.BASE){return y._setWindowSize(g),y.multiply(BigInt(3)),y}};function E(g,y=!0){return f.fromPrivateKey(g).toRawBytes(y)}function v(g){const y=g instanceof Uint8Array,_=typeof g=="string",N=(y||_)&&g.length;return y?N===o||N===i:_?N===2*o||N===2*i:g instanceof f}function I(g,y,_=!0){if(v(g))throw new Error("first arg must be private key");if(!v(y))throw new Error("second arg must be public key");return f.fromHex(y).multiply(w(g)).toRawBytes(_)}const p=n.bits2int||function(g){const y=C(g),_=g.length*8-n.nBitLength;return _>0?y>>BigInt(_):y},B=n.bits2int_modN||function(g){return c(p(g))},S=Zt(n.nBitLength);function k(g){if(typeof g!="bigint")throw new Error("bigint expected");if(!(D<=g&&g<S))throw new Error(`bigint expected < 2^${n.nBitLength}`);return tt(g,n.nByteLength)}function T(g,y,_=O){if(["recovered","canonical"].some(nt=>nt in _))throw new Error("sign() legacy options not supported");const{hash:N,randomBytes:q}=n;let{lowS:$,prehash:z,extraEntropy:j}=_;$==null&&($=!0),g=Z("msgHash",g),z&&(g=Z("prehashed msgHash",N(g)));const W=B(g),X=w(y),it=[k(X),k(W)];if(j!=null){const nt=j===!0?q(e.BYTES):j;it.push(Z("extraEntropy",nt))}const dt=K(...it),Q=W;function At(nt){const st=p(nt);if(!A(st))return;const Pt=s(st),ct=f.BASE.multiply(st).toAffine(),Y=c(ct.x);if(Y===D)return;const ft=c(Pt*c(Q+Y*X));if(ft===D)return;let zt=(ct.x===Y?0:2)|Number(ct.y&U),jt=ft;return $&&b(ft)&&(jt=u(ft),zt^=1),new d(Y,jt,zt)}return{seed:dt,k2sig:At}}const O={lowS:n.lowS,prehash:!1},V={lowS:n.lowS,prehash:!1};function P(g,y,_=O){const{seed:N,k2sig:q}=T(g,y,_),$=n;return ee($.hash.outputLen,$.nByteLength,$.hmac)(N,q)}f.BASE._setWindowSize(8);function G(g,y,_,N=V){var ct;const q=g;if(y=Z("msgHash",y),_=Z("publicKey",_),"strict"in N)throw new Error("options.strict was renamed to lowS");const{lowS:$,prehash:z}=N;let j,W;try{if(typeof q=="string"||q instanceof Uint8Array)try{j=d.fromDER(q)}catch(Y){if(!(Y instanceof ot.Err))throw Y;j=d.fromCompact(q)}else if(typeof q=="object"&&typeof q.r=="bigint"&&typeof q.s=="bigint"){const{r:Y,s:ft}=q;j=new d(Y,ft)}else throw new Error("PARSE");W=f.fromHex(_)}catch(Y){if(Y.message==="PARSE")throw new Error("signature must be Signature instance, Uint8Array or hex string");return!1}if($&&j.hasHighS())return!1;z&&(y=n.hash(y));const{r:X,s:it}=j,dt=B(y),Q=s(it),At=c(dt*Q),nt=c(X*Q),st=(ct=f.BASE.multiplyAndAddUnsafe(W,At,nt))==null?void 0:ct.toAffine();return st?c(st.x)===X:!1}return{CURVE:n,getPublicKey:E,getSharedSecret:I,sign:P,verify:G,ProjectivePoint:f,Signature:d,utils:m}}function De(t,n){const e=t.ORDER;let r=D;for(let b=e-U;b%J===D;b/=J)r+=U;const o=r,i=J<<o-U-U,a=i*J,c=(e-U)/a,s=(c-U)/J,f=a-U,w=i,l=t.pow(n,c),A=t.pow(n,(c+U)/J);let x=(b,u)=>{let h=l,d=t.pow(u,f),m=t.sqr(d);m=t.mul(m,u);let E=t.mul(b,m);E=t.pow(E,s),E=t.mul(E,d),d=t.mul(E,u),m=t.mul(E,b);let v=t.mul(m,d);E=t.pow(v,w);let I=t.eql(E,t.ONE);d=t.mul(m,A),E=t.mul(v,h),m=t.cmov(d,m,I),v=t.cmov(E,v,I);for(let p=o;p>U;p--){let B=p-J;B=J<<B-U;let S=t.pow(v,B);const k=t.eql(S,t.ONE);d=t.mul(m,h),h=t.mul(h,h),S=t.mul(v,h),m=t.cmov(d,m,k),v=t.cmov(S,v,k)}return{isValid:I,value:m}};if(t.ORDER%Gt===yt){const b=(t.ORDER-yt)/Gt,u=t.sqrt(t.neg(n));x=(h,d)=>{let m=t.sqr(d);const E=t.mul(h,d);m=t.mul(m,E);let v=t.pow(m,b);v=t.mul(v,E);const I=t.mul(v,u),p=t.mul(t.sqr(v),d),B=t.eql(p,h);let S=t.cmov(I,v,B);return{isValid:B,value:S}}}return x}function Ge(t,n){if(ne(t),!t.isValid(n.A)||!t.isValid(n.B)||!t.isValid(n.Z))throw new Error("mapToCurveSimpleSWU: invalid opts");const e=De(t,n.Z);if(!t.isOdd)throw new Error("Fp.isOdd is not implemented!");return r=>{let o,i,a,c,s,f,w,l;o=t.sqr(r),o=t.mul(o,n.Z),i=t.sqr(o),i=t.add(i,o),a=t.add(i,t.ONE),a=t.mul(a,n.B),c=t.cmov(n.Z,t.neg(i),!t.eql(i,t.ZERO)),c=t.mul(c,n.A),i=t.sqr(a),f=t.sqr(c),s=t.mul(f,n.A),i=t.add(i,s),i=t.mul(i,a),f=t.mul(f,c),s=t.mul(f,n.B),i=t.add(i,s),w=t.mul(o,a);const{isValid:A,value:x}=e(i,f);l=t.mul(o,r),l=t.mul(l,x),w=t.cmov(w,a,A),l=t.cmov(l,x,A);const b=t.isOdd(r)===t.isOdd(l);return l=t.cmov(t.neg(l),l,b),w=t.div(w,c),{x:w,y:l}}}function We(t){if(t instanceof Uint8Array)return t;if(typeof t=="string")return vt(t);throw new Error("DST must be Uint8Array or string")}const Xe=C;function F(t,n){if(t<0||t>=1<<8*n)throw new Error(`bad I2OSP call: value=${t} length=${n}`);const e=Array.from({length:n}).fill(0);for(let r=n-1;r>=0;r--)e[r]=t&255,t>>>=8;return new Uint8Array(e)}function Qe(t,n){const e=new Uint8Array(t.length);for(let r=0;r<t.length;r++)e[r]=t[r]^n[r];return e}function ht(t){if(!(t instanceof Uint8Array))throw new Error("Uint8Array expected")}function kt(t){if(!Number.isSafeInteger(t))throw new Error("number expected")}function Je(t,n,e,r){ht(t),ht(n),kt(e),n.length>255&&(n=r(K(vt("H2C-OVERSIZE-DST-"),n)));const{outputLen:o,blockLen:i}=r,a=Math.ceil(e/o);if(a>255)throw new Error("Invalid xmd length");const c=K(n,F(n.length,1)),s=F(0,i),f=F(e,2),w=new Array(a),l=r(K(s,t,f,F(0,1),c));w[0]=r(K(l,F(1,1),c));for(let x=1;x<=a;x++){const b=[Qe(l,w[x-1]),F(x+1,1),c];w[x]=r(K(...b))}return K(...w).slice(0,e)}function Fe(t,n,e,r,o){if(ht(t),ht(n),kt(e),n.length>255){const i=Math.ceil(2*r/8);n=o.create({dkLen:i}).update(vt("H2C-OVERSIZE-DST-")).update(n).digest()}if(e>65535||n.length>255)throw new Error("expand_message_xof: invalid lenInBytes");return o.create({dkLen:e}).update(t).update(F(e,2)).update(n).update(F(n.length,1)).digest()}function Wt(t,n,e){lt(e,{DST:"stringOrUint8Array",p:"bigint",m:"isSafeInteger",k:"isSafeInteger",hash:"hash"});const{p:r,k:o,m:i,hash:a,expand:c,DST:s}=e;ht(t),kt(n);const f=We(s),w=r.toString(2).length,l=Math.ceil((w+o)/8),A=n*i*l;let x;if(c==="xmd")x=Je(t,f,A,a);else if(c==="xof")x=Fe(t,f,A,o,a);else if(c==="_internal_pass")x=t;else throw new Error('expand must be "xmd" or "xof"');const b=new Array(n);for(let u=0;u<n;u++){const h=new Array(i);for(let d=0;d<i;d++){const m=l*(d+u*i),E=x.subarray(m,m+l);h[d]=L(Xe(E),r)}b[u]=h}return b}function tn(t,n){const e=n.map(r=>Array.from(r).reverse());return(r,o)=>{const[i,a,c,s]=e.map(f=>f.reduce((w,l)=>t.add(t.mul(w,r),l)));return r=t.div(i,a),o=t.mul(o,t.div(c,s)),{x:r,y:o}}}function en(t,n,e){if(typeof n!="function")throw new Error("mapToCurve() must be defined");return{hashToCurve(r,o){const i=Wt(r,2,{...e,DST:e.DST,...o}),a=t.fromAffine(n(i[0])),c=t.fromAffine(n(i[1])),s=a.add(c).clearCofactor();return s.assertValidity(),s},encodeToCurve(r,o){const i=Wt(r,1,{...e,DST:e.encodeDST,...o}),a=t.fromAffine(n(i[0])).clearCofactor();return a.assertValidity(),a}}}class ce extends me{constructor(n,e){super(),this.finished=!1,this.destroyed=!1,ye(n);const r=be(e);if(this.iHash=n.create(),typeof this.iHash.update!="function")throw new Error("Expected instance of class which extends utils.Hash");this.blockLen=this.iHash.blockLen,this.outputLen=this.iHash.outputLen;const o=this.blockLen,i=new Uint8Array(o);i.set(r.length>o?n.create().update(r).digest():r);for(let a=0;a<i.length;a++)i[a]^=54;this.iHash.update(i),this.oHash=n.create();for(let a=0;a<i.length;a++)i[a]^=106;this.oHash.update(i),i.fill(0)}update(n){return Kt(this),this.iHash.update(n),this}digestInto(n){Kt(this),Ee(n,this.outputLen),this.finished=!0,this.iHash.digestInto(n),this.oHash.update(n),this.oHash.digestInto(n),this.destroy()}digest(){const n=new Uint8Array(this.oHash.outputLen);return this.digestInto(n),n}_cloneInto(n){n||(n=Object.create(Object.getPrototypeOf(this),{}));const{oHash:e,iHash:r,finished:o,destroyed:i,blockLen:a,outputLen:c}=this;return n=n,n.finished=o,n.destroyed=i,n.blockLen=a,n.outputLen=c,n.oHash=e._cloneInto(n.oHash),n.iHash=r._cloneInto(n.iHash),n}destroy(){this.destroyed=!0,this.oHash.destroy(),this.iHash.destroy()}}const fe=(t,n,e)=>new ce(t,n).update(e).digest();fe.create=(t,n)=>new ce(t,n);/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */function nn(t){return{hash:t,hmac:(n,...e)=>fe(t,n,pe(...e)),randomBytes:Jt}}function rn(t,n){const e=r=>Ye({...t,...nn(r)});return Object.freeze({...e(n),create:e})}/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */const St=BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),bt=BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),ae=BigInt(1),Et=BigInt(2),Xt=(t,n)=>(t+n/Et)/n;function ue(t){const n=St,e=BigInt(3),r=BigInt(6),o=BigInt(11),i=BigInt(22),a=BigInt(23),c=BigInt(44),s=BigInt(88),f=t*t*t%n,w=f*f*t%n,l=M(w,e,n)*w%n,A=M(l,e,n)*w%n,x=M(A,Et,n)*f%n,b=M(x,o,n)*x%n,u=M(b,i,n)*b%n,h=M(u,c,n)*u%n,d=M(h,s,n)*h%n,m=M(d,c,n)*u%n,E=M(m,e,n)*w%n,v=M(E,a,n)*b%n,I=M(v,r,n)*f%n,p=M(I,Et,n);if(!et.eql(et.sqr(p),t))throw new Error("Cannot find square root");return p}const et=Ze(St,void 0,void 0,{sqrt:ue}),wt=rn({a:BigInt(0),b:BigInt(7),Fp:et,n:bt,Gx:BigInt("55066263022277343669578718895168534326250603453777594175500187360389116729240"),Gy:BigInt("32670510020758816978083085130507043184471273380659243275938904335757337482424"),h:BigInt(1),lowS:!0,endo:{beta:BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),splitScalar:t=>{const n=bt,e=BigInt("0x3086d221a7d46bcde86c90e49284eb15"),r=-ae*BigInt("0xe4437ed6010e88286f547fa90abfe4c3"),o=BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"),i=e,a=BigInt("0x100000000000000000000000000000000"),c=Xt(i*t,n),s=Xt(-r*t,n);let f=L(t-c*e-s*o,n),w=L(-c*r-s*i,n);const l=f>a,A=w>a;if(l&&(f=n-f),A&&(w=n-w),f>a||w>a)throw new Error("splitScalar: Endomorphism failed, k="+t);return{k1neg:l,k1:f,k2neg:A,k2:w}}}},mt),It=BigInt(0),le=t=>typeof t=="bigint"&&It<t&&t<St,on=t=>typeof t=="bigint"&&It<t&&t<bt,Qt={};function pt(t,...n){let e=Qt[t];if(e===void 0){const r=mt(Uint8Array.from(t,o=>o.charCodeAt(0)));e=K(r,r),Qt[t]=e}return mt(K(e,...n))}const Ct=t=>t.toRawBytes(!0).slice(1),Ut=t=>tt(t,32),qt=t=>L(t,St),gt=t=>L(t,bt),Vt=wt.ProjectivePoint,sn=(t,n,e)=>Vt.BASE.multiplyAndAddUnsafe(t,n,e);function Rt(t){let n=wt.utils.normPrivateKeyToScalar(t),e=Vt.fromPrivateKey(n);return{scalar:e.hasEvenY()?n:gt(-n),bytes:Ct(e)}}function de(t){if(!le(t))throw new Error("bad x: need 0 < x < p");const n=qt(t*t),e=qt(n*t+BigInt(7));let r=ue(e);r%Et!==It&&(r=qt(-r));const o=new Vt(t,r,ae);return o.assertValidity(),o}function he(...t){return gt(C(pt("BIP0340/challenge",...t)))}function cn(t){return Rt(t).bytes}function fn(t,n,e=Jt(32)){const r=Z("message",t),{bytes:o,scalar:i}=Rt(n),a=Z("auxRand",e,32),c=Ut(i^C(pt("BIP0340/aux",a))),s=pt("BIP0340/nonce",c,o,r),f=gt(C(s));if(f===It)throw new Error("sign failed: k is zero");const{bytes:w,scalar:l}=Rt(f),A=he(w,o,r),x=new Uint8Array(64);if(x.set(w,0),x.set(Ut(gt(l+A*i)),32),!ge(x,r,o))throw new Error("sign: Invalid signature produced");return x}function ge(t,n,e){const r=Z("signature",t,64),o=Z("message",n),i=Z("publicKey",e,32);try{const a=de(C(i)),c=C(r.subarray(0,32));if(!le(c))return!1;const s=C(r.subarray(32,64));if(!on(s))return!1;const f=he(Ut(c),Ct(a),o),w=sn(a,s,gt(-f));return!(!w||!w.hasEvenY()||w.toAffine().x!==c)}catch{return!1}}const an={getPublicKey:cn,sign:fn,verify:ge,utils:{randomPrivateKey:wt.utils.randomPrivateKey,lift_x:de,pointToBytes:Ct,numberToBytesBE:tt,bytesToNumberBE:C,taggedHash:pt,mod:L}},un=tn(et,[["0x8e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38daaaaa8c7","0x7d3d4c80bc321d5b9f315cea7fd44c5d595d2fc0bf63b92dfff1044f17c6581","0x534c328d23f234e6e2a413deca25caece4506144037c40314ecbd0b53d9dd262","0x8e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38daaaaa88c"],["0xd35771193d94918a9ca34ccbb7b640dd86cd409542f8487d9fe6b745781eb49b","0xedadc6f64383dc1df7c4b2d51b54225406d36b641f5e41bbc52a56612a8c6d14","0x0000000000000000000000000000000000000000000000000000000000000001"],["0x4bda12f684bda12f684bda12f684bda12f684bda12f684bda12f684b8e38e23c","0xc75e0c32d5cb7c0fa9d0a54b12a0a6d5647ab046d686da6fdffc90fc201d71a3","0x29a6194691f91a73715209ef6512e576722830a201be2018a765e85a9ecee931","0x2f684bda12f684bda12f684bda12f684bda12f684bda12f684bda12f38e38d84"],["0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffff93b","0x7a06534bb8bdb49fd5e9e6632722c2989467c1bfc8e8d978dfb425d2685c2573","0x6484aa716545ca2cf3a70c3fa8fe337e0a3d21162f0d6299a7bf8192bfd2a76f","0x0000000000000000000000000000000000000000000000000000000000000001"]].map(t=>t.map(n=>BigInt(n)))),ln=Ge(et,{A:BigInt("0x3f8731abdd661adca08a5558f0f5d272e953d363cb6f0e5d405447c01a444533"),B:BigInt("1771"),Z:et.create(BigInt("-11"))}),we=en(wt.ProjectivePoint,t=>{const{x:n,y:e}=ln(et.create(t[0]));return un(n,e)},{DST:"secp256k1_XMD:SHA-256_SSWU_RO_",encodeDST:"secp256k1_XMD:SHA-256_SSWU_NU_",p:et.ORDER,m:1,k:128,expand:"xmd",hash:mt}),dn=we.hashToCurve,hn=we.encodeToCurve,yn=Object.freeze(Object.defineProperty({__proto__:null,encodeToCurve:hn,hashToCurve:dn,schnorr:an,secp256k1:wt},Symbol.toStringTag,{value:"Module"}));export{yn as a,Se as e,wt as s,qe as u};