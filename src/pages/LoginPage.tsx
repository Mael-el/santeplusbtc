import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { apiClient } from '../services/api';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.login({ phone, password });
      
      // Sauvegarder les infos utilisateur
      localStorage.setItem('user', JSON.stringify(response.user));
      
      // Rediriger selon le rôle
      if (response.user.role === 'patient') {
        navigate('/patient/dashboard');
      } else if (response.user.role === 'doctor') {
        navigate('/doctor/dashboard');
      } else if (response.user.role === 'admin') {
        navigate('/admin/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00D26A] via-[#067A45] to-[#000000] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-2">Santé+</h1>
          <p className="text-white text-opacity-80">De l'urgence au soin en 3 minutes</p>
        </div>

        {/* Card de connexion */}
        <Card className="bg-white">
          <h2 className="text-2xl font-bold text-[#1C1C1E] mb-6">Connexion</h2>

          {error && (
            <div className="p-3 bg-[#FF3B30] text-white rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Numéro de téléphone"
              type="tel"
              placeholder="+229 01 97 88 55 44"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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

          {/* Liens additionnels */}
          <div className="mt-6 space-y-3 text-center">
            <a href="/recuperation" className="block text-[#00D26A] hover:underline text-sm">
              Mot de passe oublié ?
            </a>
            <div className="text-[#8E8E93]">
              Pas de compte ?{' '}
              <a href="/inscription" className="text-[#00D26A] hover:underline">
                S'inscrire
              </a>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
