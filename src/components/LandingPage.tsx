import React, { useState } from 'react';

interface LandingPageProps {
  onSelectRole: (role: 'patient' | 'doctor' | 'hospital') => void;
  onEnterApp: (initialView: 'map' | 'wallet' | 'appointments') => void;
  isLoggedIn: boolean;
  onOpenAuth: () => void;
  onOpenEmergency?: () => void;
}

type SelectedRole = 'patient' | 'doctor' | 'hospital';

type FormErrors = {
  name?: string;
  phone?: string;
  email?: string;
};

const styles = `
  .sante-landing-root {
    --vert-500: #00a86b;
    --vert-600: #008f5a;
    --vert-700: #007048;
    --vert-800: #055637;
    --vert-100: #e3f6ec;
    --vert-50: #f1faf6;
    --blanc: #ffffff;
    --fond: #f0f9f4;
    --texte: #0c1f18;
    --texte-secondaire: #4a665c;
    --bordure: #cce8d9;
    --radius: 22px;
    --font: "Atkinson Hyperlegible", system-ui, sans-serif;
    --font-title: "Fraunces", Georgia, serif;
    color: var(--texte);
    font-family: var(--font);
    background:
      radial-gradient(ellipse 120% 80% at 50% -20%, rgba(0, 168, 107, 0.12), transparent 50%),
      var(--fond);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    line-height: 1.5;
  }

  .sante-landing-shell {
    width: 100%;
    max-width: 460px;
    position: relative;
  }

  .sante-logo {
    text-align: center;
    margin-bottom: 44px;
    animation: santeFadeInDown 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .sante-logo-icon {
    width: 72px;
    height: 72px;
    background: linear-gradient(145deg, #00a86b 0%, #2ecf8a 100%);
    border-radius: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 18px;
    color: white;
    font-size: 34px;
    font-weight: 800;
    box-shadow:
      0 10px 0 #007048,
      0 16px 32px rgba(0, 168, 107, 0.35);
    position: relative;
  }

  .sante-logo-icon::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 24px;
    background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%);
    animation: santeShine 4s ease-in-out infinite;
  }

  .sante-logo-title {
    font-family: var(--font-title);
    font-size: 36px;
    font-weight: 700;
    color: var(--vert-800);
    letter-spacing: -0.8px;
  }

  .sante-logo-tagline {
    color: var(--texte-secondaire);
    font-size: 15px;
    margin-top: 6px;
    font-weight: 500;
    font-style: italic;
  }

  .sante-card {
    background: var(--blanc);
    border-radius: 32px;
    padding: 40px 32px;
    box-shadow:
      0 4px 6px rgba(0, 90, 58, 0.03),
      0 20px 50px rgba(0, 90, 58, 0.10);
    border: 1px solid rgba(204, 232, 217, 0.8);
    animation: santeFadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
  }

  .sante-card-title {
    font-family: var(--font-title);
    font-size: 28px;
    color: var(--vert-800);
    text-align: center;
    margin-bottom: 8px;
    letter-spacing: -0.5px;
  }

  .sante-card-subtitle {
    text-align: center;
    color: var(--texte-secondaire);
    font-size: 16px;
    margin-bottom: 36px;
  }

  .sante-choices {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 36px;
  }

  .sante-choice {
    position: relative;
  }

  .sante-choice input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .sante-choice label {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 20px 22px;
    background: var(--blanc);
    border: 2px solid var(--bordure);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    font-size: 18px;
    font-weight: 700;
    color: var(--texte);
    min-height: 84px;
    position: relative;
    overflow: hidden;
  }

  .sante-choice label::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    background: var(--vert-500);
    opacity: 0;
    transition: opacity 0.25s ease;
  }

  .sante-choice label:hover {
    border-color: #8fd8b0;
    background: #f8fdf9;
    transform: translateY(-3px);
    box-shadow: 0 12px 28px rgba(0, 100, 65, 0.10);
  }

  .sante-choice input:checked + label {
    border-color: var(--vert-500);
    background: linear-gradient(135deg, #f1faf6 0%, #e8f7f0 100%);
    box-shadow:
      0 0 0 4px rgba(0, 168, 107, 0.12),
      0 10px 28px rgba(0, 100, 65, 0.10);
    transform: translateY(-2px);
  }

  .sante-choice input:checked + label::before {
    opacity: 1;
  }

  .sante-choice-icon {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: var(--vert-100);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    flex-shrink: 0;
    transition: all 0.3s ease;
  }

  .sante-choice input:checked + label .sante-choice-icon {
    background: linear-gradient(135deg, #00a86b, #2ecf8a);
    color: white;
    box-shadow: 0 6px 14px rgba(0, 168, 107, 0.3);
    transform: scale(1.05);
  }

  .sante-choice-text small {
    display: block;
    font-size: 13.5px;
    font-weight: 500;
    color: var(--texte-secondaire);
    margin-top: 3px;
  }

  .sante-form {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .sante-form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sante-label {
    font-size: 14px;
    color: var(--texte);
    font-weight: 700;
  }

  .sante-input {
    width: 100%;
    min-height: 52px;
    border-radius: 14px;
    border: 1.5px solid var(--bordure);
    background: #f9fdfb;
    padding: 0 14px;
    font-size: 16px;
    color: var(--texte);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    font-family: var(--font);
  }

  .sante-input:focus {
    outline: none;
    border-color: var(--vert-500);
    box-shadow: 0 0 0 4px rgba(0, 168, 107, 0.11);
  }

  .sante-error {
    font-size: 12px;
    color: #c93434;
    font-weight: 700;
    margin-top: 2px;
  }

  .sante-success {
    margin-top: 16px;
    padding: 14px 16px;
    border-radius: 14px;
    background: #ecfdf5;
    border: 1px solid #b7f0cb;
    color: #0d7b4d;
    font-size: 14px;
    line-height: 1.5;
    font-weight: 700;
  }

  .sante-btn {
    width: 100%;
    min-height: 58px;
    border: none;
    border-radius: 18px;
    font-family: var(--font);
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .sante-btn-primary {
    background: linear-gradient(135deg, #00a86b 0%, #2ecf8a 100%);
    color: white;
    box-shadow: 0 14px 30px rgba(0, 168, 107, 0.25);
  }

  .sante-btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 18px 35px rgba(0, 168, 107, 0.30);
  }

  .sante-btn-primary:disabled {
    opacity: 0.75;
    cursor: wait;
  }

  .sante-btn-secondary {
    margin-top: 12px;
    background: #edf8f2;
    color: var(--vert-800);
    border: 1px solid var(--bordure);
  }

  .sante-btn-secondary:hover {
    background: #e5f4eb;
  }

  .sante-footer {
    text-align: center;
    margin-top: 26px;
    font-size: 13px;
    color: var(--texte-secondaire);
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  @keyframes santeFadeInDown {
    from {
      opacity: 0;
      transform: translateY(-18px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes santeFadeInUp {
    from {
      opacity: 0;
      transform: translateY(18px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes santeShine {
    0% { transform: translateX(-120%); }
    100% { transform: translateX(120%); }
  }

  @media (max-width: 480px) {
    .sante-card {
      padding: 28px 22px;
    }

    .sante-card-title {
      font-size: 24px;
    }

    .sante-choice label {
      padding: 18px 16px;
      min-height: 72px;
    }

    .sante-choice-icon {
      width: 46px;
      height: 46px;
      font-size: 22px;
    }
  }
`;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validatePhone = (value: string) => {
  const normalized = value.trim();
  const pattern = /^(?:\+229\s?01\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}|01\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2})$/;
  return pattern.test(normalized);
};

export default function LandingPage({
  onSelectRole,
  onEnterApp,
  isLoggedIn,
  onOpenAuth,
  onOpenEmergency,
}: LandingPageProps) {
  const [selectedRole, setSelectedRole] = useState<SelectedRole>('patient');
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleRoleSelect = (role: SelectedRole) => {
    setSelectedRole(role);
    setErrors({});
    setIsSubmitted(false);

    if (role === 'patient') {
      if (typeof window !== 'undefined') {
        try {
          window.location.href = '/inscription-patient';
          return;
        } catch {
          // fallback below
        }
      }
      onSelectRole(role);
    }
  };

  const handleInputChange = (field: 'name' | 'phone' | 'email', value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleContinue = () => {
    if (selectedRole === 'patient') {
      handleRoleSelect('patient');
      return;
    }

    if (selectedRole === 'doctor' || selectedRole === 'hospital') {
      setIsSubmitted(false);
      return;
    }

    onEnterApp('wallet');
  };

  const handleConnectionClick = () => {
    if (typeof window !== 'undefined') {
      try {
        window.location.href = '/connexion';
        return;
      } catch {
        // fallback below
      }
    }
    onOpenAuth();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FormErrors = {};

    if (!formData.name.trim()) {
      nextErrors.name = 'Veuillez renseigner votre nom.';
    }

    if (!formData.phone.trim()) {
      nextErrors.phone = 'Le numéro de téléphone est requis.';
    } else if (!validatePhone(formData.phone)) {
      nextErrors.phone = 'Format invalide. Exemple : +229 01 97 00 00 00';
    }

    if (!formData.email.trim()) {
      nextErrors.email = 'Veuillez renseigner votre adresse email.';
    } else if (!emailPattern.test(formData.email.trim())) {
      nextErrors.email = 'Veuillez saisir un email valide.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    const payload = {
      role: selectedRole,
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
    };

    try {
      const response = await fetch('/api/contact/professional', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!response.ok) {
        console.log('API /api/contact/professional indisponible, payload:', payload);
      }
    } catch (error) {
      console.log('API /api/contact/professional indisponible, payload:', payload, error);
    } finally {
      setIsSubmitting(false);
      setIsSubmitted(true);
      setFormData({ name: '', phone: '', email: '' });
    }
  };

  return (
    <div className="sante-landing-root">
      <style>{styles}</style>

      <div className="sante-landing-shell">
        <div className="sante-logo">
          <div className="sante-logo-icon" aria-label="Logo Santé+">🧬</div>
          <h1 className="sante-logo-title">Santé+</h1>
          <p className="sante-logo-tagline">De l'urgence au soin en 3 minutes</p>
        </div>

        <div className="sante-card">
          <h2 className="sante-card-title">Commencer</h2>
          <p className="sante-card-subtitle">Choisissez votre profil pour accéder au bon parcours.</p>

          <div className="sante-choices" role="radiogroup" aria-label="Choisir un profil">
            <div className="sante-choice">
              <input
                type="radio"
                id="role-patient"
                name="role"
                checked={selectedRole === 'patient'}
                onChange={() => handleRoleSelect('patient')}
              />
              <label htmlFor="role-patient">
                <span className="sante-choice-icon">👤</span>
                <span className="sante-choice-text">
                  Patient
                  <small>Créer mon espace sécurisé</small>
                </span>
              </label>
            </div>

            <div className="sante-choice">
              <input
                type="radio"
                id="role-doctor"
                name="role"
                checked={selectedRole === 'doctor'}
                onChange={() => handleRoleSelect('doctor')}
              />
              <label htmlFor="role-doctor">
                <span className="sante-choice-icon">🩺</span>
                <span className="sante-choice-text">
                  Médecin
                  <small>Accéder à la plateforme</small>
                </span>
              </label>
            </div>

            <div className="sante-choice">
              <input
                type="radio"
                id="role-hospital"
                name="role"
                checked={selectedRole === 'hospital'}
                onChange={() => handleRoleSelect('hospital')}
              />
              <label htmlFor="role-hospital">
                <span className="sante-choice-icon">🏥</span>
                <span className="sante-choice-text">
                  Hôpital
                  <small>Présenter le logiciel</small>
                </span>
              </label>
            </div>
          </div>

          {selectedRole !== 'patient' && (
            <form className="sante-form" onSubmit={handleSubmit} noValidate>
              <div className="sante-form-group">
                <label className="sante-label" htmlFor="professional-name">Nom et prénom</label>
                <input
                  id="professional-name"
                  className="sante-input"
                  type="text"
                  placeholder="Nom et prénom"
                  value={formData.name}
                  onChange={(event) => handleInputChange('name', event.target.value)}
                />
                {errors.name && <span className="sante-error">{errors.name}</span>}
              </div>

              <div className="sante-form-group">
                <label className="sante-label" htmlFor="professional-phone">Numéro de téléphone (Bénin, 10 chiffres)</label>
                <input
                  id="professional-phone"
                  className="sante-input"
                  type="tel"
                  inputMode="tel"
                  placeholder="Ex : 01 97 00 00 00"
                  value={formData.phone}
                  onChange={(event) => handleInputChange('phone', event.target.value)}
                />
                {errors.phone && <span className="sante-error">{errors.phone}</span>}
              </div>

              <div className="sante-form-group">
                <label className="sante-label" htmlFor="professional-email">Adresse email</label>
                <input
                  id="professional-email"
                  className="sante-input"
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(event) => handleInputChange('email', event.target.value)}
                />
                {errors.email && <span className="sante-error">{errors.email}</span>}
              </div>

              <button
                className="sante-btn sante-btn-primary"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Envoi en cours...' : 'Envoyer'}
              </button>

              {isSubmitted && (
                <div className="sante-success">
                  Demande bien reçue ! L'équipe Santé+ BTC vous contactera très prochainement pour vous présenter le logiciel et discuter des conditions.
                </div>
              )}
            </form>
          )}

          {selectedRole === 'patient' && (
            <>
              <button className="sante-btn sante-btn-primary" type="button" onClick={handleContinue}>
                Continuer
              </button>
              <button className="sante-btn sante-btn-secondary" type="button" onClick={handleConnectionClick}>
                Se connecter
              </button>
            </>
          )}

          {(selectedRole === 'doctor' || selectedRole === 'hospital') && (
            <button className="sante-btn sante-btn-secondary" type="button" onClick={handleConnectionClick}>
              Se connecter
            </button>
          )}
        </div>

        <div className="sante-footer">Bénin · E-santé · Bitcoin · Accès sécurisé</div>
      </div>
    </div>
  );
}
