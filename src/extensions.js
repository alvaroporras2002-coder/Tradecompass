// Shared validation for optional modules in a restored or synchronized workspace.
export function validExtensions(state) {
 const text=(v,max=3000)=>typeof v==='string'&&v.length<=max;
 const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const day=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;};
 const settings=state.settings;
 if(!record(settings))return false;
 if(settings.name!==undefined&&!text(settings.name,1000))return false;
 if(settings.theme!==undefined&&!['dark','light'].includes(settings.theme))return false;
 if(settings.reducedMotion!==undefined&&typeof settings.reducedMotion!=='boolean')return false;
 if(settings.marketWatchlist!==undefined&&(!Array.isArray(settings.marketWatchlist)||settings.marketWatchlist.length>50||!settings.marketWatchlist.every(v=>text(v,100))))return false;
 if(settings.marketLevels!==undefined&&(!record(settings.marketLevels)||Object.entries(settings.marketLevels).some(([key,values])=>!['EURUSD','XAUUSD','USDJPY','GBPUSD','NAS100'].includes(key)||!Array.isArray(values)||values.length>12||!values.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1e9))))return false;
 if(settings.eaNotes!==undefined&&(!record(settings.eaNotes)||Object.keys(settings.eaNotes).length>50||!Object.values(settings.eaNotes).every(v=>text(v,12000))))return false;
 const subscription=settings.subscription;
 if(subscription!==undefined&&subscription!==null){
  if(!record(subscription)||!['free','pro','elite'].includes(subscription.plan)||!['month','year'].includes(subscription.billing)||subscription.simulated!==true||!['card','apple',null].includes(subscription.method)||subscription.plan!=='free'&&!subscription.method||typeof subscription.changedAt!=='string'||!Number.isFinite(Date.parse(subscription.changedAt))||!Array.isArray(subscription.accountIds)||subscription.accountIds.length>100||subscription.accountIds.some(id=>typeof id!=='string'||id.length>150)||Object.keys(subscription).some(k=>!['plan','billing','method','simulated','changedAt','accountIds'].includes(k)))return false;
 }
 if(settings.planUsage!==undefined&&(!record(settings.planUsage)||Object.keys(settings.planUsage).length>2400||Object.entries(settings.planUsage).some(([key,value])=>!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)||!Number.isSafeInteger(value)||value<0)))return false;
 if(settings.planInterest!==undefined&&settings.planInterest!==null&&(!record(settings.planInterest)||!['pro','free'].includes(settings.planInterest.plan)||!['month','year'].includes(settings.planInterest.billing)))return false;
 if(state.evaluations!==undefined){
  if(!Array.isArray(state.evaluations)||state.evaluations.length>500)return false;
  const ids=new Set(),accounts=new Set(state.accounts.map(a=>a.id));
  for(const e of state.evaluations){
   if(!record(e)||!text(e.id,150)||!e.id||ids.has(e.id)||!accounts.has(e.accountId))return false;
   ids.add(e.id);
   if(!text(e.title,150)||!e.title.trim()||!['historical','forward'].includes(e.kind)||!day(e.from)||!day(e.to)||e.from>e.to)return false;
   if(!Number.isInteger(e.sample)||e.sample<0||e.sample>1000000||!['costs','result','drawdown'].every(k=>typeof e[k]==='number'&&Number.isFinite(e[k]))||e.costs<0||e.drawdown<0)return false;
   if(!text(e.limitations,3000)||!e.limitations.trim())return false;
   if(e.version!==undefined&&!text(e.version,60))return false;
   if(e.currency!==undefined&&(typeof e.currency!=='string'||!/^([A-Z]{3})$/.test(e.currency)))return false;
   if(e.createdAt!==undefined&&(!text(e.createdAt,100)||!Number.isFinite(Date.parse(e.createdAt))))return false;
   if(e.report!==undefined&&e.report!==null&&(!record(e.report)||!text(e.report.name,1000)||!text(e.report.text,102400)))return false;
  }
 }
 return true;
}
