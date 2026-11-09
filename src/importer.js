/** MT5 position-history importer. No scripts or formulas in input are executed. */
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = {
  ticket: ['ticket','position','positionid','deal','dealid','order','id','posicion','operacion','boleto'],
  symbol: ['symbol','simbolo','instrument','instrumento','activo'],
  side: ['type','tipo','side','direction','direccion'],
  openedAt: ['opentime','openingtime','openedat','fechaapertura','horaapertura','apertura','open'],
  closedAt: ['closetime','closingtime','closedat','fechacierre','horacierre','cierre','close'],
  time: ['time','date','datetime','fecha','hora'],
  entry: ['openprice','entryprice','entry','precioentrada','precioapertura'],
  exit: ['closeprice','exitprice','exit','preciocierre','preciosalida'],
  price: ['price','precio'],
  volume: ['volume','lots','lot','volumen','lotes','size'],
  gross: ['profit','gross','grossprofit','beneficio','ganancia','result','resultado','pnl'],
  commission: ['commission','comision','commissions'],
  swap: ['swap','swaps'],
  fee: ['fee','fees','tarifa','tarifas'],
  stopLoss: ['sl','stoploss'],
  takeProfit: ['tp','takeprofit'],
};
const keyFor = header => Object.keys(aliases).find(key => aliases[key].includes(norm(header)));
function unescapeHTML(s) {
  return s.replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|#160);/gi, ' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&#(\d+);/g, (_,n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();
}
function htmlRows(text) {
  const safe = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
  return [...safe.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(match => [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell => unescapeHTML(cell[1]))).filter(row => row.length > 1);
}
function csvRows(text) {
  let input = text.replace(/^\uFEFF/, '');
  const sep = input.match(/^sep=([,;\t|])\s*\r?\n/i);
  if (sep) input = input.slice(sep[0].length);
  const first = input.split(/\r?\n/).find(line => line.trim()) || '';
  function count(delim) { let quoted = false, n = 0; for (let i=0;i<first.length;i++) { if(first[i] === '"') { if(quoted && first[i+1] === '"') i++; else quoted=!quoted; } else if(!quoted && first[i]===delim)n++; } return n; }
  const delimiter = sep?.[1] || [',',';','\t','|'].sort((a,b) => count(b)-count(a))[0];
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<input.length;i++) {
    const char=input[i];
    if(char==='"') { if(quoted && input[i+1]==='"') {cell+='"';i++;} else if(quoted || !cell.trim()) quoted=!quoted; else cell+=char; }
    else if(!quoted && char===delimiter){row.push(cell.trim());cell='';}
    else if(!quoted && (char==='\n'||char==='\r')) { if(char==='\r'&&input[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell=''; }
    else cell+=char;
  }
  if(quoted) throw new Error('El archivo contiene comillas sin cerrar.');
  row.push(cell.trim());if(row.some(Boolean))rows.push(row);
  return rows;
}
function numeric(value, field, optional = false) {
  let raw = String(value ?? '').trim();
  if(!raw || raw==='—' || raw==='-') {if(optional)return null;throw new Error(`Falta ${field}.`);}
  let negative = /^\(.*\)$/.test(raw);if(negative)raw=raw.slice(1,-1);
  raw = raw.replace(/[\s\u00A0\u202F']/g,'').replace(/^(?:USD|EUR|GBP|CAD|CRC|[$€£₡])/i,'').replace(/(?:USD|EUR|GBP|CAD|CRC|[$€£₡])$/i,'');
  if(!/^[+-]?\d+(?:[.,]\d+)*$/.test(raw))throw new Error(`${field}: número inválido (${String(value).slice(0,30)}).`);
  const comma=raw.lastIndexOf(','),dot=raw.lastIndexOf('.');
  if(comma>=0 && dot>=0) {
    const decimal=comma>dot?',':'.', thousands=decimal===','?'.':',';
    raw=raw.split(thousands).join('').replace(decimal,'.');
  } else if(comma>=0) {
    if((raw.match(/,/g)||[]).length>1) {if(!/^[+-]?\d{1,3}(,\d{3})+$/.test(raw))throw new Error(`${field}: separadores inválidos.`);raw=raw.replace(/,/g,'');}
    else raw=raw.replace(',','.');
  } else if((raw.match(/\./g)||[]).length>1) {
    if(!/^[+-]?\d{1,3}(\.\d{3})+$/.test(raw))throw new Error(`${field}: separadores inválidos.`);raw=raw.replace(/\./g,'');
  }
  const number=Number(raw);if(!Number.isFinite(number))throw new Error(`${field}: número no finito.`);
  return negative?-number:number;
}
function date(value, field) {
  let raw=String(value??'').trim();if(!raw)throw new Error(`Falta ${field}.`);
  raw=raw.replace(/^(\d{4})[./](\d{2})[./](\d{2})/, '$1-$2-$3').replace(/^(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1').replace(' ','T');
  // MT5 reports without an offset are interpreted as UTC; original text is retained.
  if(!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw))raw+='Z';
  const timestamp=Date.parse(raw);if(!Number.isFinite(timestamp))throw new Error(`${field}: fecha inválida.`);
  return new Date(timestamp).toISOString();
}
const hash = value => {let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
function mapHeaders(row) {
  const map={};row.forEach((header,index)=>{const key=keyFor(header);if(key)(map[key] ||= []).push(index);});return map;
}
const get = (row,map,key,n=0) => row[map[key]?.[n]] ?? '';
function isHeader(map){return !!(map.side && map.gross && (map.symbol || map.ticket));}
export function parseMT5(text, {accountId, existing=[]}={}) {
  const output={trades:[],duplicates:[],errors:[],cashflows:[],totals:{gross:0,commission:0,swap:0,net:0,count:0}};
  if(!accountId){output.errors.push({row:0,message:'Selecciona una cuenta antes de importar.'});return output;}
  if(typeof text!=='string' || !text.trim()){output.errors.push({row:0,message:'El archivo está vacío.'});return output;}
  let rows;try {rows=/<(?:html|table|tr)\b/i.test(text)?htmlRows(text):csvRows(text);}catch(error){output.errors.push({row:0,message:error.message});return output;}
  let map=null,headers=null;
  const seen=new Set(existing.filter(item=>item.accountId===accountId && item.sourceId).map(item=>String(item.sourceId)));
  for(let i=0;i<rows.length;i++) {
    const row=rows[i],candidate=mapHeaders(row);
    // A full MT5 report also contains Deals. Those can duplicate positions and
    // split entry/exit fees; import the Positions section instead.
    if (row.some(value => ['deal','dealid','transaccion'].includes(norm(value))) && row.some(value => ['direction','entrada','entry'].includes(norm(value)))) {map=null;headers=null;continue;}
    if(isHeader(candidate)){map=candidate;headers=row;continue;}
    // Do not carry a positions header into an unrelated report section.
    if(candidate.side && candidate.symbol && !candidate.gross){map=null;headers=null;continue;}
    if(!map)continue;
    const kind=norm(get(row,map,'side'));
    if(!kind)continue;
    const isCash=/^(balance|deposit|withdrawal|withdraw|credit|deposito|retiro|saldo|balanceoperation)$/.test(kind);
    const side=/^(buy|compra|comprar|long)$/.test(kind)?'buy':/^(sell|venta|vender|short)$/.test(kind)?'sell':null;
    if(!isCash && !side) {if(/^(total|totals|resumen|summary)/.test(kind))continue;output.errors.push({row:i+1,message:`Tipo no compatible: ${get(row,map,'side').slice(0,40)}.`});continue;}
    try {
      if(row.length<headers.length)throw new Error('La fila tiene menos columnas que el encabezado.');
      const sourceId=String(get(row,map,'ticket') || `row-${hash(JSON.stringify(row))}`);
      if(seen.has(sourceId)){output.duplicates.push({row:i+1,sourceId,original:row});continue;}
      const original={headers:[...headers],row:[...row],timezoneAssumption:'UTC when report has no offset'};
      const gross=numeric(get(row,map,'gross'),'beneficio');
      if(isCash){const flow={id:`cash-${hash(accountId+'|'+sourceId)}`,accountId,sourceId,source:'mt5',date:date(get(row,map,'closedAt')||get(row,map,'time')||get(row,map,'openedAt'),'fecha'),amount:gross,type:gross>=0?'deposit':'withdrawal',original,batchId:null};output.cashflows.push(flow);seen.add(sourceId);continue;}
      const symbol=get(row,map,'symbol').trim().toUpperCase();if(!symbol || symbol.length>40)throw new Error('El símbolo está vacío o es demasiado largo.');
      const openedAt=date(get(row,map,'openedAt')||get(row,map,'time'),'fecha de apertura');
      const closedAt=date(get(row,map,'closedAt')||get(row,map,'time',1)||get(row,map,'time'),'fecha de cierre');
      if(closedAt<openedAt)throw new Error('El cierre es anterior a la apertura.');
      const volume=numeric(get(row,map,'volume'),'volumen');if(volume<=0)throw new Error('El volumen debe ser mayor que cero.');
      const entry=numeric(get(row,map,'entry')||get(row,map,'price'),'precio de entrada',true);
      const exit=numeric(get(row,map,'exit')||get(row,map,'price',1),'precio de salida',true);
      if(entry!==null && entry<=0 || exit!==null && exit<=0)throw new Error('Los precios deben ser mayores que cero.');
      const commission=(numeric(get(row,map,'commission'),'comisión',true)??0)+(numeric(get(row,map,'fee'),'tarifa',true)??0),swap=numeric(get(row,map,'swap'),'swap',true)??0;
      const trade={id:`mt5-${hash(accountId+'|'+sourceId)}`,accountId,symbol,side,status:'closed',openedAt,closedAt,entry,exit,volume,gross,commission,swap,risk:null,stopLoss:numeric(get(row,map,'stopLoss'),'SL',true),takeProfit:numeric(get(row,map,'takeProfit'),'TP',true),strategy:'Importado MT5',tags:[],notes:'',reason:'',emotionBefore:'',emotionDuring:'',emotionAfter:'',lesson:'',checklist:{},attachments:[],source:'mt5',sourceId,batchId:null,original};
      output.trades.push(trade);seen.add(sourceId);
    }catch(error){output.errors.push({row:i+1,message:error.message,original:row});}
  }
  if(!headers && !output.trades.length && !output.cashflows.length && !output.errors.length)output.errors.push({row:0,message:'No se encontró una tabla de posiciones compatible. Usa CSV/TSV o un informe HTML de MT5 con tipo, símbolo, volumen, fecha y beneficio.'});
  for(const trade of output.trades){output.totals.gross+=trade.gross;output.totals.commission+=trade.commission;output.totals.swap+=trade.swap;}
  output.totals.net=output.totals.gross+output.totals.commission+output.totals.swap;output.totals.count=output.trades.length;
  for(const key of ['gross','commission','swap','net'])output.totals[key]=Math.round((output.totals[key]+Number.EPSILON)*100)/100;
  return output;
}
