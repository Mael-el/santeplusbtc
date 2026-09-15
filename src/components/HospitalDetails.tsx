import React, { useState } from 'react';
import { Hospital, Review } from '../types';
import { ArrowLeft, Star, Phone, MapPin, Clock, Calendar, Check, Send, ShieldCheck, HeartPulse, CreditCard, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface HospitalDetailsProps {
  hospital: Hospital;
  onBack: () => void;
  onBookAppointment: () => void;
  onProceedToPayment: () => void;
}

export default function HospitalDetails({
  hospital,
  onBack,
  onBookAppointment,
  onProceedToPayment,
}: HospitalDetailsProps) {
  const [reviews, setReviews] = useState<Review[]>(hospital.reviews);
  const [newAuthor, setNewAuthor] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [showReviewSuccess, setShowReviewSuccess] = useState(false);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthor.trim() || !newComment.trim()) return;

    const newReview: Review = {
      id: `r-new-${Date.now()}`,
      author: newAuthor,
      rating: newRating,
      date: 'Aujourd\'hui',
      comment: newComment,
    };

    setReviews([newReview, ...reviews]);
    setNewAuthor('');
    setNewComment('');
    setNewRating(5);
    setShowReviewSuccess(true);
    setTimeout(() => setShowReviewSuccess(false), 3000);
  };

  return (
    <div id="hospital-details-page" className="max-w-4xl mx-auto bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Cover Image & Header */}
      <div className="relative h-64 md:h-80 bg-emerald-950">
        <img
          src={hospital.image}
          alt={hospital.name}
          className="w-full h-full object-cover opacity-80"
          referrerPolicy="no-referrer"
        />
        {/* Back Button Overlay */}
        <button
          onClick={onBack}
          className="absolute top-5 left-5 p-2.5 bg-white/90 backdrop-blur-md rounded-full text-gray-800 hover:bg-white shadow-md transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Floating Verified Tag */}
        {hospital.isVerified && (
          <div className="absolute top-5 right-5 px-3 py-1.5 bg-white/95 backdrop-blur-md border border-amber-200 rounded-full text-[#FF8A00] font-bold font-sans text-xs flex items-center gap-1 shadow-md">
            <ShieldCheck className="w-4 h-4 text-[#FF8A00]" />
            Établissement Agréé MSP
          </div>
        )}

        {/* Hospital Title Block Overlay at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-6 text-white">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-sans font-semibold uppercase tracking-wider ${
              hospital.type === 'public' ? 'bg-[#059669] text-white' : hospital.type === 'lab' ? 'bg-[#2563EB] text-white' : 'bg-[#FF8A00] text-white'
            }`}>
              {hospital.type === 'public' ? 'Secteur Public' : hospital.type === 'lab' ? 'Laboratoire Médical' : 'Clinique Privée'}
            </span>
            <span className="text-xs text-gray-300 font-sans font-medium">• {hospital.distance} de vous</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-sans tracking-tight">{hospital.name}</h1>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Info, Pricing, Services */}
        <div className="md:col-span-7 space-y-8">
          {/* Quick Contact & Info */}
          <div className="p-5 bg-gray-50 rounded-2xl space-y-4 border border-gray-100">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-sans">Adresse</p>
                <p className="text-sm font-sans font-semibold text-[#1C1C1E]">{hospital.address}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-sans">Téléphone Officiel</p>
                <p className="text-sm font-sans font-semibold text-[#1C1C1E]">{hospital.phone}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-sans">Horaires d'Ouverture</p>
                <p className="text-sm font-sans font-semibold text-[#1C1C1E]">{hospital.hours}</p>
              </div>
            </div>
          </div>

          {/* List of Services */}
          <div>
            <h3 className="text-lg font-sans font-bold text-[#1C1C1E] mb-3 flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-[#059669]" />
              Spécialités & Services disponibles
            </h3>
            <div className="flex flex-wrap gap-2">
              {hospital.services.map((service, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 text-[#059669] rounded-xl text-xs font-sans font-medium"
                >
                  {service}
                </span>
              ))}
            </div>
          </div>

          {/* Official Grille de Tarifs */}
          <div>
            <h3 className="text-lg font-sans font-bold text-[#1C1C1E] mb-3 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#00D26A]" />
              Grille Tarifaire Transparente
            </h3>
            <p className="text-xs text-gray-500 font-sans mb-3">
              Les tarifs ci-dessous sont réglementés et convertis en temps réel au réseau Lightning (Sats).
            </p>
            <div className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100">
              <div className="grid grid-cols-12 bg-gray-50 p-3.5 text-xs font-bold text-gray-500 uppercase font-sans">
                <span className="col-span-5">Acte Médical / Examen</span>
                <span className="col-span-3 text-center">Quantité disponible</span>
                <span className="col-span-2 text-right">Franc CFA</span>
                <span className="col-span-2 text-right">Satoshis</span>
              </div>
              {hospital.priceList.map((item, index) => (
                <div key={index} className="grid grid-cols-12 p-3.5 text-xs md:text-sm items-center hover:bg-gray-50/50 transition-all">
                  <span className="col-span-5 font-sans font-medium text-gray-700">{item.name}</span>
                  <span className="col-span-3 text-center">
                    {item.quantityAvailable !== undefined ? (
                      <span className="px-2.5 py-1 bg-amber-50 border border-amber-100 text-amber-800 rounded-lg text-[11px] font-bold font-sans">
                        {item.quantityAvailable} dispo
                      </span>
                    ) : (
                      <span className="text-gray-400 font-sans text-xs">—</span>
                    )}
                  </span>
                  <span className="col-span-2 text-right font-mono font-semibold text-[#1C1C1E]">
                    {(item.priceXOF ?? 0).toLocaleString('fr-FR')} XOF
                  </span>
                  <span className="col-span-2 text-right font-mono font-bold text-[#00D26A]">
                    {(item.priceSats ?? 0).toLocaleString()} Sats
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Actions & Patient Reviews */}
        <div className="md:col-span-5 space-y-8">
          {/* CRITICAL ACTIONS PANEL */}
          <div className="p-6 border border-gray-200 rounded-3xl bg-white shadow-xs space-y-4 sticky top-6">
            <h3 className="text-md font-bold font-sans text-gray-800">Parcours de Soins Citoyen</h3>
            <p className="text-xs text-gray-500 font-sans leading-relaxed">
              Sélectionnez l'action souhaitée selon votre situation. Pour payer des examens prescrits ou de la pharmacie, cliquez sur le bouton vert ci-dessous.
            </p>

            {/* BUTTON 1 : Prendre Rendez-vous */}
            <button
              onClick={onBookAppointment}
              className="w-full py-3.5 px-4 bg-[#059669] hover:bg-[#059669]/90 text-white font-sans font-bold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Calendar className="w-5 h-5" />
              Prendre Rendez-vous en ligne
            </button>

            {/* BUTTON 2 : Je suis déjà là-bas / Payer */}
            <button
              onClick={onProceedToPayment}
              className="w-full py-3.5 px-4 bg-[#00D26A] hover:bg-[#00D26A]/95 text-white font-sans font-bold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Je suis déjà là-bas / Payer</span>
              <Zap className="w-4 h-4" />
            </button>
          </div>

          {/* REVIEWS SECTION */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-sans font-bold text-[#1C1C1E]">Avis des Patients</h3>
              <div className="flex items-center text-[#FF8A00]">
                <Star className="w-4 h-4 fill-current" />
                <span className="text-sm font-bold font-sans ml-1">{hospital.rating}</span>
                <span className="text-xs text-gray-400 font-sans ml-1">({reviews.length})</span>
              </div>
            </div>

            {/* List of Reviews */}
            <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
              {reviews.map((rev) => (
                <div key={rev.id} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-2xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold font-sans text-gray-800">{rev.author}</span>
                    <span className="text-[10px] text-gray-400 font-sans">{rev.date}</span>
                  </div>
                  <div className="flex items-center text-amber-400 mb-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${i < rev.rating ? 'fill-current text-[#FF8A00]' : 'text-gray-200'}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 font-sans leading-relaxed">{rev.comment}</p>
                </div>
              ))}
            </div>

            {/* Leave a Review Form */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 font-sans">Laisser un avis</h4>
              <form onSubmit={handleSubmitReview} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Votre nom complet"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl font-sans focus:outline-none focus:ring-1 focus:ring-[#059669]"
                  />
                  <div className="flex items-center justify-end gap-1 bg-white px-2.5 py-1 border border-gray-200 rounded-xl">
                    <span className="text-[10px] font-sans font-medium text-gray-400 mr-1">Note :</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setNewRating(star)}
                        className="p-0.5 cursor-pointer text-[#FF8A00] hover:scale-110 transition-all"
                      >
                        <Star className={`w-3.5 h-3.5 ${star <= newRating ? 'fill-current' : 'text-gray-200'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  required
                  placeholder="Partagez votre expérience d'accueil ou de soins..."
                  rows={2}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl font-sans focus:outline-none focus:ring-1 focus:ring-[#059669] resize-none"
                ></textarea>

                <button
                  type="submit"
                  className="w-full py-2.5 btn-primary rounded-xl text-xs font-sans font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  Publier l'avis
                </button>
              </form>

              {showReviewSuccess && (
                <div className="mt-2.5 p-2 bg-emerald-50 border border-emerald-100 text-[#00D26A] text-xs font-medium font-sans rounded-xl flex items-center gap-1.5 justify-center">
                  <Check className="w-3.5 h-3.5" />
                  Votre avis a été publié avec succès.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
