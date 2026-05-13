const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../server/db');

const playbook = [
  ['🔎 Research', 'Sprawdź język fundacji: cele, beneficjentów, wykluczenia, regiony i ostatnio finansowane projekty.', 'Dopisz 3 zdania: dlaczego ten grantodawca pasuje do projektu.'],
  ['🤝 Warm introduction', 'Najsilniejsze relacje zaczynają się od wprowadzenia przez wspólną osobę, partnera, kościół, radę lub uczelnię.', 'Znajdź 1-2 osoby mogące zrobić neutralne intro.'],
  ['💌 Value-first contact', 'Pierwszy kontakt nie powinien brzmieć jak masowa prośba o pieniądze. Pokaż zrozumienie misji i poproś o krótki eligibility check.', 'Wyślij krótki email z jednym konkretnym pytaniem o dopasowanie.'],
  ['🎧 Discovery call', 'Na rozmowie więcej diagnozuj niż sprzedawaj: priorytety, błędy w aplikacjach, deadline, wymagania, mierniki.', 'Przygotuj 5 pytań i 90-sekundową prezentację projektu.'],
  ['📄 Concept note', 'Przed pełnym wnioskiem przygotuj 1-2 strony: problem, grupa docelowa, rozwiązanie, budżet i mierniki.', 'Poproś o informację, czy warto składać pełny wniosek.'],
  ['🏁 Application', 'Wniosek powinien odbijać kryteria grantodawcy, a nie tylko opis projektu. Zadbaj o teorię zmiany, dowody, ryzyka i ewaluację.', 'Mapuj każde kryterium fundera do konkretnej odpowiedzi.'],
  ['🌱 Stewardship', 'Po decyzji buduj relację dalej: dziękuj, raportuj konkrety, dziel się learningami, nie odzywaj się tylko po pieniądze.', 'Wyślij aktualizację wpływu po 60-90 dniach.']
];
function emailFrom(text){ const m=String(text||'').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i); return m?m[0]:null; }
function phoneFrom(text){ const m=String(text||'').match(/(?:\+|00)?[0-9][0-9 ()\-.]{7,}[0-9]/); return m?m[0].trim():null; }
function fitScore(row){ const t=`${row.segment||''} ${row.fit||''} ${row.ai_strategy||''}`.toLowerCase(); let s=52; if(/christ|catholic|church|faith|relig/.test(t))s+=12; if(/digital|technology|app|mental|addiction|wellbeing|youth/.test(t))s+=15; if(/grant|apply|application|fund/.test(t))s+=8; if(/public|government|eu|national/.test(t))s-=3; return Math.max(0,Math.min(100,s)); }
function currency(country){ if(/USA|United States/i.test(country||''))return 'USD'; if(/Canada/i.test(country||''))return 'CAD'; if(/UK|United Kingdom/i.test(country||''))return 'GBP'; if(/Korea/i.test(country||''))return 'KRW'; if(/Singapore/i.test(country||''))return 'SGD'; return 'EUR'; }

async function main(){
  const rows = JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','grantmakers_data.json'),'utf8'));
  await pool.query('BEGIN');
  try {
    for (const r of rows) {
      await pool.query(`INSERT INTO grantmakers (id,segment,name,country,region,fit,eligibility,grant_route,public_contact,apply_url,source_url,ai_strategy,contact_type,privacy_note,last_checked,how_to_apply,repayability_type)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (id) DO UPDATE SET segment=EXCLUDED.segment,name=EXCLUDED.name,country=EXCLUDED.country,region=EXCLUDED.region,fit=EXCLUDED.fit,eligibility=EXCLUDED.eligibility,grant_route=EXCLUDED.grant_route,public_contact=EXCLUDED.public_contact,apply_url=EXCLUDED.apply_url,source_url=EXCLUDED.source_url,ai_strategy=EXCLUDED.ai_strategy,contact_type=EXCLUDED.contact_type,privacy_note=EXCLUDED.privacy_note,last_checked=EXCLUDED.last_checked,how_to_apply=EXCLUDED.how_to_apply,repayability_type=EXCLUDED.repayability_type,updated_at=now()`,
        [r.id,r.segment,r.name,r.country,r.region,r.fit,r.eligibility,r.grant_route,r.public_contact,r.apply_url,r.source_url,r.ai_strategy,r.contact_type,r.privacy_note,r.last_checked,r.how_to_apply||null,r.repayability_type||null]);
      const sc=fitScore(r), cur=currency(r.country);
      await pool.query(`INSERT INTO crm_profiles (grantmaker_id,organization_summary,program_fit_notes,mission_alignment_notes,funding_fit_score,relationship_strength_score,urgency_score,currency,budget_status,relationship_goal,value_offer,next_best_action,ai_recommended_message,stewardship_plan)
        VALUES ($1,$2,$3,$4,$5,0,50,$6,'Not started',$7,$8,$9,$10,$11)
        ON CONFLICT (grantmaker_id) DO UPDATE SET updated_at=now()`,
        [r.id, `${r.name}: ${r.segment||'grantmaker'} in ${r.country||'unknown country'}.`, r.fit||'Check alignment with criteria.', 'Map the project to funder language: mission, beneficiaries, outcomes, evidence and stewardship.', sc, cur, 'Move from cold prospect to eligibility-confirmed conversation.', 'Offer a concise, evidence-based project brief, measurable outcomes, and thoughtful reporting updates.', 'Verify current open calls, identify the correct institutional contact or portal, and prepare a 1-page concept note.', r.ai_strategy||'Personalize first contact around stated priorities and ask one eligibility question.', 'Send value updates every 60-90 days: progress, evidence, learning, and gratitude.']);
      const email=emailFrom(r.public_contact), phone=phoneFrom(r.public_contact);
      if(email||phone||r.apply_url||r.source_url){
        await pool.query(`INSERT INTO contact_people (grantmaker_id,role_title,organization,email,phone,contact_url,source_url,preferred_channel,is_primary,notes,last_verified_at)
          SELECT $1,'Grants / institutional contact',$2,$3,$4,$5,$6,$7,true,$8,$9
          WHERE NOT EXISTS (SELECT 1 FROM contact_people WHERE grantmaker_id=$1 AND coalesce(email,'')=coalesce($3,'') AND coalesce(contact_url,'')=coalesce($5,''))`,
          [r.id,r.name,email,phone,r.apply_url||r.source_url||null,r.source_url||r.apply_url||null,email?'email':(phone?'phone':'portal'),`Seeded from public source. public_contact: ${r.public_contact||'not listed'}`,r.last_checked||null]);
      }
      await pool.query(`INSERT INTO grant_opportunities (grantmaker_id,opportunity_name,stage,status,currency,application_url,requirements,documents_needed,success_strategy,notes)
        SELECT $1,'Primary grant route','Researching','Open / unknown',$2,$3,$4,$5,$6,$7
        WHERE NOT EXISTS (SELECT 1 FROM grant_opportunities WHERE grantmaker_id=$1 AND opportunity_name='Primary grant route')`,
        [r.id,cur,r.apply_url||null,r.eligibility||'Verify eligibility before contact.','Concept note, budget, organization profile, outcomes/impact metrics, governance and compliance notes.',r.ai_strategy||'Start with fit research and a short eligibility question.',r.grant_route||null]);
    }
    for(const [stage,advice,example] of playbook){
      await pool.query(`INSERT INTO relationship_playbook_items (stage,advice,example_action) SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM relationship_playbook_items WHERE stage=$1 AND advice=$2)`,[stage,advice,example]);
    }
    const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'GrantCRM2026!', 12);
    await pool.query(`INSERT INTO users (username,password_hash) VALUES ('admin',$1) ON CONFLICT (username) DO NOTHING`, [adminHash]);
    await pool.query('COMMIT');
    console.log(`Seed complete: ${rows.length} grantmakers loaded.`);
  } catch(e){ await pool.query('ROLLBACK'); throw e; }
}
main().catch(e=>{console.error(e);process.exit(1);}).finally(()=>pool.end());
