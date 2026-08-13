"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/Button";
import {
  createApiKey,
  fetchActiveApiKey,
  revokeApiKey,
  type ApiKey,
} from "@/lib/api-keys";

/** Label used when the field is left blank — a key still needs a name. */
const DEFAULT_NAME = "My API key";

/** Matches the backend DTO: letters, digits, spaces, dots, hyphens, underscores. */
const NAME_PATTERN = "[\\w .-]+";

const inputClasses =
  "w-full border border-arcade-border bg-arcade-bg px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:border-neon-cyan";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * API key management for the public API (`/api/v1`).
 *
 * One key per account, which is what shapes this panel: there is no list, just
 * two states — you have a key or you do not. Minting while a key is live is
 * refused by the backend (409), so the button that would do it is not rendered
 * until the current key is revoked.
 *
 * The secret exists in exactly one place for one moment: the mint response.
 * It is held in component state and shown until dismissed, because the server
 * keeps only a hash and genuinely cannot show it again.
 */
export default function ApiKeyPanel() {
  const [key, setKey] = useState<ApiKey | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const applyKey = useCallback((active: ApiKey | null) => {
    setKey(active);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchActiveApiKey()
      .then((active) => {
        if (!cancelled) applyKey(active);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [applyKey]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createApiKey(name.trim() || DEFAULT_NAME);
      setSecret(created.key);
      setCopied(false);
      setName("");
      // Copied field by field rather than spread: the response carries the
      // secret, and the state this panel renders from must not.
      setKey({
        id: created.id,
        name: created.name,
        prefix: created.prefix,
        lastUsedAt: created.lastUsedAt,
        revokedAt: created.revokedAt,
        createdAt: created.createdAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not create key");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!key) return;
    if (
      !confirm(
        "Revoke this key? Anything using it stops working immediately, and it cannot be restored.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await revokeApiKey(key.id);
      setKey(null);
      setSecret(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not revoke key");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      // Clipboard access can be refused (insecure context, denied permission).
      // The secret is on screen and selectable, so this is not worth an error.
      setCopied(false);
    }
  }

  return (
    <div className="mb-8 border border-arcade-border bg-arcade-panel p-4">
      <h2 className="mb-1 font-arcade text-[10px] text-arcade-muted">API KEY</h2>
      <p className="mb-3 font-mono text-[10px] leading-relaxed text-arcade-muted">
        For scripts calling the public API at <code>/api/v1</code>. Acts as you,
        limited to 100 requests per minute. One key per account.
      </p>

      {error && <p className="mb-3 font-mono text-xs text-neon-red">{error}</p>}

      {/* The secret, shown once. Survives until dismissed or the key is revoked. */}
      {secret && (
        <div className="mb-3 border border-neon-yellow/40 bg-arcade-bg p-3">
          <p className="mb-2 font-arcade text-[9px] leading-relaxed text-neon-yellow">
            COPY THIS NOW — IT WILL NOT BE SHOWN AGAIN
          </p>
          <code className="mb-2 block break-all font-mono text-[11px] text-neon-green">
            {secret}
          </code>
          <div className="flex gap-2">
            <Button type="button" onClick={handleCopy}>
              {copied ? "COPIED" : "COPY"}
            </Button>
            <Button type="button" onClick={() => setSecret(null)}>
              DISMISS
            </Button>
          </div>
        </div>
      )}

      {!loaded && (
        <p className="font-mono text-xs text-arcade-muted animate-blink">
          LOADING...
        </p>
      )}

      {loaded && key && (
        <div className="flex flex-col gap-3">
          <dl className="flex flex-col gap-1.5 font-mono text-xs">
            <Row label="Name" value={key.name} />
            <Row label="Key" value={`${key.prefix}…`} mono />
            <Row label="Created" value={formatDate(key.createdAt)} />
            <Row
              label="Last used"
              value={key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}
            />
          </dl>
          <div>
            <Button
              type="button"
              onClick={handleRevoke}
              disabled={busy}
              className="border-neon-red/40 text-neon-red hover:border-neon-red hover:shadow-[0_0_8px_#ff004040]"
            >
              {busy ? "WORKING..." : "REVOKE KEY"}
            </Button>
          </div>
          <p className="font-mono text-[10px] text-arcade-muted">
            Revoke this key to create a new one.
          </p>
        </div>
      )}

      {loaded && !key && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <div>
            <label
              htmlFor="api-key-name"
              className="mb-1 block font-mono text-[10px] uppercase text-arcade-muted"
            >
              Label (optional)
            </label>
            <input
              id="api-key-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={DEFAULT_NAME}
              maxLength={40}
              pattern={NAME_PATTERN}
              title="Letters, digits, spaces, dots, - and _ only"
              className={inputClasses}
            />
          </div>
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? "GENERATING..." : "GENERATE KEY"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[10px] uppercase tracking-wider text-arcade-muted">
        {label}
      </dt>
      <dd className={`truncate ${mono ? "text-neon-cyan" : "text-foreground"}`}>
        {value}
      </dd>
    </div>
  );
}
