import React, { useState, useEffect, useRef } from 'react';
import { Hospital } from '../types';
import { HOSPITALS } from '../data';
import { Search, MapPin, Star, ShieldCheck, Clock, Navigation, SlidersHorizontal, Info, HelpCircle, Map as MapIcon, Globe, Sparkles, Zap } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface InteractiveMapProps {
  onSelectHospital: (hospital: Hospital) => void;
  onSelectAlreadyThere: (hospital: Hospital) => void;
  hospitals?: Hospital[];
}

export default function InteractiveMap({ onSelectHospital, onSelectAlreadyThere, hospitals = HOSPITALS }: InteractiveMapProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'public' | 'private' | 'clinic'>('all');
  const [hoveredHospitalId, setHoveredHospitalId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'list' | 'map'>('list');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Only show verified hospitals to the general public
  const verifiedHospitals = hospitals.filter(h => h.isVerified);

  // Filter hospitals based on search and type
  const filteredHospitals = verifiedHospitals.filter((h) => {
    const matchesSearch = h.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          h.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          h.services.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = selectedType === 'all' || h.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let map: L.Map | null = null;
    try {
      // Centered around Abomey-Calavi / Cotonou area
      map = L.map(mapContainerRef.current, {
        center: [6.4385, 2.3412],
        zoom: 13,
        zoomControl: false,
      });

      // Standard OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      // Zoom control in bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapRef.current = map;
    } catch (e) {
      console.error("Failed to initialize Leaflet Map:", e);
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.warn("Failed to safely remove Leaflet Map:", e);
        }
        mapRef.current = null;
      }
    };
  }, []);

  // Handle ResizeObserver to resize map gracefully when container size changes
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapRef.current) {
        try {
          mapRef.current.invalidateSize();
        } catch (e) {
          console.warn("Failed to invalidate map size:", e);
        }
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Force map resize when user switches to map tab on mobile
  useEffect(() => {
    if (mobileTab === 'map' && mapRef.current) {
      const timer = setTimeout(() => {
        try {
          mapRef.current?.invalidateSize();
        } catch (e) {
          console.warn("Failed to invalidate map size on tab change:", e);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [mobileTab]);

  // Update Markers based on filteredHospitals
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Stop any active animations/transitions to prevent race conditions
    try {
      map.stop();
    } catch (e) {
      console.warn("Could not stop map animation:", e);
    }

    // Remove existing markers safely
    markersRef.current.forEach((marker) => {
      try {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      } catch (e) {
        console.warn("Failed to remove map marker safely:", e);
      }
    });
    markersRef.current = [];

    // Create new markers
    filteredHospitals.forEach((hospital) => {
      const lat = hospital.lat || 6.4385;
      const lng = hospital.lng || 2.3412;

      const color = hospital.type === 'public' ? '#059669' : '#FF8A00';
      const labelText = hospital.name.split('(')[0].replace('Hôpital de', 'Hosp.').replace('Centre de Santé de', 'CS.').trim();

      const customIcon = L.divIcon({
        html: `
          <div class="relative flex flex-col items-center" style="transform: translate(-50%, -100%); margin-top: 18px;">
            <!-- Marker pin circle with dynamic color based on type -->
            <div class="w-9 h-9 rounded-full flex items-center justify-center border-2 border-white shadow-md text-white transition-all transform duration-200 hover:scale-115 flex-shrink-0"
                 style="background-color: ${color}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0V10z"></path>
                <circle cx="12" cy="10" r="3" fill="currentColor"></circle>
              </svg>
            </div>
            <!-- Tooltip label -->
            <span class="mt-1 px-1.5 py-0.5 bg-white border border-gray-100 rounded-md text-[9px] font-bold text-gray-800 font-sans shadow-xs whitespace-nowrap max-w-[120px] truncate">
              ${labelText}
            </span>
          </div>
        `,
        className: 'custom-leaflet-marker',
        iconSize: [36, 50],
        iconAnchor: [18, 25]
      });

      try {
        const marker = L.marker([lat, lng], { icon: customIcon });
        marker.addTo(map);
        marker.on('click', () => {
          onSelectHospital(hospital);
        });
        markersRef.current.push(marker);
      } catch (e) {
        console.warn("Failed to add marker for hospital:", hospital.name, e);
      }
    });

    // Clean up markers if this effect runs again or unmounts
    return () => {
      markersRef.current.forEach((marker) => {
        try {
          if (map.hasLayer(marker)) {
            map.removeLayer(marker);
          }
        } catch (e) {
          // silent ignore
        }
      });
    };
  }, [filteredHospitals]);

  // Sync Hover state to focus/setView selected hospital
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hoveredHospitalId) return;
    const target = filteredHospitals.find((h) => h.id === hoveredHospitalId);
    if (target) {
      const lat = target.lat || 6.4385;
      const lng = target.lng || 2.3412;
      try {
        map.setView([lat, lng], 14.5, {
          animate: true,
          duration: 0.8,
        });
      } catch (e) {
        console.warn("Failed to set map view on hover:", e);
      }
    }
  }, [hoveredHospitalId, filteredHospitals]);

  return (
    <div id="interactive-map-container" className="flex flex-col gap-3 h-full">
      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'list'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Établissements ({filteredHospitals.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'map'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-emerald-600" />
          <span>Carte Interactive</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        {/* Sidebar: Search & Hospital List */}
        <div
          id="map-sidebar"
          className={`lg:col-span-5 flex-col h-[650px] lg:h-[750px] bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden ${
            mobileTab === 'list' ? 'flex' : 'hidden lg:flex'
          }`}
        >
        {/* Header Search Area */}
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-sans font-bold text-[#1C1C1E] tracking-tight">Santé+</h2>
              <p className="text-xs text-gray-500 font-sans mt-0.5">Trouvez et réglez vos soins à Abomey-Calavi</p>
            </div>
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-amber-700 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Bénin Officiel
            </span>
          </div>

          {/* Search Box */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un hôpital, soin, médecin..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm font-sans text-[#1C1C1E] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-transparent transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium font-sans whitespace-nowrap transition-all ${
                selectedType === 'all'
                  ? 'bg-[#059669] text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Tous ({verifiedHospitals.length})
            </button>
            <button
              onClick={() => setSelectedType('public')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium font-sans whitespace-nowrap transition-all ${
                selectedType === 'public'
                  ? 'bg-[#059669] text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Hôpitaux Publics
            </button>
            <button
              onClick={() => setSelectedType('private')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium font-sans whitespace-nowrap transition-all ${
                selectedType === 'private'
                  ? 'bg-[#059669] text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Cliniques Privées
            </button>
          </div>
        </div>

        {/* List of Hospitals */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
          {filteredHospitals.length > 0 ? (
            filteredHospitals.map((hospital) => (
              <div
                key={hospital.id}
                onMouseEnter={() => setHoveredHospitalId(hospital.id)}
                onMouseLeave={() => setHoveredHospitalId(null)}
                className={`p-4 bg-white border rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer ${
                  hoveredHospitalId === hospital.id ? 'border-[#059669] ring-1 ring-[#059669]/20' : 'border-gray-100'
                }`}
                onClick={() => onSelectHospital(hospital)}
              >
                <div className="flex gap-3">
                  <img
                    src={hospital.image}
                    alt={hospital.name}
                    className="w-20 h-20 rounded-xl object-cover bg-gray-100 flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="font-sans font-bold text-sm text-[#1C1C1E] leading-tight truncate">
                        {hospital.name}
                      </h3>
                      {hospital.isVerified && (
                        <span className="flex-shrink-0 text-xs text-[#FF8A00] bg-amber-50 px-1.5 py-0.5 rounded-md font-medium font-sans flex items-center gap-0.5">
                          <ShieldCheck className="w-3 h-3" />
                          Validé
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 font-sans mt-1 truncate">{hospital.address}</p>

                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center text-[#FF8A00]">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span className="text-xs font-bold font-sans ml-1">{hospital.rating}</span>
                        <span className="text-xs text-gray-400 font-sans ml-0.5">({hospital.reviewsCount})</span>
                      </div>
                      <div className="flex items-center text-gray-500 text-xs">
                        <Navigation className="w-3 h-3 mr-0.5 text-[#059669]" />
                        <span className="font-sans font-medium">{hospital.distance}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2.5">
                      <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md font-medium font-sans">
                        {hospital.hours}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 bg-[#059669]/5 text-[#059669] rounded-md font-medium font-sans">
                        {hospital.type === 'public' ? 'Public' : 'Privé'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick actions inside card */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-50" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onSelectHospital(hospital)}
                    className="py-1.5 text-xs text-[#059669] bg-[#059669]/5 hover:bg-[#059669]/10 font-sans font-medium rounded-xl transition-all text-center cursor-pointer"
                  >
                    Voir Infos & RDV
                  </button>
                  <button
                    onClick={() => onSelectAlreadyThere(hospital)}
                    className="py-1.5 text-xs text-white bg-[#00D26A] hover:bg-[#00D26A]/90 font-sans font-medium rounded-xl shadow-xs transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Sur place</span>
                    <Zap className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setHoveredHospitalId(hospital.id);
                      setMobileTab('map');
                    }}
                    className="col-span-2 lg:hidden py-1.5 text-xs text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-sans font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-200"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Localiser sur la carte</span>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 px-4">
              <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-sans font-medium text-gray-600">Aucun établissement trouvé</p>
              <p className="text-xs font-sans text-gray-400 mt-1">Essayez d'ajuster vos filtres de recherche.</p>
            </div>
          )}
        </div>
      </div>

      {/* Map View Canvas (Exclusively OpenStreetMap) */}
      <div
        id="vector-map"
        className={`lg:col-span-7 flex-col h-[520px] sm:h-[600px] lg:h-[750px] bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden relative ${
          mobileTab === 'map' ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {/* Map Header Overlay */}
        <div className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-md border border-gray-100 px-3 py-2 rounded-2xl shadow-md flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#059669]" />
          <span className="text-xs font-bold font-sans text-gray-800">
            OpenStreetMap Réel
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        {/* Real OSM Map Area */}
        <div className="flex-1 w-full h-full relative z-[1]">
          <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-[1]" />
          
          {/* Floating attribution banner */}
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 border border-gray-100 rounded-xl text-[10px] font-sans text-gray-500 shadow-xs z-[1001]">
            Données de carte &copy; contributeurs OpenStreetMap
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
