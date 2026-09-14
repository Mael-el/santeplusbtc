import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X, Upload, AlertCircle, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';

export interface DecodedPatientData {
  raw: string;
  npi?: string;
  name?: string;
  blood?: string;
  id?: string;
}

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: DecodedPatientData) => void;
  title?: string;
}

export default function QRScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "Scanner le QR Code Patient"
}: QRScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [successData, setSuccessData] = useState<DecodedPatientData | null>(null);

  // Parse le QR code selon le format Bénin ou JSON
  const parseQRContent = (text: string): DecodedPatientData => {
    // Format officiel Bénin : SANTE-PLUS-BENIN:NPI=...;PATIENT=...;BLOOD=...;DATE=...
    if (text.includes('SANTE-PLUS-BENIN')) {
      const parts = text.split(';');
      const data: Record<string, string> = {};
      parts.forEach(part => {
        const [k, v] = part.split('=');
        if (k && v) data[k.trim().toUpperCase()] = v.trim();
      });

      return {
        raw: text,
        npi: data['NPI'] || data['PATIENTNPI'] || data['PATIENT_NPI'] || data['SANTE-PLUS-BENIN:NPI'],
        name: data['PATIENT'],
        blood: data['BLOOD'],
        id: data['QR_HASH'] || data['ID'] || data['PATIENTID'] || data['PATIENT_ID'],
      };
    }

    // Essayer de parser en JSON
    try {
      const parsed = JSON.parse(text);
      return {
        raw: text,
        npi: parsed.npi || parsed.NPI || parsed.patientNpi || parsed.patient_npi,
        name: parsed.name || parsed.patientName,
        blood: parsed.blood || parsed.bloodGroup,
        id: parsed.id || parsed.patientId
      };
    } catch {
      // Texte brut (ex: NPI direct)
      const npiMatch = text.match(/(?:npi|patientnpi|patient[_-]?npi)\s*[:=]\s*([a-z0-9-]+)/i);
      return {
        raw: text,
        npi: npiMatch?.[1] || text.trim(),
        name: `Patient (${text.substring(0, 10)})`
      };
    }
  };

  const handleDetected = (rawText: string) => {
    const parsed = parseQRContent(rawText);
    setSuccessData(parsed);

    // Audio feedback si supporté
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {}

    // Vibration haptique
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }

    setTimeout(() => {
      onScan(parsed);
      onClose();
    }, 600);
  };

  // Scan de la boucle vidéo
  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        setIsScanning(false);
        handleDetected(code.data);
        return;
      }
    }

    animationFrameId.current = requestAnimationFrame(scanFrame);
  };

  // Initialisation de la caméra
  useEffect(() => {
    if (!isOpen) return;

    let stream: MediaStream | null = null;
    setIsScanning(true);
    setSuccessData(null);
    setCameraError('');

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      })
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.setAttribute('playsinline', 'true');
            videoRef.current.play().then(() => {
              animationFrameId.current = requestAnimationFrame(scanFrame);
            }).catch(() => {});
          }
        })
        .catch(err => {
          console.warn("Accès caméra impossible ou refusé:", err);
          setHasCamera(false);
          setCameraError("Impossible d'accéder à la caméra (permission refusée ou non disponible).");
          setIsScanning(false);
        });
    } else {
      setHasCamera(false);
      setCameraError("Le navigateur ne supporte pas l'accès direct à la caméra.");
      setIsScanning(false);
    }

    return () => {
      setIsScanning(false);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen]);

  // Scan depuis une image importée
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, img.width, img.height);
          const imgData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height);
          if (code && code.data) {
            handleDetected(code.data);
          } else {
            alert("Aucun QR Code valide détecté dans l'image sélectionnée.");
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col border border-slate-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight">{title}</h3>
              <p className="text-[11px] text-gray-500 font-medium">Santé+ Bénin • Décodage instantané</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Zone Vidéo / Scanner */}
        <div className="relative aspect-square sm:aspect-4/3 bg-black flex items-center justify-center overflow-hidden">
          {hasCamera && !cameraError ? (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                autoPlay
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Viseur de scan */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-56 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  {/* Coins renforcés */}
                  <span className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <span className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                  
                  {/* Ligne laser animée */}
                  <div className="w-full h-0.5 bg-linear-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-pulse absolute top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Overlay de succès */}
              {successData && (
                <div className="absolute inset-0 bg-emerald-600/90 flex flex-col items-center justify-center text-white p-6 animate-fade-in text-center">
                  <CheckCircle2 className="w-16 h-16 text-white mb-2 animate-bounce" />
                  <h4 className="text-xl font-bold">Patient Reconnu !</h4>
                  <p className="text-sm opacity-95 font-medium mt-1">{successData.name}</p>
                  {successData.npi && (
                    <span className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-xs font-mono">
                      <ShieldCheck className="w-3.5 h-3.5" /> NPI: {successData.npi}
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="p-6 text-center text-white max-w-xs space-y-3">
              <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
              <p className="text-xs text-gray-300">{cameraError || "Caméra indisponible sur ce périphérique."}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4" />
                Importer une image de QR
              </button>
            </div>
          )}
        </div>

        {/* Pied de modal / Options alternatives */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          
          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <span>Présentez le pass citoyen Santé+ Bénin</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-emerald-700 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Choisir une photo
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
