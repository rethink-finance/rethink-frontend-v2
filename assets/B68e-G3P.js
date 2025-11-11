import Ee from"./B1b9GBsg.js";import{d as Ce,h as Fe,c as Be,G as De,e as U,o as Te,cc as H,ey as ye,et as Ve,k as Re,t as xe,P as j,O as Ie,ez as Ae,eA as qe,eB as Ge,eC as fe,u as _e,cd as We}from"./_BmmGIGi.js";import{z as Oe,G as $e,Z as Me,N as Le,u as G,R as Ue,F as $,s as q,k as ke}from"./BMM55Xfq.js";import{g as z}from"./BW1CNIvT.js";import{w as x,C as y,x as He,d as N,y as je,s as M}from"./BwiW5Nlt.js";import{u as J}from"./DxTlZv4G.js";const gt=Ce({__name:"ProposalStateChip",props:{value:{type:String,default:""}},setup(e){const t=e,a=Fe(()=>{var o;return`proposal_state_${((o=t.value)==null?void 0:o.toLowerCase())??"undefined"}`});return(o,s)=>{const r=Ee;return Te(),Be(r,{value:e.value,class:De(U(a)),uppercase:"",bold:""},null,8,["value","class"])}}}),ze=z`
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
`,Ze=async(e,t)=>{const a=H().$getApolloClient(e);if(!a)throw new Error("Apollo client not found");try{const{data:o}=await a.query({query:ze,variables:{governorAddress:t.governorAddress},fetchPolicy:"network-only"});if(console.log("fetched data of proposals",o),!o||!o.proposals)throw new Error("Received no data or events!");return o.proposals}catch(o){throw console.error("Error fetching governor proposals:",o),o}},Xe=async(e,t)=>{const a=H().$getApolloClient(e);if(!a)throw new Error("Apollo client not found");try{const{data:o}=await a.query({query:Je,variables:{governorAddress:t.governorAddress,proposalId:t.proposalId},fetchPolicy:"network-only"});if(!o||!o.proposals)throw new Error("Received no data or events!");return o.proposals[0]}catch(o){throw console.error("Error fetching governor proposal:",o),o}},Ke=async(e,t)=>{const a=H().$getApolloClient(e);if(!a)throw new Error("Apollo client not found");try{const{data:o}=await a.query({query:Qe,variables:{votingContract:t.votingContract}});if(console.log("fetchSubgraphDelegates data: ",o),!o||!o.votingContract)throw new Error("Received no data or events!");return o.votingContract}catch(o){throw console.error("Error fetching subgraph delegates response:",o),o}};var C=(e=>(e.Pending="Pending",e.Active="Active",e.Canceled="Canceled",e.Defeated="Defeated",e.Succeeded="Succeeded",e.Queued="Queued",e.Expired="Expired",e.Executed="Executed",e))(C||{}),Ye=(e=>(e.Against="Reject",e.For="Approve",e.Abstain="Abstain",e))(Ye||{});const et={0:"Reject",1:"Approve",2:"Abstain"},tt={0:"Pending",1:"Active",2:"Canceled",3:"Defeated",4:"Succeeded",5:"Queued",6:"Expired",7:"Executed"},ht={Reject:0,Approve:1,Abstain:2},bt={1:"Approve",0:"Reject",2:"Abstain"},vt={Approve:"material-symbols:done",Reject:"material-symbols:close",Abstain:"material-symbols:question-mark"},ft={Approve:"for",Reject:"against",Abstain:"abstain"};var B=(e=>(e.NAV_UPDATE="NAV Update",e.DIRECT_EXECUTION="Direct Execution",e.PERMISSIONS="Permissions",e.FUND_SETTINGS="Fund Settings",e.UNDEFINED="Undefined",e))(B||{});const Q=(e,t,a,o,s)=>{var n,p;const r=t.slice(0,10),l=t.slice(10),c=L[r],i={functionName:void 0,contractName:void 0,calldataType:void 0,calldataDecoded:void 0,calldata:t};if(!((n=c==null?void 0:c.function)!=null&&n.name))return console.warn("No existing function signature found in the GovernableFund ABI for ",r,c),i;const b=(p=c==null?void 0:c.function)==null?void 0:p.inputs;try{let d=ye(b,l);d=x(d);let f=B.UNDEFINED;const u=c.function.name,k=a.toLocaleLowerCase();if(u==="updateNav")f=B.NAV_UPDATE;else if(k===(o==null?void 0:o.toLocaleLowerCase()))f=B.DIRECT_EXECUTION;else if(k===(e==null?void 0:e.toLocaleLowerCase()))f=B.PERMISSIONS;else if(u==="updateSettings")f=B.FUND_SETTINGS;else if(u==="storeNAVData")try{if(s&&(d==null?void 0:d.oiv)===s){const v=Q(e,(d==null?void 0:d.data)??"",a,o,s);v!=null&&v.calldataDecoded&&(d=v==null?void 0:v.calldataDecoded),f=B.NAV_UPDATE}}catch(v){console.error("Failed decoding storeNAVData NAV methods",t,v)}return{functionName:u,contractName:c.contractName,calldataType:f,calldataDecoded:d,calldata:t}}catch(d){console.error("error while decoding signature: ",r,d)}return console.error("FAILED decoding signature: ",r,L[r]),i},L={},ot=[{abi:Oe.abi,name:"GovernableFund"},{abi:$e.abi,name:"GnosisSafeL2"},{abi:Me.abi,name:"ZodiacRoles"},{abi:Le.abi,name:"NAVExecutor"}];ot.forEach(e=>{e.abi.forEach(t=>{if(t.type==="function"){const a=Ve(t);L[a]={function:t,contractName:e.name}}})});async function Ne(e,t,a,o,s,r,l,c,i,b,n){var ee,te,oe,re,ae,se,ne,ce,ie,le,ue,de,me,pe,ge,he,be,ve;let p=Number(e.voteStart),d=Number(e.voteEnd),f=a.currentBlock;c===y.Timestamp?f=Math.floor(Date.now()/1e3):c===y.BlockNumber?(p=await l(Number(e.voteStart),a),d=await l(Number(e.voteEnd),a)):(p=0,d=0,console.error("Invalid clock mode in _mapSubgraphProposalToProposal",c,e));const k=(m=>{try{const E=JSON.parse(m);return{title:E.title,description:E.description}}catch{return{title:m.split(`
`)[0],description:m}}})(e.description),v=e.calls.map(m=>m.calldata),g=e.calls.map(m=>m.value),h=e.calls.map(m=>m.signature),S=e.calls.map(m=>m.target.id),w=[],P=[];v.forEach((m,E)=>{const A=Q(i,m,S[E],b,n);w.push(A),P.push(A==null?void 0:A.calldataType)});const V=[...new Set(P.filter(m=>m!==B.UNDEFINED&&m!==void 0))],F=e.receipts||[],D=F.filter(m=>m.support.support===1).reduce((m,E)=>m+BigInt(E.weight),BigInt(0)),R=F.filter(m=>m.support.support===0).reduce((m,E)=>m+BigInt(E.weight),BigInt(0)),W=F.filter(m=>m.support.support===2).reduce((m,E)=>m+BigInt(E.weight),BigInt(0)),I=D+R+W,Z=Number(I),Pe=Number(D),X=Number(t||0),O=BigInt(t)*BigInt(s)/BigInt(r),K=I>BigInt(0)?Math.min(Pe/Z*100,100):0,Y=X>0?Math.min(Z/X*100,100):0;let T;(te=(ee=e.proposalCanceled)==null?void 0:ee[0])!=null&&te.timestamp?T=C.Canceled:(re=(oe=e.proposalExecuted)==null?void 0:oe[0])!=null&&re.timestamp?T=C.Executed:(se=(ae=e.proposalQueued)==null?void 0:ae[0])!=null&&se.timestamp?T=C.Queued:f<Number(e.voteStart)?T=C.Pending:f>=Number(e.voteStart)&&f<Number(e.voteEnd)?T=C.Active:f>=Number(e.voteEnd)?T=I>=O&&D>R?C.Succeeded:C.Defeated:T=C.Pending;const we=(e.receipts??[]).map(m=>({proposalId:e.proposalId.toString(),proposer:m.voter.id,my_vote:!1,submission_status:et[m.support.support],quorumVotes:N(BigInt(m.weight),o,!1,!0),date:He(new Date(Number(m.voteCasts[0].transaction.timestamp)*1e3),!1),blockNumber:m.voteCasts[0].transaction.blockNumber}));return{proposalId:e.proposalId.toString(),proposer:e.proposer.id,title:k.title,description:k.description,voteStart:e.voteStart.toString(),voteEnd:e.voteEnd.toString(),voteStartTimestamp:p==null?void 0:p.toString(),voteEndTimestamp:d==null?void 0:d.toString(),createdTimestamp:Number((ce=(ne=e.proposalCreated)==null?void 0:ne[0])==null?void 0:ce.timestamp),executedTimestamp:Number((le=(ie=e.proposalExecuted)==null?void 0:ie[0])==null?void 0:le.timestamp),createdDatetimeFormatted:(de=(ue=e.proposalCreated)==null?void 0:ue[0])!=null&&de.timestamp?new Date(Number(e.proposalCreated[0].timestamp)*1e3).toDateString():new Date().toDateString(),targets:S,values:g,signatures:h,calldatas:v,descriptionHash:Re(xe(e.description)),calldatasDecoded:w,calldataTypes:P,calldataTags:V,state:T,createdBlockNumber:BigInt(((ge=(pe=(me=e.proposalCreated)==null?void 0:me[0])==null?void 0:pe.transaction)==null?void 0:ge.blockNumber)??"0"),executedBlockNumber:BigInt(((ve=(be=(he=e.proposalExecuted)==null?void 0:he[0])==null?void 0:be.transaction)==null?void 0:ve.blockNumber)??"0"),approval:K/100,approvalFormatted:`${parseFloat(K.toFixed(2))}%`,participation:Y/100,participationFormatted:`${parseFloat(Y.toFixed(2))}%`,quorumVotes:O,quorumVotesFormatted:N(O,o,!1),forVotes:D,forVotesFormatted:N(D,o,!1),againstVotes:R,againstVotesFormatted:N(R,o,!1),abstainVotes:W,abstainVotesFormatted:N(W,o,!1),totalVotes:I,totalVotesFormatted:N(BigInt(I),o,!1),totalSupply:BigInt(t),totalSupplyFormatted:N(BigInt(t),o,!1),voteSubmissions:we}}function rt(e,t){var o;if(!(e!=null&&e.weight))return[];const a=((o=e.totalWeight)==null?void 0:o.value)||"0";return e.weight.map(s=>{var c,i,b;const r=((i=(c=s.account)==null?void 0:c.delegationFrom)==null?void 0:i.map(n=>{var p,d,f;return{address:n.delegator.id||"",weight:((f=(d=(p=n.delegator)==null?void 0:p.voteWeigth)==null?void 0:d[0])==null?void 0:f.value)||"0"}}))||[],l=a!=="0"?(Number(s.value||0)/Number(a)*100).toFixed(2):"0";return{address:((b=s.account)==null?void 0:b.id)||"",delegators:r,delegatorCount:r.length,votingPower:N(BigInt(s.value||"0"),t,!1),votingPowerPercent:`${l}%`}})}function kt(e){return e.map(t=>({delegatedMember:t.address,delegators:t.delegators.map(a=>a.address),delegatorsEvents:[],impact:t.votingPowerPercent,votingPower:t.votingPower}))}const at=async()=>{var l,c;const e=G(),t=_(),a=U(e.fund);if(!a)return;const o=(l=a==null?void 0:a.governanceToken)==null?void 0:l.address;if(!o)throw new Error("Governor token address not found");const s=await Ke(a.chainId,{votingContract:o}),r=rt(s,((c=a==null?void 0:a.governanceToken)==null?void 0:c.decimals)||18);return t.storeDelegates(a==null?void 0:a.chainId,a==null?void 0:a.address,r),console.log("processedDelegates: ",r),s},st=async e=>{var k,v,g,h,S,w,P,V,F,D,R;const t=_(),a=j(),o=G(),s=J(),r=U(o.fund);if(!r)return;if(!(r!=null&&r.governorAddress))throw new Error("Governor address not found");if(!e)throw new Error("Proposal ID not found");const l=await Xe(r==null?void 0:r.chainId,{governorAddress:r==null?void 0:r.governorAddress,proposalId:e});console.log("indexer raw fetched proposal",l);const c=await s.initializeBlockTimeContext(r.chainId),i=await o.fetchRoleModAddress(r.address),b=((k=r==null?void 0:r.clockMode)==null?void 0:k.mode)===y.BlockNumber?(h=(g=(v=l.proposalCreated)==null?void 0:v[0])==null?void 0:g.transaction)==null?void 0:h.blockNumber:(w=(S=l.proposalCreated)==null?void 0:S[0])==null?void 0:w.timestamp,n=((P=r==null?void 0:r.clockMode)==null?void 0:P.mode)===y.BlockNumber?await a.callWithRetry(r==null?void 0:r.chainId,()=>o.fundGovernorContract.methods.proposalSnapshot(l.proposalId).call()):(D=(F=(V=l.proposalCreated)==null?void 0:V[0])==null?void 0:F.transaction)==null?void 0:D.blockNumber,[p,d,f]=await Promise.all([a.callWithRetry(r==null?void 0:r.chainId,()=>o.fundGovernorContract.methods.quorumNumerator(b).call()),a.callWithRetry(r==null?void 0:r.chainId,()=>o.fundGovernorContract.methods.quorumDenominator().call()),a.callWithRetry(r==null?void 0:r.chainId,()=>o.fundGovernanceTokenContract.methods.getPastTotalSupply(n).call())]),u=await Ne(l,f,c,(r==null?void 0:r.governanceToken.decimals)??0,p,d,s.getTimestampForBlock,(R=r==null?void 0:r.clockMode)==null?void 0:R.mode,i??"",(r==null?void 0:r.safeAddress)??"",(r==null?void 0:r.address)??"");return t.storeProposal(r==null?void 0:r.chainId,r==null?void 0:r.address,u),u},nt=async()=>{const e=_(),t=G(),a=j(),o=J(),s=t.fund;if(!s)return;if(!(s!=null&&s.governorAddress))throw new Error("Governor address not found");const r=await o.initializeBlockTimeContext(s.chainId),l=await t.fetchRoleModAddress(s.address);console.log("roleModAddress",l);const c=await a.callWithRetry(s.chainId,()=>t.fundGovernorContract.methods.quorumDenominator().call()),b=(await Ze(s.chainId,{governorAddress:s==null?void 0:s.governorAddress})).map(u=>{var k,v,g,h,S,w,P,V,F;return{proposal:u,timepoint:((k=s==null?void 0:s.clockMode)==null?void 0:k.mode)===y.BlockNumber?(h=(g=(v=u.proposalCreated)==null?void 0:v[0])==null?void 0:g.transaction)==null?void 0:h.blockNumber:(w=(S=u.proposalCreated)==null?void 0:S[0])==null?void 0:w.timestamp,blockNumber:(F=(V=(P=u.proposalCreated)==null?void 0:P[0])==null?void 0:V.transaction)==null?void 0:F.blockNumber}}),n=[...new Set(b.map(u=>JSON.stringify({timepoint:u.timepoint,blockNumber:u.blockNumber})))].map(u=>JSON.parse(u)),p=Object.fromEntries(await Promise.all(n.map(async({timepoint:u,blockNumber:k})=>{const[v,g]=await Promise.all([a.callWithRetry(s.chainId,()=>t.fundGovernorContract.methods.quorumNumerator(u).call()),a.callWithRetry(s.chainId,()=>t.fundGovernanceTokenContract.methods.totalSupply().call({blockNumber:k}))]);return[JSON.stringify({timepoint:u,blockNumber:k}),{quorumNumerator:v,totalSupply:g}]}))),d=b.map(({proposal:u,timepoint:k,blockNumber:v})=>{var w,P;const g=JSON.stringify({timepoint:k,blockNumber:v}),{quorumNumerator:h,totalSupply:S}=p[g];return Ne(u,S,r,((w=s==null?void 0:s.governanceToken)==null?void 0:w.decimals)||18,h,c,o.getTimestampForBlock,(P=s==null?void 0:s.clockMode)==null?void 0:P.mode,l??"",(s==null?void 0:s.safeAddress)??"",(s==null?void 0:s.address)??"")}),f=await Promise.all(d);return e.storeProposals(s.chainId,s==null?void 0:s.address,f),f},_=Ie({id:"governanceProposalStore",state:()=>({fundProposals:{},fundDelegates:{},fundProposalsBlockFetchedRanges:Ae("fundProposalsBlockFetchedRanges",{})??{},connectedAccountProposalsHasVoted:{}}),getters:{fundStore(){return G()},toastStore(){return _e()},web3Store(){return j()},blockTimeStore(){return J()},selectedFundChainId(){return this.fundStore.selectedFundChain},selectedFundWeb3Provider(){return this.web3Store.chainProviders[this.selectedFundChainId]}},actions:{async loadFundProposals(){const e=await ke("fundProposals",{});this.fundProposals=e},async loadFundDelegates(){const e=await ke("fundDelegates",{});this.fundDelegates=e},resetProposals(e,t){var o;if(!t)return;const a=(o=this.fundProposals)==null?void 0:o[e];console.debug("this.fundProposals: ",this.fundProposals,typeof this.fundProposals),a||(this.fundProposals[e]={}),this.fundProposals[e][t]={},this.fundProposalsBlockFetchedRanges[e]||(this.fundProposalsBlockFetchedRanges[e]={}),this.fundProposalsBlockFetchedRanges[e][t]=[],q("fundProposals",this.fundProposals),fe("fundProposalsBlockFetchedRanges",this.fundProposalsBlockFetchedRanges)},storeProposal(e,t,a){var o,s;(o=this.fundProposals)[e]??(o[e]={}),(s=this.fundProposals[e])[t]??(s[t]={}),this.fundProposals[e][t][a.proposalId]=x(a),q("fundProposals",this.fundProposals)},storeProposals(e,t,a){var o,s;if(!e){console.error("Cannot store proposals: chainId is required");return}if(!t){console.error("Cannot store proposals: fundAddress is required");return}(o=this.fundProposals)[e]??(o[e]={}),(s=this.fundProposals[e])[t]??(s[t]={}),a.forEach(r=>{this.fundProposals[e][t][r.proposalId]=x(r)}),q("fundProposals",this.fundProposals)},storeDelegates(e,t,a){var o,s;if(!e){console.error("Cannot store delegates: chainId is required");return}if(!t){console.error("Cannot store delegates: fundAddress is required");return}(o=this.fundDelegates)[e]??(o[e]={}),(s=this.fundDelegates[e])[t]??(s[t]={}),a.forEach(r=>{this.fundDelegates[e][t][r.address]=x(r)}),q("fundDelegates",this.fundDelegates)},getProposals(e,t){var s;if(!t)return[];const a=(s=this.fundProposals)==null?void 0:s[e];return a?a[t]?Object.values(this.fundProposals[e][t]):[]:[]},getProposal(e,t,a){var r;if(!t||!a)return;const o=(r=this.fundProposals)==null?void 0:r[e];if(!o)return;const s=o[t];if(s)return s[a]},getDelegates(e,t){var s;if(!t)return[];const a=(s=this.fundDelegates)==null?void 0:s[e];return a?a[t]?Object.values(this.fundDelegates[e][t]):[]:[]},getDelegate(e,t,a){var r,l,c,i;if(!t||!a)return;const o=(r=this.fundDelegates)==null?void 0:r[e];if(!(!o||!o[t]))return(i=(c=(l=this.fundDelegates)==null?void 0:l[e])==null?void 0:c[t])==null?void 0:i[a]},hasAccountVoted(e){var a,o,s;const t=this.fundStore.activeAccountAddress;if(!t)return!1;if(((a=this.connectedAccountProposalsHasVoted)==null?void 0:a[e])!==void 0)return(s=(o=this.connectedAccountProposalsHasVoted)==null?void 0:o[e])==null?void 0:s[t]},getFundProposalsBlockFetchedRanges(e,t){var s;if(!t)return[void 0,void 0];const a=(s=this.fundProposalsBlockFetchedRanges)==null?void 0:s[e];if(!a)return[void 0,void 0];const o=a[t];return o||[void 0,void 0]},setFundProposalsBlockFetchedRanges(e,t,a,o){var r,l;(r=this.fundProposalsBlockFetchedRanges)[e]??(r[e]={}),(l=this.fundProposalsBlockFetchedRanges[e])[t]??(l[t]=[]);const s=this.fundProposalsBlockFetchedRanges[e][t];if(s.length){let c=s[0],i=s[1];a>c&&(c=a),o<i&&(i=o),this.fundProposalsBlockFetchedRanges[e][t]=[c,i]}else this.fundProposalsBlockFetchedRanges[e][t]=[a,o];fe("fundProposalsBlockFetchedRanges",x(this.fundProposalsBlockFetchedRanges))},fetchDelegates(){return $("fetchDelegatesAction",()=>at())},fetchGovernanceProposals(){return $("fetchGovernanceProposalsAction",()=>nt())},fetchGovernanceProposal(e){return $("fetchGovernanceProposalAction",()=>st(e))},decodeProposalCreatedEvent(e){var s,r;if(!e.raw)return;const t=(s=e.raw)==null?void 0:s.topics,a=qe(ct??[],((r=e.raw)==null?void 0:r.data)??"",t.slice(1)),o=x(a);try{o.descriptionHash=Ge(o.description);const l=JSON.parse(o.description);o.title=l.title,o.description=l.description}catch{o.title=o.description}return console.debug("event decoded"),o},async fetchBlockProposals(e){console.debug("fetchBlockProposals:",e);const t=await this.web3Store.callWithRetry(this.selectedFundChainId,()=>this.fundStore.fundGovernorContract.getPastEvents("ProposalCreated",{fromBlock:e,toBlock:e}));console.debug("fetchBlockProposals events:",t),await this.parseProposalCreatedEvents(t)},async proposalExecutedBlockNumber(e){var t,a;try{if(e.state===C.Executed){const o=Number(await this.selectedFundWeb3Provider.eth.getBlockNumber());console.log("currentBlock:",o);const s=BigInt(e.createdBlockNumber),r=BigInt(o),l=3000n;let c=[];for(let i=s;i<=r;i+=l){const b=i+l-1n>r?r:i+l-1n;console.debug(`Fetching events from ${i} to ${b}`);const n=await this.fundStore.fundGovernorContract.getPastEvents("ProposalExecuted",{fromBlock:Number(i),toBlock:Number(b)});if(c=c.concat(n),console.debug("proposalExecutedEvents: ",c),c.length>0){const p=c.find(d=>d.returnValues.proposalId.toString()===e.proposalId);if(console.debug("proposal executed event: ",p),p){const d=await this.selectedFundWeb3Provider.eth.getBlock(p.blockNumber);console.log("blockExecuted: ",d),e.executedTimestamp=Number(d.timestamp),e.executedBlockNumber=p.blockNumber,console.debug("proposal with executed data:",e),this.storeProposal((t=this.fundStore.fund)==null?void 0:t.chainId,(a=this.fundStore.fund)==null?void 0:a.address,e);break}}}}}catch(o){console.error("error fetching ProposalExecuted: ",o)}},async getBlockPerHoursRate(){const e=await this.blockTimeStore.initializeBlockTimeContext(this.selectedFundChainId),t=e.currentBlock,a=e.currentBlockTimestamp;console.debug(`Current block number: ${t}`),console.debug(`Current block timestamp: ${a}`);const o=3600,s=a-o;let r=0,l=t,c;for(;r<=l;){const b=Math.floor((r+l)/2),n=await this.selectedFundWeb3Provider.eth.getBlock(b),p=Number(n.timestamp);if(p<s)r=b+1;else if(p>s)l=b-1;else{c=n;break}if(Math.abs(p-s)<o/10){c=n;break}}c||(c=await this.selectedFundWeb3Provider.eth.getBlock(l));const i=(t-Number(c.number))/((a-Number(c.timestamp))/o);return console.debug(`Blocks per hour rate: ${i}`),i},async setProposalVoteStartEndTimestamp(e){var t,a,o,s;if(((a=(t=this.fundStore.fund)==null?void 0:t.clockMode)==null?void 0:a.mode)===y.Timestamp){e.voteStartTimestamp=e.voteStart,e.voteEndTimestamp=e.voteEnd;return}if(((s=(o=this.fundStore.fund)==null?void 0:o.clockMode)==null?void 0:s.mode)!==y.BlockNumber){e.voteEndTimestamp=void 0,e.voteStartTimestamp=void 0;return}try{const r=await this.blockTimeStore.initializeBlockTimeContext(this.selectedFundChainId),l=r.currentBlock,c=r.currentBlockTimestamp;if(console.debug("currentBlockNumber: ",l,"currentBlockTimestamp",c),Number(e.voteEnd)<=l){console.debug("fetch blockEnd");const i=await this.selectedFundWeb3Provider.eth.getBlock(e.voteEnd);console.debug("blockEnd: ",i),e.voteEndTimestamp=i==null?void 0:i.timestamp.toString()}else{console.log("estimate blockEnd");const i=await this.blockTimeStore.getTimestampForBlock(Number(e.voteEnd),r);console.log("estimatedEndTimestamp: ",i),e.voteEndTimestamp=i.toString()}if(Number(e.voteStart)<=l){console.debug("fetch blockStart");const i=await this.selectedFundWeb3Provider.eth.getBlock(e.voteStart);console.debug("blockStart: ",i),e.voteStartTimestamp=i==null?void 0:i.timestamp.toString()}else{console.debug("estimate blockStart");const i=await this.blockTimeStore.getTimestampForBlock(Number(e.voteStart),r);console.debug("estimatedStartTimestamp: ",i),e.voteStartTimestamp=i.toString()}}catch{console.error("failed fetching proposal vote start end timestamps for ",e)}},async parseProposalCreatedEvents(e){var a,o,s,r,l,c,i;if(!(e!=null&&e.length))return;const t=this.fundStore.fund;if(!(t!=null&&t.governanceToken.decimals)){console.error("No vault governance token decimals found."),this.toastStore.errorToast("No vault governance token decimals found.");return}if(!((a=t.clockMode)!=null&&a.mode)){console.error("Vault clock mode is unknown."),this.toastStore.errorToast("Vault clock mode is unknown.");return}for(const b of e){console.debug("event"),console.debug(b);const n=this.decodeProposalCreatedEvent(b);if(!n)continue;const p=await this.selectedFundWeb3Provider.eth.getBlock(b.blockNumber);n.createdTimestamp=Number(p.timestamp),n.createdDatetimeFormatted=je(new Date(Number(p.timestamp)*1e3)),n.createdBlockNumber=b.blockNumber;const d=(r=(s=(o=this.fundProposals)==null?void 0:o[t.chainId])==null?void 0:s[t==null?void 0:t.address])==null?void 0:r[n.proposalId];n.executedTimestamp=d==null?void 0:d.executedTimestamp,n.executedBlockNumber=d==null?void 0:d.executedBlockNumber;const f=await this.web3Store.callWithRetry(this.selectedFundChainId,()=>this.fundStore.fundGovernorContract.methods.state(n.proposalId).call());n.state=tt[f],console.debug("proposal: ",n),await this.setProposalVoteStartEndTimestamp(n),console.debug("proposal:",n);const u=await this.web3Store.callWithRetry(this.selectedFundChainId,()=>this.fundStore.fundGovernorContract.methods.proposalVotes(n.proposalId).call());console.debug("proposal votes: ",u),console.debug("get total supply at blockNumber: ",n.createdBlockNumber);let k;try{k=await this.web3Store.callWithRetry(this.selectedFundChainId,()=>this.fundStore.fundGovernanceTokenContract.methods.totalSupply().call({},n.createdBlockNumber)),n.totalSupply=k,n.totalSupplyFormatted=N(k,(l=t==null?void 0:t.governanceToken)==null?void 0:l.decimals,!1)}catch(g){console.error("failed fetching total supply",g),n.totalSupplyFormatted="N/A"}console.debug("proposal created blockNumber ",n.createdBlockNumber," timestamp ",n.createdTimestamp);try{const g=((c=t==null?void 0:t.clockMode)==null?void 0:c.mode)===y.BlockNumber?n.createdBlockNumber:n.createdTimestamp,h=await this.web3Store.callWithRetry(this.selectedFundChainId,()=>this.fundStore.fundGovernorContract.methods.quorumNumerator(g).call());n.quorumVotes=h,n.quorumVotesFormatted=N(h,(i=t==null?void 0:t.governanceToken)==null?void 0:i.decimals,!1)}catch(g){console.error("error fetching quorumVotes: ",g),n.quorumVotesFormatted="N/A"}if(console.debug("parse votes",u),u){const g=u.forVotes+u.abstainVotes+u.againstVotes;if(n.totalVotes=g,n.totalVotesFormatted=N(g,t==null?void 0:t.governanceToken.decimals,!1),n.forVotes=u.forVotes,n.abstainVotes=u.abstainVotes,n.againstVotes=u.againstVotes,n.forVotesFormatted=N(u.forVotes,t==null?void 0:t.governanceToken.decimals,!1),n.abstainVotesFormatted=N(u.abstainVotes,t==null?void 0:t.governanceToken.decimals,!1),n.againstVotesFormatted=N(u.againstVotes,t==null?void 0:t.governanceToken.decimals,!1),console.log("proposal votes",n),n.quorumVotes===0n&&Number(u.forVotes)>0)n.approval=1,n.approvalFormatted=M(n.approval,!1);else if(n.quorumVotes){let h=Number(u.forVotes)/Number(n.quorumVotes);h>1&&(h=1),n.approval=h,n.approvalFormatted=M(h,!1)}else n.approvalFormatted="N/A";if(k){let h=Number(g)/Number(k);h>1&&(h=1),n.participation=h,n.participationFormatted=M(h,!1)}else n.participationFormatted="N/A"}n.calldatasDecoded=[],n.calldataTypes=[];const v=await this.fundStore.fetchRoleModAddress(t.address);n.calldatas.forEach((g,h)=>{const S=Q(v,g,n.targets[h],t==null?void 0:t.safeAddress,t==null?void 0:t.address);n.calldataTypes.push(S==null?void 0:S.calldataType),n.calldatasDecoded.push(S)}),n.calldataTags=[...new Set(n.calldataTypes.filter(g=>g!==B.UNDEFINED&&g!==void 0))],this.storeProposal(t==null?void 0:t.chainId,t==null?void 0:t.address,n)}}}});var Se;const ct=((Se=Ue.abi.find(e=>e.name==="ProposalCreated"&&e.type==="event"))==null?void 0:Se.inputs)??[];We(()=>{const e=_();e.loadFundProposals(),e.loadFundDelegates()});export{C as P,vt as V,gt as _,B as a,kt as b,ht as c,Ye as d,ft as e,bt as f,_ as u};
