import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Calendar, 
  Pill, 
  FileText, 
  CreditCard, 
  HeartHandshake,
  CheckCircle2,
  Bot
} from 'lucide-react';
import { Patient } from '../types';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  quickAction?: {
    label: string;
    view?: string;
  };
}

interface PatientChatbotProps {
  patient?: Patient | null;
  onNavigate?: (view: string) => void;
}

export const PatientChatbot: React.FC<PatientChatbotProps> = ({ patient, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initial welcome message tailored to the patient
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: patient?.name 
        ? `Bonjour ${patient.name} ! Je suis votre Assistant SANTÉ+. Comment puis-je vous aider aujourd'hui ?`
        : "Bonjour ! Je suis votre Assistant SANTÉ+. Comment puis-je vous accompagner pour votre santé aujourd'hui ?",
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Setup Speech Recognition if supported by browser
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'fr-FR';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Text-to-Speech function
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    // Remove markdown or special characters before vocalizing
    const cleanedText = text
      .replace(/[•*#_`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.95; // Slightly slower for optimal clarity for seniors

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Toggle voice recognition
  const handleToggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          console.warn("Recognition already started or error:", err);
        }
      } else {
        alert("La reconnaissance vocale n'est pas supportée par votre navigateur. Vous pouvez saisir votre message au clavier.");
      }
    }
  };

  // Knowledge base and intent resolution engine
  const resolveBotAnswer = (userQuery: string): { text: string; action?: { label: string; view?: string } } => {
    const q = userQuery.toLowerCase().trim();

    // 1. Médicaments & Posologie
    if (q.includes('médicament') || q.includes('medicament') || q.includes('prendre') || q.includes('posologie') || q.includes('comprimé') || q.includes('pilule') || q.includes('dose')) {
      return {
        text: "Pour bien prendre vos médicaments :\n• Respectez toujours les heures prescrites par votre médecin.\n• Vérifiez si le médicament se prend pendant le repas ou à jeun.\n• Buvez un grand verre d'eau propre.\n• En cas d'oubli, ne doublez jamais la dose suivante.\n• Terminez toujours l'intégralité du traitement antibiotique même si vous vous sentez guéri.",
        action: { label: "Voir mes ordonnances", view: "wallet" }
      };
    }

    // 2. Prochain Rendez-vous
    if (q.includes('rendez-vous') || q.includes('rdv') || q.includes('prochain') || q.includes('docteur') || q.includes('quand')) {
      return {
        text: "Pour consulter vos rendez-vous :\nVous pouvez retrouver la date, l'heure et le nom du médecin dans votre onglet Rendez-vous. Vous y recevrez aussi les rappels automatiques par SMS et notifications.",
        action: { label: "Ouvrir mes rendez-vous", view: "appointments" }
      };
    }

    // 3. Dossier médical & NPI
    if (q.includes('dossier') || q.includes('npi') || q.includes('carnet') || q.includes('historique') || q.includes('analyse') || q.includes('résultat') || q.includes('resultat')) {
      const npiText = patient?.npi ? ` Votre Numéro NPI officiel est le : ${patient.npi}.` : "";
      return {
        text: `Votre Dossier Médical Partagé SANTÉ+ regroupe vos consultations, vos ordonnances sécurisées par QR code et vos antécédents.${npiText}\nVous pouvez y accéder en toute sécurité dans votre espace.`,
        action: { label: "Accéder à mon dossier", view: "wallet" }
      };
    }

    // 4. Paiement facture & Mobile Money
    if (q.includes('payer') || q.includes('facture') || q.includes('argent') || q.includes('momo') || q.includes('moov') || q.includes('mtn') || q.includes('celtiis') || q.includes('tarif') || q.includes('prix')) {
      return {
        text: "Pour régler une consultation ou une ordonnance :\n1. Allez dans votre Portefeuille SANTÉ+.\n2. Sélectionnez votre mode de paiement béninois préféré : MTN Mobile Money, Moov Money, Celtiis Cash ou Lightning Network.\n3. Validez la transaction avec votre code secret habituel. Le reçu est généré instantanément.",
        action: { label: "Payer une facture", view: "wallet" }
      };
    }

    // 5. Ordonnance & Pharmacie
    if (q.includes('ordonnance') || q.includes('pharmacie') || q.includes('acheter')) {
      return {
        text: "Toutes vos ordonnances sont certifiées numériquement avec un QR code cryptographique. Présentez simplement l'écran de votre téléphone à votre pharmacien partenaire au Bénin pour être délivré sans attente.",
        action: { label: "Voir mes ordonnances", view: "wallet" }
      };
    }

    // 6. Conseils de santé générale / Paludisme / Fièvre / Tension
    if (q.includes('palu') || q.includes('paludisme') || q.includes('fièvre') || q.includes('fievre') || q.includes('chaud') || q.includes('courbature')) {
      return {
        text: "En cas de fièvre, de frissons ou de courbatures au Bénin, faites immédiatement un test rapide de paludisme (TDR) dans un centre de santé agréé. Ne pratiquez pas l'automédication prolongée. Buvez beaucoup d'eau propre et reposez-vous.",
        action: { label: "Trouver un centre de santé", view: "map" }
      };
    }

    if (q.includes('tension') || q.includes('coeur') || q.includes('hypertension') || q.includes('sel')) {
      return {
        text: "Pour protéger votre tension artérielle :\n• Limitez le sel et les cubes d'assaisonnement dans vos repas.\n• Marchez au moins 30 minutes par jour.\n• Buvez 1,5L à 2L d'eau par jour.\n• Mesurez régulièrement votre tension chez votre médecin.",
        action: { label: "Prendre rendez-vous", view: "appointments" }
      };
    }

    if (q.includes('bonjour') || q.includes('salut') || q.includes('coucou') || q.includes('hello')) {
      return {
        text: "Bonjour ! Je suis à votre entière disposition. Vous pouvez me poser une question sur vos médicaments, vos rendez-vous, votre dossier ou vos paiements."
      };
    }

    if (q.includes('merci')) {
      return {
        text: "Avec grand plaisir ! Votre santé et votre tranquillité sont notre priorité absolue sur SANTÉ+."
      };
    }

    // Default intelligent guidance
    return {
      text: "Je comprends votre demande. Pour votre sécurité médicale :\n• Vous pouvez consulter vos médicaments et résultats dans votre Dossier.\n• Prendre un rendez-vous avec un praticien certifié.\n• Ou contacter immédiatement le SAMU au 15 en cas d'urgence.",
      action: { label: "Consulter mon dossier", view: "wallet" }
    };
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    stopSpeaking();

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    // Simulate natural response delay
    setTimeout(() => {
      const response = resolveBotAnswer(text);
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: response.text,
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        quickAction: response.action
      };

      setMessages(prev => [...prev, botMsg]);

      // Speak aloud if voice enabled
      if (voiceEnabled) {
        speakText(response.text);
      }
    }, 450);
  };

  // Quick prompt chip clicked
  const handleQuickQuestion = (query: string) => {
    handleSendMessage(query);
  };

  return (
    <>
      {/* 1. Trigger Floating Button (Positioned bottom right, above emergency button) */}
      <div className="fixed bottom-[96px] right-5 z-40">
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen && voiceEnabled && messages.length > 0) {
              const lastMsg = messages[messages.length - 1];
              if (lastMsg.sender === 'bot') speakText(lastMsg.text);
            }
          }}
          className="chatbot-fab-pulse w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-[#00a86b] hover:bg-[#00905b] text-white flex items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95 cursor-pointer border-2 border-white/60"
          title="Assistant SANTÉ+ (Chatbot Médical)"
          aria-label="Ouvrir l'assistant SANTÉ+"
        >
          {isOpen ? (
            <X className="w-7 h-7" />
          ) : (
            <span className="text-2xl select-none" role="img" aria-label="bulle de chat">💬</span>
          )}
        </button>
      </div>

      {/* 2. Chat Window Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-4 sm:right-6 z-50 w-[92vw] sm:w-[400px] h-[580px] max-h-[82vh] bg-white rounded-3xl shadow-2xl border-2 border-[#d0e8db] flex flex-col overflow-hidden font-sans"
            role="dialog"
            aria-labelledby="assistant-santeplus-title"
          >
            {/* Header: Assistant SANTÉ+ & Controls */}
            <div className="bg-white border-b-2 border-[#e4f0e9] px-4 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-[#e6f7f0] text-[#00a86b] flex items-center justify-center font-bold">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 id="assistant-santeplus-title" className="text-lg font-black text-[#0f1f1a] leading-tight">
                    Assistant SANTÉ+
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-[#00a86b] animate-ping" />
                    <span className="text-xs font-semibold text-[#00a86b]">En ligne • 24h/24</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Text-to-speech toggle */}
                <button
                  type="button"
                  onClick={() => {
                    if (isSpeaking) stopSpeaking();
                    setVoiceEnabled(!voiceEnabled);
                  }}
                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                    voiceEnabled ? 'text-[#00a86b] bg-[#e6f7f0]' : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title={voiceEnabled ? "Lecture vocale activée" : "Lecture vocale désactivée"}
                  aria-label="Activer ou désactiver la lecture vocale"
                >
                  {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>

                {/* Close window */}
                <button
                  type="button"
                  onClick={() => {
                    stopSpeaking();
                    setIsOpen(false);
                  }}
                  className="p-2 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer"
                  title="Fermer l'assistant"
                  aria-label="Fermer la fenêtre d'aide"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Suggestions Chips Bar */}
            <div className="bg-[#f2f9f5] border-b border-[#e4f0e9] px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
              <button
                type="button"
                onClick={() => handleQuickQuestion("Comment prendre mon médicament ?")}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white border border-[#d0e8db] text-xs font-bold text-[#0f1f1a] hover:bg-[#e6f7f0] hover:text-[#00a86b] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
              >
                <Pill className="w-3.5 h-3.5 text-[#00a86b]" />
                <span>Médicaments</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickQuestion("Où est mon prochain rendez-vous ?")}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white border border-[#d0e8db] text-xs font-bold text-[#0f1f1a] hover:bg-[#e6f7f0] hover:text-[#00a86b] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
              >
                <Calendar className="w-3.5 h-3.5 text-[#00a86b]" />
                <span>Rendez-vous</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickQuestion("Comment voir mon dossier ?")}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white border border-[#d0e8db] text-xs font-bold text-[#0f1f1a] hover:bg-[#e6f7f0] hover:text-[#00a86b] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
              >
                <FileText className="w-3.5 h-3.5 text-[#00a86b]" />
                <span>Dossier médical</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickQuestion("Comment payer une facture ?")}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white border border-[#d0e8db] text-xs font-bold text-[#0f1f1a] hover:bg-[#e6f7f0] hover:text-[#00a86b] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
              >
                <CreditCard className="w-3.5 h-3.5 text-[#00a86b]" />
                <span>Payer facture</span>
              </button>
            </div>

            {/* Messages Area (Auto-scrolling, font 18px minimum) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
              {messages.map(msg => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-[18px] leading-relaxed font-sans ${
                        isUser
                          ? 'bg-[#e6f7f0] text-[#0f1f1a] rounded-tr-xs'
                          : 'bg-white text-[#0f1f1a] border-2 border-gray-200 rounded-tl-xs shadow-xs'
                      }`}
                    >
                      <p className="whitespace-pre-line">{msg.text}</p>

                      {/* Optional Action Button inside Bot Message */}
                      {msg.quickAction && onNavigate && (
                        <div className="mt-3 pt-2 border-t border-gray-100">
                          <button
                            type="button"
                            onClick={() => {
                              if (msg.quickAction?.view) {
                                onNavigate(msg.quickAction.view);
                                setIsOpen(false);
                              }
                            }}
                            className="w-full py-2.5 px-4 bg-[#00a86b] hover:bg-[#00905b] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
                          >
                            <span>{msg.quickAction.label}</span>
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 px-1">
                      <span className="text-[11px] font-semibold text-gray-400">
                        {msg.timestamp}
                      </span>
                      {/* Individual Read Aloud button for bot message */}
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => speakText(msg.text)}
                          className="text-gray-400 hover:text-[#00a86b] transition-colors cursor-pointer"
                          title="Écouter à voix haute"
                          aria-label="Lire ce message à voix haute"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Listening indicator */}
            {isListening && (
              <div className="bg-[#e6f7f0] border-t border-[#d0e8db] px-4 py-2 flex items-center justify-between text-xs font-bold text-[#007048] animate-pulse">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  Écoute en cours... Parlez maintenant
                </span>
                <button
                  type="button"
                  onClick={handleToggleListening}
                  className="text-xs text-red-600 underline font-bold cursor-pointer"
                >
                  Arrêter
                </button>
              </div>
            )}

            {/* Input Area (Bottom with Micro & Send) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="bg-white border-t-2 border-[#e4f0e9] p-3 flex items-center gap-2 shrink-0"
            >
              {/* Voice recognition button */}
              <button
                type="button"
                onClick={handleToggleListening}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  isListening
                    ? 'bg-red-500 text-white animate-bounce shadow-md'
                    : 'bg-[#e6f7f0] text-[#00a86b] hover:bg-[#d0e8db]'
                }`}
                title={isListening ? "Arrêter l'écoute" : "Parler au micro (Saisie vocale)"}
                aria-label="Saisie vocale"
              >
                {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              {/* Text input (18px font size minimum) */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Posez votre question de santé..."
                className="flex-1 min-h-[48px] px-3.5 py-2.5 border-2 border-[#d0e8db] rounded-2xl text-[18px] text-[#0f1f1a] bg-white focus:outline-none focus:border-[#00a86b] placeholder:text-gray-400 font-sans"
              />

              {/* Send button */}
              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
                  inputText.trim()
                    ? 'bg-[#00a86b] hover:bg-[#00905b] text-white shadow-md cursor-pointer'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                title="Envoyer la question"
                aria-label="Envoyer"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
