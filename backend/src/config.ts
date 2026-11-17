import { z } from 'zod';

export function postgresUrl(name: string) {
  return z
    .string({ error: `${name} fehlt` })
    .refine(
      (v) =>
        !/[<>]/.test(v) && URL.canParse(v) && /^postgres(ql)?:\/\//.test(v),
      {
        message: `${name} ist keine gültige Postgres-URL (Platzhalter ersetzen?)`,
      },
    );
}

export function parseEnv<S extends z.ZodType>(
  schema: S,
  env: NodeJS.ProcessEnv = process.env,
): z.infer<S> {
  const result = schema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `- ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Ungültige Konfiguration:\n${details}`);
  }
  return result.data;
}

const schema = z.object({
  DATABASE_URL: postgresUrl('DATABASE_URL'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return parseEnv(schema, env);
}
