-- UUIDv7 (RFC 9562): 48 Bit Unix-Zeit in Millisekunden, danach Zufall.
-- PostgreSQL 16 hat noch kein eingebautes uuidv7() (erst ab Version 18).
CREATE FUNCTION uuidv7() RETURNS uuid
LANGUAGE sql VOLATILE PARALLEL SAFE
AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          PLACING substring(int8send((extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
          FROM 1 FOR 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid;
$$;
