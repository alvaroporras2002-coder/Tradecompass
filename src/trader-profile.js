import {writableAccounts} from './plans.js';

// Questionnaire IDs are stable data; labels are presentation-only and never executable HTML.
export const PROFILE_OPTIONS = Object.freeze({
 experience: [['new','Estoy comenzando','I am getting started'],['developing','Estoy desarrollando mi proceso','I am developing my process'],['experienced','Ya tengo experiencia','I am experienced']],
 style: [['scalping','Scalping','Scalping'],['intraday','Intradía','Intraday'],['swing','Swing trading','Swing trading'],['position','Operaciones de largo plazo','Position trading'],['exploring','Todavía estoy explorando','I am still exploring']],
 markets: [['forex','Forex','Forex'],['indices','Índices','Indices'],['metals','Metales','Metals'],['crypto','Criptomonedas','Cryptocurrencies'],['stocks','Acciones','Stocks']],
 goal: [['discipline','Respetar mi proceso','Follow my process'],['consistency','Ser constante con mi diario','Build a journaling habit'],['understand','Entender mis resultados','Understand my results'],['strategy','Documentar mis estrategias','Document my strategies']],
 session: [['asia','Asia','Asia'],['london','Londres','London'],['newyork','Nueva York','New York'],['flexible','Horario flexible','Flexible schedule']],
 platform: [['mt5','MetaTrader 5','MetaTrader 5'],['mt4','MetaTrader 4','MetaTrader 4'],['tradingview','TradingView','TradingView'],['other','Otra plataforma','Other platform']],
 weeklyReview: [['monday','Lunes','Monday'],['friday','Viernes','Friday'],['sunday','Domingo','Sunday']],
 accountMode: [['demo','Práctica / demo','Practice / demo'],['real','Real','Live']],
});
const fields=Object.keys(PROFILE_OPTIONS);
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const allowed=(field,value)=>typeof value==='string'&&PROFILE_OPTIONS[field].some(option=>option[0]===value);
const canonicalDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;

export function validTraderProfile(profile){
 if(!record(profile)||profile.version!==1||!canonicalDate(profile.updatedAt))return false;
 if(Object.keys(profile).length!==fields.length+2||Object.keys(profile).some(key=>!fields.includes(key)&&!['version','updatedAt'].includes(key)))return false;
 if(fields.some(field=>!own(profile,field)))return false;
 for(const field of fields){
  if(field==='markets'){
   if(!Array.isArray(profile.markets)||profile.markets.length<1||profile.markets.length>5||new Set(profile.markets).size!==profile.markets.length||profile.markets.some(value=>!allowed(field,value)))return false;
  }else if(!allowed(field,profile[field]))return false;
 }
 return true;
}

export function profileLabel(field,id,language='es'){
 const option=PROFILE_OPTIONS[field]?.find(row=>row[0]===id);
 return option?option[language==='en'?2:1]:'';
}

export function applyTraderProfile(state,input,now=Date.now()){
 if(!record(input)||!record(state?.settings)||!Array.isArray(state.accounts)||!state.accounts.length||!Array.isArray(state.trades)||!Array.isArray(state.cashflows)||!Array.isArray(state.rules))throw new Error('Invalid trader profile');
 if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>60||!['es','en'].includes(input.language)||!['USD','EUR','CRC','MXN','COP','GBP','CAD'].includes(input.currency)||typeof input.timezone!=='string'||!input.timezone||input.timezone.length>100)throw new Error('Invalid trader profile');
 try{new Intl.DateTimeFormat('en',{timeZone:input.timezone}).format();}catch{throw new Error('Invalid timezone');}
 const timestamp=new Date(now).toISOString();
 const profile={version:1,...Object.fromEntries(fields.map(field=>[field,field==='markets'&&Array.isArray(input.markets)?input.markets.slice():input[field]])),updatedAt:timestamp};
 if(!validTraderProfile(profile))throw new Error('Invalid trader profile');
 const primary=state.accounts[0];
 const untouched=primary.name==='Mi cuenta'&&!state.trades.some(trade=>trade.accountId===primary.id)&&!state.cashflows.some(flow=>flow.accountId===primary.id)&&writableAccounts(state).includes(primary.id);
 state.settings.name=input.name.trim();
 state.settings.language=input.language;
 state.settings.timezone=input.timezone;
 state.settings.traderProfile=profile;
 state.settings.onboardingComplete=true;
 if(untouched){
  primary.currency=input.currency;
  primary.timezone=input.timezone;
  primary.platform=profileLabel('platform',input.platform,input.language);
  primary.type=input.accountMode;
 }
 if(!state.rules.length){
  const descriptions=input.language==='en'?[
   'I documented the entry reason and the conditions in my plan.',
   'I recorded the available execution details and costs.',
   'I noted my emotions and an observation to review.',
  ]:[
   'Documenté el motivo de entrada y las condiciones de mi plan.',
   'Registré los datos de ejecución y los costos disponibles.',
   'Anoté mis emociones y una observación para revisar.',
  ];
  state.rules=['profile-plan','profile-documentation','profile-emotion'].map((id,index)=>({id,text:descriptions[index],strategy:''}));
 }
 return state;
}

export function profileRecommendations(state,language=state?.settings?.language||'es'){
 const en=language==='en';
 const choose=(es,english)=>en?english:es;
 const profile=validTraderProfile(state?.settings?.traderProfile)?state.settings.traderProfile:null;
 if(!profile)return [
  {title:choose('Empieza con tu diario','Start with your journal'),detail:choose('Registra una operación con sus notas y contexto.','Log a trade with notes and context.'),route:'journal'},
  {title:choose('Prepara tus reglas','Prepare your rules'),detail:choose('Define condiciones que puedas documentar en cada registro.','Define conditions you can document in each entry.'),route:'discipline'},
  {title:choose('Reserva un momento para revisar','Make time to review'),detail:choose('La revisión semanal permite guardar una acción basada en tu historial.','The weekly review lets you save an action based on your history.'),route:'review'},
 ];
 const goals={
  discipline:{title:choose('Tu proceso, presente','Keep your process visible'),detail:choose('Personaliza tus reglas y completa el checklist al documentar cada operación.','Customize your rules and complete the checklist when documenting each trade.'),route:'discipline'},
  consistency:{title:choose('Una rutina para tu diario','A routine for your journal'),detail:choose('Revisa tus registros el '+profileLabel('weeklyReview',profile.weeklyReview,'es').toLocaleLowerCase()+' y guarda una acción para la próxima semana.','Review your entries on '+profileLabel('weeklyReview',profile.weeklyReview,'en')+' and save an action for the next week.'),route:'review'},
  understand:{title:choose('Resultados con contexto','Results with context'),detail:choose('Consulta las métricas disponibles en tu plan a partir de tus propias operaciones.','View your plan’s available metrics based on your own trades.'),route:'analytics'},
  strategy:{title:choose('Tu estrategia, documentada','Document your strategy'),detail:choose('Usa el campo estrategia, las etiquetas y las notas para organizar tu evidencia.','Use strategy, tags and notes to organize your evidence.'),route:'journal'},
 };
 const shortStyle=['scalping','intraday'].includes(profile.style);
 const style=profile.style==='exploring'?{
  title:choose('Conoce tus herramientas','Get to know your tools'),detail:choose('Consulta la ayuda de registro, importación y exportación antes de elegir tu rutina.','Review the logging, import and export help before choosing your routine.'),route:'docs',
 }:shortStyle&&profile.platform==='mt5'?{
  title:choose('Tu historial de MT5','Your MT5 history'),detail:choose('Importa un archivo de MT5 y revisa cuenta, fechas y duplicados antes de confirmarlo.','Import an MT5 file and review account, dates and duplicates before confirming.'),route:'import',
 }:{
  title:choose('Conserva el contexto','Keep the context'),detail:choose('Añade el motivo de entrada, las emociones y las capturas permitidas en tu plan.','Add entry reasons, emotions and the screenshots allowed by your plan.'),route:'journal',
 };
 const experience=profile.experience==='new'?{
  title:choose('Un registro claro cada vez','One clear entry at a time'),detail:choose('Empieza con los datos que conoces y completa después el contexto de tu operación.','Start with the details you know and add your trade’s context afterward.'),route:'journal',
 }:profile.experience==='experienced'?{
  title:choose('Revisa tu evidencia','Review your evidence'),detail:choose('Explora tu historial y las métricas habilitadas sin mezclar monedas de cuentas distintas.','Explore your history and enabled metrics without mixing different account currencies.'),route:'analytics',
 }:{
  title:choose('Convierte observaciones en acciones','Turn observations into actions'),detail:choose('Anota qué aprendiste y guarda una acción concreta en la revisión semanal.','Note what you learned and save one concrete action in the weekly review.'),route:'review',
 };
 return [goals[profile.goal],style,experience];
}
