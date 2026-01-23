// QC Data Types for HayQC - Bale Logging & Quality Control

// User Roles for RBAC
export type UserRole = 'INSPECTOR' | 'SUPERVISOR' | 'CUSTOMER' | 'SUPPLIER';

// Enums
export enum POStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum ItemType {
  RHODES_GRASS = 'RHODES_GRASS',
  WHEAT_STRAW = 'WHEAT_STRAW',
  ALFALFA = 'ALFALFA',
}

export enum BalePress {
  SINGLE = 'SINGLE',
  DOUBLE = 'DOUBLE',
}

export enum BaleSize {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
}

export enum BaleGrade {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  REJECT = 'REJECT',
}

// Updated Color enum with 4 options
export enum Color {
  DARK_GREEN = 'DARK_GREEN',
  GREEN = 'GREEN',
  LIGHT_GREEN = 'LIGHT_GREEN',
  BROWN = 'BROWN',
}

export enum Stems {
  LOW = 'LOW',
  MED = 'MED',
  HIGH = 'HIGH',
}

export enum Wetness {
  DRY = 'DRY',
  DAMP = 'DAMP',
  WET = 'WET',
}

export enum Decision {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
}

export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  ERROR = 'ERROR',
}

export enum ShipmentStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum ContainerStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

// Interfaces - ALL camelCase

export interface Company {
  id: string;
  name: string;
  code: string;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  assignedPoIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  companyId: string;
  poNumber: string;
  customerName: string;
  product: string;
  contractQtyMt: number;
  poDate: string;
  paymentTerms: string | null;
  pricePerMt: number | null;
  status: POStatus | string;
  createdAt: string;
  updatedAt: string;
}

export interface Shipment {
  id: string;
  poId: string;
  shipmentCode: string;
  supplierName: string;
  shipmentDate: string;
  status: ShipmentStatus | string;
  createdAt: string;
  updatedAt: string;
}

export interface Container {
  id: string;
  shipmentId: string;
  containerCode: string;
  containerNumber: string;
  itemType: ItemType | string;
  balePress: BalePress | string;
  baleSize: BaleSize | string;
  avgExpectedWeight: number;
  status: ContainerStatus | string;
  createdAt: string;
  updatedAt: string;
}

export interface InspectorAssignment {
  id: string;
  containerId: string;
  inspectorId: string;
  rangeStart: number;
  rangeEnd: number;
  createdAt: string;
}

export interface Bale {
  id: string;
  poId: string;
  shipmentId: string;
  containerId: string;
  inspectorId: string;
  baleNumber: number;
  baleIdDisplay: string;
  weightKg: number;
  moisturePct: number | null;
  color: Color | string;
  stems: Stems | string;
  wetness: Wetness | string;
  contamination: boolean;
  mixedMaterial: boolean;
  mold: boolean;
  grade: BaleGrade | string;
  decision: Decision | string;
  rejectReason: string | null;
  photo1Url: string | null;
  photo2Url: string | null;
  notes: string | null;
  syncStatus: SyncStatus | string;
  createdAt: string;
  updatedAt: string;
}

export interface POUserAssignment {
  id: string;
  poId: string;
  userId: string;
  user?: User;
  purchaseOrder?: PurchaseOrder;
  createdAt: string;
}

export interface PONote {
  id: string;
  poId: string;
  userId: string;
  content: string;
  user?: User;
  createdAt: string;
  updatedAt: string;
}

// Display maps
export const itemTypeDisplay: Record<string, string> = {
  RHODES_GRASS: 'Rhodes Grass',
  WHEAT_STRAW: 'Wheat Straw',
  ALFALFA: 'Alfalfa',
};

export const balePressDisplay: Record<string, string> = {
  SINGLE: 'Single Press',
  DOUBLE: 'Double Press',
};

export const baleSizeDisplay: Record<string, string> = {
  SMALL: 'Small (<300kg)',
  MEDIUM: 'Medium (300-400kg)',
  LARGE: 'Large (>400kg)',
};

export const gradeDisplay: Record<string, string> = {
  A: 'Grade A',
  B: 'Grade B',
  C: 'Grade C',
  D: 'Grade D',
  REJECT: 'Reject',
};

export const colorDisplay: Record<string, string> = {
  DARK_GREEN: 'Dark Green',
  GREEN: 'Green',
  LIGHT_GREEN: 'Light Green',
  BROWN: 'Brown',
};

export const stemsDisplay: Record<string, string> = {
  LOW: 'Low',
  MED: 'Medium',
  HIGH: 'High',
};

export const wetnessDisplay: Record<string, string> = {
  DRY: 'Dry',
  DAMP: 'Damp',
  WET: 'Wet',
};

export const decisionDisplay: Record<string, string> = {
  ACCEPT: 'Accept',
  REJECT: 'Reject',
};

export const poStatusDisplay: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

export const shipmentStatusDisplay: Record<string, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

export const roleDisplay: Record<UserRole, string> = {
  INSPECTOR: 'Inspector',
  SUPERVISOR: 'Supervisor',
  CUSTOMER: 'Customer',
  SUPPLIER: 'Supplier',
};

// NEW Grade calculation with Grade D support
export function calculateBaleGrade(
  moisture: number | null,
  color: Color | string,
  wetness: Wetness | string,
  mold: boolean,
  contamination: boolean
): BaleGrade {
  // Reject conditions - immediate rejection
  if (mold || contamination || wetness === Wetness.WET || wetness === 'WET') {
    return BaleGrade.REJECT;
  }

  // Grade A: Dark green or green color, moisture 10-14%, dry
  if (
    (color === Color.DARK_GREEN || color === 'DARK_GREEN' || color === Color.GREEN || color === 'GREEN') &&
    moisture !== null && moisture >= 10 && moisture <= 14 &&
    (wetness === Wetness.DRY || wetness === 'DRY')
  ) {
    return BaleGrade.A;
  }

  // Grade D: moisture > 30% but not wet (before checking C)
  if (moisture !== null && moisture > 30) {
    return BaleGrade.D;
  }

  // Grade C: moisture > 25%
  if (moisture !== null && moisture > 25) {
    return BaleGrade.C;
  }

  // Grade B: Light green or brown color OR moisture 14-25% OR damp
  if (
    color === Color.LIGHT_GREEN || color === 'LIGHT_GREEN' ||
    color === Color.BROWN || color === 'BROWN' ||
    (moisture !== null && moisture > 14 && moisture <= 25) ||
    wetness === Wetness.DAMP || wetness === 'DAMP'
  ) {
    return BaleGrade.B;
  }

  // Default to Grade A if dark green/green and dry with no moisture reading
  if (
    (color === Color.DARK_GREEN || color === 'DARK_GREEN' || color === Color.GREEN || color === 'GREEN') &&
    (wetness === Wetness.DRY || wetness === 'DRY')
  ) {
    return BaleGrade.A;
  }

  return BaleGrade.B;
}

// Bilingual labels
export const bilingualLabels = {
  inspector: { en: 'Inspector', ur: 'معائنہ کار' },
  supervisor: { en: 'Supervisor', ur: 'سپروائزر' },
  customer: { en: 'Customer', ur: 'گاہک' },
  supplier: { en: 'Supplier', ur: 'سپلائر' },
  login: { en: 'Start Inspection', ur: 'معائنہ شروع کریں' },
  baleNumber: { en: 'Bale Number', ur: 'گانٹھ نمبر' },
  weight: { en: 'Weight (kg)', ur: 'وزن (کلو)' },
  moisture: { en: 'Moisture', ur: 'نمی' },
  color: { en: 'Color', ur: 'رنگ' },
  stems: { en: 'Stems', ur: 'تنے' },
  wetness: { en: 'Wetness', ur: 'گیلا پن' },
  contamination: { en: 'Contamination', ur: 'آلودگی' },
  mixedMaterial: { en: 'Mixed Material', ur: 'مخلوط مواد' },
  mold: { en: 'Mold', ur: 'پھپھوندی' },
  accept: { en: 'ACCEPT', ur: 'قبول' },
  reject: { en: 'REJECT', ur: 'مسترد' },
  saveNext: { en: 'Save & Next', ur: 'محفوظ کریں اور اگلا' },
  saveBack: { en: 'Save & Back', ur: 'محفوظ کریں اور واپس' },
  photo: { en: 'Photo', ur: 'تصویر' },
  notes: { en: 'Notes', ur: 'نوٹس' },
  darkGreen: { en: 'DARK GREEN', ur: 'گہرا سبز' },
  green: { en: 'GREEN', ur: 'سبز' },
  lightGreen: { en: 'LIGHT GREEN', ur: 'ہلکا سبز' },
  brown: { en: 'BROWN', ur: 'بھورا' },
  low: { en: 'LOW', ur: 'کم' },
  med: { en: 'MED', ur: 'درمیانہ' },
  high: { en: 'HIGH', ur: 'زیادہ' },
  dry: { en: 'DRY', ur: 'خشک' },
  damp: { en: 'DAMP', ur: 'نم' },
  wet: { en: 'WET', ur: 'گیلا' },
  yes: { en: 'Yes', ur: 'ہاں' },
  no: { en: 'No', ur: 'نہیں' },
  company: { en: 'Company', ur: 'کمپنی' },
  createAccount: { en: 'Create Account', ur: 'اکاؤنٹ بنائیں' },
  pin: { en: 'PIN', ur: 'پن' },
  grade: { en: 'Grade', ur: 'گریڈ' },
  itemType: { en: 'Item Type', ur: 'آئٹم کی قسم' },
  balePress: { en: 'Bale Press', ur: 'گانٹھ پریس' },
  baleSize: { en: 'Bale Size', ur: 'گانٹھ کا سائز' },
  avgWeight: { en: 'Avg Expected Weight', ur: 'متوقع اوسط وزن' },
  moisturePct: { en: 'Moisture %', ur: 'نمی فیصد' },
  dashboard: { en: 'Dashboard', ur: 'ڈیش بورڈ' },
  logout: { en: 'Logout', ur: 'لاگ آؤٹ' },
  purchaseOrders: { en: 'Purchase Orders', ur: 'خریداری کے آرڈرز' },
  companyAdmin: { en: 'Company Admin', ur: 'کمپنی ایڈمن' },
};

// Reject reasons
export const rejectReasons = [
  'Excessive moisture',
  'Contamination found',
  'Mold present',
  'Mixed material',
  'Poor color quality',
  'Underweight',
  'Physical damage',
  'Foreign material',
  'Other',
];
