import { z } from "zod";

// Enum Zod schemas for type-safe validation
export const POStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
]);

export const ShipmentStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
]);

export const ContainerStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
]);

export const ItemTypeSchema = z.enum([
  "RHODES_GRASS",
  "WHEAT_STRAW",
  "ALFALFA",
]);

export const BalePressSchema = z.enum([
  "SINGLE",
  "DOUBLE",
]);

export const BaleSizeSchema = z.enum(["SMALL", "MEDIUM", "LARGE"]);

export const BaleGradeSchema = z.enum(["A", "B", "C", "D", "REJECT"]);

export const ColorSchema = z.enum(["DARK_GREEN", "GREEN", "LIGHT_GREEN", "BROWN"]);

export const StemsSchema = z.enum(["LOW", "MED", "HIGH"]);

export const WetnessSchema = z.enum([
  "DRY",
  "DAMP",
  "WET",
]);

export const DecisionSchema = z.enum(["ACCEPT", "REJECT"]);

export const SyncStatusSchema = z.enum(["PENDING", "SYNCED", "ERROR"]);

// Type exports
export type POStatus = z.infer<typeof POStatusSchema>;
export type ShipmentStatus = z.infer<typeof ShipmentStatusSchema>;
export type ContainerStatus = z.infer<typeof ContainerStatusSchema>;
export type ItemType = z.infer<typeof ItemTypeSchema>;
export type BalePress = z.infer<typeof BalePressSchema>;
export type BaleSize = z.infer<typeof BaleSizeSchema>;
export type BaleGrade = z.infer<typeof BaleGradeSchema>;
export type Color = z.infer<typeof ColorSchema>;
export type Stems = z.infer<typeof StemsSchema>;
export type Wetness = z.infer<typeof WetnessSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type SyncStatus = z.infer<typeof SyncStatusSchema>;
