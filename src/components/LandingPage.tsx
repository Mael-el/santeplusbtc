import React, { useState, useRef, useEffect } from 'react';
import { 
  User, Stethoscope, Building2, ShieldCheck, Zap, Shield, TrendingUp,
  Volume2, VolumeX, MessageSquare, Send, ChevronDown, ChevronUp,
  Sparkles, CheckCircle2, ArrowRight, HelpCircle, PhoneCall, Users, Activity, X
} from 'lucide-react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';

interface LandingPageProps {
  onSelectRole: (role: 'patient' | 'doctor' | 'hospital') => void;
  onEnterApp: (initialView: 'map' | 'wallet' | 'appointments') => void;
  isLoggedIn: boolean;
  onOpenAuth: () => void;
  onOpenEmergency?: () => void;
}

export default function LandingPage({
  onSelectRole,
  onEnterApp,
  isLoggedIn,
  onOpenAuth,
  onOpenEmergency
}: LandingPageProps) {
  // Voice Speech Synthesis state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const speakIntro = () => {
    if (!('speechSynthesis' in window)) {
      alert("La synthèse vocale n'est pas supportée sur ce navigateur.");
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const text = "Bienvenue sur Santé Plus Bénin. De l'urgence au soin en trois minutes. Si vous êtes un patient, touchez la carte verte Patient. Si vous êtes un médecin, touchez la carte bleue Médecin. Pour l'administration d'un hôpital, touchez la carte orange Hôpital. En cas d'urgence grave, touchez le bouton rouge en bas de votre écran.";
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.95;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    setIsPlayingAudio(true);
    window.speechSynthesis.speak(utterance);
  };

  // FAQ state
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const faqs = [
    {
      question: "Comment utiliser Santé+ sans savoir lire ni écrire ?",
      answer: "Santé+ est spécialement conçu avec des repères visuels intuitifs : de grands boutons de couleur, la connexion par empreinte digitale ou scan de visage (biométrie), et un QR Code sécurisé. Vous pouvez également cliquer sur les icônes de haut-parleur pour écouter les explications et ordonnances à voix haute."
    },
    {
      question: "Comment fonctionne le règlement rapide par Bitcoin Lightning ?",
      answer: "Lors d'une consultation ou d'un acte médical, le paiement est instantané en moins de 2 secondes via le réseau Lightning de Bitcoin ou votre portefeuille en Francs CFA, garantissant une prise en charge immédiate sans attente au guichet."
    },
    {
      question: "Mes données médicales sont-elles protégées ?",
      answer: "Oui. Toutes vos données sont chiffrées et décentralisées. Aucun médecin ou tiers ne peut accéder à votre dossier sans votre consentement explicite, validé via votre QR code ou votre signature cryptographique."
    },
    {
      question: "Que faire en cas d'urgence immédiate ?",
      answer: "Cliquez sur le bouton rouge 'Urgence' situé en permanence en bas à droite de votre écran pour contacter directement le SAMU (15), les sapeurs-pompiers (118) ou obtenir l'itinéraire vers l'hôpital le plus proche."
    }
  ];

  // Chatbot State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant', text: string }>>([
    { role: 'assistant', text: "Bonjour ! Je suis l'assistant Santé+ Bénin. Posez-moi vos questions ou écoutez mes réponses audio." }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isTyping]);

  const handleSendChat = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    setChatMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setChatInput('');
    setIsTyping(true);

    // Add placeholder for streaming assistant message
    setChatMessages(prev => [...prev, { role: 'assistant', text: '' }]);

    try {
      const history = chatMessages.slice(1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.text
      }));

      const params = new URLSearchParams({
        message: textToSend,
        history: JSON.stringify(history)
      });

      const eventSource = new EventSource(`/api/chat/stream?${params.toString()}`);
      let accumulated = '';

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.chunk) {
            accumulated += data.chunk;
            setChatMessages(prev => {
              const msgs = [...prev];
              msgs[msgs.length - 1] = { role: 'assistant', text: accumulated };
              return msgs;
            });
          }
          if (data.done) {
            eventSource.close();
            setIsTyping(false);
          }
          if (data.error) {
            eventSource.close();
            setIsTyping(false);
          }
        } catch { /* ignore parse errors */ }
      };

      eventSource.onerror = () => {
        eventSource.close();
        if (!accumulated) {
          setChatMessages(prev => {
            const msgs = [...prev];
            msgs[msgs.length - 1] = { role: 'assistant', text: "Je suis là pour vous aider. Vous pouvez accéder à votre dossier médical, régler vos soins ou consulter la liste des hôpitaux partenaires." };
            return msgs;
          });
        }
        setIsTyping(false);
      };
    } catch (err) {
      setChatMessages(prev => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = { 
          role: 'assistant', 
          text: "Je suis là pour vous aider. Vous pouvez accéder à votre dossier médical, régler vos soins ou consulter la liste des hôpitaux partenaires." 
        };
        return msgs;
      });
      setIsTyping(false);
    }
  };


  return (
    <MotionConfig transition={{ duration: 0 }} reducedMotion="always">
    <div className="landing-page w-full flex flex-col items-center overflow-hidden">
      
      {/* Hero principal */}
      <section className="relative w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8 lg:pt-12 pb-8 sm:pb-12 flex flex-col items-center text-center">
        <div className="landing-orb landing-orb-one" aria-hidden="true" />
        <div className="landing-orb landing-orb-two" aria-hidden="true" />
        <div className="landing-grid" aria-hidden="true" />
        
        {/* Badge Officiel National */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="relative inline-flex max-w-full items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 text-slate-700 border border-emerald-200 text-[10px] sm:text-[11px] font-bold tracking-tight mb-5 shadow-sm backdrop-blur-sm"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          <span className="truncate">Portail National d'Interconnexion Médicale • République du Bénin</span>
        </motion.div>

        {/* Medical Icon & Audio helper */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.1, type: 'spring', stiffness: 180 }}
          className="relative mb-5"
        >
          <div 
            className="landing-logo-badge w-16 h-16 sm:w-20 sm:h-20 rounded-[1.4rem] bg-emerald-600 flex items-center justify-center text-white shadow-md hover:bg-emerald-700 transition-colors cursor-pointer"
            onClick={speakIntro}
            title="Cliquez pour écouter l'explication audio"
          >
            <Activity className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          {/* Audio helper tag */}
          <button
            onClick={speakIntro}
            className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-white text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-sans shadow-xs hover:bg-emerald-50 flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            {isPlayingAudio ? (
              <>
                <VolumeX className="w-3 h-3 text-red-500 animate-pulse" />
                <span>Arrêter l'audio</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3 h-3 text-emerald-600" />
                <span>Écouter (Audio)</span>
              </>
            )}
          </button>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.18 }}
          className="relative text-[2.2rem] sm:text-5xl lg:text-6xl font-extrabold font-sans text-slate-900 tracking-[-0.04em] leading-[1.02] max-w-4xl mt-1"
        >
          Accès immédiat aux soins, <span className="landing-highlight text-emerald-600">sans friction</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28 }}
          className="relative mt-4 text-sm sm:text-base lg:text-lg text-slate-600 font-sans max-w-2xl leading-relaxed"
        >
          Un écosystème santé sécurisé pour les patients, médecins, hôpitaux et administrateurs, avec dossier numérique, prise en charge rapide et paiements instantanés.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.34 }}
          className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.12em] text-slate-600"
        >
          <span className="rounded-full border border-emerald-200 bg-white/85 px-3 py-1.5 text-emerald-800 shadow-sm">Dossier chiffré</span>
          <span className="rounded-full border border-sky-200 bg-white/85 px-3 py-1.5 text-sky-700 shadow-sm">Consultation rapide</span>
          <span className="rounded-full border border-amber-200 bg-white/85 px-3 py-1.5 text-amber-700 shadow-sm">Urgence 24/7</span>
        </motion.div>

        {/* 3 Action Cards (Patient / Médecin / Hôpital) */}
        <div className="relative w-full grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-5 mt-8 sm:mt-10">
          
          {/* 1. PATIENT CARD */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.35 }}
            onClick={() => onSelectRole('patient')}
            className="landing-role-card landing-role-card-patient sante-card p-5 sm:p-5 lg:p-6 flex flex-col items-center text-center group cursor-pointer bg-white relative overflow-hidden border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-600"></div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-3 group-hover:scale-105 transition-transform">
              <User className="w-7 h-7" />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full mb-1.5">
              Espace Citoyen
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 font-sans">Patient</h3>
            <p className="text-xs sm:text-sm text-slate-600 font-sans mt-1">
              Dossier médical, QR Pass & Soins
            </p>
            <div className="mt-4 text-sm font-bold text-emerald-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Accéder à mon espace</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>

          {/* 2. DOCTOR CARD */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.44 }}
            onClick={() => onSelectRole('doctor')}
            className="landing-role-card landing-role-card-doctor sante-card p-5 sm:p-5 lg:p-6 flex flex-col items-center text-center group cursor-pointer bg-white relative overflow-hidden border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600"></div>
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 mb-3 group-hover:scale-105 transition-transform">
              <Stethoscope className="w-7 h-7" />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full mb-1.5">
              Espace Praticien
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 font-sans">Médecin</h3>
            <p className="text-xs sm:text-sm text-slate-600 font-sans mt-1">
              Consultations, ordonnances & IA
            </p>
            <div className="mt-4 text-sm font-bold text-blue-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Consulter un dossier</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>

          {/* 3. HOSPITAL CARD */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.53 }}
            onClick={() => onSelectRole('hospital')}
            className="landing-role-card landing-role-card-hospital sante-card p-5 sm:p-5 lg:p-6 flex flex-col items-center text-center group cursor-pointer bg-white relative overflow-hidden border border-slate-200 hover:border-amber-500 hover:shadow-md transition-all"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500"></div>
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mb-3 group-hover:scale-105 transition-transform">
              <Building2 className="w-7 h-7" />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full mb-1.5">
              Direction Hospitalière
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 font-sans">Hôpital</h3>
            <p className="text-xs sm:text-sm text-slate-600 font-sans mt-1">
              Lits, personnel & régulation MSP
            </p>
            <div className="mt-4 text-sm font-bold text-amber-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Gérer l'établissement</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>

        </div>

        {/* 3 Compact Metric Cards (Couverture, Efficacité, Vitesse) */}
        <div className="relative w-full grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">

          {/* Metric 1: Couverture */}
          <motion.div className="sante-card p-4 text-left bg-white border border-slate-200/80 rounded-2xl relative overflow-hidden flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-black text-slate-900 font-sans tracking-tight">
                98%
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">COUVERTURE</span>
              <p className="text-[11px] text-slate-500 font-sans leading-tight mt-0.5">
                Des données patients sécurisées
              </p>
            </div>
          </motion.div>

          {/* Metric 2: Efficacité */}
          <motion.div className="sante-card p-4 text-left bg-white border border-slate-200/80 rounded-2xl relative overflow-hidden flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-black text-slate-900 font-sans tracking-tight">
                40%
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">EFFICACITÉ</span>
              <p className="text-[11px] text-slate-500 font-sans leading-tight mt-0.5">
                D'économie sur la gestion des soins
              </p>
            </div>
          </motion.div>

          {/* Metric 3: Vitesse */}
          <motion.div className="sante-card p-4 text-left bg-white border border-slate-200/80 rounded-2xl relative overflow-hidden flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
              <Zap className="w-5 h-5 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <div className="text-xl font-black text-slate-900 font-sans tracking-tight">
                &lt; 2s
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">VITESSE RÈGLEMENT</span>
              <p className="text-[11px] text-slate-500 font-sans leading-tight mt-0.5">
                Règlement direct par Bitcoin Lightning
              </p>
            </div>
          </motion.div>

        </div>

      </section>

      {/* FAQ & Voice Assistance Section */}
      <section className="w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 pb-16">
        <div className="landing-faq bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 md:p-8 space-y-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="space-y-1 text-left">
              <h3 className="text-lg font-black text-slate-900 font-sans flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-600" />
                Foire Aux Questions & Guide Simplifié
              </h3>
              <p className="text-xs text-slate-500">Comprendre le fonctionnement en toute simplicité</p>
            </div>
            <button
              onClick={speakIntro}
              className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              <span className="hidden sm:inline">Guide Audio</span>
            </button>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div 
                key={idx}
                className="border border-slate-200 rounded-2xl overflow-hidden bg-white"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full py-3.5 px-5 flex items-center justify-between text-left font-sans font-bold text-slate-800 text-xs sm:text-sm gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <span>{faq.question}</span>
                  {activeFaq === idx ? (
                    <ChevronUp className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>
                
                <AnimatePresence initial={false}>
                  {activeFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-5 pb-4 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Floating Chat Assistant Button & Modal (Positioned cleanly alongside Emergency SAMU) */}
      <div className="fixed bottom-20 right-3 sm:bottom-5 sm:right-52 z-40 flex flex-col items-end">
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="w-[320px] sm:w-[360px] h-[450px] bg-white rounded-3xl shadow-xl border border-slate-200 flex flex-col overflow-hidden mb-3 absolute bottom-12 right-0 z-50"
            >
              <div className="p-3.5 bg-emerald-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white font-black text-xs">
                    S+
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Assistant Vocal Santé+</h4>
                    <span className="text-[10px] text-emerald-100 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      En ligne • Réponses audio
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setChatOpen(false)}
                  className="text-white/80 hover:text-white p-1 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-50 text-xs">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-800 border border-slate-200/80 shadow-xs'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white text-slate-500 border border-slate-200 rounded-2xl px-3.5 py-2 text-xs flex items-center gap-1 shadow-xs">
                      <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce delay-100"></span>
                      <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce delay-200"></span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat(chatInput);
                }}
                className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Posez votre question..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                />
                <button
                  type="submit"
                  className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center cursor-pointer shrink-0 transition-colors shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="h-9 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-full shadow-md cursor-pointer flex items-center gap-2 text-xs font-bold transition-colors"
          title="Assistant Santé+"
        >
          <MessageSquare className="w-3.5 h-3.5 text-white" />
          <span className="hidden sm:inline">Assistant IA</span>
        </button>
      </div>

    </div>
    </MotionConfig>
  );
}
