// ============================================================================
// ROUTES HOSPITAL SERVICE
// ============================================================================

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

interface Hospital {
  id: number;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  type: string;
  phone?: string;
  email?: string;
  specialties: string[];
  rating: number;
  ratingCount: number;
}

// Mock DB
const hospitals: Hospital[] = [
  {
    id: 1,
    name: 'CHU Cotonou',
    address: 'Route Inter-États',
    city: 'Cotonou',
    latitude: 6.4385,
    longitude: 2.3412,
    type: 'public',
    phone: '+229 01 21 36 01 22',
    email: 'chu@santeplus.bj',
    specialties: ['Urgences', 'Cardiologie', 'Radiologie'],
    rating: 4.5,
    ratingCount: 238,
  },
  {
    id: 2,
    name: 'Clinique Sainte-Famille',
    address: 'Quartier Zogbadjè',
    city: 'Abomey-Calavi',
    latitude: 6.4182,
    longitude: 2.3395,
    type: 'private',
    phone: '+229 01 97 45 11 89',
    email: 'contact@saintfamille.bj',
    specialties: ['Médecine Générale', 'Pédiatrie', 'Maternité'],
    rating: 4.7,
    ratingCount: 85,
  },
];

// GET /api/hospitals
router.get('/', (req: Request, res: Response) => {
  const { city, type, specialty } = req.query;

  let filtered = hospitals;

  if (city) filtered = filtered.filter(h => h.city === city);
  if (type) filtered = filtered.filter(h => h.type === type);
  if (specialty) {
    filtered = filtered.filter(h =>
      h.specialties.some(s => s.includes(specialty as string))
    );
  }

  res.json({
    success: true,
    data: filtered,
  });
});

// GET /api/hospitals/:id
router.get('/:id', (req: Request, res: Response) => {
  const hospital = hospitals.find(h => h.id === parseInt(req.params.id));

  if (!hospital) {
    return res.status(404).json({ success: false, error: 'Hospital not found' });
  }

  res.json({
    success: true,
    data: {
      ...hospital,
      priceList: [
        { name: 'Consultation Générale', priceXOF: 5000, priceSats: 8330 },
        { name: 'Bilan Sanguin Complet', priceXOF: 15000, priceSats: 25000 },
      ],
    },
  });
});

// POST /api/hospitals (Admin only)
router.post('/', requireAuth, requireRole('admin', 'superadmin'), (req: Request, res: Response) => {
  const { name, address, city, latitude, longitude, type, phone, email, specialties } = req.body;

  const newHospital: Hospital = {
    id: hospitals.length + 1,
    name,
    address,
    city,
    latitude,
    longitude,
    type,
    phone,
    email,
    specialties,
    rating: 0,
    ratingCount: 0,
  };

  hospitals.push(newHospital);

  res.status(201).json({
    success: true,
    data: newHospital,
  });
});

// GET /api/hospitals/nearby
router.get('/nearby', (req: Request, res: Response) => {
  const { latitude, longitude, radius = 10 } = req.query;

  // Mock: return all hospitals with distance calculation
  const result = hospitals.map(h => ({
    ...h,
    distance: Math.random() * 10,
    distanceText: `${(Math.random() * 10).toFixed(1)} km`,
  }));

  res.json({
    success: true,
    data: result,
  });
});

// GET /api/hospitals/statistics
router.get('/statistics', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      totalHospitals: hospitals.length,
      publicHospitals: hospitals.filter(h => h.type === 'public').length,
      privateHospitals: hospitals.filter(h => h.type === 'private').length,
      totalConsultations: 1250,
      averageRating: 4.6,
    },
  });
});

export default router;
