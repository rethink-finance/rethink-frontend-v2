import Ee from"./CyNW5mbe.js";import{d as Ce,g as Fe,c as Be,E as De,b as U,o as Te,cl as H,et as ye,eo as Ve,k as Re,t as xe,O as j,N as Ie,eu as qe,ev as Ae,ew as Ge,ex as fe,u as _e,cm as We}from"./DMr2Lov7.js";import{z as Oe,G as $e,Z as Me,N as Le,u as G,R as Ue,B as $,s as A,k as ke}from"./BoR6Scjb.js";import{g as z}from"./Bcc-Vfxl.js";import{v as R,C as V,w as He,d as N,x as je,r as M}from"./tXbm5PSG.js";import{u as J}from"./DZYjx_iz.js";const gt=Ce({__name:"ProposalStateChip",props:{value:{type:String,default:""}},setup(e){const t=e,s=Fe(()=>{var o;return`proposal_state_${((o=t.value)==null?void 0:o.toLowerCase())??"undefined"}`});return(o,r)=>{const a=Ee;return Te(),Be(a,{value:e.value,class:De(U(s)),uppercase:"",bold:""},null,8,["value","class"])}}}),ze=z`
  query FetchGovernanceProposals($governorAddress: String!) {
    proposals(where: { governor_: { id: $governorAddress } }) {
      id
      proposalId
      voteStart
      voteEnd
      description
      canceled
      queued
      executed
      proposer {
        id
      }
      proposalCanceled {
        timestamp
        transaction {
          blockNumber
        }
      }
      proposalCreated {
        timestamp
        transaction {
          blockNumber
        }
      }
      proposalExecuted {
        timestamp
        transaction {
          blockNumber
        }
      }
      proposalQueued {
        timestamp
        transaction {
          blockNumber
        }
      }
      calls(orderBy: index, orderDirection: asc) {
        calldata
        index
        signature
        value
        target {
          id
        }
      }
      receipts {
        id
        voter {
          id
        }
        support {
          support
        }
        weight
        voteCasts {
          transaction {
            timestamp
            blockNumber
          }
        }
      }
    }
  }
`,Je=z`
  query FetchSingleProposal($proposalId: String!, $governorAddress: String!) {
    proposals(
      where: { proposalId: $proposalId, governor_: { id: $governorAddress } }
    ) {
      id
      proposalId
      voteStart
      voteEnd
      description
      canceled
      queued
      executed
      proposer {
        id
      }
      proposalCanceled {
        timestamp
        transaction {
          blockNumber
        }
      }
      proposalCreated {
        timestamp
        transaction {
          blockNumber
        }
      }
      proposalExecuted {
        timestamp
        transaction {
          blockNumber
        }
      }
      proposalQueued {
        timestamp
        transaction {
          blockNumber
        }
      }
      calls(orderBy: index, orderDirection: asc, first: 1000) {
        calldata
        index
        signature
        value
        target {
          id
        }
      }
      receipts {
        id
        voter {
          id
        }
        support {
          support
        }
        weight
        voteCasts {
          transaction {
            timestamp
            blockNumber
          }
        }
      }
    }
  }
`,Qe=z`
  query FetchDelegates($votingContract: String!) {
    votingContract(id: $votingContract) {
      id
      totalWeight {
        value
      }
      weight(where: { value_gt: 0, account_not: null }) {
        account {
          id
          delegationFrom(where: { contract_: { id: $votingContract } }) {
            delegator {
              id
              voteWeigth(where: { contract_: { id: $votingContract } }) {
                value
              }
            }
          }
        }
        value
      }
    }
  }
`,Ze=async(e,t)=>{const s=H().$getApolloClient(e);if(!s)throw new Error("Apollo client not found");try{const{data:o}=await s.query({query:ze,variables:{governorAddress:t.governorAddress},fetchPolicy:"network-only"});if(console.log("fetched data of proposals",o),!o||!o.proposals)throw new Error("Received no data or events!");return o.proposals}catch(o){throw console.error("Error fetching governor proposals:",o),o}},Xe=async(e,t)=>{const s=H().$getApolloClient(e);if(!s)throw new Error("Apollo client not found");try{const{data:o}=await s.query({query:Je,variables:{governorAddress:t.governorAddress,proposalId:t.proposalId},fetchPolicy:"network-only"});if(!o||!o.proposals)throw new Error("Received no data or events!");return o.proposals[0]}catch(o){throw console.error("Error fetching governor proposal:",o),o}},Ke=async(e,t)=>{const s=H().$getApolloClient(e);if(!s)throw new Error("Apollo client not found");try{const{data:o}=await s.query({query:Qe,variables:{votingContract:t.votingContract}});if(console.log("fetchSubgraphDelegates data: ",o),!o||!o.votingContract)throw new Error("Received no data or events!");return o.votingContract}catch(o){throw console.error("Error fetching subgraph delegates response:",o),o}};var F=(e=>(e.Pending="Pending",e.Active="Active",e.Canceled="Canceled",e.Defeated="Defeated",e.Succeeded="Succeeded",e.Queued="Queued",e.Expired="Expired",e.Executed="Executed",e))(F||{}),Ye=(e=>(e.Against="Reject",e.For="Approve",e.Abstain="Abstain",e))(Ye||{});const et={0:"Reject",1:"Approve",2:"Abstain"},tt={0:"Pending",1:"Active",2:"Canceled",3:"Defeated",4:"Succeeded",5:"Queued",6:"Expired",7:"Executed"},ht={Reject:0,Approve:1,Abstain:2},bt={1:"Approve",0:"Reject",2:"Abstain"},vt={Approve:"material-symbols:done",Reject:"material-symbols:close",Abstain:"material-symbols:question-mark"},ft={Approve:"for",Reject:"against",Abstain:"abstain"};var D=(e=>(e.NAV_UPDATE="NAV Update",e.DIRECT_EXECUTION="Direct Execution",e.PERMISSIONS="Permissions",e.FUND_SETTINGS="Fund Settings",e.UNDEFINED="Undefined",e))(D||{});const Q=(e,t,s,o,r)=>{var n,p;const a=t.slice(0,10),l=t.slice(10),c=L[a],i={functionName:void 0,contractName:void 0,calldataType:void 0,calldataDecoded:void 0,calldata:t};if(!((n=c==null?void 0:c.function)!=null&&n.name))return console.warn("No existing function signature found in the GovernableFund ABI for ",a,c),i;const b=(p=c==null?void 0:c.function)==null?void 0:p.inputs;try{let u=ye(b,l);u=R(u);let k=D.UNDEFINED;const d=c.function.name,v=s.toLocaleLowerCase();if(d==="updateNav")k=D.NAV_UPDATE;else if(v===(o==null?void 0:o.toLocaleLowerCase()))k=D.DIRECT_EXECUTION;else if(v===(e==null?void 0:e.toLocaleLowerCase()))k=D.PERMISSIONS;else if(d==="updateSettings")k=D.FUND_SETTINGS;else if(d==="storeNAVData")try{if(r&&(u==null?void 0:u.oiv)===r){const f=Q(e,(u==null?void 0:u.data)??"",s,o,r);f!=null&&f.calldataDecoded&&(u=f==null?void 0:f.calldataDecoded),k=D.NAV_UPDATE}}catch(f){console.error("Failed decoding storeNAVData NAV methods",t,f)}return{functionName:d,contractName:c.contractName,calldataType:k,calldataDecoded:u,calldata:t}}catch(u){console.error("error while decoding signature: ",a,u)}return console.error("FAILED decoding signature: ",a,L[a]),i},L={},ot=[{abi:Oe.abi,name:"GovernableFund"},{abi:$e.abi,name:"GnosisSafeL2"},{abi:Me.abi,name:"ZodiacRoles"},{abi:Le.abi,name:"NAVExecutor"}];ot.forEach(e=>{e.abi.forEach(t=>{if(t.type==="function"){const s=Ve(t);L[s]={function:t,contractName:e.name}}})});async function Ne(e,t,s,o,r,a,l,c,i,b,n){var ee,te,oe,re,ae,se,ne,ce,ie,le,ue,de,me,pe,ge,he,be,ve;let p,u;c===V.Timestamp?(p=e.voteStart,u=e.voteEnd):c===V.BlockNumber?(p=await l(Number(e.voteStart),s),u=await l(Number(e.voteEnd),s)):(p=0,u=0);const d=(m=>{try{const E=JSON.parse(m);return{title:E.title,description:E.description}}catch{return{title:m.split(`
`)[0],description:m}}})(e.description),v=e.calls.map(m=>m.calldata),f=e.calls.map(m=>m.value),g=e.calls.map(m=>m.signature),h=e.calls.map(m=>m.target.id),S=[],P=[];v.forEach((m,E)=>{const q=Q(i,m,h[E],b,n);S.push(q),P.push(q==null?void 0:q.calldataType)});const C=[...new Set(P.filter(m=>m!==D.UNDEFINED&&m!==void 0))],B=e.receipts||[],w=B.filter(m=>m.support.support===1).reduce((m,E)=>m+BigInt(E.weight),BigInt(0)),y=B.filter(m=>m.support.support===0).reduce((m,E)=>m+BigInt(E.weight),BigInt(0)),W=B.filter(m=>m.support.support===2).reduce((m,E)=>m+BigInt(E.weight),BigInt(0)),x=w+y+W,Z=Number(x),Pe=Number(w),X=Number(t||0),O=BigInt(t)*BigInt(r)/BigInt(a),K=x>BigInt(0)?Math.min(Pe/Z*100,100):0,Y=X>0?Math.min(Z/X*100,100):0;let T;const I=Math.floor(Date.now()/1e3);(te=(ee=e.proposalCanceled)==null?void 0:ee[0])!=null&&te.timestamp?T=F.Canceled:(re=(oe=e.proposalExecuted)==null?void 0:oe[0])!=null&&re.timestamp?T=F.Executed:(se=(ae=e.proposalQueued)==null?void 0:ae[0])!=null&&se.timestamp?T=F.Queued:I<Number(p)?T=F.Pending:I>=Number(p)&&I<Number(u)?T=F.Active:I>=Number(u)?T=x>=O&&w>y?F.Succeeded:F.Defeated:T=F.Pending;const we=(e.receipts??[]).map(m=>({proposalId:e.proposalId.toString(),proposer:m.voter.id,my_vote:!1,submission_status:et[m.support.support],quorumVotes:N(BigInt(m.weight),o,!1,!0),date:He(new Date(Number(m.voteCasts[0].transaction.timestamp)*1e3),!1),blockNumber:m.voteCasts[0].transaction.blockNumber}));return{proposalId:e.proposalId.toString(),proposer:e.proposer.id,title:d.title,description:d.description,voteStart:e.voteStart.toString(),voteEnd:e.voteEnd.toString(),voteStartTimestamp:p==null?void 0:p.toString(),voteEndTimestamp:u==null?void 0:u.toString(),createdTimestamp:Number((ce=(ne=e.proposalCreated)==null?void 0:ne[0])==null?void 0:ce.timestamp),executedTimestamp:Number((le=(ie=e.proposalExecuted)==null?void 0:ie[0])==null?void 0:le.timestamp),createdDatetimeFormatted:(de=(ue=e.proposalCreated)==null?void 0:ue[0])!=null&&de.timestamp?new Date(Number(e.proposalCreated[0].timestamp)*1e3).toDateString():new Date().toDateString(),targets:h,values:f,signatures:g,calldatas:v,descriptionHash:Re(xe(e.description)),calldatasDecoded:S,calldataTypes:P,calldataTags:C,state:T,createdBlockNumber:BigInt(((ge=(pe=(me=e.proposalCreated)==null?void 0:me[0])==null?void 0:pe.transaction)==null?void 0:ge.blockNumber)??"0"),executedBlockNumber:BigInt(((ve=(be=(he=e.proposalExecuted)==null?void 0:he[0])==null?void 0:be.transaction)==null?void 0:ve.blockNumber)??"0"),approval:K/100,approvalFormatted:`${parseFloat(K.toFixed(2))}%`,participation:Y/100,participationFormatted:`${parseFloat(Y.toFixed(2))}%`,quorumVotes:O,quorumVotesFormatted:N(O,o,!1),forVotes:w,forVotesFormatted:N(w,o,!1),againstVotes:y,againstVotesFormatted:N(y,o,!1),abstainVotes:W,abstainVotesFormatted:N(W,o,!1),totalVotes:x,totalVotesFormatted:N(BigInt(x),o,!1),totalSupply:BigInt(t),totalSupplyFormatted:N(BigInt(t),o,!1),voteSubmissions:we}}function rt(e,t){var o;if(!(e!=null&&e.weight))return[];const s=((o=e.totalWeight)==null?void 0:o.value)||"0";return e.weight.map(r=>{var c,i,b;const a=((i=(c=r.account)==null?void 0:c.delegationFrom)==null?void 0:i.map(n=>{var p,u,k;return{address:n.delegator.id||"",weight:((k=(u=(p=n.delegator)==null?void 0:p.voteWeigth)==null?void 0:u[0])==null?void 0:k.value)||"0"}}))||[],l=s!=="0"?(Number(r.value||0)/Number(s)*100).toFixed(2):"0";return{address:((b=r.account)==null?void 0:b.id)||"",delegators:a,delegatorCount:a.length,votingPower:N(BigInt(r.value||"0"),t,!1),votingPowerPercent:`${l}%`}})}function kt(e){return e.map(t=>({delegatedMember:t.address,delegators:t.delegators.map(s=>s.address),delegatorsEvents:[],impact:t.votingPowerPercent,votingPower:t.votingPower}))}const at=async()=>{var l,c;const e=G(),t=_(),s=U(e.fund);if(!s)return;const o=(l=s==null?void 0:s.governanceToken)==null?void 0:l.address;if(!o)throw new Error("Governor token address not found");const r=await Ke(s.chainId,{votingContract:o}),a=rt(r,((c=s==null?void 0:s.governanceToken)==null?void 0:c.decimals)||18);return t.storeDelegates(s==null?void 0:s.chainId,s==null?void 0:s.address,a),console.log("processedDelegates: ",a),r},st=async e=>{var v,f,g,h,S,P,C,B,w,y;const t=_(),s=j(),o=G(),r=J(),a=U(o.fund);if(!a)return;if(!(a!=null&&a.governorAddress))throw new Error("Governor address not found");if(!e)throw new Error("Proposal ID not found");const l=await Xe(a==null?void 0:a.chainId,{governorAddress:a==null?void 0:a.governorAddress,proposalId:e}),c=await r.initializeBlockTimeContext(a.chainId),i=await o.fetchRoleModAddress(a.address),b=((v=a==null?void 0:a.clockMode)==null?void 0:v.mode)===V.BlockNumber?(h=(g=(f=l.proposalCreated)==null?void 0:f[0])==null?void 0:g.transaction)==null?void 0:h.blockNumber:(P=(S=l.proposalCreated)==null?void 0:S[0])==null?void 0:P.timestamp,n=(w=(B=(C=l.proposalCreated)==null?void 0:C[0])==null?void 0:B.transaction)==null?void 0:w.blockNumber,[p,u,k]=await Promise.all([s.callWithRetry(a==null?void 0:a.chainId,()=>o.fundGovernorContract.methods.quorumNumerator(b).call()),s.callWithRetry(a==null?void 0:a.chainId,()=>o.fundGovernorContract.methods.quorumDenominator().call()),s.callWithRetry(a==null?void 0:a.chainId,()=>o.fundGovernanceTokenContract.methods.totalSupply().call({blockNumber:n}))]),d=await Ne(l,k,c,(a==null?void 0:a.governanceToken.decimals)??0,p,u,r.getTimestampForBlock,(y=a==null?void 0:a.clockMode)==null?void 0:y.mode,i??"",(a==null?void 0:a.safeAddress)??"",(a==null?void 0:a.address)??"");return t.storeProposal(a==null?void 0:a.chainId,a==null?void 0:a.address,d),d},nt=async()=>{const e=_(),t=G(),s=j(),o=J(),r=t.fund;if(!r)return;if(!(r!=null&&r.governorAddress))throw new Error("Governor address not found");const a=await o.initializeBlockTimeContext(r.chainId),l=await t.fetchRoleModAddress(r.address);console.log("roleModAddress",l);const c=await s.callWithRetry(r.chainId,()=>t.fundGovernorContract.methods.quorumDenominator().call()),b=(await Ze(r.chainId,{governorAddress:r==null?void 0:r.governorAddress})).map(d=>{var v,f,g,h,S,P,C,B,w;return{proposal:d,timepoint:((v=r==null?void 0:r.clockMode)==null?void 0:v.mode)===V.BlockNumber?(h=(g=(f=d.proposalCreated)==null?void 0:f[0])==null?void 0:g.transaction)==null?void 0:h.blockNumber:(P=(S=d.proposalCreated)==null?void 0:S[0])==null?void 0:P.timestamp,blockNumber:(w=(B=(C=d.proposalCreated)==null?void 0:C[0])==null?void 0:B.transaction)==null?void 0:w.blockNumber}}),n=[...new Set(b.map(d=>JSON.stringify({timepoint:d.timepoint,blockNumber:d.blockNumber})))].map(d=>JSON.parse(d)),p=Object.fromEntries(await Promise.all(n.map(async({timepoint:d,blockNumber:v})=>{const[f,g]=await Promise.all([s.callWithRetry(r.chainId,()=>t.fundGovernorContract.methods.quorumNumerator(d).call()),s.callWithRetry(r.chainId,()=>t.fundGovernanceTokenContract.methods.totalSupply().call({blockNumber:v}))]);return[JSON.stringify({timepoint:d,blockNumber:v}),{quorumNumerator:f,totalSupply:g}]}))),u=b.map(({proposal:d,timepoint:v,blockNumber:f})=>{var P,C;const g=JSON.stringify({timepoint:v,blockNumber:f}),{quorumNumerator:h,totalSupply:S}=p[g];return Ne(d,S,a,((P=r==null?void 0:r.governanceToken)==null?void 0:P.decimals)||18,h,c,o.getTimestampForBlock,(C=r==null?void 0:r.clockMode)==null?void 0:C.mode,l??"",(r==null?void 0:r.safeAddress)??"",(r==null?void 0:r.address)??"")}),k=await Promise.all(u);return e.storeProposals(r.chainId,r==null?void 0:r.address,k),k},_=Ie({id:"governanceProposalStore",state:()=>({fundProposals:{},fundDelegates:{},fundProposalsBlockFetchedRanges:qe("fundProposalsBlockFetchedRanges",{})??{},connectedAccountProposalsHasVoted:{}}),getters:{fundStore(){return G()},toastStore(){return _e()},web3Store(){return j()},blockTimeStore(){return J()},selectedFundChainId(){return this.fundStore.selectedFundChain},selectedFundWeb3Provider(){return this.web3Store.chainProviders[this.selectedFundChainId]}},actions:{async loadFundProposals(){const e=await ke("fundProposals",{});this.fundProposals=e},async loadFundDelegates(){const e=await ke("fundDelegates",{});this.fundDelegates=e},resetProposals(e,t){var o;if(!t)return;const s=(o=this.fundProposals)==null?void 0:o[e];console.debug("this.fundProposals: ",this.fundProposals,typeof this.fundProposals),s||(this.fundProposals[e]={}),this.fundProposals[e][t]={},this.fundProposalsBlockFetchedRanges[e]||(this.fundProposalsBlockFetchedRanges[e]={}),this.fundProposalsBlockFetchedRanges[e][t]=[],A("fundProposals",this.fundProposals),fe("fundProposalsBlockFetchedRanges",this.fundProposalsBlockFetchedRanges)},storeProposal(e,t,s){var o,r;(o=this.fundProposals)[e]??(o[e]={}),(r=this.fundProposals[e])[t]??(r[t]={}),this.fundProposals[e][t][s.proposalId]=R(s),A("fundProposals",this.fundProposals)},storeProposals(e,t,s){var o,r;if(!e){console.error("Cannot store proposals: chainId is required");return}if(!t){console.error("Cannot store proposals: fundAddress is required");return}(o=this.fundProposals)[e]??(o[e]={}),(r=this.fundProposals[e])[t]??(r[t]={}),s.forEach(a=>{this.fundProposals[e][t][a.proposalId]=R(a)}),A("fundProposals",this.fundProposals)},storeDelegates(e,t,s){var o,r;if(!e){console.error("Cannot store delegates: chainId is required");return}if(!t){console.error("Cannot store delegates: fundAddress is required");return}(o=this.fundDelegates)[e]??(o[e]={}),(r=this.fundDelegates[e])[t]??(r[t]={}),s.forEach(a=>{this.fundDelegates[e][t][a.address]=R(a)}),A("fundDelegates",this.fundDelegates)},getProposals(e,t){var r;if(!t)return[];const s=(r=this.fundProposals)==null?void 0:r[e];return s?s[t]?Object.values(this.fundProposals[e][t]):[]:[]},getProposal(e,t,s){var a;if(!t||!s)return;const o=(a=this.fundProposals)==null?void 0:a[e];if(!o)return;const r=o[t];if(r)return r[s]},getDelegates(e,t){var r;if(!t)return[];const s=(r=this.fundDelegates)==null?void 0:r[e];return s?s[t]?Object.values(this.fundDelegates[e][t]):[]:[]},getDelegate(e,t,s){var a,l,c,i;if(!t||!s)return;const o=(a=this.fundDelegates)==null?void 0:a[e];if(!(!o||!o[t]))return(i=(c=(l=this.fundDelegates)==null?void 0:l[e])==null?void 0:c[t])==null?void 0:i[s]},hasAccountVoted(e){var s,o,r;const t=this.fundStore.activeAccountAddress;if(!t)return!1;if(((s=this.connectedAccountProposalsHasVoted)==null?void 0:s[e])!==void 0)return(r=(o=this.connectedAccountProposalsHasVoted)==null?void 0:o[e])==null?void 0:r[t]},getFundProposalsBlockFetchedRanges(e,t){var r;if(!t)return[void 0,void 0];const s=(r=this.fundProposalsBlockFetchedRanges)==null?void 0:r[e];if(!s)return[void 0,void 0];const o=s[t];return o||[void 0,void 0]},setFundProposalsBlockFetchedRanges(e,t,s,o){var a,l;(a=this.fundProposalsBlockFetchedRanges)[e]??(a[e]={}),(l=this.fundProposalsBlockFetchedRanges[e])[t]??(l[t]=[]);const r=this.fundProposalsBlockFetchedRanges[e][t];if(r.length){let c=r[0],i=r[1];s>c&&(c=s),o<i&&(i=o),this.fundProposalsBlockFetchedRanges[e][t]=[c,i]}else this.fundProposalsBlockFetchedRanges[e][t]=[s,o];fe("fundProposalsBlockFetchedRanges",R(this.fundProposalsBlockFetchedRanges))},fetchDelegates(){return $("fetchDelegatesAction",()=>at())},fetchGovernanceProposals(){return $("fetchGovernanceProposalsAction",()=>nt())},fetchGovernanceProposal(e){return $("fetchGovernanceProposalAction",()=>st(e))},decodeProposalCreatedEvent(e){var r,a;if(!e.raw)return;const t=(r=e.raw)==null?void 0:r.topics,s=Ae(ct??[],((a=e.raw)==null?void 0:a.data)??"",t.slice(1)),o=R(s);try{o.descriptionHash=Ge(o.description);const l=JSON.parse(o.description);o.title=l.title,o.description=l.description}catch{o.title=o.description}return console.debug("event decoded"),o},async fetchBlockProposals(e){console.debug("fetchBlockProposals:",e);const t=await this.web3Store.callWithRetry(this.selectedFundChainId,()=>this.fundStore.fundGovernorContract.getPastEvents("ProposalCreated",{fromBlock:e,toBlock:e}));console.debug("fetchBlockProposals events:",t),await this.parseProposalCreatedEvents(t)},async proposalExecutedBlockNumber(e){var t,s;try{if(e.state===F.Executed){const o=Number(await this.selectedFundWeb3Provider.eth.getBlockNumber());console.log("currentBlock:",o);const r=BigInt(e.createdBlockNumber),a=BigInt(o),l=3000n;let c=[];for(let i=r;i<=a;i+=l){const b=i+l-1n>a?a:i+l-1n;console.debug(`Fetching events from ${i} to ${b}`);const n=await this.fundStore.fundGovernorContract.getPastEvents("ProposalExecuted",{fromBlock:Number(i),toBlock:Number(b)});if(c=c.concat(n),console.debug("proposalExecutedEvents: ",c),c.length>0){const p=c.find(u=>u.returnValues.proposalId.toString()===e.proposalId);if(console.debug("proposal executed event: ",p),p){const u=await this.selectedFundWeb3Provider.eth.getBlock(p.blockNumber);console.log("blockExecuted: ",u),e.executedTimestamp=Number(u.timestamp),e.executedBlockNumber=p.blockNumber,console.debug("proposal with executed data:",e),this.storeProposal((t=this.fundStore.fund)==null?void 0:t.chainId,(s=this.fundStore.fund)==null?void 0:s.address,e);break}}}}}catch(o){console.error("error fetching ProposalExecuted: ",o)}},async getBlockPerHoursRate(){const e=await this.blockTimeStore.initializeBlockTimeContext(this.selectedFundChainId),t=e.currentBlock,s=e.currentBlockTimestamp;console.debug(`Current block number: ${t}`),console.debug(`Current block timestamp: ${s}`);const o=3600,r=s-o;let a=0,l=t,c;for(;a<=l;){const b=Math.floor((a+l)/2),n=await this.selectedFundWeb3Provider.eth.getBlock(b),p=Number(n.timestamp);if(p<r)a=b+1;else if(p>r)l=b-1;else{c=n;break}if(Math.abs(p-r)<o/10){c=n;break}}c||(c=await this.selectedFundWeb3Provider.eth.getBlock(l));const i=(t-Number(c.number))/((s-Number(c.timestamp))/o);return console.debug(`Blocks per hour rate: ${i}`),i},async setProposalVoteStartEndTimestamp(e){var t,s,o,r;if(((s=(t=this.fundStore.fund)==null?void 0:t.clockMode)==null?void 0:s.mode)===V.Timestamp){e.voteStartTimestamp=e.voteStart,e.voteEndTimestamp=e.voteEnd;return}if(((r=(o=this.fundStore.fund)==null?void 0:o.clockMode)==null?void 0:r.mode)!==V.BlockNumber){e.voteEndTimestamp=void 0,e.voteStartTimestamp=void 0;return}try{const a=await this.blockTimeStore.initializeBlockTimeContext(this.selectedFundChainId),l=a.currentBlock,c=a.currentBlockTimestamp;if(console.debug("currentBlockNumber: ",l,"currentBlockTimestamp",c),Number(e.voteEnd)<=l){console.debug("fetch blockEnd");const i=await this.selectedFundWeb3Provider.eth.getBlock(e.voteEnd);console.debug("blockEnd: ",i),e.voteEndTimestamp=i==null?void 0:i.timestamp.toString()}else{console.log("estimate blockEnd");const i=await this.blockTimeStore.getTimestampForBlock(Number(e.voteEnd));console.log("estimatedEndTimestamp: ",i),e.voteEndTimestamp=i.toString()}if(Number(e.voteStart)<=l){console.debug("fetch blockStart");const i=await this.selectedFundWeb3Provider.eth.getBlock(e.voteStart);console.debug("blockStart: ",i),e.voteStartTimestamp=i==null?void 0:i.timestamp.toString()}else{console.debug("estimate blockStart");const i=await this.blockTimeStore.getTimestampForBlock(Number(e.voteStart));console.debug("estimatedStartTimestamp: ",i),e.voteStartTimestamp=i.toString()}}catch{console.error("failed fetching proposal vote start end timestamps for ",e)}},async parseProposalCreatedEvents(e){var s,o,r,a,l,c,i;if(!(e!=null&&e.length))return;const t=this.fundStore.fund;if(!(t!=null&&t.governanceToken.decimals)){console.error("No vault governance token decimals found."),this.toastStore.errorToast("No vault governance token decimals found.");return}if(!((s=t.clockMode)!=null&&s.mode)){console.error("Vault clock mode is unknown."),this.toastStore.errorToast("Vault clock mode is unknown.");return}for(const b of e){console.debug("event"),console.debug(b);const n=this.decodeProposalCreatedEvent(b);if(!n)continue;const p=await this.selectedFundWeb3Provider.eth.getBlock(b.blockNumber);n.createdTimestamp=Number(p.timestamp),n.createdDatetimeFormatted=je(new Date(Number(p.timestamp)*1e3)),n.createdBlockNumber=b.blockNumber;const u=(a=(r=(o=this.fundProposals)==null?void 0:o[t.chainId])==null?void 0:r[t==null?void 0:t.address])==null?void 0:a[n.proposalId];n.executedTimestamp=u==null?void 0:u.executedTimestamp,n.executedBlockNumber=u==null?void 0:u.executedBlockNumber;const k=await this.web3Store.callWithRetry(this.selectedFundChainId,()=>this.fundStore.fundGovernorContract.methods.state(n.proposalId).call());n.state=tt[k],console.debug("proposal: ",n),await this.setProposalVoteStartEndTimestamp(n),console.debug("proposal:",n);const d=await this.web3Store.callWithRetry(this.selectedFundChainId,()=>this.fundStore.fundGovernorContract.methods.proposalVotes(n.proposalId).call());console.debug("proposal votes: ",d),console.debug("get total supply at blockNumber: ",n.createdBlockNumber);let v;try{v=await this.web3Store.callWithRetry(this.selectedFundChainId,()=>this.fundStore.fundGovernanceTokenContract.methods.totalSupply().call({},n.createdBlockNumber)),n.totalSupply=v,n.totalSupplyFormatted=N(v,(l=t==null?void 0:t.governanceToken)==null?void 0:l.decimals,!1)}catch(g){console.error("failed fetching total supply",g),n.totalSupplyFormatted="N/A"}console.debug("proposal created blockNumber ",n.createdBlockNumber," timestamp ",n.createdTimestamp);try{const g=((c=t==null?void 0:t.clockMode)==null?void 0:c.mode)===V.BlockNumber?n.createdBlockNumber:n.createdTimestamp,h=await this.web3Store.callWithRetry(this.selectedFundChainId,()=>this.fundStore.fundGovernorContract.methods.quorumNumerator(g).call());n.quorumVotes=h,n.quorumVotesFormatted=N(h,(i=t==null?void 0:t.governanceToken)==null?void 0:i.decimals,!1)}catch(g){console.error("error fetching quorumVotes: ",g),n.quorumVotesFormatted="N/A"}if(console.debug("parse votes",d),d){const g=d.forVotes+d.abstainVotes+d.againstVotes;if(n.totalVotes=g,n.totalVotesFormatted=N(g,t==null?void 0:t.governanceToken.decimals,!1),n.forVotes=d.forVotes,n.abstainVotes=d.abstainVotes,n.againstVotes=d.againstVotes,n.forVotesFormatted=N(d.forVotes,t==null?void 0:t.governanceToken.decimals,!1),n.abstainVotesFormatted=N(d.abstainVotes,t==null?void 0:t.governanceToken.decimals,!1),n.againstVotesFormatted=N(d.againstVotes,t==null?void 0:t.governanceToken.decimals,!1),console.log("proposal votes",n),n.quorumVotes===0n&&Number(d.forVotes)>0)n.approval=1,n.approvalFormatted=M(n.approval,!1);else if(n.quorumVotes){let h=Number(d.forVotes)/Number(n.quorumVotes);h>1&&(h=1),n.approval=h,n.approvalFormatted=M(h,!1)}else n.approvalFormatted="N/A";if(v){let h=Number(g)/Number(v);h>1&&(h=1),n.participation=h,n.participationFormatted=M(h,!1)}else n.participationFormatted="N/A"}n.calldatasDecoded=[],n.calldataTypes=[];const f=await this.fundStore.fetchRoleModAddress(t.address);n.calldatas.forEach((g,h)=>{const S=Q(f,g,n.targets[h],t==null?void 0:t.safeAddress,t==null?void 0:t.address);n.calldataTypes.push(S==null?void 0:S.calldataType),n.calldatasDecoded.push(S)}),n.calldataTags=[...new Set(n.calldataTypes.filter(g=>g!==D.UNDEFINED&&g!==void 0))],this.storeProposal(t==null?void 0:t.chainId,t==null?void 0:t.address,n)}}}});var Se;const ct=((Se=Ue.abi.find(e=>e.name==="ProposalCreated"&&e.type==="event"))==null?void 0:Se.inputs)??[];We(()=>{const e=_();e.loadFundProposals(),e.loadFundDelegates()});export{F as P,vt as V,gt as _,D as a,kt as b,ht as c,Ye as d,ft as e,bt as f,_ as u};
