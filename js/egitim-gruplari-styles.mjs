// Match the classroom management cards and controls in index.html.
export const groupStyles=`
.ig-panel{font-family:inherit;font-size:13.5px;line-height:1.5;color:var(--c-text,#1e293b);min-width:0}
.ig-panel *{box-sizing:border-box}
.ig-header{display:flex;align-items:center;justify-content:space-between;gap:16px;background:linear-gradient(135deg,#2D5E3E,#4A7C59);color:#fff;border-radius:14px;padding:16px 18px}
.ig-panel h3,.ig-panel h4{font-family:var(--font-display,inherit);margin:0;font-weight:700}
.ig-panel h3{font-size:17px}.ig-panel h4{font-size:15px}
.ig-header p{margin:4px 0 0;opacity:.88;font-size:12px}
.ig-panel .ig-header button{background:transparent;color:#fff;border-color:#ffffff80;flex-shrink:0}
.ig-intro,.ig-help{color:var(--c-muted,#64748b);margin:10px 0 14px;font-size:12px}
.ig-card{border:1px solid var(--c-line,#E2E8F0);border-radius:14px;padding:18px;margin:14px 0;background:#fff}
.ig-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:14px}
.ig-panel label:not(.ig-check){display:flex;flex-direction:column;gap:6px;min-width:0;font-size:12px;font-weight:600}
.ig-panel input:not([type=checkbox]),.ig-panel select,.ig-panel button{font:inherit;border:1px solid var(--c-line,#E2E8F0);border-radius:10px;padding:10px 12px;max-width:100%;min-width:0;min-height:44px;background:#fff;color:inherit}
.ig-panel input:not([type=checkbox]),.ig-panel select{width:100%;font-weight:400}
.ig-panel button{cursor:pointer;font-weight:600}
.ig-panel button:hover:not(:disabled){background:#F2F7F3;border-color:#4A7C59}
.ig-panel .ig-header button:hover:not(:disabled){background:#ffffff20;border-color:#fff}
.ig-panel button.ig-primary{background:#2D5E3E;color:#fff;border-color:#2D5E3E}
.ig-panel button.ig-primary:hover:not(:disabled){background:#244c32}
.ig-panel button.ig-danger{color:#b91c1c}
.ig-panel :is(input,select,button):focus-visible{outline:3px solid #91bca0;outline-offset:2px}
.ig-panel button:disabled{opacity:.45;cursor:not-allowed}
.ig-panel input[type=checkbox]{width:20px;height:20px;min-height:20px;margin:0;accent-color:#2D5E3E;cursor:pointer;vertical-align:middle}
.ig-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:14px}
.ig-check{display:flex;align-items:center;gap:8px;margin-right:auto;min-height:44px}
.ig-selection{padding:12px 0}.ig-selection strong{color:#2D5E3E;font-size:12px;margin-left:auto}
.ig-table{width:100%;min-width:0}.ig-panel table{width:100%;border-collapse:collapse;table-layout:fixed}
.ig-panel caption{text-align:left;margin:0;padding:0 0 8px}
.ig-panel td,.ig-panel th{text-align:left;padding:12px 10px;border-bottom:1px solid var(--c-line,#E2E8F0);overflow-wrap:anywhere}
.ig-panel th{background:#f8faf9;color:var(--c-muted,#64748b);font-size:12px;font-weight:600}
.ig-panel th:first-child{width:52px}.ig-panel small{color:var(--c-muted,#64748b)}
.ig-selected{background:#F2F7F3}.ig-badge{display:inline-block;border-radius:8px;background:#E8F3EB;color:#2D5E3E;padding:4px 8px;font-size:12px}.ig-unassigned{background:#f1f5f9;color:#64748b}
.ig-panel .ig-empty{text-align:center;padding:28px 12px;color:var(--c-muted,#64748b)}
.ig-assignment{display:flex;align-items:flex-end;flex-wrap:wrap;gap:10px;padding:16px;margin-top:16px;border-radius:12px;background:#F2F7F3}
.ig-assignment label{flex:1 1 220px}.ig-panel [data-status]:not(:empty){padding-top:14px;overflow-wrap:anywhere}
@media(max-width:700px){.ig-fields{grid-template-columns:minmax(0,1fr)}.ig-card{padding:14px}.ig-header{align-items:flex-start;flex-wrap:wrap}.ig-selection strong{width:100%;margin:0}.ig-assignment{padding:12px}.ig-assignment label,.ig-assignment button{width:100%;flex-basis:100%}}
@media(max-width:480px){.ig-panel thead{position:absolute;clip-path:inset(50%);width:1px;height:1px;overflow:hidden}.ig-panel table,.ig-panel tbody{display:block}.ig-panel tr{display:grid;grid-template-columns:36px minmax(0,1fr);border:1px solid var(--c-line,#E2E8F0);border-radius:12px;margin-bottom:8px;padding:10px}.ig-panel td{display:block;border:0;padding:4px;min-width:0}.ig-panel td:first-child{grid-row:1 / span 3;display:flex;align-items:flex-start;padding-top:6px}.ig-panel td[data-label]{grid-column:2}.ig-panel td[data-label]::before{content:attr(data-label) ': ';color:#64748b;font-size:12px}.ig-panel .ig-empty{grid-column:1 / -1;display:block}.ig-panel caption{display:block}.ig-row button{flex:1 1 auto}}
`;
