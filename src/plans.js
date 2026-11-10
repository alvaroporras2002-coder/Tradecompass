// Demonstration entitlements only. No payment credentials or real billing.
export const PLANS = Object.freeze({free:{name:'TradeFree',rank:0,monthly:0,annual:0,accounts:1,trades:30,images:1},pro:{name:'TradePro',rank:1,monthly:9,annual:90,accounts:5,trades:Infinity,images:5},elite:{name:'SuperTrade',rank:2,monthly:19,annual:190,accounts:15,trades:Infinity,images:10}});
export const planId = state => ['free','pro','elite'].includes(state?.settings?.subscription?.plan)?state.settings.subscription.plan:'free';
export const planFor = state => PLANS[planId(state)];
export const monthKey = now => new Date(now).toISOString().slice(0,7);
export function usage(state,now=Date.now()) {const key=monthKey(now);return Math.max(Number(state.settings?.planUsage?.[key])||0,state.trades.filter(t=>t.createdAt?.slice(0,7)===key).length);}
export function writableAccounts(state){const ordered=state.settings?.subscription?.accountIds||[];const accounts=state.accounts.filter(a=>!a.archived).slice().sort((a,b)=>{const ai=ordered.indexOf(a.id),bi=ordered.indexOf(b.id);return (ai<0?999:ai)-(bi<0?999:bi);});return accounts.slice(0,planFor(state).accounts).map(a=>a.id);}
export class PlanLimitError extends Error {constructor(feature,required='pro'){super(feature);this.name='PlanLimitError';this.required=required;}}
export function applyPlan(state,plan,billing='month',method=null,accountId=null,now=Date.now()) {
 if(!PLANS[plan]||!['month','year'].includes(billing)||!['card','apple',null].includes(method)||plan!=='free'&&!method)throw Error('Invalid demo selection');
 const ids=[accountId,...state.accounts.filter(a=>!a.archived).map(a=>a.id)].filter((v,i,a)=>v&&a.indexOf(v)===i);
 state.settings.subscription={plan,billing:plan==='free'?'month':billing,method:plan==='free'?null:method,simulated:true,changedAt:new Date(now).toISOString(),accountIds:ids};
 return state;
}
export function enforcePlan(previous,next,now=Date.now()) {
 const p=planFor(previous),allowed=writableAccounts(previous),oldAccounts=new Set(previous.accounts.map(a=>a.id));
 for(const a of next.accounts){const old=previous.accounts.find(x=>x.id===a.id);if(old&&!allowed.includes(a.id)&&JSON.stringify({...old,archived:a.archived})!==JSON.stringify(a))throw new PlanLimitError('readonly',p.rank?'elite':'pro');}
 const newlyActive=next.accounts.filter(a=>!a.archived&&(!oldAccounts.has(a.id)||previous.accounts.find(x=>x.id===a.id)?.archived));
 if(newlyActive.length&&next.accounts.filter(a=>!a.archived).length>p.accounts)throw new PlanLimitError('accounts',p.rank?'elite':'pro');
 for(const key of ['cashflows','reviews']){const oldRows=new Map(previous[key].map(r=>[r.id,r]));if(next[key].some(r=>(!oldRows.has(r.id)||JSON.stringify(oldRows.get(r.id))!==JSON.stringify(r))&&!allowed.includes(r.accountId)&&!newlyActive.some(a=>a.id===r.accountId)))throw new PlanLimitError('readonly',p.rank?'elite':'pro');}
 const old=new Map(previous.trades.map(t=>[t.id,t])),added=next.trades.filter(t=>!old.has(t.id));
 if(added.length&&usage(previous,now)+added.length>p.trades)throw new PlanLimitError('trades');
 for(const row of next.trades){const before=old.get(row.id);if(!before||JSON.stringify(before)!==JSON.stringify(row)){
  if(!allowed.includes(row.accountId)&&!newlyActive.some(a=>a.id===row.accountId))throw new PlanLimitError('readonly',p.rank?'elite':'pro');
  if((row.attachments?.length||0)>p.images&&(row.attachments?.length||0)>(before?.attachments?.length||0))throw new PlanLimitError('images',p.rank?'elite':'pro');
  if(before)row.createdAt=before.createdAt;else row.createdAt=new Date(now).toISOString();
 }}
 // A backup cannot activate a plan or reset a consumed monthly allowance.
 next.settings.subscription=structuredClone(previous.settings.subscription??null);
 next.settings.planUsage={...previous.settings.planUsage,[monthKey(now)]:usage(previous,now)+added.length};
 if(p.rank<2&&(next.evaluations||[]).some(r=>!(previous.evaluations||[]).some(old=>old.id===r.id&&JSON.stringify(old)===JSON.stringify(r))))throw new PlanLimitError('laboratory','elite');
 // Laboratory UI is gated independently; dataset restores remain subject to trade/account quotas.
 return next;
}

export const canAccessLibrary = state => planId(state)==='elite';
