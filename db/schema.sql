CREATE TABLE books (
                       id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                       title      TEXT        NOT NULL CHECK (btrim(title) <> ''),
                       author     TEXT,
                       status     TEXT        NOT NULL DEFAULT 'want'
                           CHECK (status IN ('want', 'reading', 'done')),
                       created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
