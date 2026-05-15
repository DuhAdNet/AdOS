import { useState, useEffect } from 'react';

const ados = (window as any).ados;

const TIMEZONES = [
  'America/Sao_Paulo', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Europe/Lisbon',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'UTC',
];

const LANGUAGES = [
  { id: 'pt-BR', name: 'Português (Brasil)' },
  { id: 'en-US', name: 'English (US)' },
  { id: 'es-ES', name: 'Español' },
  { id: 'fr-FR', name: 'Français' },
  { id: 'de-DE', name: 'Deutsch' },
];

export default function Preferences() {
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [language, setLanguage] = useState('pt-BR');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const prefs = await ados.db.getPreferences();
    if (prefs.name) setName(prefs.name);
    if (prefs.timezone) setTimezone(prefs.timezone);
    if (prefs.language) setLanguage(prefs.language);
    if (prefs.role) setRole(prefs.role);
    if (prefs.notes) setNotes(prefs.notes);
  };

  const handleSave = async () => {
    await Promise.all([
      ados.db.setPreference('name', name),
      ados.db.setPreference('timezone', timezone),
      ados.db.setPreference('language', language),
      ados.db.setPreference('role', role),
      ados.db.setPreference('notes', notes),
    ]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-primary">Preferências</h1>
        <p className="text-sm text-muted mt-1">Contexto pessoal usado para personalizar respostas do assistente.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <div className="max-w-lg space-y-6">
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-secondary mb-1.5 block">Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none focus:border-brand-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-secondary mb-1.5 block">Cargo / Função</label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ex: CEO, Gestor de Projetos, Dev Senior"
                className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none focus:border-brand-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">Fuso horário</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none"
                >
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">Idioma</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none"
                >
                  {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-secondary mb-1.5 block">Notas para o assistente</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contexto adicional que ajuda o assistente (projetos atuais, preferências, etc.)"
                rows={3}
                className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none resize-none focus:border-brand-500/50"
              />
            </div>

            <button
              onClick={handleSave}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm font-medium text-white transition-all"
            >
              {saved ? 'Salvo' : 'Salvar Preferências'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
