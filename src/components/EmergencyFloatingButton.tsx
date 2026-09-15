import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PhoneCall, 
  Flame, 
  ShieldAlert, 
  MapPin, 
  Share2, 
  Copy, 
  Check, 
  X, 
  Heart,
  Navigation,
  UserCheck,
  AlertOctagon,
  ExternalLink
} from 'lucide-react';
import { Patient } from '../types';

interface EmergencyFloatingButtonProps {
  patient?: Patient | null;
  onNavigateToMap?: () => void;
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

interface Position {
  x: number;
  y: number;
}

const STORAGE_KEY = 'sante_emergency_btn_pos';
const MARGIN = 16; // Minimum distance from screen edges in pixels
const BUTTON_HEIGHT = 64; // Minimum 64px height per specification
const BUTTON_WIDTH = 180; // Approximate width for clamping

export const EmergencyFloatingButton: React.FC<EmergencyFloatingButtonProps> = ({ 
  patient,
  onNavigateToMap,
  externalOpen,
  onExternalClose
}) => {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (externalOpen) {
      setShowModal(true);
      speakEmergencyAlert();
    }
  }, [externalOpen]);

  const handleCloseModal = () => {
    setShowModal(false);
    onExternalClose?.();
  };
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0
  });
  const movedRef = useRef<boolean>(false);
  const pressTimerRef = useRef<any>(null);

  // Safe clamping helper
  const clampPosition = (x: number, y: number, btnW = BUTTON_WIDTH, btnH = BUTTON_HEIGHT): Position => {
    const maxX = Math.max(MARGIN, window.innerWidth - btnW - MARGIN);
    const maxY = Math.max(MARGIN, window.innerHeight - btnH - MARGIN);
    return {
      x: Math.min(Math.max(MARGIN, x), maxX),
      y: Math.min(Math.max(MARGIN, y), maxY)
    };
  };

  // Initialize position from localStorage or default to bottom-right
  useEffect(() => {
    const computeInitialPos = () => {
      const btnW = buttonRef.current?.offsetWidth || BUTTON_WIDTH;
      const btnH = buttonRef.current?.offsetHeight || BUTTON_HEIGHT;
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            return clampPosition(parsed.x, parsed.y, btnW, btnH);
          }
        } catch {
          // ignore corrupted json
        }
      }

      // Default position: bottom-right
      return clampPosition(
        window.innerWidth - btnW - MARGIN,
        window.innerHeight - btnH - MARGIN,
        btnW,
        btnH
      );
    };

    setPosition(computeInitialPos());

    const handleResize = () => {
      setPosition(prev => {
        const btnW = buttonRef.current?.offsetWidth || BUTTON_WIDTH;
        const btnH = buttonRef.current?.offsetHeight || BUTTON_HEIGHT;
        return clampPosition(prev.x, prev.y, btnW, btnH);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Vocal alert on modal open
  const speakEmergencyAlert = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance("Urgence médicale SANTÉ+. En cas de danger vital, touchez le bouton rouge pour le SAMU 15 ou les Pompiers 118.");
      u.lang = 'fr-FR';
      u.rate = 1.0;
      window.speechSynthesis.speak(u);
    }
  };

  // --- DRAG HANDLING (TOUCH & MOUSE) ---

  const handleStart = (clientX: number, clientY: number) => {
    movedRef.current = false;
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: position.x,
      initialY: position.y
    };

    // Long press visual feedback
    pressTimerRef.current = setTimeout(() => {
      setIsPressing(true);
    }, 150);
  };

  const handleMove = (clientX: number, clientY: number) => {
    const deltaX = clientX - dragStartRef.current.startX;
    const deltaY = clientY - dragStartRef.current.startY;
    const dist = Math.hypot(deltaX, deltaY);

    if (dist > 6) {
      movedRef.current = true;
      setIsDragging(true);
      setIsPressing(true);
      clearTimeout(pressTimerRef.current);

      const btnW = buttonRef.current?.offsetWidth || BUTTON_WIDTH;
      const btnH = buttonRef.current?.offsetHeight || BUTTON_HEIGHT;

      const newPos = clampPosition(
        dragStartRef.current.initialX + deltaX,
        dragStartRef.current.initialY + deltaY,
        btnW,
        btnH
      );

      setPosition(newPos);
    }
  };

  const handleEnd = () => {
    clearTimeout(pressTimerRef.current);
    setIsPressing(false);

    if (isDragging) {
      setIsDragging(false);
      // Auto-reposition safely and save in localStorage
      const btnW = buttonRef.current?.offsetWidth || BUTTON_WIDTH;
      const btnH = buttonRef.current?.offsetHeight || BUTTON_HEIGHT;
      const clamped = clampPosition(position.x, position.y, btnW, btnH);
      setPosition(clamped);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
    }
  };

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchEnd = () => {
    handleEnd();
  };

  // Mouse handlers
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left click only
      handleStart(e.clientX, e.clientY);

      const onMouseMove = (moveEvent: MouseEvent) => {
        handleMove(moveEvent.clientX, moveEvent.clientY);
      };

      const onMouseUp = () => {
        handleEnd();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  };

  // Click trigger (only if not dragged)
  const handleClick = (e: React.MouseEvent) => {
    if (!movedRef.current) {
      setShowModal(true);
      speakEmergencyAlert();
    }
  };

  // Geolocation sharing
  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre appareil.");
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationLoading(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocationCoords({ lat, lng });
        setHasLocation(true);

        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
        if (navigator.share) {
          navigator.share({
            title: "Urgence Médicale - Ma Position SANTÉ+",
            text: `URGENCE VITALE SANTÉ+ BÉNIN : Je sollicite une assistance immédiate. Ma position exacte : ${mapsUrl}`,
            url: mapsUrl
          }).catch(() => {
            // fallback
          });
        }
      },
      (err) => {
        setLocationLoading(false);
        alert("Impossible d'obtenir votre position GPS. Veuillez vérifier les autorisations de localisation.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Copy GPS link
  const handleCopyLocation = () => {
    if (locationCoords) {
      const url = `https://maps.google.com/?q=${locationCoords.lat},${locationCoords.lng}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Gather emergency contacts
  const getEmergencyContacts = () => {
    const list: Array<{ name: string; phone: string }> = [];

    if (patient?.emergencyContacts && Array.isArray(patient.emergencyContacts)) {
      list.push(...patient.emergencyContacts);
    }

    try {
      const savedProfileStr = localStorage.getItem('sante_patient_profile');
      if (savedProfileStr) {
        const saved = JSON.parse(savedProfileStr);
        if (saved.emergencyContactOneName && saved.emergencyContactOnePhone) {
          list.push({ name: saved.emergencyContactOneName, phone: saved.emergencyContactOnePhone });
        }
        if (saved.emergencyContactTwoName && saved.emergencyContactTwoPhone) {
          list.push({ name: saved.emergencyContactTwoName, phone: saved.emergencyContactTwoPhone });
        }
      }
    } catch {
      // ignore
    }

    // Deduplicate
    const unique = list.filter((item, idx, arr) => 
      arr.findIndex(t => t.phone.replace(/\s/g, '') === item.phone.replace(/\s/g, '')) === idx
    );

    return unique;
  };

  const emergencyContacts = getEmergencyContacts();

  return (
    <>
      {/* ============================================================ */}
      {/* 1. BOUTON D'URGENCE ROUGE, FLOTTANT ET DÉPLAÇABLE (DRAGGABLE) */}
      {/* ============================================================ */}
      <button
        ref={buttonRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onClick={handleClick}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          touchAction: 'none'
        }}
        className={`fixed z-[9999] min-h-[64px] h-16 px-6 rounded-full bg-[#ef4444] text-white flex items-center justify-center gap-3 font-black text-base shadow-2xl cursor-pointer select-none transition-transform duration-75 border-2 border-white/80 ${
          isPressing || isDragging ? 'scale-110 shadow-red-500/60' : 'btn-emergency-heartbeat hover:scale-105 active:scale-95'
        }`}
        title="Bouton d'Urgence Médicale SANTÉ+ (Déplaçable sur l'écran)"
        aria-label="Déclencher l'Urgence Médicale"
      >
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <PhoneCall className="w-6 h-6 text-white animate-bounce" />
        </div>
        <span className="tracking-wider text-lg font-black uppercase text-white drop-shadow-sm">
          URGENCE
        </span>
      </button>

      {/* ============================================================ */}
      {/* 2. FENÊTRE MODALE D'URGENCE VITALE (AU CLIC)                */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 text-center border-2 border-red-100 relative my-auto font-sans"
              role="dialog"
              aria-modal="true"
              aria-labelledby="emergency-modal-title"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={handleCloseModal}
                className="absolute top-4 right-4 p-2.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Fermer la fenêtre d'urgence"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Heartbeat Badge */}
              <div className="w-20 h-20 rounded-full bg-red-100 text-[#ef4444] flex items-center justify-center mx-auto shadow-inner animate-pulse">
                <AlertOctagon className="w-10 h-10" />
              </div>

              <div>
                <h2 id="emergency-modal-title" className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">
                  Urgence Médicale Bénin
                </h2>
                <p className="text-sm text-gray-600 mt-1 font-medium">
                  Numéros prioritaires nationaux et géolocalisation des secours d'urgence
                </p>
              </div>

              {/* Priority Call Buttons */}
              <div className="space-y-3 pt-1">
                {/* 1. SAMU 15 */}
                <a
                  href="tel:15"
                  className="w-full min-h-[64px] py-4 px-6 bg-[#ef4444] hover:bg-[#dc2626] text-white font-black rounded-2xl text-lg sm:text-xl flex items-center justify-between shadow-lg shadow-red-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                      <PhoneCall className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <span className="block font-black text-xl leading-none">SAMU 15</span>
                      <span className="text-xs font-semibold text-white/80">Secours Médicaux d'Urgence</span>
                    </div>
                  </div>
                  <span className="text-sm bg-white text-[#ef4444] font-black px-3.5 py-1.5 rounded-xl shadow-xs">
                    APPEL GRATUIT
                  </span>
                </a>

                {/* 2. Pompiers 18 / 118 */}
                <a
                  href="tel:118"
                  className="w-full min-h-[58px] py-3.5 px-6 bg-[#ea580c] hover:bg-[#c2410c] text-white font-black rounded-2xl text-base sm:text-lg flex items-center justify-between shadow-md transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <Flame className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <span className="block font-black text-lg leading-none">Pompiers 118 / 18</span>
                      <span className="text-xs font-semibold text-white/80">Incendies, Sinistres & Accidents</span>
                    </div>
                  </div>
                  <span className="text-xs bg-white text-[#ea580c] font-black px-3 py-1.5 rounded-xl">
                    APPELER
                  </span>
                </a>

                {/* 3. Police Secours 117 */}
                <a
                  href="tel:117"
                  className="w-full min-h-[54px] py-3 px-6 bg-[#1e40af] hover:bg-[#1d4ed8] text-white font-black rounded-2xl text-base flex items-center justify-between shadow-md transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                      <ShieldAlert className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <span className="block font-black text-base leading-none">Police Secours 117</span>
                      <span className="text-xs font-semibold text-white/80">Sécurité publique & Assistance</span>
                    </div>
                  </div>
                  <span className="text-xs bg-white text-[#1e40af] font-black px-3 py-1 rounded-xl">
                    APPELER
                  </span>
                </a>
              </div>

              {/* Personal Emergency Contacts */}
              <div className="pt-2 text-left">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#00a86b]" />
                  <span>Contacts d'urgence personnels</span>
                </h4>

                {emergencyContacts.length > 0 ? (
                  <div className="space-y-2">
                    {emergencyContacts.map((c, i) => (
                      <a
                        key={i}
                        href={`tel:${c.phone.replace(/\s/g, '')}`}
                        className="p-3 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 rounded-2xl flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <span className="block font-bold text-sm text-gray-900">{c.name}</span>
                          <span className="text-xs font-mono text-gray-600">{c.phone}</span>
                        </div>
                        <span className="text-xs font-bold text-[#00a86b] bg-[#e6f7f0] px-3 py-1.5 rounded-xl flex items-center gap-1">
                          <PhoneCall className="w-3.5 h-3.5" />
                          Appeler
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic bg-gray-50 p-3 rounded-2xl border border-dashed border-gray-200">
                    Aucun contact d'urgence configuré. Vous pouvez en enregistrer dans votre profil.
                  </p>
                )}
              </div>

              {/* Share Location & Map Navigation */}
              <div className="space-y-2.5 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleShareLocation}
                  disabled={locationLoading}
                  className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <MapPin className="w-5 h-5 text-emerald-200" />
                  <span>
                    {locationLoading 
                      ? "Localisation GPS en cours..." 
                      : hasLocation 
                        ? "Position partagée avec succès" 
                        : "Partager ma position avec les secours"}
                  </span>
                </button>

                {/* Location details card if shared */}
                {hasLocation && locationCoords && (
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                    <span className="font-mono">
                      GPS : {locationCoords.lat.toFixed(5)}, {locationCoords.lng.toFixed(5)}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyLocation}
                      className="px-3 py-1 bg-white rounded-lg border border-emerald-300 font-bold text-emerald-700 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? "Copié" : "Copier lien"}</span>
                    </button>
                  </div>
                )}

                {/* Nearest Hospital Map */}
                {onNavigateToMap && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      onNavigateToMap();
                    }}
                    className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Navigation className="w-4 h-4 text-gray-600" />
                    <span>Itinéraire vers l'hôpital ou la clinique le plus proche</span>
                  </button>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-xs font-bold text-gray-500 hover:text-gray-800 cursor-pointer underline"
                >
                  Retourner à l'application
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
