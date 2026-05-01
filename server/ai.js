function providerConfig() {
  const provider = (process.env.AI_PROVIDER || 'fallback').toLowerCase();
  const cfg = {
    provider,
    temperature: Number(process.env.AI_TEMPERATURE || 0.3),
    maxTokens: Number(process.env.AI_MAX_TOKENS || 1400)
  };
  const modelByProvider = {
    openai: process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-5.5',
    anthropic: process.env.ANTHROPIC_MODEL || process.env.AI_MODEL || 'claude-sonnet-4-5',
    gemini: process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-2.5-pro',
    mistral: process.env.MISTRAL_MODEL || process.env.AI_MODEL || 'mistral-large-latest',
    openrouter: process.env.OPENROUTER_MODEL || process.env.AI_MODEL || 'openai/gpt-5.5',
    groq: process.env.GROQ_MODEL || process.env.AI_MODEL || 'llama-3.3-70b-versatile',
    ollama: process.env.OLLAMA_MODEL || process.env.AI_MODEL || 'llama3.1',
    custom: process.env.CUSTOM_AI_MODEL || process.env.AI_MODEL || 'custom-model',
    fallback: 'local-fallback'
  };
  cfg.model = modelByProvider[provider] || process.env.AI_MODEL || 'local-fallback';
  return cfg;
}

function modelsCatalog() {
  return {
    openai: ['gpt-5.5', 'gpt-5.5-thinking', 'gpt-4.1', 'gpt-4o', 'o3', 'o4-mini'],
    anthropic: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
    gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    mistral: ['mistral-large-latest', 'pixtral-large-latest', 'ministral-8b-latest'],
    openrouter: ['openai/gpt-5.5', 'anthropic/claude-sonnet-4-5', 'google/gemini-2.5-pro', 'meta-llama/llama-3.3-70b-instruct'],
    groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    ollama: ['llama3.1', 'mistral', 'qwen2.5', 'gemma3'],
    custom: ['any OpenAI-compatible model'],
    fallback: ['local-fallback']
  };
}

function buildSystemPrompt() {
  return `You are an advanced grant fundraising and relationship-building assistant for a local CRM. Help the user ethically build grant pipelines, relationship funnels, and application strategy. Never invent private personal contact data. Prefer public institutional routes, eligibility checks, warm introductions, concise concept notes, stewardship, compliance, and source verification. Respond in Polish unless the user asks otherwise. Use clear sections, practical next actions, and tactful relationship language.`;
}

function fallbackResponse({ action, prompt, grantmaker }) {
  const name = grantmaker?.name || 'ten grantodawca';
  const fit = grantmaker?.fit || 'obszar grantowy wymaga doprecyzowania';
  const route = grantmaker?.grant_route || grantmaker?.apply_url || 'sprawdź aktualną stronę aplikacyjną i wymagania';
  const base = `🤖 Tryb lokalny fallback — brak skonfigurowanego klucza prawdziwego modelu AI.\n\n`;
  if (action === 'email') return base + `✉️ Szkic pierwszego kontaktu dla ${name}:\n\nDzień dobry,\n\npracujemy nad projektem, który jest potencjalnie spójny z Państwa priorytetami: ${fit}. Zanim przygotujemy pełny wniosek, chcielibyśmy upewnić się, czy nasza inicjatywa mieści się w aktualnych kryteriach.\n\nCzy właściwym pierwszym krokiem będzie krótki concept note / formularz eligibility check? Chętnie prześlemy 1-stronicowe podsumowanie problemu, grupy docelowej, rozwiązania, mierników wpływu i budżetu.\n\nZ wyrazami szacunku,\n[Twoje imię]`;
  if (action === 'relationship') return base + `🤝 Plan relacji dla ${name}:\n1. Zweryfikuj aktualne kryteria i język fundera.\n2. Znajdź warm intro przez partnerów, radę, uczelnię, kościół lub organizację branżową.\n3. Wyślij krótki eligibility email zamiast długiego pitchu.\n4. Po odpowiedzi wyślij 1-2 stronicowy concept note.\n5. Co 60-90 dni wysyłaj wartościowe aktualizacje, nie tylko prośby o finansowanie.`;
  if (action === 'concept') return base + `📄 Szkielet concept note dla ${name}:\n• Problem: jaki konkretny problem rozwiązujesz i dla kogo.\n• Grupa docelowa: liczebność, potrzeba, kontekst.\n• Rozwiązanie: krótki opis interwencji/aplikacji/programu.\n• Dopasowanie do fundera: ${fit}.\n• Mierniki: adopcja, retencja, redukcja szkody, dobrostan, feedback, bezpieczeństwo.\n• Budżet: kwota, wkład własny, koszty główne.\n• Ryzyka i compliance: prywatność, RODO, safeguarding, ewaluacja.\n• Następny krok: ${route}.`;
  if (action === 'eligibility') return base + `✅ Eligibility checklist dla ${name}:\n• Czy kraj/region projektu mieści się w kryteriach?\n• Czy typ organizacji jest kwalifikowalny?\n• Czy projekt pasuje do tematów: ${fit}?\n• Czy aplikacje/profilaktyka technologiczna są akceptowane jako koszt/program?\n• Czy są wymagane partnerstwa, wkład własny, rekomendacje, audyt lub status charity/OPP?\n• Czy przed pełnym wnioskiem warto zrobić eligibility call?`;
  if (action === 'compliance') return base + `⚠️ Compliance dla ${name}:\n• Używaj wyłącznie kontaktów instytucjonalnych i publicznych.\n• Zapisuj źródło danych, datę weryfikacji i podstawę kontaktu.\n• Nie scrape'uj prywatnych telefonów/emaili osób fizycznych.\n• W pierwszym kontakcie podaj skąd masz dane i zaoferuj opt-out.\n• Weryfikuj aktualność kryteriów bezpośrednio na stronie grantodawcy.`;
  return base + `✨ Strategia dla ${name}:\n1. Zmapuj dopasowanie: ${fit}.\n2. Sprawdź drogę aplikowania: ${route}.\n3. Przygotuj krótką hipotezę dopasowania i 1-stronicowy concept note.\n4. Zacznij od pytania eligibility, nie od prośby o pieniądze.\n5. Buduj relację przez wartość, raportowanie i regularne aktualizacje.`;
}

async function callAI({ action, prompt, grantmaker }) {
  const cfg = providerConfig();
  const system = buildSystemPrompt();
  const user = `Action: ${action || 'strategy'}\nGrantmaker context: ${JSON.stringify(grantmaker || {}, null, 2)}\nUser prompt: ${prompt || ''}`;
  if (cfg.provider === 'fallback') return { provider: 'fallback', model: 'local-fallback', text: fallbackResponse({ action, prompt, grantmaker }) };

  try {
    if (cfg.provider === 'openai') {
      if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
      const r = await fetch('https://api.openai.com/v1/responses', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`}, body: JSON.stringify({ model: cfg.model, input: [{role:'system',content:system},{role:'user',content:user}], temperature: cfg.temperature, max_output_tokens: cfg.maxTokens }) });
      const j = await r.json(); if(!r.ok) throw new Error(JSON.stringify(j));
      return { provider: cfg.provider, model: cfg.model, text: j.output_text || JSON.stringify(j) };
    }
    const openAICompatible = {
      mistral: ['https://api.mistral.ai/v1/chat/completions', process.env.MISTRAL_API_KEY],
      openrouter: ['https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_API_KEY],
      groq: ['https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY],
      custom: [process.env.CUSTOM_AI_BASE_URL, process.env.CUSTOM_AI_API_KEY]
    };
    if (openAICompatible[cfg.provider]) {
      const [url, key] = openAICompatible[cfg.provider]; if(!url || !key) throw new Error(`${cfg.provider} API config missing`);
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`}, body: JSON.stringify({ model: cfg.model, messages:[{role:'system',content:system},{role:'user',content:user}], temperature: cfg.temperature, max_tokens: cfg.maxTokens }) });
      const j = await r.json(); if(!r.ok) throw new Error(JSON.stringify(j));
      return { provider: cfg.provider, model: cfg.model, text: j.choices?.[0]?.message?.content || JSON.stringify(j) };
    }
    if (cfg.provider === 'anthropic') {
      if(!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');
      const r = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{'Content-Type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'}, body: JSON.stringify({ model: cfg.model, system, messages:[{role:'user',content:user}], max_tokens: cfg.maxTokens, temperature: cfg.temperature }) });
      const j=await r.json(); if(!r.ok) throw new Error(JSON.stringify(j));
      return { provider: cfg.provider, model: cfg.model, text: (j.content||[]).map(c=>c.text||'').join('\n') || JSON.stringify(j) };
    }
    if (cfg.provider === 'gemini') {
      if(!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing');
      const url=`https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:system+'\n\n'+user}]}],generationConfig:{temperature:cfg.temperature,maxOutputTokens:cfg.maxTokens}})});
      const j=await r.json(); if(!r.ok) throw new Error(JSON.stringify(j));
      return { provider: cfg.provider, model: cfg.model, text: j.candidates?.[0]?.content?.parts?.map(p=>p.text).join('\n') || JSON.stringify(j) };
    }
    if (cfg.provider === 'ollama') {
      const base=process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434';
      const r=await fetch(`${base}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:cfg.model,messages:[{role:'system',content:system},{role:'user',content:user}],stream:false,options:{temperature:cfg.temperature}})});
      const j=await r.json(); if(!r.ok) throw new Error(JSON.stringify(j));
      return { provider: cfg.provider, model: cfg.model, text: j.message?.content || JSON.stringify(j) };
    }
    return { provider:'fallback', model:'local-fallback', text:fallbackResponse({action,prompt,grantmaker}) };
  } catch (err) {
    return { provider: `${cfg.provider}-error-fallback`, model: cfg.model, text: `${fallbackResponse({action,prompt,grantmaker})}\n\n⚠️ Błąd prawdziwego AI: ${err.message}` };
  }
}
module.exports = { callAI, providerConfig, modelsCatalog };
