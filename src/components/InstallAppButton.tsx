import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallAppButton() {
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };

    const onAppInstalled = () => {
      setShowInstallButton(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (!showInstallButton || !deferredPrompt) {
    return null;
  }

  const handleInstall = async () => {
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowInstallButton(false);
      }
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Erreur lors de l’installation de l’application:', error);
    }
  };

  return (
    <button
      type="button"
      onClick={handleInstall}
      className="fixed right-4 bottom-20 z-50 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-500"
    >
      <span aria-hidden="true">⬇</span>
      Installer l’app
    </button>
  );
}
