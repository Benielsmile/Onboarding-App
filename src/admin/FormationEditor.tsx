/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Formation Editor (CMS de la Landing Page)
 * Allows the administrator to:
 * 1. Edit every landing page element of the ACTIVE formation (texts, pricing,
 *    capacity, session status, Orange Money details, visuals, modules, NDA).
 * 2. Launch a brand-new blank formation in one click.
 * 3. Duplicate, activate, and delete saved formations from the durable registry.
 * 4. Upload hero / auditorium images and preview them instantly.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Rocket,
  Copy,
  ImagePlus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Presentation,
  Wallet,
  ScrollText,
  CalendarClock,
  LibraryBig
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { ProgramConfig, ProgramModule, ProgramModuleIcon, FormationSummary } from '../types/index.ts';
import { PROGRAM_MODULE_ICONS, TRAINING_PRESETS } from '../utils/programPresets.ts';
import { resolveFormationImageUrl, HERO_IMAGE_FALLBACK, AUDITORIUM_IMAGE_FALLBACK } from '../utils/programAssets.ts';

interface FormationEditorProps {
  config: ProgramConfig;
  onSaved: (config: ProgramConfig) => void;
}

type EditorSection = 'identity' | 'logistics' | 'payment' | 'visuals' | 'modules' | 'nda' | 'library';

const SECTION_TABS: { id: EditorSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'identity', label: 'Identité', icon: Presentation },
  { id: 'logistics', label: 'Logistique & Tarif', icon: CalendarClock },
  { id: 'payment', label: 'Paiement & Contacts', icon: Wallet },
  { id: 'visuals', label: 'Visuels', icon: ImagePlus },
  { id: 'modules', label: 'Programme & Modules', icon: Layers },
  { id: 'nda', label: 'Contrat NDA', icon: ScrollText },
  { id: 'library', label: 'Registre des Formations', icon: LibraryBig }
];

const STATUS_LABELS: Record<ProgramConfig['status'], string> = {
  OPEN: 'Ouverte aux inscriptions',
  COMING_SOON: 'Bientôt disponible',
  SOLD_OUT: 'Complète — Inscriptions fermées'
};

export const FormationEditor: React.FC<FormationEditorProps> = ({ config, onSaved }) => {
  const [draft, setDraft] = useState<ProgramConfig>({ ...config });
  const [activeSection, setActiveSection] = useState<EditorSection>('identity');

  // Formation registry state
  const [formations, setFormations] = useState<FormationSummary[]>([]);
  const [activeId, setActiveId] = useState<string>(config.id);
  const [newFormationName, setNewFormationName] = useState('');
  const [duplicateName, setDuplicateName] = useState('');

  // Feedback & busy state
  const [isSaving, setIsSaving] = useState(false);
  const [isBusyRegistry, setIsBusyRegistry] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const heroFileRef = useRef<HTMLInputElement>(null);
  const auditoriumFileRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState<'hero' | 'auditorium' | null>(null);

  // Re-hydrate the draft whenever the parent activates a different formation
  useEffect(() => {
    setDraft({ ...config });
    setActiveId(config.id);
  }, [config]);

  const refreshRegistry = useCallback(async () => {
    try {
      const state = await api.listFormations();
      setFormations(state.formations);
      setActiveId(state.activeId);
    } catch {
      // Silent — registry list is non-critical for editing
    }
  }, []);

  useEffect(() => {
    refreshRegistry();
  }, [refreshRegistry]);

  const flash = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const fail = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 7000);
  };

  const updateField = <K extends keyof ProgramConfig>(key: K, value: ProgramConfig[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  // =================== PUBLISH (updates the live landing page) ===================
  const handlePublish = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const data = await api.updateProgramConfig(draft);
      setDraft({ ...data.config });
      onSaved(data.config);
      await refreshRegistry();
      flash('Landing page publiée. Les modifications sont en ligne et persistées sur le serveur.');
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'Échec de la publication.');
    } finally {
      setIsSaving(false);
    }
  };

  // =================== FORMATION REGISTRY ACTIONS ===================
  const handleCreateFormation = async () => {
    if (!newFormationName.trim()) return;
    setIsBusyRegistry(true);
    setErrorMessage(null);
    try {
      const data = await api.createFormation(newFormationName.trim());
      setNewFormationName('');
      onSaved(data.config);
      await refreshRegistry();
      flash(`Nouvelle formation « ${data.config.title} » lancée et activée. Personnalisez-la puis publiez.`);
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'Échec de création.');
    } finally {
      setIsBusyRegistry(false);
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateName.trim()) return;
    setIsBusyRegistry(true);
    setErrorMessage(null);
    try {
      await api.duplicateFormation(duplicateName.trim());
      setDuplicateName('');
      await refreshRegistry();
      flash('Copie enregistrée dans le registre. Activez-la le moment venu.');
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'Échec de la duplication.');
    } finally {
      setIsBusyRegistry(false);
    }
  };

  const handleActivate = async (id: string) => {
    setIsBusyRegistry(true);
    setErrorMessage(null);
    try {
      const data = await api.activateFormation(id);
      onSaved(data.config);
      await refreshRegistry();
      flash(`Formation « ${data.config.title} » activée : la landing page publique utilise désormais cette configuration.`);
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'Échec de l\'activation.');
    } finally {
      setIsBusyRegistry(false);
    }
  };

  const handleDeleteFormation = async (id: string) => {
    if (!window.confirm('Supprimer définitivement cette formation du registre ?')) return;
    setIsBusyRegistry(true);
    setErrorMessage(null);
    try {
      await api.deleteFormation(id);
      await refreshRegistry();
      flash('Formation supprimée du registre.');
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'Échec de la suppression.');
    } finally {
      setIsBusyRegistry(false);
    }
  };

  // =================== PRESET QUICK LOAD ===================
  const handleApplyPreset = (presetId: string) => {
    const preset = TRAINING_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setDraft(prev => ({
      ...prev,
      ...preset.config,
      // Curated presets never override uploaded visuals; keep the current ones
      heroImageUrl: prev.heroImageUrl,
      auditoriumImageUrl: prev.auditoriumImageUrl
    }));
    flash(`Modèle « ${preset.name} » chargé. Vérifiez les dates, le tarif et les visuels, puis publiez.`);
  };

  // =================== IMAGE UPLOADS ===================
  const handleImageUpload = async (target: 'hero' | 'auditorium', file?: File | null) => {
    if (!file) return;
    setIsUploading(target);
    setErrorMessage(null);
    try {
      const data = await api.uploadImage(file);
      updateField(target === 'hero' ? 'heroImageUrl' : 'auditoriumImageUrl', data.url);
      flash('Image enregistrée sur le serveur. Publiez pour l\'appliquer en ligne.');
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : 'Échec de l\'upload.');
    } finally {
      setIsUploading(null);
    }
  };

  // =================== MODULE CRUD ===================
  const updateModule = (index: number, patch: Partial<ProgramModule>) => {
    setDraft(prev => ({
      ...prev,
      modules: prev.modules.map((m, i) => i === index ? { ...m, ...patch } : m)
    }));
  };

  const addModule = () => {
    setDraft(prev => ({
      ...prev,
      modules: [...prev.modules, {
        id: `m-${Date.now().toString(36)}-${prev.modules.length}`,
        index: String(prev.modules.length + 1).padStart(2, '0'),
        title: 'Nouveau module',
        highlight: '',
        description: '',
        iconName: 'Network' as ProgramModuleIcon
      }]
    }));
  };

  const removeModule = (index: number) => {
    setDraft(prev => {
      const modules = prev.modules.filter((_, i) => i !== index);
      // Renumber indexes sequentially
      return { ...prev, modules: modules.map((m, i) => ({ ...m, index: String(i + 1).padStart(2, '0') })) };
    });
  };

  const moveModule = (index: number, direction: -1 | 1) => {
    setDraft(prev => {
      const modules = [...prev.modules];
      const target = index + direction;
      if (target < 0 || target >= modules.length) return prev;
      [modules[index], modules[target]] = [modules[target], modules[index]];
      return { ...prev, modules: modules.map((m, i) => ({ ...m, index: String(i + 1).padStart(2, '0') })) };
    });
  };

  // =================== NDA CLAUSES CRUD ===================
  const updateClause = (index: number, value: string) => {
    setDraft(prev => ({ ...prev, ndaClauses: prev.ndaClauses.map((c, i) => i === index ? value : c) }));
  };

  const addClause = () => setDraft(prev => ({ ...prev, ndaClauses: [...prev.ndaClauses, 'Nouvelle clause...'] }));
  const removeClause = (index: number) => setDraft(prev => ({ ...prev, ndaClauses: prev.ndaClauses.filter((_, i) => i !== index) }));

  // =================== Shared field styles ===================
  const labelCls = 'block text-[10px] font-bold font-montserrat uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';
  const inputCls = 'w-full px-3 py-2 bg-slate-50 dark:bg-[#0A0A0A] border border-slate-300 dark:border-[#222222] focus:border-[#E50914] rounded-md text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-colors';
  const cardCls = 'p-5 rounded-xl bg-[#F8F9FA] dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] shadow-xs space-y-4';

  const field = (label: string, key: keyof ProgramConfig, placeholder = '', type: 'text' | 'number' | 'url' = 'text') => (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type={type}
        value={String(draft[key] ?? '')}
        onChange={(e) => updateField(key, (type === 'number' ? Number(e.target.value) : e.target.value) as never)}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Sticky publication bar */}
      <div className="sticky top-20 z-10 rounded-xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] p-4 shadow-md flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-[#E50914]/10 border border-[#E50914]/30">
            <Rocket className="w-4 h-4 text-[#E50914]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white truncate">
              {draft.title || 'Formation sans titre'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-inter">
              Formation active · {STATUS_LABELS[draft.status]} · ${draft.ticketPriceUsd.toFixed(2)} USD · {draft.dateDisplay}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={draft.status}
            onChange={(e) => updateField('status', e.target.value as ProgramConfig['status'])}
            className="px-3 py-2 bg-slate-50 dark:bg-[#0A0A0A] border border-slate-300 dark:border-[#222222] rounded-md text-[11px] text-slate-900 dark:text-white outline-none cursor-pointer"
          >
            {(Object.keys(STATUS_LABELS) as ProgramConfig['status'][]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <button
            onClick={handlePublish}
            disabled={isSaving}
            className={`px-5 py-2.5 text-xs font-bold font-montserrat tracking-wide rounded-md transition-all shadow-md flex items-center gap-2 ${
              isSaving
                ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'text-white bg-[#E50914] hover:bg-[#C80711] cursor-pointer shadow-[#E50914]/20'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Publication…' : 'Publier la Landing Page'}</span>
          </button>
        </div>
      </div>

      {/* Feedback banners */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 font-inter">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-700 dark:text-amber-300 font-inter">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {/* Section navigation */}
      <div className="flex flex-wrap items-center gap-2">
        {SECTION_TABS.map(s => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`px-3.5 py-2 text-[11px] font-bold font-montserrat rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSection === s.id
                  ? 'bg-[#E50914] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#0E0E0E]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* ============================ IDENTITY ============================ */}
      {activeSection === 'identity' && (
        <div className={cardCls}>
          <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
            Identité de la Formation (Hero)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Bandeau institutionnel (kicker)', 'kicker', 'PIGA STUDIO TECH MEDIA')}
            {field('Titre principal', 'title', 'Titre affiché en H1')}
          </div>
          {field('Slogan / tagline', 'tagline', 'L’intelligence logicielle. L’impact cinématographique.')}
          <div>
            <label className={labelCls}>Description commerciale</label>
            <textarea
              value={draft.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={4}
              placeholder="Pitch complet affiché sous le titre…"
              className={`${inputCls} resize-y`}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Date affichée', 'dateDisplay', 'Vendredi 13 Novembre 2026')}
            {field('Horaires affichés', 'timeDisplay', '09h00 – 18h00 (Kinshasa)')}
          </div>
          {field('Lieu / modalité de session', 'locationDisplay', 'Session Kinshasa & Transmission Chiffrée')}
        </div>
      )}

      {/* ============================ LOGISTICS ============================ */}
      {activeSection === 'logistics' && (
        <div className={cardCls}>
          <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
            Tarification, Capacité & Statut de Session
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Prix du billet (USD)', 'ticketPriceUsd', '20.00', 'number')}
            {field('Capacité totale (places)', 'totalCapacity', '80', 'number')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-inter">
            Le prix est verrouillé côté serveur à la registration : les participants ne peuvent jamais choisir un autre montant.
          </div>

          <div className="border-t border-slate-200 dark:border-[#1E1E1E] pt-4 space-y-4">
            <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
              Textes de la section « Programme »
            </div>
            {field('Titre de la section Programme', 'curriculumTitle', 'Piliers Stratégiques & Modules Pratiques')}
            <div>
              <label className={labelCls}>Introduction de la section Programme</label>
              <textarea
                value={draft.curriculumIntro || ''}
                onChange={(e) => updateField('curriculumIntro', e.target.value)}
                rows={3}
                placeholder="Texte affiché au-dessus des modules…"
                className={`${inputCls} resize-y`}
              />
            </div>
            <div>
              <label className={labelCls}>Description du pied de page (footer)</label>
              <textarea
                value={draft.footerAbout || ''}
                onChange={(e) => updateField('footerAbout', e.target.value)}
                rows={3}
                placeholder="Positionnement affiché dans le footer…"
                className={`${inputCls} resize-y`}
              />
            </div>
            {field('Lien Communauté WhatsApp VIP', 'vipWhatsAppUrl', 'https://chat.whatsapp.com/...', 'url')}
          </div>
        </div>
      )}

      {/* ============================ PAYMENT & CONTACTS ============================ */}
      {activeSection === 'payment' && (
        <div className={cardCls}>
          <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
            Compte Orange Money Récepteur & Contacts Direction
          </div>

          {/* Bande de vérification — GROS CARACTÈRES (lisibilité console) */}
          <div className="rounded-lg border-2 border-[#E50914]/40 bg-[#E50914]/5 px-5 py-4 space-y-2">
            <div className="text-[11px] font-bold font-montserrat uppercase tracking-wider text-[#E50914]">
              ✅ Vérification visuelle — ce que les clients verront
            </div>
            <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white leading-snug break-all">
              Orange Money : {draft.orangeMoneyNumber || '—'}
            </div>
            <div className="text-xl font-bold text-slate-700 dark:text-slate-200 leading-snug break-all">
              Titulaire : {draft.orangeMoneyHolder || '—'}
              <span className="block text-sm font-semibold text-slate-500 dark:text-slate-400">
                (Personne physique · Chargé d'Administration PIGA STUDIO)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Numéro Orange Money (affichage)', 'orangeMoneyNumber', '+243 803 240 289')}
            {field('Titulaire du compte', 'orangeMoneyHolder', 'Beniel Musuela')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Email Direction', 'directionEmail', 'direction@piga.cd')}
            {field('Téléphone Direction', 'directionPhone', '0997406281')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-inter">
            Ces informations alimentent automatiquement le hero, les modalités, le footer, les messages WhatsApp de confirmation/révocation et le PDF du billet.
          </div>
        </div>
      )}

      {/* ============================ VISUALS ============================ */}
      {activeSection === 'visuals' && (
        <div className={cardCls}>
          <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
            Visuels de la Landing Page
          </div>

          {/* Hero image */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-start">
            <div className="space-y-2">
              <label className={labelCls}>Image principale (Hero)</label>
              <input
                type="text"
                value={draft.heroImageUrl}
                onChange={(e) => updateField('heroImageUrl', e.target.value)}
                placeholder="URL d'image ou bouton d'upload ci-dessous"
                className={inputCls}
              />
              <div className="flex items-center gap-2">
                <input
                  ref={heroFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleImageUpload('hero', e.target.files?.[0])}
                />
                <button
                  onClick={() => heroFileRef.current?.click()}
                  disabled={isUploading === 'hero'}
                  className="px-3.5 py-2 text-[11px] font-bold font-montserrat rounded-md flex items-center gap-2 bg-slate-800 dark:bg-[#151515] text-white border border-slate-700 dark:border-[#222222] hover:bg-[#E50914] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isUploading === 'hero' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                  <span>{isUploading === 'hero' ? 'Envoi…' : 'Téléverser une image'}</span>
                </button>
                <img
                  src={resolveFormationImageUrl(draft.heroImageUrl, HERO_IMAGE_FALLBACK)}
                  alt="Aperçu hero"
                  className="w-28 h-16 object-cover rounded-md border border-slate-300 dark:border-[#222222]"
                />
              </div>
            </div>
          </div>

          {/* Auditorium image */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-start">
            <div className="space-y-2">
              <label className={labelCls}>Image de la section Modalités (auditorium)</label>
              <input
                type="text"
                value={draft.auditoriumImageUrl}
                onChange={(e) => updateField('auditoriumImageUrl', e.target.value)}
                placeholder="URL d'image ou bouton d'upload ci-dessous"
                className={inputCls}
              />
              <div className="flex items-center gap-2">
                <input
                  ref={auditoriumFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleImageUpload('auditorium', e.target.files?.[0])}
                />
                <button
                  onClick={() => auditoriumFileRef.current?.click()}
                  disabled={isUploading === 'auditorium'}
                  className="px-3.5 py-2 text-[11px] font-bold font-montserrat rounded-md flex items-center gap-2 bg-slate-800 dark:bg-[#151515] text-white border border-slate-700 dark:border-[#222222] hover:bg-[#E50914] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isUploading === 'auditorium' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                  <span>{isUploading === 'auditorium' ? 'Envoi…' : 'Téléverser une image'}</span>
                </button>
                <img
                  src={resolveFormationImageUrl(draft.auditoriumImageUrl, AUDITORIUM_IMAGE_FALLBACK)}
                  alt="Aperçu auditorium"
                  className="w-28 h-16 object-cover rounded-md border border-slate-300 dark:border-[#222222]"
                />
              </div>
            </div>
          </div>

          {/* Presets */}
          <div className="border-t border-slate-200 dark:border-[#1E1E1E] pt-4 space-y-3">
            <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
              Modèles PIGA prêts à l'emploi (chargement dans le brouillon)
            </div>
            <div className="flex flex-wrap gap-2">
              {TRAINING_PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleApplyPreset(p.id)}
                  className="px-3 py-2 text-[11px] font-semibold rounded-md border border-slate-300 dark:border-[#222222] bg-white dark:bg-[#111111] text-slate-700 dark:text-slate-300 hover:border-[#E50914] hover:text-[#E50914] transition-colors cursor-pointer flex flex-col items-start"
                >
                  <span className="font-bold">{p.name}</span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400">{p.badge} · ${p.config.ticketPriceUsd} · {p.config.totalCapacity} places</span>
                </button>
              ))}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-inter">
              Le contenu du modèle est appliqué au brouillon local : rien ne part en ligne avant « Publier ».
            </div>
          </div>
        </div>
      )}

      {/* ============================ MODULES ============================ */}
      {activeSection === 'modules' && (
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
              Curriculum · {draft.modules.length} module(s)
            </div>
            <button
              onClick={addModule}
              className="px-3 py-2 text-[11px] font-bold font-montserrat rounded-md flex items-center gap-1.5 text-white bg-[#E50914] hover:bg-[#C80711] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter un module</span>
            </button>
          </div>

          {draft.modules.length === 0 && (
            <div className="text-xs text-slate-400 py-6 text-center font-inter">
              Aucun module : la section « Programme » sera vide. Ajoutez les piliers de votre formation.
            </div>
          )}

          <div className="space-y-3">
            {draft.modules.map((m, idx) => (
              <div key={m.id} className="p-4 rounded-lg bg-white dark:bg-[#0E0E0E] border border-slate-200 dark:border-[#1E1E1E] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-[#E50914]">{m.index}.</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveModule(idx, -1)} disabled={idx === 0} title="Monter" className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1A1A1A] cursor-pointer disabled:opacity-30">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => moveModule(idx, 1)} disabled={idx === draft.modules.length - 1} title="Descendre" className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1A1A1A] cursor-pointer disabled:opacity-30">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeModule(idx)} title="Supprimer" className="p-1.5 rounded-md text-slate-500 hover:text-[#E50914] hover:bg-[#E50914]/10 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[70px_1fr] gap-3">
                  <div>
                    <label className={labelCls}>N°</label>
                    <input value={m.index} onChange={(e) => updateModule(idx, { index: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Titre du module</label>
                    <input value={m.title} onChange={(e) => updateModule(idx, { title: e.target.value })} placeholder="Titre affiché" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Point fort (highlight)</label>
                  <input value={m.highlight} onChange={(e) => updateModule(idx, { highlight: e.target.value })} placeholder="Sous-titre accrocheur" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea value={m.description} onChange={(e) => updateModule(idx, { description: e.target.value })} rows={2} placeholder="Contenu pédagogique du module…" className={`${inputCls} resize-y`} />
                </div>
                <div>
                  <label className={labelCls}>Icône</label>
                  <select
                    value={m.iconName || 'Network'}
                    onChange={(e) => updateModule(idx, { iconName: e.target.value as ProgramModuleIcon })}
                    className={`${inputCls} cursor-pointer`}
                  >
                    {PROGRAM_MODULE_ICONS.map(icon => (
                      <option key={icon.id} value={icon.id}>{icon.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================ NDA ============================ */}
      {activeSection === 'nda' && (
        <div className={cardCls}>
          <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
            Contrat de Confidentialité (DNA / IP) — obligatoire à l'inscription
          </div>
          {field('Titre du contrat', 'ndaTitle', 'ACCORD DE CONFIDENTIALITÉ…')}
          <div className="space-y-3">
            {draft.ndaClauses.map((clause, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <textarea
                  value={clause}
                  onChange={(e) => updateClause(idx, e.target.value)}
                  rows={3}
                  className={`${inputCls} resize-y flex-1`}
                />
                <button onClick={() => removeClause(idx)} title="Supprimer la clause" className="p-2 rounded-md text-slate-500 hover:text-[#E50914] hover:bg-[#E50914]/10 cursor-pointer mt-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addClause}
            className="w-full px-3 py-2.5 text-[11px] font-bold font-montserrat rounded-md flex items-center justify-center gap-1.5 border border-dashed border-slate-300 dark:border-[#333333] text-slate-500 hover:text-[#E50914] hover:border-[#E50914]/50 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter une clause</span>
          </button>
        </div>
      )}

      {/* ============================ REGISTRY ============================ */}
      {activeSection === 'library' && (
        <div className="space-y-5">
          {/* Launch new */}
          <div className={cardCls}>
            <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
              Lancer une Nouvelle Formation
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-inter">
              Crée une formation vierge, l'active immédiatement et vide la vue publique pour sa personnalisation.
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newFormationName}
                onChange={(e) => setNewFormationName(e.target.value)}
                placeholder="Nom de la nouvelle formation…"
                className={inputCls}
              />
              <button
                onClick={handleCreateFormation}
                disabled={isBusyRegistry || !newFormationName.trim()}
                className="px-5 py-2.5 text-xs font-bold font-montserrat rounded-md flex items-center justify-center gap-2 text-white bg-[#E50914] hover:bg-[#C80711] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-md shadow-[#E50914]/20"
              >
                {isBusyRegistry ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                <span>Créer &amp; Activer</span>
              </button>
            </div>
          </div>

          {/* Duplicate current */}
          <div className={cardCls}>
            <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
              Dupliquer la Formation Active
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-inter">
              La copie hérite de toute la configuration actuelle (textes, modules, NDA, visuels) pour être retouchée sereinement.
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                placeholder="Nom de la copie…"
                className={inputCls}
              />
              <button
                onClick={handleDuplicate}
                disabled={isBusyRegistry || !duplicateName.trim()}
                className="px-5 py-2.5 text-xs font-bold font-montserrat rounded-md flex items-center justify-center gap-2 text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#111111] border border-slate-300 dark:border-[#222222] hover:border-[#E50914] hover:text-[#E50914] cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Dupliquer</span>
              </button>
            </div>
          </div>

          {/* Saved formations */}
          <div className={cardCls}>
            <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
              Registre Persistant ({formations.length} formation(s))
            </div>
            <div className="space-y-2">
              {formations.length === 0 && (
                <div className="text-xs text-slate-400 py-4 text-center font-inter">Registre vide.</div>
              )}
              {formations.map(f => {
                const isActive = f.id === activeId;
                return (
                  <div
                    key={f.id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-2 justify-between p-3.5 rounded-lg border transition-colors ${
                      isActive
                        ? 'bg-[#E50914]/5 border-[#E50914]/40'
                        : 'bg-white dark:bg-[#0E0E0E] border-slate-200 dark:border-[#1E1E1E]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                        <span className="truncate">{f.title}</span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded bg-[#E50914] text-white text-[9px] font-bold uppercase tracking-wider">Active</span>
                        )}
                        {f.status === 'SOLD_OUT' && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#1A1A1A] text-slate-500 text-[9px] font-bold uppercase tracking-wider">Complète</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-inter mt-0.5">
                        {f.dateDisplay} · dernière édition {new Date(f.updatedAt).toLocaleString('fr-FR')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!isActive && (
                        <>
                          <button
                            onClick={() => handleActivate(f.id)}
                            disabled={isBusyRegistry}
                            className="px-3.5 py-2 text-[10px] font-bold font-montserrat rounded-md flex items-center gap-1.5 text-white bg-[#E50914] hover:bg-[#C80711] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Rocket className="w-3 h-3" />
                            <span>Activer</span>
                          </button>
                          <button
                            onClick={() => handleDeleteFormation(f.id)}
                            disabled={isBusyRegistry}
                            title="Supprimer"
                            className="p-2 rounded-md text-slate-500 hover:text-[#E50914] hover:bg-[#E50914]/10 cursor-pointer disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-inter">
              Le registre est persisté sur disque (data/formations.json) : les formations survivent aux redémarrages du serveur.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
