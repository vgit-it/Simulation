import { z } from 'zod';

/**
 * Schemas for every kind of authored world file. Loaders validate against these
 * so malformed content fails loudly with a clear message and file path, rather
 * than silently mis-rendering.
 */

export const appActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  intelligence: z.string().optional(),
});

export const appDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  category: z.string().default('other'),
  capabilities: z.array(z.string()).default([]),
  actions: z.array(appActionSchema).default([]),
});
export type AppDefinition = z.infer<typeof appDefinitionSchema>;

export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string().default('🙂'),
  traits: z.array(z.string()).default([]),
  behaviors: z.record(z.unknown()).default({}),
});
export type Profile = z.infer<typeof profileSchema>;

export const contactSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string().default('🙂'),
});
export type Contact = z.infer<typeof contactSchema>;

export const contactsFileSchema = z.object({
  contacts: z.array(contactSchema).default([]),
});

export const deviceSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  theme: z.string(),
  apps: z.array(z.string()).default([]),
});
export type Device = z.infer<typeof deviceSchema>;

export const themeSchema = z.object({
  id: z.string(),
  name: z.string(),
  colors: z.object({
    bg: z.string(),
    surface: z.string(),
    text: z.string(),
    muted: z.string(),
    accent: z.string(),
  }),
  radii: z.object({
    screen: z.number(),
    card: z.number(),
  }),
  font: z.string(),
});
export type Theme = z.infer<typeof themeSchema>;

/** One role of the type scale: a complete, self-contained text style. */
export const typeRoleSchema = z.object({
  fontFamily: z.string(), // may be a "{fonts.<id>}" reference, resolved on load
  fontSize: z.string().regex(/^\d+(\.\d+)?(px|em|rem)$/),
  fontWeight: z.number(),
  lineHeight: z.number(),
  letterSpacing: z.string().regex(/^-?\d*(\.\d+)?em$/),
});
export type TypeRole = z.infer<typeof typeRoleSchema>;

const dimensionSchema = z.string().regex(/^\d+(\.\d+)?(px|em|rem)$/);

/**
 * The OS design language (world/design/DESIGN.md, DESIGN.md format): the
 * typography/spacing/shape tokens every device shares. Role and scale names
 * are fixed — they are the engine contract the UI's utility classes compile
 * against — while every value is authored content.
 */
export const designSystemSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  fonts: z.record(z.string()),
  typography: z.object({
    display: typeRoleSchema,
    headline: typeRoleSchema,
    title: typeRoleSchema,
    body: typeRoleSchema,
    'body-sm': typeRoleSchema,
    label: typeRoleSchema,
    caption: typeRoleSchema,
  }),
  spacing: z.object({
    xs: dimensionSchema,
    sm: dimensionSchema,
    md: dimensionSchema,
    lg: dimensionSchema,
    xl: dimensionSchema,
    '2xl': dimensionSchema,
  }),
  rounded: z.object({
    xs: dimensionSchema,
    sm: dimensionSchema,
    md: dimensionSchema,
    lg: dimensionSchema,
    full: dimensionSchema,
  }),
});
export type DesignSystem = z.infer<typeof designSystemSchema>;

export const photoMetaSchema = z.object({
  date: z.coerce.date(),
  location: z.string().default(''),
  people: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});
export type PhotoMeta = z.infer<typeof photoMetaSchema>;

/** A gallery photo: metadata joined with its resolved image URL and id. */
export interface Photo extends PhotoMeta {
  id: string;
  url: string;
}

const focusScreenSchema = z.union([
  z.literal('locked'),
  z.literal('home'),
  z.object({ app: z.string() }),
]);

/** One step of a scenario: advance the clock, cut to a person's phone, or share. */
export const scenarioStepSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('clock'), at: z.coerce.date() }),
  z.object({
    kind: z.literal('focus'),
    person: z.string(),
    device: z.string().optional(),
    screen: focusScreenSchema.default('home'),
  }),
  z.object({
    kind: z.literal('share'),
    person: z.string(),
    device: z.string().optional(),
    photos: z.array(z.string()).min(1),
  }),
]);
export type ScenarioStep = z.infer<typeof scenarioStepSchema>;

export const scenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  steps: z.array(scenarioStepSchema).min(1),
});
export type Scenario = z.infer<typeof scenarioSchema>;
