"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import AppShell from "../../components/AppShell";

type MatchRow = { id: string; user_id: string; candidate_id: string; status: "pending"|"accepted"|"declined"; created_at: string; };
type ProfileRow = { id: string; full_name: string | null; bio?: string | null; stage?: string | null; goals?: string | null; hours_per_week?: number | null; };
type AcceptedMatchOption = { match_id: string; founder_a_id: string; founder_b_id: string; other_id: string; other: ProfileRow | null; };
type AgreementRow = { id: string; match_id: string; founder_a_id: string; founder_b_id: string; agreement_title: string|null; project_name: string|null; startup_stage: string|null; founder_a_role: string|null; founder_b_role: string|null; shared_responsibilities: string|null; equity_expectations: string|null; vesting_expectations: string|null; cash_contribution: string|null; time_commitment: string|null; availability_expectation: string|null; decision_style: string|null; conflict_handling: string|null; meeting_cadence: string|null; communication_preference: string|null; milestones: string|null; notes: string|null; status: "draft"|"finalized"; created_by: string|null; updated_by: string|null; last_edited_by_name: string|null; created_at: string; updated_at: string; };
type AgreementForm = { agreement_title:string; project_name:string; startup_stage:string; founder_a_role:string; founder_b_role:string; shared_responsibilities:string; equity_expectations:string; vesting_expectations:string; cash_contribution:string; time_commitment:string; availability_expectation:string; decision_style:string; conflict_handling:string; meeting_cadence:string; communication_preference:string; milestones:string; notes:string; status:"draft"|"finalized"; };
const emptyForm: AgreementForm = { agreement_title:"",project_name:"",startup_stage:"",founder_a_role:"",founder_b_role:"",shared_responsibilities:"",equity_expectations:"",vesting_expectations:"",cash_contribution:"",time_commitment:"",availability_expectation:"",decision_style:"",conflict_handling:"",meeting_cadence:"",communication_preference:"",milestones:"",notes:"",status:"draft" };

const S = {
  section: { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, padding:24, marginBottom:16 },
  input: { width:"100%", background:"var(--bg)", border:"1px solid var(--border)", borderRadius:10, padding:"10px 14px", color:"var(--text-primary)", fontSize:13, outline:"none", fontFamily:"inherit", WebkitTextFillColor:"var(--text-primary)" },
  label: { display:"block" as const, fontSize:10, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.1em", color:"var(--text-muted)", marginBottom:6 },
  btnPrimary: { background:"var(--accent)", border:"none", borderRadius:10, padding:"10px 22px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" },
  btnGhost: { background:"transparent", border:"1px solid var(--border)", borderRadius:10, padding:"10px 22px", color:"var(--text-muted)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
  sectionTitle: { fontFamily:"inherit", fontSize:17, fontWeight:700, color:"var(--text-primary)", marginBottom:4 },
  sectionSub: { fontSize:13, color:"var(--text-muted)", marginBottom:18 },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={S.label}>{label}</label>{children}</div>;
}
function FInput({ label, value, onChange, placeholder }: { label:string; value:string; onChange:(v:string)=>void; placeholder:string }) {
  return <Field label={label}><input style={S.input} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} /></Field>;
}
function FTextarea({ label, value, onChange, placeholder, rows=4 }: { label:string; value:string; onChange:(v:string)=>void; placeholder:string; rows?:number }) {
  return <Field label={label}><textarea style={{...S.input,resize:"vertical"}} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} /></Field>;
}

export default function AgreementPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const autosaveRef = useRef<NodeJS.Timeout|null>(null);
  const hydratingRef = useRef(false);
  const [me, setMe] = useState<string|null>(null);
  const [myName, setMyName] = useState("Founder");
  const [matches, setMatches] = useState<AcceptedMatchOption[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [agreementId, setAgreementId] = useState<string|null>(null);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingAgreement, setLoadingAgreement] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [autosaveLabel, setAutosaveLabel] = useState("Up to date");
  const [pendingRemoteRefresh, setPendingRemoteRefresh] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string|null>(null);
  const [lastEditedByName, setLastEditedByName] = useState<string|null>(null);
  const [form, setForm] = useState<AgreementForm>(emptyForm);

  useEffect(() => { loadAcceptedMatches(); }, []);
  useEffect(() => {
    if (!selectedMatchId) { hydratingRef.current=true; setAgreementId(null); setForm(emptyForm); setLastSavedAt(null); setLastEditedByName(null); setPendingRemoteRefresh(false); setDirty(false); setAutosaveLabel("Up to date"); queueMicrotask(()=>{hydratingRef.current=false;}); return; }
    loadAgreement(selectedMatchId);
  }, [selectedMatchId]);

  useEffect(() => {
    if (!selectedMatchId) return;
    const ch = supabase.channel(`agreement-sync-${selectedMatchId}`).on("postgres_changes",{event:"*",schema:"public",table:"founder_agreements",filter:`match_id=eq.${selectedMatchId}`},(payload)=>{
      const row=payload.new as AgreementRow|undefined;
      if (row?.updated_by===me) return;
      if (dirty) { setPendingRemoteRefresh(true); setAutosaveLabel("Remote changes available"); return; }
      loadAgreement(selectedMatchId,true);
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedMatchId, supabase, me, dirty]);

  useEffect(() => {
    if (!selectedMatchId||hydratingRef.current||!dirty) return;
    setAutosaveLabel("Saving...");
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(()=>saveAgreement(form.status,true),1200);
    return ()=>{ if (autosaveRef.current) clearTimeout(autosaveRef.current); };
  }, [form, dirty, selectedMatchId]);

  async function loadAcceptedMatches() {
    setLoadingMatches(true);
    const {data:ud}=await supabase.auth.getUser();
    if (!ud.user) { setLoadingMatches(false); return; }
    setMe(ud.user.id);
    const {data:prof}=await supabase.from("profiles").select("full_name").eq("id",ud.user.id).maybeSingle();
    if (prof?.full_name) setMyName(prof.full_name);
    const {data:acc}=await supabase.from("matches").select("id,user_id,candidate_id,status,created_at").eq("status","accepted");
    const accepted=((acc as MatchRow[])??[]).filter(m=>m.user_id===ud.user!.id||m.candidate_id===ud.user!.id);
    const otherIds=Array.from(new Set(accepted.map(m=>m.user_id===ud.user!.id?m.candidate_id:m.user_id)));
    let otherProfiles:ProfileRow[]=[];
    if (otherIds.length>0) { const {data:p}=await supabase.from("profiles").select("id,full_name,bio,stage,goals,hours_per_week").in("id",otherIds); otherProfiles=(p as ProfileRow[])??[]; }
    const hydrated=accepted.map(m=>{ const otherId=m.user_id===ud.user!.id?m.candidate_id:m.user_id; return {match_id:m.id,founder_a_id:m.user_id,founder_b_id:m.candidate_id,other_id:otherId,other:otherProfiles.find(p=>p.id===otherId)??null}; });
    setMatches(hydrated); setSelectedMatchId(hydrated[0]?.match_id||""); setLoadingMatches(false);
  }

  async function loadAgreement(matchId:string,silent=false) {
    if (!silent) setLoadingAgreement(true);
    const {data,error}=await supabase.from("founder_agreements").select("*").eq("match_id",matchId).maybeSingle();
    if (error) { if (!silent) setLoadingAgreement(false); return; }
    hydratingRef.current=true;
    if (!data) { setAgreementId(null); setForm(emptyForm); setLastSavedAt(null); setLastEditedByName(null); setPendingRemoteRefresh(false); setDirty(false); setAutosaveLabel("Up to date"); queueMicrotask(()=>{hydratingRef.current=false;}); if (!silent) setLoadingAgreement(false); return; }
    const row=data as AgreementRow;
    setAgreementId(row.id);
    setForm({agreement_title:row.agreement_title??"",project_name:row.project_name??"",startup_stage:row.startup_stage??"",founder_a_role:row.founder_a_role??"",founder_b_role:row.founder_b_role??"",shared_responsibilities:row.shared_responsibilities??"",equity_expectations:row.equity_expectations??"",vesting_expectations:row.vesting_expectations??"",cash_contribution:row.cash_contribution??"",time_commitment:row.time_commitment??"",availability_expectation:row.availability_expectation??"",decision_style:row.decision_style??"",conflict_handling:row.conflict_handling??"",meeting_cadence:row.meeting_cadence??"",communication_preference:row.communication_preference??"",milestones:row.milestones??"",notes:row.notes??"",status:row.status??"draft"});
    setLastSavedAt(row.updated_at); setLastEditedByName(row.last_edited_by_name??null); setPendingRemoteRefresh(false); setDirty(false); setAutosaveLabel("Up to date");
    queueMicrotask(()=>{hydratingRef.current=false;});
    if (!silent) setLoadingAgreement(false);
  }

  async function saveAgreement(nextStatus?:"draft"|"finalized",silent=false) {
    if (!me) return;
    const sm=matches.find(m=>m.match_id===selectedMatchId);
    if (!sm) return;
    if (!silent) setSaving(true);
    const payload={match_id:sm.match_id,founder_a_id:sm.founder_a_id,founder_b_id:sm.founder_b_id,...form,status:nextStatus??form.status,created_by:agreementId?undefined:me,updated_by:me,last_edited_by_name:myName};
    const {data,error}=await supabase.from("founder_agreements").upsert(payload,{onConflict:"match_id"}).select().single();
    if (!silent) setSaving(false);
    if (error) { setAutosaveLabel("Save failed"); if (!silent) alert("Failed: "+error.message); return; }
    const row=data as AgreementRow;
    setAgreementId(row.id); setForm(p=>({...p,status:row.status})); setLastSavedAt(row.updated_at); setLastEditedByName(row.last_edited_by_name??null); setDirty(false); setPendingRemoteRefresh(false);
    setAutosaveLabel(nextStatus==="finalized"?"Agreement finalized":"All changes saved");
    if (!silent&&nextStatus==="finalized") alert("Agreement finalized.");
  }

  function upd<K extends keyof AgreementForm>(key:K,value:AgreementForm[K]) { setForm(p=>({...p,[key]:value})); setDirty(true); setAutosaveLabel("Unsaved changes"); }

  const sm=matches.find(m=>m.match_id===selectedMatchId);

  if (loadingMatches) return <AppShell title="Founder Agreement"><div style={{color:"var(--text-muted)",padding:40}}>Loading...</div></AppShell>;

  if (matches.length===0) return (
    <AppShell title="Founder Agreement">
      <div style={{...S.section,textAlign:"center",padding:60}}>
        <p style={{fontSize:18,fontWeight:700,color:"var(--text-primary)",marginBottom:8}}>No accepted matches yet</p>
        <p style={{color:"var(--text-muted)",fontSize:14}}>Agreement unlocks after a founder match is accepted.</p>
      </div>
    </AppShell>
  );

  return (
    <AppShell title="Founder Agreement">
      <div style={{maxWidth:900}}>

        {/* Status bar */}
        <div style={{...S.section,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:16}}>
          <div>
            <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--text-muted)",marginBottom:4}}>Agreement Status</p>
            <p style={{fontSize:16,fontWeight:700,color:form.status==="finalized"?"var(--green)":"var(--amber)",textTransform:"capitalize"}}>{form.status}</p>
            <p style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{autosaveLabel}</p>
          </div>
          <div style={{fontSize:11,color:"var(--text-muted)",textAlign:"right"}}>
            {lastEditedByName && <p>Edited by: <span style={{color:"var(--text-muted)"}}>{lastEditedByName}</span></p>}
            {lastSavedAt && <p>Saved: <span style={{color:"var(--text-muted)"}}>{new Date(lastSavedAt).toLocaleString()}</span></p>}
          </div>
        </div>

        {pendingRemoteRefresh && (
          <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
            <p style={{fontSize:13,color:"var(--amber)"}}>Your cofounder saved changes. Load latest?</p>
            <button onClick={()=>selectedMatchId&&loadAgreement(selectedMatchId,true)} style={{...S.btnGhost,padding:"7px 16px",fontSize:12,color:"var(--amber)",borderColor:"var(--amber-border)"}}>Load Latest</button>
          </div>
        )}

        {/* Match + partner info */}
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
          <div style={S.section}>
            <p style={S.sectionTitle}>Match Selection</p>
            <p style={S.sectionSub}>This agreement is shared — both founders can edit.</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Matched Founder">
                <select style={S.input} value={selectedMatchId} onChange={e=>setSelectedMatchId(e.target.value)}>
                  {matches.map(m=><option key={m.match_id} value={m.match_id}>{m.other?.full_name??"Unnamed"}</option>)}
                </select>
              </Field>
              <Field label="Agreement Status">
                <select style={S.input} value={form.status} onChange={e=>upd("status",e.target.value as "draft"|"finalized")}>
                  <option value="draft">Draft</option><option value="finalized">Finalized</option>
                </select>
              </Field>
            </div>
          </div>
          <div style={S.section}>
            <p style={S.sectionTitle}>Cofounder</p>
            {[["Name",sm?.other?.full_name??"—"],["Bio",sm?.other?.bio??"-"],["Stage",sm?.other?.stage??"-"]].map(([l,v])=>(
              <div key={l} style={{marginBottom:10}}>
                <p style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--text-muted)",marginBottom:2}}>{l}</p>
                <p style={{fontSize:13,color:"#cbd5e1"}}>{v}</p>
              </div>
            ))}
          </div>
        </div>

        {loadingAgreement ? <div style={{color:"#94a3b8",padding:20}}>Loading agreement...</div> : (
          <>
            {/* Sections */}
            {[
              {title:"Agreement Basics",sub:"Define the foundation of the partnership.",fields:[
                {type:"input",label:"Agreement Title",key:"agreement_title",ph:"Cofounder Working Agreement v1"},
                {type:"input",label:"Project / Startup Name",key:"project_name",ph:"Your startup name"},
                {type:"input",label:"Startup Stage",key:"startup_stage",ph:"Idea / MVP / Early Revenue"},
              ]},
              {title:"Roles & Responsibilities",sub:"Make ownership clear early.",fields:[
                {type:"input",label:"Founder A Role",key:"founder_a_role",ph:"Product / Business"},
                {type:"input",label:"Founder B Role",key:"founder_b_role",ph:"Tech / Engineering"},
                {type:"textarea",label:"Shared Responsibilities",key:"shared_responsibilities",ph:"Fundraising, hiring, investor updates..."},
              ]},
              {title:"Equity & Commitment",sub:"Set expectations before assumptions become conflict.",fields:[
                {type:"textarea",label:"Equity Expectations",key:"equity_expectations",ph:"Expected split and reasoning"},
                {type:"textarea",label:"Vesting Expectations",key:"vesting_expectations",ph:"4 years, 1 year cliff..."},
                {type:"textarea",label:"Cash Contribution",key:"cash_contribution",ph:"Who contributes money and when?"},
                {type:"input",label:"Time Commitment",key:"time_commitment",ph:"20 hours/week"},
                {type:"input",label:"Availability",key:"availability_expectation",ph:"Respond within 24 hours"},
              ]},
              {title:"Decision-Making & Conflict",sub:"Define how you handle hard moments.",fields:[
                {type:"textarea",label:"Decision-Making Style",key:"decision_style",ph:"Consensus, domain ownership..."},
                {type:"textarea",label:"Conflict Handling",key:"conflict_handling",ph:"How disagreements get resolved"},
              ]},
              {title:"Working Rhythm",sub:"Set the cadence that keeps both founders aligned.",fields:[
                {type:"input",label:"Meeting Cadence",key:"meeting_cadence",ph:"Weekly / Bi-weekly"},
                {type:"input",label:"Communication",key:"communication_preference",ph:"Slack / WhatsApp / Chat"},
                {type:"textarea",label:"Milestones",key:"milestones",ph:"30/60/90 day expectations"},
              ]},
              {title:"Notes",sub:"Anything else important.",fields:[
                {type:"textarea",label:"Additional Notes",key:"notes",ph:"Assumptions, risks, special terms..."},
              ]},
            ].map(section=>(
              <div key={section.title} style={S.section}>
                <p style={S.sectionTitle}>{section.title}</p>
                <p style={S.sectionSub}>{section.sub}</p>
                <div style={{display:"grid",gridTemplateColumns:section.fields.length>2?"1fr 1fr":"1fr 1fr",gap:14}}>
                  {section.fields.map(f=>f.type==="textarea"?(
                    <FTextarea key={f.key} label={f.label} value={(form as any)[f.key]} onChange={v=>upd(f.key as any,v)} placeholder={f.ph} />
                  ):(
                    <FInput key={f.key} label={f.label} value={(form as any)[f.key]} onChange={v=>upd(f.key as any,v)} placeholder={f.ph} />
                  ))}
                </div>
              </div>
            ))}

            {/* Sticky save bar */}
            <div style={{position:"sticky",bottom:16,zIndex:10}}>
              <div style={{background:"rgba(6,8,16,0.96)",border:"1px solid rgba(99,102,241,0.2)",backdropFilter:"blur(20px)",borderRadius:16,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                <div>
                  <p style={{fontWeight:700,color:"#f0f2fc",fontSize:14}}>Shared agreement is live</p>
                  <p style={{fontSize:12,color:"#475569"}}>Autosave on. Both founders can edit.</p>
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  <button onClick={()=>selectedMatchId&&loadAgreement(selectedMatchId,true)} style={S.btnGhost}>Refresh</button>
                  <button onClick={()=>saveAgreement("draft")} disabled={saving} style={{...S.btnGhost,opacity:saving?0.5:1}}>{saving?"Saving...":"Save Draft"}</button>
                  <button onClick={()=>saveAgreement("finalized")} disabled={saving} style={{...S.btnPrimary,opacity:saving?0.5:1}}>{saving?"Saving...":"Finalize Agreement"}</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}