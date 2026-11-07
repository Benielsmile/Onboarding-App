/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Dynamic Training Program Presets & Configuration
 * Allows the administrator to instantly customize the landing page,
 * switch formations, adjust pricing ($20 USD default, or new tariff),
 * capacity, curriculum modules, and DNA terms.
 */

import type { ProgramConfig, ProgramModuleIcon } from '../types/index.ts';

/** Icon palette available for curriculum modules in the Formation Editor */
export const PROGRAM_MODULE_ICONS: { id: ProgramModuleIcon; label: string }[] = [
  { id: 'Network', label: 'Réseau / Architecture' },
  { id: 'ShieldAlert', label: 'Sécurité' },
  { id: 'Server', label: 'Serveur / Infra' },
  { id: 'QrCode', label: 'QR Code / Billetterie' },
  { id: 'Cpu', label: 'Calcul / IA' },
  { id: 'Brain', label: 'Intelligence / Agents' },
  { id: 'Workflow', label: 'Workflow / Automatisation' },
  { id: 'Code', label: 'Code / Développement' },
  { id: 'Terminal', label: 'Terminal / Garde-fous' },
  { id: 'Database', label: 'Base de données' }
];

export const DEFAULT_PROGRAM_CONFIG: ProgramConfig = {
  id: 'arsenal-agentique-2026',
  title: 'Arsenal Agentique : L’Intelligence Logicielle de Demain',
  tagline: 'L’intelligence logicielle. L’impact cinématographique.',
  kicker: 'PIGA STUDIO TECH MEDIA',
  dateDisplay: 'Vendredi 13 Novembre 2026',
  timeDisplay: '09h00 – 18h00 (Kinshasa)',
  locationDisplay: 'Session Kinshasa & Transmission Chiffrée',
  description: 'Développé par PIGA STUDIO, le studio d’innovation IA et Tech Media de référence. Concevez, orchestrez et blindez des architectures multi-agents prêtes pour la production (LangGraph, tool-calling et défenses anti-injection).',
  ticketPriceUsd: 20.00,
  totalCapacity: 80,
  status: 'OPEN',
  orangeMoneyNumber: '+243 803 240 289',
  orangeMoneyHolder: 'Beniel Musuela',
  directionEmail: 'Benielsmile89@gmail.com',
  directionPhone: '0997406281',
  heroImageUrl: '/src/assets/images/hero_arsenal_agentique_1793949804735.jpg',
  auditoriumImageUrl: '/src/assets/images/event_keynote_hall_1793949804529.jpg',
  modules: [
    {
      id: 'm1',
      index: '01',
      title: 'Architectures Multi-Agents & LangGraph',
      highlight: 'Cyclic State Graphs & Cognitive Routing',
      description: 'Conception de flux d’agents collaboratifs, mémoire épisodique, modèles superviseurs et orchestration à faible latence dans l’écosystème PIGA TECH.',
      iconName: 'Network'
    },
    {
      id: 'm2',
      index: '02',
      title: 'Tool-Calling & Sandboxing Zéro-Trust',
      highlight: 'Défenses OWASP Top 10 for LLMs',
      description: 'Cloisonnement strict d’exécution, barrières contre les prompt injections indirectes, validation de tokens éphémères et contrôle d’accès granulaire.',
      iconName: 'ShieldAlert'
    },
    {
      id: 'm3',
      index: '03',
      title: 'Haute Concurrence & Déploiement Edge',
      highlight: 'PostgreSQL RLS & Cloudflare WAF',
      description: 'Verrouillage transactionnel au niveau ligne (SELECT FOR UPDATE), cryptographie de stockage privé (URLs signées HMAC) et distribution Edge sans latence.',
      iconName: 'Server'
    },
    {
      id: 'm4',
      index: '04',
      title: 'Billetterie Cryptographique Inviolable',
      highlight: 'AES-256-GCM & Authentification 128-bit',
      description: 'Génération de laissez-passer chiffrés avec balise d’authentification, QR code dynamique scannable et intégration de conciergerie WhatsApp en direct.',
      iconName: 'QrCode'
    }
  ],
  ndaTitle: 'ACCORD DE CONFIDENTIALITÉ & PROTECTION DES ACTIFS INTELLECTUELS (DNA & IP)',
  ndaClauses: [
    '1. Droits Exclusifs PIGA STUDIO : L’ensemble des architectures de supervision d’agents, scripts d’orchestration LangGraph, structures de sandboxing et supports audiovisuels dispensés lors de la formation constituent la propriété intellectuelle exclusive de PIGA STUDIO.',
    '2. Engagement de Non-Divulgation (DNA / NDA) : Le participant s’engage formellement à garder confidentielles les clés d’architectures, les pipelines propriétaires et les stratégies offensives/défensives présentées. Toute diffusion non autorisée sur un réseau public ou dépôt externe est rigoureusement interdite.',
    '3. Éthique et Sécurité Offensive : Les connaissances transmises (défenses contre les prompt injections, contournements et audit de sécurité d’agents) doivent être mobilisées exclusivement dans le cadre de la protection défensive des systèmes d’information d’entreprises.',
    '4. Révocation de Billet : Tout manquement à ces règles entraînera l’annulation immédiate du billet cryptographique AES-256-GCM sans remboursement et des poursuites légales sous la juridiction compétente en RDC.'
  ],
  vipWhatsAppUrl: 'https://chat.whatsapp.com/PigaArsenalAgentique2026',
  updatedAt: new Date().toISOString()
};

/** Blank starting point used when the admin launches a brand-new formation */
export const BLANK_FORMATION_TEMPLATE: Omit<ProgramConfig, 'id' | 'updatedAt'> = {
  title: 'Nouvelle Formation',
  tagline: '',
  kicker: 'PIGA STUDIO TECH MEDIA',
  dateDisplay: 'Date à confirmer',
  timeDisplay: '',
  locationDisplay: '',
  description: '',
  ticketPriceUsd: 20.00,
  totalCapacity: 50,
  status: 'COMING_SOON',
  orangeMoneyNumber: DEFAULT_PROGRAM_CONFIG.orangeMoneyNumber,
  orangeMoneyHolder: DEFAULT_PROGRAM_CONFIG.orangeMoneyHolder,
  directionEmail: DEFAULT_PROGRAM_CONFIG.directionEmail,
  directionPhone: DEFAULT_PROGRAM_CONFIG.directionPhone,
  heroImageUrl: '',
  auditoriumImageUrl: '',
  modules: [],
  ndaTitle: DEFAULT_PROGRAM_CONFIG.ndaTitle,
  ndaClauses: [...DEFAULT_PROGRAM_CONFIG.ndaClauses],
  curriculumTitle: '',
  curriculumIntro: '',
  footerAbout: '',
  vipWhatsAppUrl: DEFAULT_PROGRAM_CONFIG.vipWhatsAppUrl
};

export const TRAINING_PRESETS: { id: string; name: string; badge: string; config: Partial<ProgramConfig> }[] = [
  {
    id: 'arsenal-agentique',
    name: 'Arsenal Agentique : Production & Sécurité',
    badge: 'Flagship PIGA',
    config: {
      title: 'Arsenal Agentique : L’Intelligence Logicielle de Demain',
      tagline: 'L’intelligence logicielle. L’impact cinématographique.',
      kicker: 'PIGA STUDIO TECH MEDIA',
      dateDisplay: 'Vendredi 13 Novembre 2026',
      timeDisplay: '09h00 – 18h00 (Kinshasa)',
      locationDisplay: 'Session Kinshasa & Transmission Chiffrée',
      description: 'Développé par PIGA STUDIO, le studio d’innovation IA et Tech Media de référence. Concevez, orchestrez et blindez des architectures multi-agents prêtes pour la production (LangGraph, tool-calling et défenses anti-injection).',
      ticketPriceUsd: 20.00,
      totalCapacity: 80,
      modules: DEFAULT_PROGRAM_CONFIG.modules
    }
  },
  {
    id: 'n8n-multi-agents',
    name: 'Masterclass n8n & Systèmes Multi-Agents Autonomes',
    badge: 'Automatisation & Entreprise',
    config: {
      title: 'Masterclass n8n & Systèmes Multi-Agents Autonomes',
      tagline: 'Automatisez vos opérations à l’échelle grâce aux agents autonomes.',
      kicker: 'PIGA STUDIO EXECUTIVE ACADEMY',
      dateDisplay: 'Samedi 5 Décembre 2026',
      timeDisplay: '10h00 – 17h00 (Kinshasa)',
      locationDisplay: 'Auditorium Piga Kinshasa & Live Stream VIP',
      description: 'Apprenez à construire des pipelines d’automatisation complexes connectant des modèles IA (Gemini, Claude, GPT) à vos bases de données, CRM et systèmes bancaires via des workflows n8n hautement résilients.',
      ticketPriceUsd: 25.00,
      totalCapacity: 60,
      modules: [
        {
          id: 'n1',
          index: '01',
          title: 'Fondations n8n & Node Architecture',
          highlight: 'Webhooks, Déclencheurs Événementiels & Polling',
          description: 'Configuration du serveur n8n self-hosted, sécurisation des identifiants et création de flux asynchrones fiables.',
          iconName: 'Workflow'
        },
        {
          id: 'n2',
          index: '02',
          title: 'Intégration d’Agents IA Cognitifs',
          highlight: 'OpenAI Functions, Tool-Calling & Mémoire Redis',
          description: 'Implémentation d’agents capables de prendre des décisions autonomes et de router dynamiquement les requêtes complexes.',
          iconName: 'Brain'
        },
        {
          id: 'n3',
          index: '03',
          title: 'Connecteurs Métiers (ERP, WhatsApp & Mobile Money)',
          highlight: 'Intégration API Orange Money & WhatsApp Cloud',
          description: 'Automatisation des encaissements, relances clients instantanées et génération de reçus PDF à la volée.',
          iconName: 'Database'
        },
        {
          id: 'n4',
          index: '04',
          title: 'Déploiement en Production & Haute Disponibilité',
          highlight: 'Docker, Reverse Proxy & Monitoring Temps Réel',
          description: 'Mise en production sécurisée sous Linux avec gestion des erreurs et reprise automatique après sinistre.',
          iconName: 'Server'
        }
      ]
    }
  },
  {
    id: 'rag-enterprise-llm',
    name: 'Ingénierie RAG Avancée & Vector Stores d’Entreprise',
    badge: 'Intelligence de Données',
    config: {
      title: 'Ingénierie RAG Avancée & Vector Stores d’Entreprise',
      tagline: 'Connectez vos LLMs à l’ensemble de vos bases documentaires privées.',
      kicker: 'PIGA STUDIO DEEP TECH',
      dateDisplay: 'Samedi 16 Janvier 2027',
      timeDisplay: '09h30 – 17h30 (Kinshasa)',
      locationDisplay: 'Lab d’Ingénierie PIGA, Kinshasa',
      description: 'Maîtrisez les techniques de pointe de Retrieval-Augmented Generation : chunking sémantique, embeddings denses/creux (Hybrid Search), re-ranking et bases vectorielles (pgvector, Qdrant).',
      ticketPriceUsd: 35.00,
      totalCapacity: 50,
      modules: [
        {
          id: 'r1',
          index: '01',
          title: 'Chunking Sémantique & Ingestion de Documents',
          highlight: 'Parsing PDF lourds, Tableaux & Données Non Structurées',
          description: 'Stratégies de découpage contextuel pour préserver le sens exact des clauses juridiques et bilans financiers.',
          iconName: 'Code'
        },
        {
          id: 'r2',
          index: '02',
          title: 'Vector Databases : PostgreSQL pgvector & Qdrant',
          highlight: 'Index HNSW, Cosine Distance & Filtres Scalaires',
          description: 'Indexation de millions de vecteurs avec temps de réponse inférieur à 20ms sous contraintes de production.',
          iconName: 'Database'
        },
        {
          id: 'r3',
          index: '03',
          title: 'Hybrid Search & Modèles de Re-Ranking',
          highlight: 'BM25 + Dense Vectors & Cohere Rerank',
          description: 'Combinaison de la recherche par mots-clés et sémantique pour éliminer 98% des hallucinations du modèle.',
          iconName: 'Cpu'
        },
        {
          id: 'r4',
          index: '04',
          title: 'Évaluation & Métriques Ragas / TruLens',
          highlight: 'Context Precision, Faithfulness & Réponse Validée',
          description: 'Mise en place d’un banc de test automatisé pour mesurer la fiabilité scientifique de votre pipeline RAG.',
          iconName: 'ShieldAlert'
        }
      ]
    }
  },
  {
    id: 'cyberdefense-llm',
    name: 'Cyberdéfense IA & Détection des Injections de Prompts',
    badge: 'Sécurité Offensive & Défensive',
    config: {
      title: 'Cyberdéfense IA & Blindage des Systèmes Autonomes',
      tagline: 'Protégez vos applications IA contre les attaques de nouvelle génération.',
      kicker: 'PIGA STUDIO CYBER DIVISION',
      dateDisplay: 'Vendredi 19 Février 2027',
      timeDisplay: '09h00 – 18h00 (Kinshasa)',
      locationDisplay: 'Centre de Conférence PIGA & Accès Chiffré',
      description: 'Audit approfondi des vulnérabilités de modèles de langage (Jailbreaks, Prompt Injections directes et indirectes, Data Exfiltration). Techniques de confinement et pare-feu d’inférence.',
      ticketPriceUsd: 30.00,
      totalCapacity: 45,
      modules: [
        {
          id: 'c1',
          index: '01',
          title: 'Anatomie des Prompt Injections (OWASP Top 10 LLM)',
          highlight: 'Attaques Multimodales, Fichiers Piégés & RAG Poisoning',
          description: 'Démonstrations pratiques de détournement de contexte et d’extraction non autorisée de données sensibles.',
          iconName: 'ShieldAlert'
        },
        {
          id: 'c2',
          index: '02',
          title: 'Filtres d’Entrée & Garde-Fous en Temps Réel',
          highlight: 'Llama Guard, NeMo Guardrails & Détection d’Anomalies',
          description: 'Mise en place de couches de validation en amont de l’inférence pour bloquer les vecteurs d’attaques connus.',
          iconName: 'Terminal'
        },
        {
          id: 'c3',
          index: '03',
          title: 'Cloisonnement d’Exécution (Tool-Calling Sandboxing)',
          highlight: 'Micro-VMs Firecracker, Docker Read-Only & Éphémérité',
          description: 'Isolation des outils d’exécution de code pour empêcher toute compromission du système hôte.',
          iconName: 'Server'
        },
        {
          id: 'c4',
          index: '04',
          title: 'Audit & Red Teaming d’Agents Autonomes',
          highlight: 'Simulation d’Attaques en Environnement Contrôlé',
          description: 'Méthodologie de pentest appliquée aux agents d’entreprise et rédaction de rapports de remédiation conformes.',
          iconName: 'Cpu'
        }
      ]
    }
  }
];
