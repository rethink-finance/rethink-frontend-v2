import Ee from"./BwJmYA3U.js";import{d as Fe,D as Be,e as Ce,F as De,h as U,o as ye,cq as H,eM as Te,eN as R,eE as Ve,eO as V,eP as Ie,d9 as P,l as Re,t as xe,u as j,ec as qe,eQ as Ae,eR as Ge,ed as M,eS as We,eT as _e,eU as ve,b as Oe,cr as Me}from"./DMAfeIv4.js";import{w as $e,G as Le,Z as Ue,N as He,u as W,R as je,x as $,s as G,g as fe}from"./C3vEfdxw.js";import{g as Q}from"./CHpfWvR_.js";import{u as Ne}from"./DOUkRbDP.js";const pt=Fe({__name:"ProposalStateChip",props:{value:{type:String,default:""}},setup(e){const t=e,a=Be(()=>{var o;return`proposal_state_${((o=t.value)==null?void 0:o.toLowerCase())??"undefined"}`});return(o,r)=>{const n=Ee;return ye(),Ce(n,{value:e.value,class:De(U(a)),uppercase:"",bold:""},null,8,["value","class"])}}}),Qe=Q`
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
      calls {
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
`,Je=Q`
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
      calls {
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
`,ze=Q`
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
`,Ze=async(e,t)=>{const a=H().$getApolloClient(e);if(!a)throw new Error("Apollo client not found");try{const{data:o}=await a.query({query:Qe,variables:{governorAddress:t.governorAddress},fetchPolicy:"network-only"});if(console.log("fetched data of proposals",o),!o||!o.proposals)throw new Error("Received no data or events!");return o.proposals}catch(o){throw console.error("Error fetching governor proposals:",o),o}},Ke=async(e,t)=>{const a=H().$getApolloClient(e);if(!a)throw new Error("Apollo client not found");try{const{data:o}=await a.query({query:Je,variables:{governorAddress:t.governorAddress,proposalId:t.proposalId},fetchPolicy:"network-only"});if(!o||!o.proposals)throw new Error("Received no data or events!");return o.proposals[0]}catch(o){throw console.error("Error fetching governor proposal:",o),o}},Xe=async(e,t)=>{const a=H().$getApolloClient(e);if(!a)throw new Error("Apollo client not found");try{const{data:o}=await a.query({query:ze,variables:{votingContract:t.votingContract}});if(console.log("fetchSubgraphDelegates data: ",o),!o||!o.votingContract)throw new Error("Received no data or events!");return o.votingContract}catch(o){throw console.error("Error fetching subgraph delegates response:",o),o}};var D=(e=>(e.Pending="Pending",e.Active="Active",e.Canceled="Canceled",e.Defeated="Defeated",e.Succeeded="Succeeded",e.Queued="Queued",e.Expired="Expired",e.Executed="Executed",e))(D||{}),Ye=(e=>(e.Against="Reject",e.For="Approve",e.Abstain="Abstain",e))(Ye||{});const et={0:"Reject",1:"Approve",2:"Abstain"},tt={0:"Pending",1:"Active",2:"Canceled",3:"Defeated",4:"Succeeded",5:"Queued",6:"Expired",7:"Executed"},gt={Reject:0,Approve:1,Abstain:2},ht={1:"Approve",0:"Reject",2:"Abstain"},bt={Approve:"material-symbols:done",Reject:"material-symbols:close",Abstain:"material-symbols:question-mark"},vt={Approve:"for",Reject:"against",Abstain:"abstain"};var y=(e=>(e.NAV_UPDATE="NAV Update",e.DIRECT_EXECUTION="Direct Execution",e.PERMISSIONS="Permissions",e.FUND_SETTINGS="Fund Settings",e.UNDEFINED="Undefined",e))(y||{});const J=(e,t,a,o,r)=>{var s,p;const n=t.slice(0,10),i=t.slice(10),c=L[n],m={functionName:void 0,contractName:void 0,calldataType:void 0,calldataDecoded:void 0,calldata:t};if(console.log("sig",n,c),!((s=c==null?void 0:c.function)!=null&&s.name))return console.warn("No existing function signature found in the GovernableFund ABI for ",n,c),m;const u=(p=c==null?void 0:c.function)==null?void 0:p.inputs;try{let l=Te(u,i);l=R(l);let k=y.UNDEFINED;const h=c.function.name,g=a.toLocaleLowerCase();if(h==="updateNav")k=y.NAV_UPDATE;else if(g===(o==null?void 0:o.toLocaleLowerCase()))k=y.DIRECT_EXECUTION;else if(g===(e==null?void 0:e.toLocaleLowerCase()))k=y.PERMISSIONS;else if(h==="updateSettings")k=y.FUND_SETTINGS;else if(h==="storeNAVData")try{if(r&&(l==null?void 0:l.oiv)===r){const f=J(e,(l==null?void 0:l.data)??"",a,o,r);f!=null&&f.calldataDecoded&&(l=f==null?void 0:f.calldataDecoded),k=y.NAV_UPDATE}}catch(f){console.error("Failed decoding storeNAVData NAV methods",t,f)}return{functionName:h,contractName:c.contractName,calldataType:k,calldataDecoded:l,calldata:t}}catch(l){console.error("error while decoding signature: ",n,l)}return console.error("FAILED decoding signature: ",n,L[n]),m},L={},ot=[{abi:$e.abi,name:"GovernableFund"},{abi:Le.abi,name:"GnosisSafeL2"},{abi:Ue.abi,name:"ZodiacRoles"},{abi:He.abi,name:"NAVExecutor"}];ot.forEach(e=>{e.abi.forEach(t=>{if(t.type==="function"){const a=Ve(t);L[a]={function:t,contractName:e.name}}})});async function Pe(e,t,a,o,r,n,i,c,m,u,s){var Y,ee,te,oe,re,ae,se,ne,ce,ie,le,ue,de,me,pe,ge,he,be;let p,l;c===V.Timestamp?(p=e.voteStart,l=e.voteEnd):c===V.BlockNumber?(p=await i(Number(e.voteStart),a),l=await i(Number(e.voteEnd),a)):(p=0,l=0);const h=(d=>{try{const F=JSON.parse(d);return{title:F.title,description:F.description}}catch{return{title:d.split(`
`)[0],description:d}}})(e.description),g=e.calls.map(d=>d.calldata),f=e.calls.map(d=>d.value),v=e.calls.map(d=>d.signature),b=e.calls.map(d=>d.target.id),N=[],w=[];g.forEach((d,F)=>{const A=J(m,d,b[F],u,s);N.push(A),w.push(A==null?void 0:A.calldataType)});const B=[...new Set(w.filter(d=>d!==y.UNDEFINED&&d!==void 0))],S=e.receipts||[],E=S.filter(d=>d.support.support===1).reduce((d,F)=>d+BigInt(F.weight),BigInt(0)),C=S.filter(d=>d.support.support===0).reduce((d,F)=>d+BigInt(F.weight),BigInt(0)),I=S.filter(d=>d.support.support===2).reduce((d,F)=>d+BigInt(F.weight),BigInt(0)),x=E+C+I,z=Number(x),Se=Number(E),Z=Number(t||0),O=BigInt(t)*BigInt(r)/BigInt(n),K=x>BigInt(0)?Math.min(Se/z*100,100):0,X=Z>0?Math.min(z/Z*100,100):0;let T;const q=Math.floor(Date.now()/1e3);(ee=(Y=e.proposalCanceled)==null?void 0:Y[0])!=null&&ee.timestamp?T=D.Canceled:(oe=(te=e.proposalExecuted)==null?void 0:te[0])!=null&&oe.timestamp?T=D.Executed:(ae=(re=e.proposalQueued)==null?void 0:re[0])!=null&&ae.timestamp?T=D.Queued:q<Number(p)?T=D.Pending:q>=Number(p)&&q<Number(l)?T=D.Active:q>=Number(l)?T=x>=O&&E>C?D.Succeeded:D.Defeated:T=D.Pending;const we=(e.receipts??[]).map(d=>({proposalId:e.proposalId.toString(),proposer:d.voter.id,my_vote:!1,submission_status:et[d.support.support],quorumVotes:P(BigInt(d.weight),o,!1,!0),date:Ie(new Date(Number(d.voteCasts[0].transaction.timestamp)*1e3),!1),blockNumber:d.voteCasts[0].transaction.blockNumber}));return{proposalId:e.proposalId.toString(),proposer:e.proposer.id,title:h.title,description:h.description,voteStart:e.voteStart.toString(),voteEnd:e.voteEnd.toString(),voteStartTimestamp:p==null?void 0:p.toString(),voteEndTimestamp:l==null?void 0:l.toString(),createdTimestamp:Number((ne=(se=e.proposalCreated)==null?void 0:se[0])==null?void 0:ne.timestamp),executedTimestamp:Number((ie=(ce=e.proposalExecuted)==null?void 0:ce[0])==null?void 0:ie.timestamp),createdDatetimeFormatted:(ue=(le=e.proposalCreated)==null?void 0:le[0])!=null&&ue.timestamp?new Date(Number(e.proposalCreated[0].timestamp)*1e3).toDateString():new Date().toDateString(),targets:b,values:f,signatures:v,calldatas:g,descriptionHash:Re(xe(e.description)),calldatasDecoded:N,calldataTypes:w,calldataTags:B,state:T,createdBlockNumber:BigInt(((pe=(me=(de=e.proposalCreated)==null?void 0:de[0])==null?void 0:me.transaction)==null?void 0:pe.blockNumber)??"0"),executedBlockNumber:BigInt(((be=(he=(ge=e.proposalExecuted)==null?void 0:ge[0])==null?void 0:he.transaction)==null?void 0:be.blockNumber)??"0"),approval:K/100,approvalFormatted:`${parseFloat(K.toFixed(2))}%`,participation:X/100,participationFormatted:`${parseFloat(X.toFixed(2))}%`,quorumVotes:O,quorumVotesFormatted:P(O,o,!1),forVotes:E,forVotesFormatted:P(E,o,!1),againstVotes:C,againstVotesFormatted:P(C,o,!1),abstainVotes:I,abstainVotesFormatted:P(I,o,!1),totalVotes:x,totalVotesFormatted:P(BigInt(x),o,!1),totalSupply:BigInt(t),totalSupplyFormatted:P(BigInt(t),o,!1),voteSubmissions:we}}function rt(e,t){var o;if(!(e!=null&&e.weight))return[];const a=((o=e.totalWeight)==null?void 0:o.value)||"0";return e.weight.map(r=>{var c,m,u;const n=((m=(c=r.account)==null?void 0:c.delegationFrom)==null?void 0:m.map(s=>{var p,l,k;return{address:s.delegator.id||"",weight:((k=(l=(p=s.delegator)==null?void 0:p.voteWeigth)==null?void 0:l[0])==null?void 0:k.value)||"0"}}))||[],i=a!=="0"?(Number(r.value||0)/Number(a)*100).toFixed(2):"0";return{address:((u=r.account)==null?void 0:u.id)||"",delegators:n,delegatorCount:n.length,votingPower:P(BigInt(r.value||"0"),t,!1),votingPowerPercent:`${i}%`}})}function ft(e){return e.map(t=>({delegatedMember:t.address,delegators:t.delegators.map(a=>a.address),delegatorsEvents:[],impact:t.votingPowerPercent,votingPower:t.votingPower}))}const at=async()=>{var i,c;const e=W(),t=_(),a=U(e.fund);if(!a)return;const o=(i=a==null?void 0:a.governanceToken)==null?void 0:i.address;if(!o)throw new Error("Governor token address not found");const r=await Xe(a.chainId,{votingContract:o}),n=rt(r,((c=a==null?void 0:a.governanceToken)==null?void 0:c.decimals)||18);return t.storeDelegates(a==null?void 0:a.chainId,a==null?void 0:a.address,n),console.log("processedDelegates: ",n),r},st=async e=>{var f,v,b,N,w,B,S,E,C,I;const t=_(),a=j(),o=W(),r=U(o.fund);if(!r)return;if(!(r!=null&&r.governorAddress))throw new Error("Governor address not found");if(!e)throw new Error("Proposal ID not found");const n=await Ke(r==null?void 0:r.chainId,{governorAddress:r==null?void 0:r.governorAddress,proposalId:e}),{initializeBlockTimeContext:i,getTimestampForBlock:c}=Ne(),m=await i(t.getWeb3InstanceByChainId()),u=await o.getRoleModAddress(r.address),s=((f=r==null?void 0:r.clockMode)==null?void 0:f.mode)===V.BlockNumber?(N=(b=(v=n.proposalCreated)==null?void 0:v[0])==null?void 0:b.transaction)==null?void 0:N.blockNumber:(B=(w=n.proposalCreated)==null?void 0:w[0])==null?void 0:B.timestamp,p=(C=(E=(S=n.proposalCreated)==null?void 0:S[0])==null?void 0:E.transaction)==null?void 0:C.blockNumber,[l,k,h]=await Promise.all([a.callWithRetry(r==null?void 0:r.chainId,()=>o.fundGovernorContract.methods.quorumNumerator(s).call()),a.callWithRetry(r==null?void 0:r.chainId,()=>o.fundGovernorContract.methods.quorumDenominator().call()),a.callWithRetry(r==null?void 0:r.chainId,()=>o.fundGovernanceTokenContract.methods.totalSupply().call({blockNumber:p}))]),g=await Pe(n,h,m,(r==null?void 0:r.governanceToken.decimals)??0,l,k,c,(I=r==null?void 0:r.clockMode)==null?void 0:I.mode,u??"",(r==null?void 0:r.safeAddress)??"",(r==null?void 0:r.address)??"");return t.storeProposal(r==null?void 0:r.chainId,r==null?void 0:r.address,g),g},nt=async()=>{const e=_(),t=W(),a=j(),o=t.fund;if(!o)return;if(!(o!=null&&o.governorAddress))throw new Error("Governor address not found");const{initializeBlockTimeContext:r,getTimestampForBlock:n}=Ne(),i=await r(e.getWeb3InstanceByChainId()),c=await t.getRoleModAddress(o.address);console.log("roleModAddress",c);const m=await a.callWithRetry(o.chainId,()=>t.fundGovernorContract.methods.quorumDenominator().call()),s=(await Ze(o.chainId,{governorAddress:o==null?void 0:o.governorAddress})).map(g=>{var f,v,b,N,w,B,S,E,C;return{proposal:g,timepoint:((f=o==null?void 0:o.clockMode)==null?void 0:f.mode)===V.BlockNumber?(N=(b=(v=g.proposalCreated)==null?void 0:v[0])==null?void 0:b.transaction)==null?void 0:N.blockNumber:(B=(w=g.proposalCreated)==null?void 0:w[0])==null?void 0:B.timestamp,blockNumber:(C=(E=(S=g.proposalCreated)==null?void 0:S[0])==null?void 0:E.transaction)==null?void 0:C.blockNumber}}),p=[...new Set(s.map(g=>JSON.stringify({timepoint:g.timepoint,blockNumber:g.blockNumber})))].map(g=>JSON.parse(g)),l=Object.fromEntries(await Promise.all(p.map(async({timepoint:g,blockNumber:f})=>{const[v,b]=await Promise.all([a.callWithRetry(o.chainId,()=>t.fundGovernorContract.methods.quorumNumerator(g).call()),a.callWithRetry(o.chainId,()=>t.fundGovernanceTokenContract.methods.totalSupply().call({blockNumber:f}))]);return[JSON.stringify({timepoint:g,blockNumber:f}),{quorumNumerator:v,totalSupply:b}]}))),k=s.map(({proposal:g,timepoint:f,blockNumber:v})=>{var B,S;const b=JSON.stringify({timepoint:f,blockNumber:v}),{quorumNumerator:N,totalSupply:w}=l[b];return Pe(g,w,i,((B=o==null?void 0:o.governanceToken)==null?void 0:B.decimals)||18,N,m,n,(S=o==null?void 0:o.clockMode)==null?void 0:S.mode,c??"",(o==null?void 0:o.safeAddress)??"",(o==null?void 0:o.address)??"")}),h=await Promise.all(k);return e.storeProposals(o.chainId,o==null?void 0:o.address,h),h},_=qe({id:"governanceProposalStore",state:()=>({fundProposals:{},fundDelegates:{},fundProposalsBlockFetchedRanges:Ae("fundProposalsBlockFetchedRanges",{})??{},connectedAccountProposalsHasVoted:{}}),getters:{fundStore(){return W()},toastStore(){return Oe()},web3Store(){return j()},selectedFundChainId(){return this.fundStore.selectedFundChain},selectedFundWeb3Provider(){return this.web3Store.chainProviders[this.selectedFundChainId]}},actions:{async loadFundProposals(){const e=await fe("fundProposals",{});this.fundProposals=e},async loadFundDelegates(){const e=await fe("fundDelegates",{});this.fundDelegates=e},resetProposals(e,t){var o;if(!t)return;const a=(o=this.fundProposals)==null?void 0:o[e];console.debug("this.fundProposals: ",this.fundProposals,typeof this.fundProposals),a||(this.fundProposals[e]={}),this.fundProposals[e][t]={},this.fundProposalsBlockFetchedRanges[e]||(this.fundProposalsBlockFetchedRanges[e]={}),this.fundProposalsBlockFetchedRanges[e][t]=[],G("fundProposals",this.fundProposals),ve("fundProposalsBlockFetchedRanges",this.fundProposalsBlockFetchedRanges)},storeProposal(e,t,a){var o,r;(o=this.fundProposals)[e]??(o[e]={}),(r=this.fundProposals[e])[t]??(r[t]={}),this.fundProposals[e][t][a.proposalId]=R(a),G("fundProposals",this.fundProposals)},storeProposals(e,t,a){var o,r;if(!e){console.error("Cannot store proposals: chainId is required");return}if(!t){console.error("Cannot store proposals: fundAddress is required");return}(o=this.fundProposals)[e]??(o[e]={}),(r=this.fundProposals[e])[t]??(r[t]={}),a.forEach(n=>{this.fundProposals[e][t][n.proposalId]=R(n)}),G("fundProposals",this.fundProposals)},storeDelegates(e,t,a){var o,r;if(!e){console.error("Cannot store delegates: chainId is required");return}if(!t){console.error("Cannot store delegates: fundAddress is required");return}(o=this.fundDelegates)[e]??(o[e]={}),(r=this.fundDelegates[e])[t]??(r[t]={}),a.forEach(n=>{this.fundDelegates[e][t][n.address]=R(n)}),G("fundDelegates",this.fundDelegates)},getProposals(e,t){var r;if(!t)return[];const a=(r=this.fundProposals)==null?void 0:r[e];return a?a[t]?Object.values(this.fundProposals[e][t]):[]:[]},getProposal(e,t,a){var n;if(!t||!a)return;const o=(n=this.fundProposals)==null?void 0:n[e];if(!o)return;const r=o[t];if(r)return r[a]},getDelegates(e,t){var r;if(!t)return[];const a=(r=this.fundDelegates)==null?void 0:r[e];return a?a[t]?Object.values(this.fundDelegates[e][t]):[]:[]},getDelegate(e,t,a){var n,i,c,m;if(!t||!a)return;const o=(n=this.fundDelegates)==null?void 0:n[e];if(!(!o||!o[t]))return(m=(c=(i=this.fundDelegates)==null?void 0:i[e])==null?void 0:c[t])==null?void 0:m[a]},hasAccountVoted(e){var a,o,r;const t=this.fundStore.activeAccountAddress;if(!t)return!1;if(((a=this.connectedAccountProposalsHasVoted)==null?void 0:a[e])!==void 0)return(r=(o=this.connectedAccountProposalsHasVoted)==null?void 0:o[e])==null?void 0:r[t]},getFundProposalsBlockFetchedRanges(e,t){var r;if(!t)return[void 0,void 0];const a=(r=this.fundProposalsBlockFetchedRanges)==null?void 0:r[e];if(!a)return[void 0,void 0];const o=a[t];return o||[void 0,void 0]},setFundProposalsBlockFetchedRanges(e,t,a,o){var n,i;(n=this.fundProposalsBlockFetchedRanges)[e]??(n[e]={}),(i=this.fundProposalsBlockFetchedRanges[e])[t]??(i[t]=[]);const r=this.fundProposalsBlockFetchedRanges[e][t];if(r.length){let c=r[0],m=r[1];a>c&&(c=a),o<m&&(m=o),this.fundProposalsBlockFetchedRanges[e][t]=[c,m]}else this.fundProposalsBlockFetchedRanges[e][t]=[a,o];ve("fundProposalsBlockFetchedRanges",R(this.fundProposalsBlockFetchedRanges))},fetchDelegates(){return $("fetchDelegatesAction",()=>at())},fetchGovernanceProposals(){return $("fetchGovernanceProposalsAction",()=>nt())},fetchGovernanceProposal(e){return $("fetchGovernanceProposalAction",()=>st(e))},decodeProposalCreatedEvent(e){var r,n;if(!e.raw)return;const t=(r=e.raw)==null?void 0:r.topics,a=We(ct??[],((n=e.raw)==null?void 0:n.data)??"",t.slice(1)),o=R(a);try{o.descriptionHash=_e(o.description);const i=JSON.parse(o.description);o.title=i.title,o.description=i.description}catch{o.title=o.description}return console.debug("event decoded"),o},async fetchBlockProposals(e){console.debug("fetchBlockProposals:",e);const t=await this.web3Store.callWithRetry(this.selectedFundChainId,()=>this.fundStore.fundGovernorContract.getPastEvents("ProposalCreated",{fromBlock:e,toBlock:e}));console.debug("fetchBlockProposals events:",t),await this.parseProposalCreatedEvents(t)},async proposalExecutedBlockNumber(e){var t,a;try{if(e.state===D.Executed){const o=Number(await this.selectedFundWeb3Provider.eth.getBlockNumber());console.log("currentBlock:",o);const r=BigInt(e.createdBlockNumber),n=BigInt(o),i=3000n;let c=[];for(let m=r;m<=n;m+=i){const u=m+i-1n>n?n:m+i-1n;console.debug(`Fetching events from ${m} to ${u}`);const s=await this.fundStore.fundGovernorContract.getPastEvents("ProposalExecuted",{fromBlock:Number(m),toBlock:Number(u)});if(c=c.concat(s),console.debug("proposalExecutedEvents: ",c),c.length>0){const p=c.find(l=>l.returnValues.proposalId.toString()===e.proposalId);if(console.debug("proposal executed event: ",p),p){const l=await this.selectedFundWeb3Provider.eth.getBlock(p.blockNumber);console.log("blockExecuted: ",l),e.executedTimestamp=Number(l.timestamp),e.executedBlockNumber=p.blockNumber,console.debug("proposal with executed data:",e),this.storeProposal((t=this.fundStore.fund)==null?void 0:t.chainId,(a=this.fundStore.fund)==null?void 0:a.address,e);break}}}}}catch(o){console.error("error fetching ProposalExecuted: ",o)}},async getBlockPerHoursRate(){this.getWeb3InstanceByChainId();const e=await this.selectedFundWeb3Provider.eth.getBlock("latest"),t=Number(e.number),a=Number(e.timestamp);console.debug(`Current block number: ${t}`),console.debug(`Current block timestamp: ${a}`);const o=3600,r=a-o;let n=0,i=t,c;for(;n<=i;){const u=Math.floor((n+i)/2),s=await this.selectedFundWeb3Provider.eth.getBlock(u),p=Number(s.timestamp);if(p<r)n=u+1;else if(p>r)i=u-1;else{c=s;break}if(Math.abs(p-r)<o/10){c=s;break}}c||(c=await this.selectedFundWeb3Provider.eth.getBlock(i));const m=(t-Number(c.number))/((a-Number(c.timestamp))/o);return console.debug(`Blocks per hour rate: ${m}`),m},async estimateTimestampFromBlockNumber(e,t,a){const r=await this.getBlockPerHoursRate()/3600,i=(a-e)/r;return t+i},getWeb3InstanceByChainId(){const e={"0xa4b1":"0x1"},t=this.fundStore.selectedFundChain,a=e[t];return a?(console.debug("chainIdMapKey: ",a),this.web3Store.chainProviders[a]):(console.debug("use the current web3"),this.web3Store.chainProviders[t])},async setProposalVoteStartEndTimestamp(e){var t,a,o,r;if(((a=(t=this.fundStore.fund)==null?void 0:t.clockMode)==null?void 0:a.mode)===V.Timestamp){e.voteStartTimestamp=e.voteStart,e.voteEndTimestamp=e.voteEnd;return}if(((r=(o=this.fundStore.fund)==null?void 0:o.clockMode)==null?void 0:r.mode)!==V.BlockNumber){e.voteEndTimestamp=void 0,e.voteStartTimestamp=void 0;return}try{const n=this.getWeb3InstanceByChainId(),i=await this.selectedFundWeb3Provider.eth.getBlock("latest"),c=Number(i.number),m=Number(i.timestamp);if(console.debug("currentBlock: ",i),Number(e.voteEnd)<=c){console.debug("fetch blockEnd");const u=await this.selectedFundWeb3Provider.eth.getBlock(e.voteEnd);console.debug("blockEnd: ",u),e.voteEndTimestamp=u==null?void 0:u.timestamp.toString()}else{console.log("estimate blockEnd");const u=await this.estimateTimestampFromBlockNumber(c,m,Number(e.voteEnd));console.log("estimatedEndTimestamp: ",u),e.voteEndTimestamp=u.toString()}if(Number(e.voteStart)<=c){console.debug("fetch blockStart");const u=await this.selectedFundWeb3Provider.eth.getBlock(e.voteStart);console.debug("blockStart: ",u),e.voteStartTimestamp=u==null?void 0:u.timestamp.toString()}else{console.debug("estimate blockStart");const u=await this.estimateTimestampFromBlockNumber(c,m,Number(e.voteStart));console.debug("estimatedStartTimestamp: ",u),e.voteStartTimestamp=u.toString()}}catch{console.error("failed fetching proposal vote start end timestamps for ",e)}},async parseProposalCreatedEvents(e){var a,o,r,n,i,c,m;if(!(e!=null&&e.length))return;const t=this.fundStore.fund;if(!(t!=null&&t.governanceToken.decimals)){console.error("No OIV governance token decimals found."),this.toastStore.errorToast("No OIV governance token decimals found.");return}if(!((a=t.clockMode)!=null&&a.mode)){console.error("OIV clock mode is unknown."),this.toastStore.errorToast("OIV clock mode is unknown.");return}for(const u of e){console.debug("event"),console.debug(u);const s=this.decodeProposalCreatedEvent(u);if(!s)continue;const p=await this.selectedFundWeb3Provider.eth.getBlock(u.blockNumber);s.createdTimestamp=Number(p.timestamp),s.createdDatetimeFormatted=Ge(new Date(Number(p.timestamp)*1e3)),s.createdBlockNumber=u.blockNumber;const l=(n=(r=(o=this.fundProposals)==null?void 0:o[t.chainId])==null?void 0:r[t==null?void 0:t.address])==null?void 0:n[s.proposalId];s.executedTimestamp=l==null?void 0:l.executedTimestamp,s.executedBlockNumber=l==null?void 0:l.executedBlockNumber;const k=await this.web3Store.callWithRetry(this.selectedFundChainId,()=>this.fundStore.fundGovernorContract.methods.state(s.proposalId).call());s.state=tt[k],console.debug("proposal: ",s),await this.setProposalVoteStartEndTimestamp(s),console.debug("proposal:",s);const h=await this.web3Store.callWithRetry(this.selectedFundChainId,()=>this.fundStore.fundGovernorContract.methods.proposalVotes(s.proposalId).call());console.debug("proposal votes: ",h),console.debug("get total supply at blockNumber: ",s.createdBlockNumber);let g;try{g=await this.web3Store.callWithRetry(this.selectedFundChainId,()=>this.fundStore.fundGovernanceTokenContract.methods.totalSupply().call({},s.createdBlockNumber)),s.totalSupply=g,s.totalSupplyFormatted=P(g,(i=t==null?void 0:t.governanceToken)==null?void 0:i.decimals,!1)}catch(v){console.error("failed fetching total supply",v),s.totalSupplyFormatted="N/A"}console.debug("proposal created blockNumber ",s.createdBlockNumber," timestamp ",s.createdTimestamp);try{const v=((c=t==null?void 0:t.clockMode)==null?void 0:c.mode)===V.BlockNumber?s.createdBlockNumber:s.createdTimestamp,b=await this.web3Store.callWithRetry(this.selectedFundChainId,()=>this.fundStore.fundGovernorContract.methods.quorumNumerator(v).call());s.quorumVotes=b,s.quorumVotesFormatted=P(b,(m=t==null?void 0:t.governanceToken)==null?void 0:m.decimals,!1)}catch(v){console.error("error fetching quorumVotes: ",v),s.quorumVotesFormatted="N/A"}if(console.debug("parse votes",h),h){const v=h.forVotes+h.abstainVotes+h.againstVotes;if(s.totalVotes=v,s.totalVotesFormatted=P(v,t==null?void 0:t.governanceToken.decimals,!1),s.forVotes=h.forVotes,s.abstainVotes=h.abstainVotes,s.againstVotes=h.againstVotes,s.forVotesFormatted=P(h.forVotes,t==null?void 0:t.governanceToken.decimals,!1),s.abstainVotesFormatted=P(h.abstainVotes,t==null?void 0:t.governanceToken.decimals,!1),s.againstVotesFormatted=P(h.againstVotes,t==null?void 0:t.governanceToken.decimals,!1),console.log("proposal votes",s),s.quorumVotes===0n&&Number(h.forVotes)>0)s.approval=1,s.approvalFormatted=M(s.approval,!1);else if(s.quorumVotes){let b=Number(h.forVotes)/Number(s.quorumVotes);b>1&&(b=1),s.approval=b,s.approvalFormatted=M(b,!1)}else s.approvalFormatted="N/A";if(g){let b=Number(v)/Number(g);b>1&&(b=1),s.participation=b,s.participationFormatted=M(b,!1)}else s.participationFormatted="N/A"}s.calldatasDecoded=[],s.calldataTypes=[];const f=await this.fundStore.getRoleModAddress(t.address);s.calldatas.forEach((v,b)=>{const N=J(f,v,s.targets[b],t==null?void 0:t.safeAddress,t==null?void 0:t.address);s.calldataTypes.push(N==null?void 0:N.calldataType),s.calldatasDecoded.push(N)}),s.calldataTags=[...new Set(s.calldataTypes.filter(v=>v!==y.UNDEFINED&&v!==void 0))],this.storeProposal(t==null?void 0:t.chainId,t==null?void 0:t.address,s)}}}});var ke;const ct=((ke=je.abi.find(e=>e.name==="ProposalCreated"&&e.type==="event"))==null?void 0:ke.inputs)??[];Me(()=>{const e=_();e.loadFundProposals(),e.loadFundDelegates()});export{D as P,bt as V,pt as _,y as a,ft as b,gt as c,Ye as d,vt as e,ht as f,_ as u};
