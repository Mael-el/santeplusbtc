import React, { useEffect, useRef, useState } from 'react';
import { Hospital, Appointment, Patient } from '../types';
import { Calendar as CalendarIcon, Clock, User, CheckCircle, ArrowLeft, ShieldAlert, Wallet, MapPin, XCircle, Repeat2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AppointmentModalProps {
  hospital: Hospital;
  onBack: () => void;
  onConfirm: (appointment: Appointment) => void;
  patientUser?: Patient | null;
  hasCreditAvailable?: boolean;
  appointments?: Appointment[];
}

export default function AppointmentModal({ hospital, onBack, onConfirm, patientUser, hasCreditAvailable, appointments = [] }: AppointmentModalProps) {
  const [patientName, setPatientName] = useState(patientUser?.name || '');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedService, setSelectedService] = useState(hospital.services[0] || 'Médecine Générale');
  const [reason, setReason] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Wallet' | 'Lightning' | 'Credit'>(hasCreditAvailable ? 'Credit' : 'Wallet');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [appointmentTab, setAppointmentTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [submitError, setSubmitError] = useState('');
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
  }, []);

  // Generate calendar days for scheduling (next 6 days starting tomorrow, skipping Sunday)
  const getNextDays = () => {
    const days = [];
    const weekdays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const months = ['Janv', 'Févr', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

    let count = 0;
    let index = 1;
    while (count < 6) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + index);

      // Skip Sundays (standard health center rest day in Benin except emergencies)
      if (futureDate.getDay() !== 0) {
        days.push({
          formattedDate: futureDate.toISOString().split('T')[0],
          dayName: weekdays[futureDate.getDay()],
          dayNum: futureDate.getDate(),
          monthName: months[futureDate.getMonth()],
        });
        count++;
      }
      index++;
    }
    return days;
  };

  const daysList = getNextDays();

  const visibleAppointments = appointments.filter(appointment => {
    if (appointmentTab === 'cancelled') return appointment.status === 'cancelled';
    if (appointmentTab === 'past') return appointment.status !== 'cancelled' && new Date(`${appointment.date}T${appointment.timeSlot || '00:00'}`) < new Date();
    return appointment.status !== 'cancelled' && new Date(`${appointment.date}T${appointment.timeSlot || '23:59'}`) >= new Date();
  });

  // Standard morning & afternoon medical consulting slots in Benin
  const slotsList = [
    '08:30', '09:00', '09:30', '10:00', '10:30', '11:00',
    '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !selectedDate || !selectedSlot || !selectedService || !reason.trim()) return;

    setSubmitError('');

    // Verify the selected payment method is actually funded before confirming.
    const amountPaidXOF = paymentMethod === 'Wallet' ? 2000 : 0;
    const amountPaidSats = paymentMethod === 'Lightning' ? 3330 : 0;

    if (paymentMethod === 'Wallet') {
      if (!patientUser) {
        setSubmitError('Connectez-vous pour payer avec votre portefeuille Santé+.');
        return;
      }
      if ((patientUser.walletBalance ?? 0) < amountPaidXOF) {
        setSubmitError(`Solde de portefeuille insuffisant (Requis : ${amountPaidXOF.toLocaleString('fr-FR')} XOF). Veuillez recharger d'abord.`);
        return;
      }
    }

    if (paymentMethod === 'Lightning') {
      if (!patientUser) {
        setSubmitError('Connectez-vous pour payer via Bitcoin Lightning.');
        return;
      }
      if ((patientUser.satoshiBalance ?? 0) < amountPaidSats) {
        setSubmitError(`Solde Satoshi insuffisant (Requis : ${amountPaidSats.toLocaleString('fr-FR')} Sats). Veuillez faire un dépôt ou payer en XOF.`);
        return;
      }
    }

    // Debit the patient's real balance for the chosen method.
    if (patientUser && paymentMethod === 'Wallet') {
      patientUser.walletBalance = (patientUser.walletBalance ?? 0) - amountPaidXOF;
    }
    if (patientUser && paymentMethod === 'Lightning') {
      patientUser.satoshiBalance = (patientUser.satoshiBalance ?? 0) - amountPaidSats;
    }

    const newAppointment: Appointment = {
      id: `apt-${Date.now()}`,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      date: selectedDate,
      timeSlot: selectedSlot,
      patientName: patientName,
      patientEmail: patientUser?.email || '',
      status: 'confirmed',
      service: selectedService,
      reason: reason.trim(),
      doctorName: doctorName.trim() || undefined,
      isPaid: true,
      paymentMethod: paymentMethod,
      amountPaidXOF,
      amountPaidSats,
    };

    setIsSubmitted(true);
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    confirmTimeoutRef.current = setTimeout(() => {
      confirmTimeoutRef.current = null;
      onConfirm(newAppointment);
    }, 2500);
  };

  return (
    <div id="appointment-scheduler" className="max-w-2xl mx-auto bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 md:p-8">
      {/* Back Button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-black text-emerald-950">Mes Rendez-vous</h2>
          <p className="text-sm text-emerald-700">Planning de soins · {hospital.name}</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-1.5">
        <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="Filtrer les rendez-vous">
          {([['upcoming', 'À venir'], ['past', 'Passés'], ['cancelled', 'Annulés']] as const).map(([tab, label]) => (
            <button key={tab} type="button" role="tab" aria-selected={appointmentTab === tab} onClick={() => setAppointmentTab(tab)} className={`min-h-[44px] rounded-xl px-3 py-2 text-sm font-black transition ${appointmentTab === tab ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-800 hover:bg-white'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {visibleAppointments.length > 0 && (
        <section className="mb-7 space-y-3" aria-label="Rendez-vous enregistrés">
          {visibleAppointments.map(appointment => (
            <article key={appointment.id} className="rounded-[32px_32px_8px_32px] border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">{new Date(`${appointment.date}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} · {appointment.timeSlot}</p>
                  <h3 className="mt-1 text-xl font-black text-emerald-950">{appointment.doctorName || 'Praticien à confirmer'}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-emerald-800"><MapPin className="h-4 w-4" />{appointment.hospitalName}</p>
                  <p className="mt-1 text-xs text-emerald-700">{appointment.service || 'Consultation médicale'} · {appointment.reason || 'Motif non précisé'}</p>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-black text-emerald-800"><CheckCircle className="h-3.5 w-3.5" />{appointment.status === 'confirmed' ? 'Confirmé' : appointment.status === 'pending' ? 'En attente' : 'Annulé'}</span>
              </div>
              {appointmentTab === 'upcoming' && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-emerald-100 pt-3">
                  <button type="button" className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100"><MapPin className="h-3.5 w-3.5" />Itinéraire</button>
                  <button type="button" className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100"><Repeat2 className="h-3.5 w-3.5" />Reporter</button>
                  <button type="button" className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-200"><XCircle className="h-3.5 w-3.5" />Annuler</button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {appointmentTab === 'upcoming' && (
        <div className="mb-5 flex items-center gap-2 text-sm font-black text-emerald-800"><CalendarIcon className="h-4 w-4" />Prendre un nouveau rendez-vous</div>
      )}

      <AnimatePresence mode="wait">
        {!isSubmitted ? (
          <motion.form
            key="booking-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* 1. Patient Name Input & Service Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-sans font-bold text-gray-700 block">Nom complet du Patient</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="Nom complet du patient"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-sans text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#059669] transition-all"
                  />
                </div>
              </div>

              {/* Service Selection */}
              <div className="space-y-2">
                <label className="text-sm font-sans font-bold text-gray-700 block">Service demandé</label>
                <select
                  required
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-sans text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#059669] transition-all appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='gray' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '16px' }}
                >
                  {hospital.services.length > 0 ? (
                    hospital.services.map((srv) => (
                      <option key={srv} value={srv}>{srv}</option>
                    ))
                  ) : (
                    <>
                      <option value="Médecine Générale">Médecine Générale</option>
                      <option value="Pédiatrie">Pédiatrie</option>
                      <option value="Gynécologie">Gynécologie</option>
                      <option value="Cardiologie">Cardiologie</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cause/Motif du Rendez-vous */}
              <div className="space-y-2">
                <label className="text-sm font-sans font-bold text-gray-700 block">Cause du Rendez-vous</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Paludisme, Consultation générale, Suivi..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-sans text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#059669] transition-all"
                />
              </div>

              {/* Docteur (Optionnel) */}
              <div className="space-y-2">
                <label className="text-sm font-sans font-bold text-gray-700 block">
                  Docteur / Praticien <span className="text-xs text-gray-400 font-normal">(Facultatif)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Dr. Jean Sossou (Facultatif)"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-sans text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#059669] transition-all"
                />
              </div>
            </div>

            {/* 2. Custom Date Selector Card Grid */}
            <div className="space-y-3">
              <label className="text-sm font-sans font-bold text-gray-700 block flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-[#059669]" />
                Choisir une date de consultation
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {daysList.map((day) => {
                  const isSelected = selectedDate === day.formattedDate;
                  return (
                    <button
                      type="button"
                      key={day.formattedDate}
                      onClick={() => setSelectedDate(day.formattedDate)}
                      className={`p-3 rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#059669] border-[#059669] text-white shadow-sm'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50/70'
                      }`}
                    >
                      <span className={`text-[10px] font-sans font-bold uppercase tracking-wider ${isSelected ? 'text-emerald-100' : 'text-gray-400'}`}>
                        {day.dayName}
                      </span>
                      <span className="text-lg font-bold font-sans mt-0.5">{day.dayNum}</span>
                      <span className={`text-[10px] font-sans font-medium mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-gray-500'}`}>
                        {day.monthName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Slot Selector Grid */}
            <div className="space-y-3">
              <label className="text-sm font-sans font-bold text-gray-700 block flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#00D26A]" />
                Choisir un créneau horaire
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slotsList.map((slot) => {
                  const isSelected = selectedSlot === slot;
                  return (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2 px-3 rounded-xl border text-xs font-sans font-semibold transition-all text-center cursor-pointer ${
                        isSelected
                          ? 'bg-[#059669] border-[#059669] text-white shadow-sm'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50/70'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Payment Selection */}
            <div className="space-y-3 p-4 bg-gray-50/75 border border-gray-100 rounded-2xl">
              <label className="text-xs font-sans font-extrabold text-gray-800 block flex items-center gap-1.5 uppercase tracking-wider">
                <Wallet className="w-4 h-4 text-[#059669]" />
                Frais de consultation : 2 000 XOF (3 330 Sats)
              </label>
              
              <div className="grid grid-cols-1 gap-2">
                {/* A. Credit Option (if available) */}
                {hasCreditAvailable && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Credit')}
                    className={`p-3.5 rounded-xl border text-left flex justify-between items-center transition-all cursor-pointer ${
                      paymentMethod === 'Credit'
                        ? 'bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-emerald-800 block">Réutiliser mon crédit de rendez-vous</span>
                      <span className="text-[10px] text-emerald-600 font-semibold font-sans">Gratuit — Suite à votre annulation précédente</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full">0 FCFA</span>
                  </button>
                )}

                {/* B. Local Wallet */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Wallet')}
                  className={`p-3.5 rounded-xl border text-left flex justify-between items-center transition-all cursor-pointer ${
                    paymentMethod === 'Wallet'
                      ? 'bg-emerald-50/60 border-[#059669] ring-2 ring-[#059669]/20'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-gray-800 block">Portefeuille Local Santé+ (XOF)</span>
                    <span className="text-[10px] text-gray-400 font-semibold font-sans">
                      Solde disponible : {(patientUser?.walletBalance ?? 0).toLocaleString('fr-FR')} XOF
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-900">2 000 XOF</span>
                </button>

                {/* C. Lightning Wallet */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Lightning')}
                  className={`p-3.5 rounded-xl border text-left flex justify-between items-center transition-all cursor-pointer ${
                    paymentMethod === 'Lightning'
                      ? 'bg-emerald-50/60 border-[#059669] ring-2 ring-[#059669]/20'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-gray-800 block">Bitcoin Lightning Network (Sats)</span>
                    <span className="text-[10px] text-gray-400 font-semibold font-sans">
                      Solde disponible : {(patientUser?.satoshiBalance ?? 0).toLocaleString('fr-FR')} Sats
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-600">3 330 Sats</span>
                </button>
              </div>

              {/* Warnings */}
              {paymentMethod === 'Wallet' && (patientUser?.walletBalance ?? 0) < 2000 && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[11px] text-red-600 font-sans flex items-center gap-1.5 mt-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <span>Solde de portefeuille insuffisant (Requis : 2 000 XOF). Veuillez recharger d'abord.</span>
                </div>
              )}
              {paymentMethod === 'Lightning' && (patientUser?.satoshiBalance ?? 0) < 3330 && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[11px] text-red-600 font-sans flex items-center gap-1.5 mt-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <span>Solde Satoshi insuffisant (Requis : 3 330 Sats). Veuillez faire un dépôt ou payer en XOF.</span>
                </div>
              )}

              {submitError && (
                <div role="alert" className="p-3 bg-red-50 border-red-100 rounded-xl text-[11px] text-red-600 font-sans flex items-center gap-1.5 mt-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>

            {/* Reminder Info Box */}
            <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-[#FF8A00] flex-shrink-0 mt-0.5" />
              <div className="text-xs font-sans text-amber-800 leading-relaxed">
                <strong>Attention d'usage :</strong> Présentez-vous 15 minutes avant l'heure de votre créneau muni de votre carte d'identité ou carnet de santé Santé+.
              </div>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={
                !patientName || 
                !selectedDate || 
                !selectedSlot || 
                !selectedService || 
                !reason ||
                (paymentMethod === 'Wallet' && (patientUser?.walletBalance ?? 0) < 2000) ||
                (paymentMethod === 'Lightning' && (patientUser?.satoshiBalance ?? 0) < 3330)
              }
              className="w-full py-4 px-6 bg-[#059669] hover:bg-[#059669]/95 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed font-bold text-sm font-sans text-white rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Valider le Rendez-vous</span>
              <CheckCircle className="w-4 h-4" />
            </button>
          </motion.form>
        ) : (
          <motion.div
            key="success-screen"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-12 text-center space-y-6 flex flex-col items-center"
          >
            {/* Animated Circular Badge Success */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#00D26A]/10 animate-ping"></div>
              <div className="w-16 h-16 rounded-full bg-[#00D26A]/10 flex items-center justify-center border-2 border-[#00D26A]">
                <CheckCircle className="w-10 h-10 text-[#00D26A]" />
              </div>
            </div>

            <div className="space-y-2 max-w-sm">
              <h3 className="text-xl font-sans font-bold text-gray-900">Rendez-vous Confirmé !</h3>
              <p className="text-sm font-sans text-gray-500 leading-relaxed">
                Votre créneau pour le <strong className="text-[#1C1C1E]">{selectedDate.split('-').reverse().join('/')}</strong> à <strong className="text-[#1C1C1E]">{selectedSlot}</strong> a été réservé et transmis au secrétariat de l'établissement.
              </p>
            </div>

            {/* Patient card overview */}
            <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl w-full max-w-md text-left space-y-2">
              <div className="flex justify-between border-b border-gray-100 pb-2 text-xs">
                <span className="text-gray-400 font-sans">Patient</span>
                <span className="font-sans font-bold text-gray-800">{patientName}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2 text-xs">
                <span className="text-gray-400 font-sans">Établissement</span>
                <span className="font-sans font-bold text-gray-800">{hospital.name}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2 text-xs">
                <span className="text-gray-400 font-sans">Service demandé</span>
                <span className="font-sans font-bold text-gray-800">{selectedService}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2 text-xs">
                <span className="text-gray-400 font-sans">Cause du RDV</span>
                <span className="font-sans font-bold text-gray-800">{reason}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2 text-xs">
                <span className="text-gray-400 font-sans">Médecin</span>
                <span className="font-sans font-bold text-gray-800">{doctorName ? `Dr. ${doctorName}` : 'Non spécifié (À attribuer)'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400 font-sans">Statut</span>
                <span className="font-sans font-bold text-[#00D26A] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00D26A]"></span>
                  Confirmé
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-400 animate-pulse font-sans">
              Retour à la page de l'établissement dans quelques secondes...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
