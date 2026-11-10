# TradeCompass — complete visual reference inventory

Source: attached `TradeCompass_49_Imagenes_Carbon_Lima (1)(1).pdf`, 24 pages, 49 numbered compositions. All 24 rendered pages were visually reviewed. These are 49 design compositions, including brand rules and marketing assets, rather than 49 separate application screens.

## Exact design system

- Brand: compass symbol, lime ring and white diagonal compass needle pointing northeast, TradeCompass wordmark.
- Palette: background #101214; surface #1C2023; elevation/border #2A3033; text #F3F5F1; lime #C1FF5E; gain/mint #65D99A; loss/coral #F18D8D; warning/amber #EAC66D.
- Suggested color proportions: 60% background, 25% surfaces, 10% text, 5% accents.
- Fonts: Manrope headings, Inter UI and reading, JetBrains Mono data/code (tabular numerals).
- Layout: 8 px spacing grid (8/16/24/32); broad rounded dark cards; subtle borders; bright filled lime primary buttons; secondary outlined lime; tertiary gray.
- Tap area >=44 px. Keyboard visible focus. Text labels accompany color. Persistent field labels, inline validation.
- Light and dark themes. Reduced motion preference. Desktop left sidebar, mobile bottom navigation. Navigation examples vary between compositions; a single consistent mobile nav with a More menu covers the complete architecture.
- Brand phrases: “Tu historial, tus reglas, una revisión más clara”; “Tu diario. Tus reglas. Tu perspectiva.”; “Diario de trading: registros, disciplina y evidencia.”

## All 49 compositions and how they apply

| # | PDF page | Composition | Application implication |
|---|---|---|---|
| 01 | 1 | Moodboard digital | Carbon/lime dashboard, compass, curve motifs, Observe/Register/Review tone. |
| 02 | 1 | Concepto central | Observe market context; record reason/context; maintain discipline checklist; test conceptual EAs. |
| 03 | 2 | Propuesta de valor | Unified history, clear review, rules/checklist, manual and MT5 importing; free/pro plan cards. |
| 04 | 2 | Personalidad y tono | Clear, calm, transparent microcopy for result, developing features, errors, risks and Pro upsell. |
| 05 | 3 | Racional de diseño | Compass orientation; grid/alignment; hierarchical cards; tabular values; semantic gain/loss colors. |
| 06 | 3 | Logotipo principal | Full compass + wordmark and branded footer/lockup. |
| 07 | 4 | Logotipo horizontal compacto | Compact header/sidebar; search and account avatar; diary quick action. |
| 08 | 4 | Isotipo | Same compass in avatar/app/sidebar; consistent northeast needle direction at all sizes. |
| 09 | 5 | Icono de aplicación y favicon | App icon and favicon from compass; responsive PWA assets 1024/512/192/180 etc. |
| 10 | 5 | Versiones de color | Logo treatment for dark, light, lime, black, white and monochrome backgrounds. |
| 11 | 6 | Reglas de uso | Clear space around mark; do not stretch/rotate/recolor; symbol minimum 24px, compact logo recommended >=120px. |
| 12 | 6 | Paleta de marca | Exact tokens listed above and restrained accent use. |
| 13 | 7 | Colores funcionales | Gain positive, loss negative, warning amber, neutral information, connected/sync/disconnected connection badges. |
| 14 | 7 | Sistema tipográfico | Manrope headings, Inter UI, JetBrains Mono numeric/coding; financial values aligned/tabular. |
| 15 | 8 | Familia de iconos | Coherent stroke icons for trades, diary, strategy, accounts, settings, market, lab, library, search, notifications. |
| 16 | 8 | Elementos gráficos auxiliares | Compass, fine grid, orientation arcs, line-chart wave; branded headers/cards/empty states. |
| 17 | 9 | Temas claro y oscuro | Same content/layout in both themes; adapted backgrounds, borders, controls and charts. |
| 18 | 9 | Movimiento y transiciones | Section changes, side panels, loading states, successful save; reduce-motion toggle. |
| 19 | 10 | Mapa de navegación | Access → Dashboard → Diary / Markets / EA library / Lab, plus Account/Connections and Billing. Statistics, Review, Discipline occur in nav elsewhere. |
| 20 | 10 | Registro y configuración inicial | Onboarding progress: account, language/timezone, trading account/currency/source, discipline rules, ready. Shortcuts import / record. |
| 21 | 11 | Flujo del diario | Manual entry with instrument/direction/entry/exit/notes/emotion → import preview/duplicate detection → market context/session/checklist → weekly review with period/symbol/metrics/chart/improvement. |
| 22 | 11 | Flujo de los EA | Catalog → concept detail → future download unavailable → desktop MT5 install guide → consult external results. Five EAs, all developing; mobile does not execute EA. |
| 23 | 12 | Flujo de suscripción | Choose plan → review/pay → administer billing/history/payment → cancel with confirmation; history/export retained. Real charges require payment integration. |
| 24 | 12 | Diseño adaptable | Same dashboard on desktop, tablet, phone; mobile compact cards and bottom navigation. |
| 25 | 13 | Botones y formularios | Create/view/delete controls; labeled trade form; account/date selectors; file upload, states neutral/focus/valid/invalid; save confirmation. |
| 26 | 13 | Componentes de navegación | Sidebar and mobile bottom bar; EA detail tabs Summary / Parameters / Rules / Tests / Notes; searchable catalog/results. |
| 27 | 14 | Tarjetas y tablas | Summary KPIs, discipline ring/checklist, trade table, multiple account cards, five EA cards. |
| 28 | 14 | Sistema de gráficos | Market candles, realized balance curve, drawdown, strategy comparison lines. |
| 29 | 15 | Avisos, ventanas y ayuda | Import confirmation, invalid-file error, saved toast, contextual import help, destructive delete modal. |
| 30 | 15 | Estados de pantalla | Loading, empty diary/register CTA, disconnected/reconnect, save error/retry, Pro feature state, ready/diary CTA. |
| 31 | 16 | Accesibilidad | Readable contrast, labels, keyboard focus, 44px targets, motion preference, textual gain/loss meaning. |
| 32 | 16 | Página comercial | Product landing, app mockup, create-account CTA, benefits, free/pro offers, future EA concepts. |
| 33 | 17 | Dashboard | Net result, discipline, trades, weekly result; realized balance chart, recent activity, register CTA. |
| 34 | 17 | Diario | Filter account/strategy/period; trade list table/cards; selected trade entry/exit/cost/result/notes/emotion/checklist; period summary. |
| 35 | 18 | Mercados | Watchlist EURUSD/XAUUSD/USDJPY/GBPUSD/NAS100, favorites, symbol/timeframe, candles/line/bars and tools. Explicit sample source/simulated update/UTC−6/illustrative data. |
| 36 | 18 | Biblioteca de EA | Five conceptual cards, description/limitation/status and concept detail CTA. Desktop MT5 execution note. |
| 37 | 19 | Detalle de un EA | Trend Navigator example: proposed logic, rules to define (entry/exit/risk), limitations, illustrative pseudocode, conceptual v0.1, unvalidated, unavailable download, MT5 desktop note. |
| 38 | 19 | Laboratorio | Historical vs forward demo tabs; no published tests; evaluation template version/period/costs/sample/limitations. Developing label. |
| 39 | 20 | Planes y facturación | Gratis US$0: 1 account, 30 new trades/month, essential stats, review/discipline, export. Pro US$9/month or US$90/year: up to 5 accounts, advanced analysis, full stats/review/discipline. Manage/cancel; export always retained. |
| 40 | 20 | Cuenta y conexiones | Editable profile, language ES/EN, timezone/currency, account active/inactive/add, file import; automatic broker connection “Próximamente”; export and delete data. |
| 41 | 21 | Plantillas de correo | Three branded sample templates: Welcome/Start, Recover access, Subscription confirmation/View plan. Sending requires explicit setup/authorization. |
| 42 | 21 | Informes exportados | Diary summary with operation count/hit rate/net result/R-B, discipline, distribution and notes; EA evaluation template with strategy/version/period/future results and rule evaluation. |
| 43 | 22 | Mockup comercial de web y dashboard | Landing/dashboard consistency; registration/import, discipline, analytics, review benefits. |
| 44 | 22 | Mockup de aplicación móvil | Phone Summary, Diary, EA library, consistent bottom nav, new trade CTA. Explicit record/import only; no order execution. |
| 45 | 23 | Plantillas de comunicaciones | Product introduction, educational Trend Navigator concept, product updates (clearer analysis, faster flow, diary controls). |
| 46 | 23 | Instalación y documentación | Guide/import step-by-step; future desktop MT5 EA installation; FAQ; clarify record/import and export access. |
| 47 | 24 | Presencia digital | Home screen app icon, sign-in screen, favicon, search and shared-link preview metadata. Domain TBD in reference. |
| 48 | 24 | Manual breve de marca | Brand reference page with logo/color/type/components, index and curve motif. |
| 49 | 24 | Especificaciones para desarrollo | Responsive principal views, 8px grid, buttons/input states, visual card anatomy, >=44px target, tokens and external EA concept limits. |

## EA catalog content

| Name | Strategy | Limitation |
|---|---|---|
| Trend Navigator | Follows main market trend | Can suffer in sideways markets |
| Range Explorer | Trades well-defined ranges | Loses effectiveness in trending markets |
| Session Breakout | Breakouts in high-activity sessions | Depends on session volatility |
| Momentum Pulse | Short-term price impulses | Can generate false signals in low volatility |
| Pullback Planner | Retracements aligned with trend | Requires a clear trend for context |

All five: “En desarrollo”; conceptual only; no validated returns. Trend Navigator illustrative metadata in #22: Trend approach; H1–D1; Forex/indices; entry, exit, SL and TP rules pending. Example code explicitly nonoperative.

## Completeness and truthful states

Actual journal CRUD, import/export, discipline, metrics and review can be implemented fully. Market quotes in the supplied design are explicitly simulated. EA execution/download and automatic broker integration are explicitly future/developing. Billing screen is a proposed plan design; do not simulate a real charge or report an active paid subscription without integration. Brand and marketing compositions should be preserved in a browsable visual guide to honor all 49, alongside the functional application.
