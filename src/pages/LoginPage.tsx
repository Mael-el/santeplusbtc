import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { apiClient } from '../services/api';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validatePatientLogin = () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      return 'L’adresse email est obligatoire.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return 'Veuillez saisir une adresse email valide.';
    }

    if (!trimmedPassword) {
      return 'Le mot de passe est obligatoire.';
    }

    if (trimmedPassword.length < 8 || trimmedPassword.length > 128 || /\s/.test(trimmedPassword)) {
      return 'Le mot de passe doit contenir entre 8 et 128 caractères, sans espace.';
    }

    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validatePatientLogin();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await apiClient.login({ email: email.trim().toLowerCase(), password: password.trim() });

      if (!response?.user) {
        throw new Error('Réponse invalide du serveur.');
      }

      localStorage.setItem('user', JSON.stringify(response.user));
      localStorage.setItem('sante_role', response.user.role || 'patient');

      if (response.user.role === 'patient') {
        window.location.href = '/patient/dashboard';
        return;
      }
      if (response.user.role === 'doctor') {
        window.location.href = '/doctor/dashboard';
        return;
      }
      if (response.user.role === 'admin') {
        window.location.href = '/admin/dashboard';
        return;
      }

      throw new Error('Rôle utilisateur inconnu.');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erreur de connexion. Vérifiez vos identifiants.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00D26A] via-[#067A45] to-[#000000] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-2">Santé+</h1>
          <p className="text-white text-opacity-80">De l'urgence au soin en 3 minutes</p>
        </div>

        <Card className="bg-white">
          <h2 className="text-2xl font-bold text-[#1C1C1E] mb-6">Connexion</h2>

          {error && (
            <div className="p-3 bg-[#FF3B30] text-white rounded-lg mb-4" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Adresse email"
              type="email"
              placeholder="prenom@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Mot de passe"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
            >
              Se connecter
            </Button>
          </form>

          <div className="mt-6 space-y-3 text-center">
            <a href="/recuperation" className="block text-[#00D26A] hover:underline text-sm">
              Mot de passe oublié ?
            </a>
            <div className="text-[#8E8E93]">
              Pas de compte ?{' '}
              <a href="/inscription-patient" className="text-[#00D26A] hover:underline">
                S'inscrire
              </a>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
