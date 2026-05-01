require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');
const { pool } = require('./db');
const { callAI, providerConfig, modelsCatalog } = require('./ai');

const app = express();
const port = process.env.PORT || 8080;
const storageRoot = path.join(__dirname, '..', 'storage', 'documents');
fs.mkdirSync(storageRoot, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const id = String(req.params.id || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
      const dir = path.join(storageRoot, id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(morgan('dev'));
app.use('/storage/documents', express.static(storageRoot));
app.use(express.static(path.join(__dirname, '..', 'public')));

const emptyToNull = v => v === '' || v === undefined ? null : v;
const like = v => `%${String(v || '').toLowerCase()}%`;
const profileFields = ['grant_status','relationship_status','priority','owner','contact_person_or_role','contacted_with','last_contact_date','next_action','next_action_date','grant_notes','relationship_notes','custom_tags','organization_summary','mission_alignment_notes','program_fit_notes','eligibility_risk_notes','funding_fit_score','relationship_strength_score','urgency_score','estimated_ask_amount','currency','deadline_date','decision_cycle','budget_status','warm_intro_source','stakeholder_map','decision_maker_notes','relationship_goal','value_offer','stewardship_plan','risks_and_objections','evidence_assets','next_best_action','ai_recommended_message','last_research_date'];

app.get('/api/health', async (req,res,next)=>{ try{ const r=await pool.query('SELECT now() as now'); res.json({ok:true, db_time:r.rows[0].now, ai: providerConfig()}); }catch(e){next(e);} });
app.get('/api/ai/config', (req,res)=>res.json({ current: providerConfig(), models: modelsCatalog(), env_example: ['AI_PROVIDER=openai','OPENAI_API_KEY=sk-...','OPENAI_MODEL=gpt-5.5','AI_TEMPERATURE=0.3','AI_MAX_TOKENS=1400'] }));

app.get('/api/grantmakers', async (req,res,next)=>{ try{
  const { q,country,segment,grant_status,relationship_status,min_fit }=req.query; const vals=[]; const where=[];
  if(q){ vals.push(like(q)); where.push(`(lower(g.name) LIKE $${vals.length} OR lower(coalesce(g.country,'')) LIKE $${vals.length} OR lower(coalesce(g.segment,'')) LIKE $${vals.length} OR lower(coalesce(g.fit,'')) LIKE $${vals.length} OR lower(coalesce(g.ai_strategy,'')) LIKE $${vals.length} OR lower(coalesce(c.grant_notes,'')) LIKE $${vals.length} OR lower(coalesce(c.relationship_notes,'')) LIKE $${vals.length} OR lower(coalesce(c.custom_tags,'')) LIKE $${vals.length})`); }
  if(country){ vals.push(country); where.push(`g.country=$${vals.length}`); }
  if(segment){ vals.push(segment); where.push(`g.segment=$${vals.length}`); }
  if(grant_status){ vals.push(grant_status); where.push(`c.grant_status=$${vals.length}`); }
  if(relationship_status){ vals.push(relationship_status); where.push(`c.relationship_status=$${vals.length}`); }
  if(min_fit){ vals.push(Number(min_fit)); where.push(`coalesce(c.funding_fit_score,0) >= $${vals.length}`); }
  const sql = `SELECT g.*, c.*, (SELECT count(*)::int FROM contact_people cp WHERE cp.grantmaker_id=g.id) contacts_count, (SELECT count(*)::int FROM interactions i WHERE i.grantmaker_id=g.id) interactions_count, (SELECT count(*)::int FROM grant_opportunities go WHERE go.grantmaker_id=g.id) opportunities_count, (SELECT count(*)::int FROM application_documents d WHERE d.grantmaker_id=g.id) documents_count, (SELECT count(*)::int FROM tasks t WHERE t.grantmaker_id=g.id AND t.status <> 'Done') open_tasks_count FROM grantmakers g LEFT JOIN crm_profiles c ON c.grantmaker_id=g.id ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY coalesce(c.priority,3), coalesce(c.funding_fit_score,50) DESC, g.name ASC`;
  const r=await pool.query(sql,vals); res.json(r.rows);
}catch(e){next(e);} });

async function getGrantmakerBundle(id) {
  const r=await pool.query('SELECT g.*, c.* FROM grantmakers g LEFT JOIN crm_profiles c ON c.grantmaker_id=g.id WHERE g.id=$1',[id]);
  if(!r.rowCount) return null;
  const [contacts,interactions,tasks,opps,docs,assets,compliance,ai,outbound,inbound,events]=await Promise.all([
    pool.query('SELECT * FROM contact_people WHERE grantmaker_id=$1 ORDER BY is_primary DESC, updated_at DESC',[id]),
    pool.query('SELECT * FROM interactions WHERE grantmaker_id=$1 ORDER BY occurred_at DESC',[id]),
    pool.query('SELECT * FROM tasks WHERE grantmaker_id=$1 ORDER BY due_date ASC NULLS LAST, created_at DESC',[id]),
    pool.query('SELECT * FROM grant_opportunities WHERE grantmaker_id=$1 ORDER BY deadline_date ASC NULLS LAST, updated_at DESC',[id]),
    pool.query('SELECT * FROM application_documents WHERE grantmaker_id=$1 ORDER BY created_at DESC, due_date ASC NULLS LAST',[id]),
    pool.query('SELECT * FROM relationship_assets WHERE grantmaker_id=$1 ORDER BY send_after_date ASC NULLS LAST',[id]),
    pool.query('SELECT * FROM compliance_notes WHERE grantmaker_id=$1 ORDER BY created_at DESC',[id]),
    pool.query('SELECT * FROM ai_history WHERE grantmaker_id=$1 ORDER BY created_at DESC LIMIT 20',[id]),
    pool.query('SELECT * FROM outbound_messages WHERE grantmaker_id=$1 ORDER BY created_at DESC',[id]),
    pool.query('SELECT * FROM inbound_messages WHERE grantmaker_id=$1 ORDER BY received_at DESC NULLS LAST, created_at DESC',[id]),
    pool.query('SELECT * FROM calendar_events WHERE grantmaker_id=$1 ORDER BY starts_at ASC NULLS LAST, created_at DESC',[id])
  ]);
  return {...r.rows[0],contacts:contacts.rows,interactions:interactions.rows,tasks:tasks.rows,opportunities:opps.rows,documents:docs.rows,relationship_assets:assets.rows,compliance_notes:compliance.rows,ai_history:ai.rows,outbound_messages:outbound.rows,inbound_messages:inbound.rows,calendar_events:events.rows};
}
app.get('/api/grantmakers/:id', async (req,res,next)=>{ try{ const data=await getGrantmakerBundle(req.params.id); if(!data)return res.status(404).json({error:'Not found'}); res.json(data); }catch(e){next(e);} });

app.put('/api/grantmakers/:id/profile', async (req,res,next)=>{ try{
  const b=req.body||{}; const vals=[req.params.id]; const cols=[]; for(const k of profileFields){ if(Object.prototype.hasOwnProperty.call(b,k)){ vals.push(emptyToNull(b[k])); cols.push(`${k}=$${vals.length}`); }}
  if(!cols.length)return res.status(400).json({error:'No profile fields supplied'});
  await pool.query('INSERT INTO crm_profiles (grantmaker_id) VALUES ($1) ON CONFLICT (grantmaker_id) DO NOTHING',[req.params.id]);
  const r=await pool.query(`UPDATE crm_profiles SET ${cols.join(', ')}, updated_at=now() WHERE grantmaker_id=$1 RETURNING *`,vals); res.json(r.rows[0]);
}catch(e){next(e);} });

app.post('/api/grantmakers/:id/contacts', async (req,res,next)=>{ try{ const b=req.body||{}; const r=await pool.query(`INSERT INTO contact_people (grantmaker_id,full_name,role_title,organization,email,phone,linkedin_url,contact_url,source_url,contact_type,consent_basis,relationship_strength,preferred_channel,is_primary,notes,last_verified_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,coalesce($10,'Institutional / public'),coalesce($11,'Public institutional contact / manual verification required'),coalesce($12,'Unknown'),$13,coalesce($14,false),$15,$16) RETURNING *`,[req.params.id,emptyToNull(b.full_name),emptyToNull(b.role_title),emptyToNull(b.organization),emptyToNull(b.email),emptyToNull(b.phone),emptyToNull(b.linkedin_url),emptyToNull(b.contact_url),emptyToNull(b.source_url),emptyToNull(b.contact_type),emptyToNull(b.consent_basis),emptyToNull(b.relationship_strength),emptyToNull(b.preferred_channel),b.is_primary===true,emptyToNull(b.notes),emptyToNull(b.last_verified_at)]); res.status(201).json(r.rows[0]); }catch(e){next(e);} });

app.post('/api/grantmakers/:id/interactions', async (req,res,next)=>{ try{ const b=req.body||{}; const r=await pool.query(`INSERT INTO interactions (grantmaker_id,occurred_at,channel,person_or_role,subject,notes,outcome,next_action,next_action_date) VALUES ($1,coalesce($2::timestamptz,now()),coalesce($3,'email'),$4,$5,$6,$7,$8,$9) RETURNING *`,[req.params.id,b.occurred_at||null,b.channel,emptyToNull(b.person_or_role),emptyToNull(b.subject),emptyToNull(b.notes),emptyToNull(b.outcome),emptyToNull(b.next_action),emptyToNull(b.next_action_date)]); res.status(201).json(r.rows[0]); }catch(e){next(e);} });

app.post('/api/grantmakers/:id/tasks', async (req,res,next)=>{ try{ const b=req.body||{}; const r=await pool.query('INSERT INTO tasks (grantmaker_id,title,status,due_date,owner,notes) VALUES ($1,$2,coalesce($3,\'Open\'),$4,$5,$6) RETURNING *',[req.params.id,b.title||'Follow up',b.status,emptyToNull(b.due_date),emptyToNull(b.owner),emptyToNull(b.notes)]); res.status(201).json(r.rows[0]); }catch(e){next(e);} });

app.post('/api/grantmakers/:id/opportunities', async (req,res,next)=>{ try{ const b=req.body||{}; const r=await pool.query(`INSERT INTO grant_opportunities (grantmaker_id,opportunity_name,stage,status,amount_min,amount_max,currency,deadline_date,decision_date,application_url,requirements,documents_needed,success_strategy,blockers,owner,notes) VALUES ($1,$2,coalesce($3,'Researching'),coalesce($4,'Open / unknown'),$5,$6,coalesce($7,'EUR'),$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,[req.params.id,b.opportunity_name||'Grant opportunity',b.stage,b.status,emptyToNull(b.amount_min),emptyToNull(b.amount_max),emptyToNull(b.currency),emptyToNull(b.deadline_date),emptyToNull(b.decision_date),emptyToNull(b.application_url),emptyToNull(b.requirements),emptyToNull(b.documents_needed),emptyToNull(b.success_strategy),emptyToNull(b.blockers),emptyToNull(b.owner),emptyToNull(b.notes)]); res.status(201).json(r.rows[0]); }catch(e){next(e);} });

app.post('/api/grantmakers/:id/documents', upload.single('file'), async (req,res,next)=>{ try{
  const b=req.body||{}; const file=req.file;
  const rel = file ? `/storage/documents/${encodeURIComponent(req.params.id)}/${encodeURIComponent(path.basename(file.filename))}` : emptyToNull(b.file_or_url);
  const r=await pool.query(`INSERT INTO application_documents (grantmaker_id,title,doc_type,status,owner,due_date,file_or_url,notes) VALUES ($1,$2,coalesce($3,'Document'),coalesce($4,'Draft'),$5,$6,$7,$8) RETURNING *`,[req.params.id,b.title || file?.originalname || 'Document',emptyToNull(b.doc_type),emptyToNull(b.status),emptyToNull(b.owner),emptyToNull(b.due_date),rel,emptyToNull(b.notes)]);
  res.status(201).json(r.rows[0]);
}catch(e){next(e);} });

app.post('/api/grantmakers/:id/assets', async (req,res,next)=>{ try{ const b=req.body||{}; const r=await pool.query(`INSERT INTO relationship_assets (grantmaker_id,asset_type,title,status,send_after_date,notes) VALUES ($1,coalesce($2,'Value update'),$3,coalesce($4,'Draft'),$5,$6) RETURNING *`,[req.params.id,emptyToNull(b.asset_type),b.title||'Relationship asset',emptyToNull(b.status),emptyToNull(b.send_after_date),emptyToNull(b.notes)]); res.status(201).json(r.rows[0]); }catch(e){next(e);} });

app.post('/api/grantmakers/:id/compliance', async (req,res,next)=>{ try{ const b=req.body||{}; const r=await pool.query(`INSERT INTO compliance_notes (grantmaker_id,note_type,note,source_url) VALUES ($1,coalesce($2,'Source / privacy note'),$3,$4) RETURNING *`,[req.params.id,emptyToNull(b.note_type),b.note||'Compliance note',emptyToNull(b.source_url)]); res.status(201).json(r.rows[0]); }catch(e){next(e);} });

app.post('/api/ai/assist', async (req,res,next)=>{ try{
  const { grantmaker_id, action, prompt } = req.body || {}; let grantmaker=null;
  if(grantmaker_id){ grantmaker=await getGrantmakerBundle(grantmaker_id); }
  const out = await callAI({ action: action||'strategy', prompt, grantmaker });
  await pool.query('INSERT INTO ai_history (grantmaker_id,provider,model,action,prompt,response) VALUES ($1,$2,$3,$4,$5,$6)',[grantmaker_id||null,out.provider,out.model,action||'strategy',prompt||'',out.text]);
  res.json(out);
}catch(e){next(e);} });

app.get('/api/meta', async (req,res,next)=>{ try{ const [countries,segments,playbook]=await Promise.all([pool.query('SELECT DISTINCT country FROM grantmakers WHERE country IS NOT NULL ORDER BY country'),pool.query('SELECT DISTINCT segment FROM grantmakers WHERE segment IS NOT NULL ORDER BY segment'),pool.query('SELECT * FROM relationship_playbook_items ORDER BY id')]); res.json({countries:countries.rows.map(r=>r.country),segments:segments.rows.map(r=>r.segment),playbook:playbook.rows}); }catch(e){next(e);} });


// ---------- Import / Export helpers ----------
function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCSV(rows) {
  if (!rows || !rows.length) return '';
  const fields = Object.keys(rows[0]);
  return [fields.join(','), ...rows.map(row => fields.map(f => csvEscape(row[f])).join(','))].join('\n');
}
function parseCSV(text) {
  const out = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i+1];
    if (q) {
      if (c === '"' && n === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); out.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  row.push(field); out.push(row);
  if (!out.length) return [];
  const headers = out.shift().map(h => h.trim());
  return out.filter(r => r.some(x => String(x || '').trim())).map(r => Object.fromEntries(headers.map((h,i)=>[h, r[i] ?? ''])));
}

const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.get('/api/export/grantmakers.json', async (req,res,next)=>{ try{
  const r = await pool.query('SELECT * FROM grantmakers ORDER BY name');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="grantmakers_export.json"');
  res.send(JSON.stringify(r.rows,null,2));
}catch(e){next(e);} });

app.get('/api/export/grantmakers.csv', async (req,res,next)=>{ try{
  const r = await pool.query('SELECT * FROM grantmakers ORDER BY name');
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="grantmakers_export.csv"');
  res.send(toCSV(r.rows));
}catch(e){next(e);} });

app.get('/api/export/full.json', async (req,res,next)=>{ try{
  const [grantmakers,profiles,contacts,opps,docs,interactions,tasks,accounts,outbound,inbound,events] = await Promise.all([
    pool.query('SELECT * FROM grantmakers ORDER BY name'),
    pool.query('SELECT * FROM crm_profiles ORDER BY grantmaker_id'),
    pool.query('SELECT * FROM contact_people ORDER BY created_at'),
    pool.query('SELECT * FROM grant_opportunities ORDER BY created_at'),
    pool.query('SELECT * FROM application_documents ORDER BY created_at'),
    pool.query('SELECT * FROM interactions ORDER BY created_at'),
    pool.query('SELECT * FROM tasks ORDER BY created_at'),
    pool.query('SELECT id,provider,account_label,email_or_identifier,status,auth_type,scopes,settings,last_sync_at,notes,created_at,updated_at FROM integration_accounts ORDER BY created_at'),
    pool.query('SELECT * FROM outbound_messages ORDER BY created_at'),
    pool.query('SELECT * FROM inbound_messages ORDER BY created_at'),
    pool.query('SELECT * FROM calendar_events ORDER BY created_at')
  ]);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="grant_crm_full_export.json"');
  res.send(JSON.stringify({grantmakers:grantmakers.rows,profiles:profiles.rows,contacts:contacts.rows,opportunities:opps.rows,documents:docs.rows,interactions:interactions.rows,tasks:tasks.rows,integration_accounts:accounts.rows,outbound_messages:outbound.rows,inbound_messages:inbound.rows,calendar_events:events.rows},null,2));
}catch(e){next(e);} });

app.post('/api/import/grantmakers', importUpload.single('file'), async (req,res,next)=>{ try{
  const format = (req.body.format || path.extname(req.file?.originalname || '').slice(1) || 'json').toLowerCase();
  const raw = req.file ? req.file.buffer.toString('utf8') : (req.body.data || '');
  let rows = [];
  if (format === 'csv') rows = parseCSV(raw);
  else {
    const parsed = JSON.parse(raw);
    rows = Array.isArray(parsed) ? parsed : (parsed.grantmakers || []);
  }
  const job = await pool.query('INSERT INTO import_export_jobs (job_type,status,file_name,format,rows_total) VALUES ($1,$2,$3,$4,$5) RETURNING *',['import_grantmakers','Running',req.file?.originalname || 'pasted-data',format,rows.length]);
  let ok=0, fail=0;
  for (const r of rows) {
    try {
      const id = String(r.id || r.name || `imported-${Date.now()}-${ok}`).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120);
      await pool.query(`INSERT INTO grantmakers (id,segment,name,country,region,fit,eligibility,grant_route,public_contact,apply_url,source_url,ai_strategy,contact_type,privacy_note,last_checked)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO UPDATE SET segment=EXCLUDED.segment,name=EXCLUDED.name,country=EXCLUDED.country,region=EXCLUDED.region,fit=EXCLUDED.fit,eligibility=EXCLUDED.eligibility,grant_route=EXCLUDED.grant_route,public_contact=EXCLUDED.public_contact,apply_url=EXCLUDED.apply_url,source_url=EXCLUDED.source_url,ai_strategy=EXCLUDED.ai_strategy,contact_type=EXCLUDED.contact_type,privacy_note=EXCLUDED.privacy_note,last_checked=EXCLUDED.last_checked,updated_at=now()`,
        [id,r.segment,r.name || id,r.country,r.region,r.fit,r.eligibility,r.grant_route,r.public_contact,r.apply_url,r.source_url,r.ai_strategy,r.contact_type || 'Institutional / public',r.privacy_note || 'Imported; verify source and compliance before outreach.',emptyToNull(r.last_checked)]);
      await pool.query('INSERT INTO crm_profiles (grantmaker_id) VALUES ($1) ON CONFLICT (grantmaker_id) DO NOTHING',[id]);
      ok++;
    } catch(err) { console.error('Import row failed', err); fail++; }
  }
  const done = await pool.query('UPDATE import_export_jobs SET status=$2, rows_success=$3, rows_failed=$4, completed_at=now() WHERE id=$1 RETURNING *',[job.rows[0].id, fail ? 'Completed with errors' : 'Completed', ok, fail]);
  res.json(done.rows[0]);
}catch(e){next(e);} });

// ---------- Integration registry and communication/calendar scaffolding ----------
app.get('/api/integrations/catalog', (req,res)=>res.json({
  providers: [
    {provider:'google', label:'Google Gmail + Calendar OAuth', status:'scaffolded', required_env:['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI'], scopes:['gmail.send','gmail.readonly','calendar.events']},
    {provider:'microsoft', label:'Microsoft Graph Outlook Mail + Calendar', status:'scaffolded', required_env:['MS_TENANT_ID','MS_CLIENT_ID','MS_CLIENT_SECRET','MS_REDIRECT_URI'], scopes:['Mail.Send','Mail.Read','Calendars.ReadWrite','offline_access']},
    {provider:'twilio', label:'Twilio SMS / Voice / WhatsApp', status:'scaffolded', required_env:['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM_NUMBER','TWILIO_MESSAGING_SERVICE_SID']},
    {provider:'telegram', label:'Telegram Bot API', status:'scaffolded', required_env:['TELEGRAM_BOT_TOKEN','TELEGRAM_DEFAULT_CHAT_ID']},
    {provider:'whatsapp_cloud', label:'Meta WhatsApp Cloud API', status:'scaffolded', required_env:['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_VERIFY_TOKEN']},
    {provider:'phone_import', label:'Manual phone/SMS/call-history import', status:'ready_for_manual_import', required_env:[]}
  ],
  note: 'OAuth/API secrets are never shipped in the project. Configure them in .env. Live sending is intentionally disabled until a provider connector is implemented and tested.'
}));

app.get('/api/integrations/accounts', async (req,res,next)=>{ try{
  const r=await pool.query('SELECT id,provider,account_label,email_or_identifier,status,auth_type,scopes,settings,last_sync_at,notes,created_at,updated_at FROM integration_accounts ORDER BY created_at DESC');
  res.json(r.rows);
}catch(e){next(e);} });

app.post('/api/integrations/accounts', async (req,res,next)=>{ try{
  const b=req.body||{};
  const r=await pool.query(`INSERT INTO integration_accounts (provider,account_label,email_or_identifier,status,auth_type,scopes,settings,notes)
    VALUES ($1,$2,$3,coalesce($4,'Not connected'),coalesce($5,'OAuth / API token'),$6,coalesce($7,'{}'::jsonb),$8) RETURNING id,provider,account_label,email_or_identifier,status,auth_type,scopes,settings,last_sync_at,notes,created_at,updated_at`,
    [b.provider||'custom',b.account_label||'Integration account',emptyToNull(b.email_or_identifier),b.status,b.auth_type,emptyToNull(b.scopes),JSON.stringify(b.settings||{}),emptyToNull(b.notes)]);
  res.status(201).json(r.rows[0]);
}catch(e){next(e);} });

app.post('/api/grantmakers/:id/outbound-messages', async (req,res,next)=>{ try{
  const b=req.body||{};
  const r=await pool.query(`INSERT INTO outbound_messages (grantmaker_id,contact_id,integration_account_id,channel,provider,to_address,from_address,subject,body,status,scheduled_at)
    VALUES ($1,$2,$3,coalesce($4,'email'),$5,$6,$7,$8,$9,coalesce($10,'Draft'),$11) RETURNING *`,
    [req.params.id,emptyToNull(b.contact_id),emptyToNull(b.integration_account_id),b.channel,emptyToNull(b.provider),emptyToNull(b.to_address),emptyToNull(b.from_address),emptyToNull(b.subject),emptyToNull(b.body),b.status,emptyToNull(b.scheduled_at)]);
  await pool.query(`INSERT INTO interactions (grantmaker_id,channel,person_or_role,subject,notes,outcome,next_action)
    VALUES ($1,$2,$3,$4,$5,$6,$7)`, [req.params.id,b.channel||'email',b.to_address||null,b.subject||null,b.body||null,`Outbound ${b.status||'Draft'}`,'Wait for reply / follow up']);
  res.status(201).json(r.rows[0]);
}catch(e){next(e);} });

app.post('/api/grantmakers/:id/inbound-messages', async (req,res,next)=>{ try{
  const b=req.body||{};
  const r=await pool.query(`INSERT INTO inbound_messages (grantmaker_id,contact_id,integration_account_id,channel,provider,from_address,to_address,subject,body,external_message_id,received_at,raw_payload)
    VALUES ($1,$2,$3,coalesce($4,'email'),$5,$6,$7,$8,$9,$10,coalesce($11::timestamptz,now()),coalesce($12,'{}'::jsonb)) RETURNING *`,
    [req.params.id,emptyToNull(b.contact_id),emptyToNull(b.integration_account_id),b.channel,emptyToNull(b.provider),emptyToNull(b.from_address),emptyToNull(b.to_address),emptyToNull(b.subject),emptyToNull(b.body),emptyToNull(b.external_message_id),emptyToNull(b.received_at),JSON.stringify(b.raw_payload||{})]);
  await pool.query(`INSERT INTO interactions (grantmaker_id,channel,person_or_role,subject,notes,outcome)
    VALUES ($1,$2,$3,$4,$5,$6)`, [req.params.id,b.channel||'email',b.from_address||null,b.subject||null,b.body||null,'Inbound message logged']);
  res.status(201).json(r.rows[0]);
}catch(e){next(e);} });

app.post('/api/grantmakers/:id/calendar-events', async (req,res,next)=>{ try{
  const b=req.body||{};
  const r=await pool.query(`INSERT INTO calendar_events (grantmaker_id,integration_account_id,provider,title,description,location,starts_at,ends_at,status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9,'Planned')) RETURNING *`,
    [req.params.id,emptyToNull(b.integration_account_id),emptyToNull(b.provider),b.title||'Grant follow-up',emptyToNull(b.description),emptyToNull(b.location),emptyToNull(b.starts_at),emptyToNull(b.ends_at),b.status]);
  res.status(201).json(r.rows[0]);
}catch(e){next(e);} });


app.use((err,req,res,next)=>{ console.error(err); res.status(500).json({error:err.message||'Server error'}); });
app.listen(port,'0.0.0.0',()=>console.log(`🚀 Grant CRM Premium AI 360 running on http://localhost:${port}`));
