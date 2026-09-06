import { z } from 'zod';

const short = z.string().trim().max(200);
const notes = z.string().trim().max(4000);
const optionalEmail = z.union([z.literal(''), z.email()]);

export const parsedLeadSchema = z
  .object({
    first_name: short,
    last_name: short,
    email: optionalEmail,
    phone: z.string().trim().max(40),
    instagram: short,
    location: short,
    preferred_contact: z.enum(['Email', 'Phone', 'SMS', 'Instagram', 'Facebook', 'WhatsApp']),
    make: short,
    model: short,
    year: short,
    chassis: short,
    notes,
    confidence: z.enum(['high', 'medium', 'low']),
  })
  .strict();

export const parsedLeadsSchema = z
  .object({
    leads: z.array(parsedLeadSchema).max(25),
    warnings: z.array(z.string().trim().max(300)).max(20),
  })
  .strict();

export const importLeadSchema = parsedLeadSchema
  .omit({ confidence: true })
  .extend({
    first_name: short.min(1, 'Every lead needs a first name'),
    make: short.min(1, 'Every lead needs a vehicle make'),
    model: short.min(1, 'Every lead needs a vehicle model'),
  })
  .refine((lead) => lead.email || lead.phone || lead.instagram, {
    message: 'Every lead needs an email, phone number, or Instagram handle',
  });

export const leadImportRequestSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('parse'),
      text: z.string().trim().min(10, 'Paste at least one complete lead').max(30000),
    })
    .strict(),
  z
    .object({
      action: z.literal('import'),
      leads: z.array(importLeadSchema).min(1).max(25),
    })
    .strict(),
]);

export type ParsedLead = z.infer<typeof parsedLeadSchema>;
