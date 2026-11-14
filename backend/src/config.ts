import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL fehlt' })
    .refine(
      (v) =>
        !/[<>]/.test(v) && URL.canParse(v) && /^postgres(ql)?:\/\//.test(v),
      {
        message:
          'DATABASE_URL ist keine gültige Postgres-URL (Platzhalter ersetzen?)',
      },
    ),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `- ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Ungültige Konfiguration:\n${details}`);
  }
  return result.data;
}
