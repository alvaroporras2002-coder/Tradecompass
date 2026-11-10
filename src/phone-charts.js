import {esc,icon} from './ui.js';
import {drawdownSeries} from './views/insights.js';

const models=new Map();
const finite=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

/** Preserve ordered bucket extrema plus the two endpoints without changing source records. */
export function samplePhonePoints(points,limit=160){
 const cap=Math.max(4,Math.floor(limit));
 if(points.length<=cap)return points.slice();
 const buckets=Math.max(1,Math.floor((cap-2)/2)),inner=points.length-2,indices=new Set([0,points.length-1]);
 for(let bucket=0;bucket<buckets;bucket++){
  const start=1+Math.floor(bucket*inner/buckets),end=1+Math.floor((bucket+1)*inner/buckets);
  let min=start,max=start;
  for(let i=start+1;i<end;i++){if(points[i].value<points[min].value)min=i;if(points[i].value>points[max].value)max=i;}
  if(start<end){indices.add(min);indices.add(max);}
 }
 return [...indices].sort((a,b)=>a-b).map(index=>points[index]);
}
function plotScale(values){
 const minimum=Math.min(0,...values),maximum=Math.max(0,...values),span=maximum-minimum||1;
 const raw=span/4,base=10**Math.floor(Math.log10(raw)),ratio=raw/base;
 const step=(ratio<=1?1:ratio<=2?2:ratio<=5?5:10)*base;
 const low=Math.floor(minimum/step)*step,high=Math.ceil(maximum/step)*step;
 const bottom=low===high?low-step:low,top=low===high?high+step:high;
 const ticks=[];for(let i=0;i<=8;i++){const value=bottom+i*step;if(value>top+step*.001)break;ticks.push(value);}
 return {low:bottom,high:top,ticks};
}
export function phoneChartModel(ctx,{kind='result'}={}){
 const equity=Array.isArray(ctx.stats?.equity)?ctx.stats.equity:[];
 const initial=finite(equity[0]?.value),percent=kind!=='drawdown'&&initial>0;
 const all=kind==='drawdown'?drawdownSeries(equity):equity.map(p=>({date:p.date,value:finite(p.pnl)}));
 const points=samplePhonePoints(all.map(p=>({date:p.date,value:percent?p.value/initial*100:p.value}))),scale=plotScale(points.map(p=>p.value));
 return {kind,percent,points,initial,...scale,x0:44,x1:344,y0:14,y1:202,width:360,height:240};
}
export function renderPhoneChart(ctx,{kind='result'}={}){
 const t=ctx.t,model=phoneChartModel(ctx,{kind});
 if(!ctx.stats?.closedCount||model.points.length<2)return `<div class="pc-empty">${icon('analytics',30)}<strong>${t('Tu evolución empieza aquí','Your progress starts here')}</strong><p>${t('Registra una operación cerrada para ver su resultado en el gráfico.','Log a closed trade to see its result on the chart.')}</p></div>`;
 const key=`pc-${kind}-${String(ctx.account?.id||'account').replace(/[^a-z0-9_-]/gi,'')}`;
 const locale=ctx.state?.settings?.language==='en'?'en-US':'es-CR';
 const display=value=>model.percent?`${value>0?'+':''}${new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2}).format(value)}%`:ctx.money(value);
 const tick=value=>model.percent?`${value>0?'+':''}${new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(value)}%`:new Intl.NumberFormat(locale,{notation:'compact',maximumFractionDigits:2}).format(value);
 const x=index=>model.x0+index/(model.points.length-1)*(model.x1-model.x0),y=value=>model.y1-(value-model.low)/(model.high-model.low)*(model.y1-model.y0);
 const coords=model.points.map((p,i)=>({x:x(i),y:y(p.value)}));
 const date=value=>ctx.date(value);
 models.set(key,{...model,coords,display,date});
 const title=kind==='drawdown'?t('Drawdown realizado','Realized drawdown'):t('Evolución del resultado','Result evolution');
 const line=coords.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
 const color=kind==='drawdown'?'#F18D8D':'#65D99A',last=model.points.at(-1),lastCoord=coords.at(-1),zero=y(0);
 const indices=[...new Set([0,Math.round((model.points.length-1)/2),model.points.length-1])];
 const dateLabels=indices.filter((index,i,array)=>i===0||date(model.points[index].date)!==date(model.points[array[i-1]].date));
 const unit=model.percent?t('% sobre saldo inicial','% of opening balance'):(ctx.account?.currency||'USD');
 return `<div class="pc-chart" data-pc-chart="${key}"><div class="pc-readout" role="status" aria-live="polite" aria-atomic="true"><span data-pc-date>${esc(date(last.date))}</span><strong class="${last.value<0?'pc-loss':'pc-gain'}" data-pc-value>${esc(display(last.value))}</strong></div><svg class="pc-svg" data-pc-svg tabindex="0" viewBox="0 0 360 240" role="img" aria-label="${esc(title)}. ${esc(display(model.points[0].value))} → ${esc(display(last.value))}. ${t('Usa las flechas para explorar los registros.','Use arrow keys to explore the records.')}"><defs><linearGradient id="${key}-fill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="${color}" stop-opacity=".27"/><stop offset="1" stop-color="${color}" stop-opacity=".025"/></linearGradient></defs>${model.ticks.map(value=>`<line x1="${model.x0}" x2="${model.x1}" y1="${y(value).toFixed(2)}" y2="${y(value).toFixed(2)}" class="pc-grid"/><text x="36" y="${(y(value)+3).toFixed(2)}" text-anchor="end" class="pc-axis">${esc(tick(value))}</text>`).join('')}${indices.map(index=>`<line x1="${x(index)}" x2="${x(index)}" y1="${model.y0}" y2="${model.y1}" class="pc-grid pc-grid-vertical"/>`).join('')}<line x1="${model.x0}" x2="${model.x1}" y1="${zero}" y2="${zero}" class="pc-zero"/><path d="${line}L${model.x1} ${zero}L${model.x0} ${zero}Z" fill="url(#${key}-fill)"/>${coords.slice(1).map((p,i)=>`<path d="M${coords[i].x.toFixed(2)} ${coords[i].y.toFixed(2)}L${p.x.toFixed(2)} ${p.y.toFixed(2)}" stroke="${kind==='drawdown'||(model.points[i].value+model.points[i+1].value)/2<0?'#F18D8D':color}" class="pc-line"/>`).join('')}${dateLabels.map((index,i)=>`<text x="${x(index)}" y="226" text-anchor="${index===0?'start':index===model.points.length-1?'end':'middle'}" class="pc-axis pc-date">${esc(date(model.points[index].date))}</text>`).join('')}<circle cx="${lastCoord.x}" cy="${lastCoord.y}" r="4" fill="${last.value<0?'#F18D8D':color}"/><g class="pc-focus" data-pc-focus visibility="hidden"><line data-pc-focus-line y1="${model.y0}" y2="${model.y1}"/><circle data-pc-focus-dot r="5"/></g></svg><div class="pc-foot"><span>${esc(unit)}</span><span>${t('Toca para explorar','Touch to explore')}</span></div></div>`;
}
export function bindPhoneCharts(ctx){
 document.querySelectorAll('[data-pc-chart]').forEach(root=>{
  const model=models.get(root.dataset.pcChart),svg=root.querySelector('[data-pc-svg]');if(!model||!svg)return;
  let selected=model.points.length-1;
  const show=index=>{
   selected=clamp(index,0,model.points.length-1);const point=model.points[selected],coord=model.coords[selected];
   const focus=root.querySelector('[data-pc-focus]');focus.setAttribute('visibility','visible');
   const line=root.querySelector('[data-pc-focus-line]');line.setAttribute('x1',coord.x);line.setAttribute('x2',coord.x);
   const dot=root.querySelector('[data-pc-focus-dot]');dot.setAttribute('cx',coord.x);dot.setAttribute('cy',coord.y);
   const value=root.querySelector('[data-pc-value]');value.textContent=model.display(point.value);value.classList.toggle('pc-loss',point.value<0);value.classList.toggle('pc-gain',point.value>=0);
   root.querySelector('[data-pc-date]').textContent=model.date(point.date);
  };
  const inspect=event=>{const box=svg.getBoundingClientRect();if(!box.width)return;const sx=(event.clientX-box.left)/box.width*model.width;show(Math.round((clamp(sx,model.x0,model.x1)-model.x0)/(model.x1-model.x0)*(model.points.length-1)));};
  svg.addEventListener('pointerdown',inspect);svg.addEventListener('pointermove',event=>{if(event.pointerType==='mouse'||event.buttons)inspect(event);});
  svg.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End','Escape'].includes(event.key))return;event.preventDefault();if(event.key==='Escape'){root.querySelector('[data-pc-focus]').setAttribute('visibility','hidden');return;}show(event.key==='Home'?0:event.key==='End'?model.points.length-1:selected+(event.key==='ArrowLeft'?-1:1));});
 });
}
