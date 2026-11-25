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

// 32 Byte Schlüssel für das verschlüsselte Sitzungscookie, als Hex.
export const sessionKey = z
  .string({ error: 'SESSION_KEY fehlt' })
  .regex(/^[0-9a-f]{64}$/i, {
    message: 'SESSION_KEY muss aus 64 Hex-Zeichen bestehen (32 Byte)',
  });

const schema = z
  .object({
    DATABASE_URL: postgresUrl('DATABASE_URL'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().min(1).default('0.0.0.0'),
    SESSION_KEY: sessionKey,
    NODE_ENV: z.string().optional(),
  })
  // Cookie mit Secure überall außer in der lokalen Entwicklung.
  .transform(({ NODE_ENV, ...rest }) => ({
    ...rest,
    secureCookie: NODE_ENV !== 'development',
  }));

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return parseEnv(schema, env);
}
