"use client";
import { useMemo, useState, useTransition } from "react";
import { adminCreateAccessLink, adminRevokeSessions, type FormState } from "../actions";

export type PlayerRow = { id: string; name: string; createdAt: string; lastActivity: string | null; predictions: number; devices: number };

export function PlayersAccess({ players }: { players: PlayerRow[] }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<(FormState & { id: string }) | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return players.filter((p) => !n || p.name.toLowerCase().includes(n)).slice(0, 50);
  }, [players, q]);

  const run = (id: string, fn: () => Promise<FormState>) => start(async () => { setCopied(false); setResult({ ...(await fn()), id }); });

  return (
    <div>
      <label htmlFor="player-search" className="sr-only">Rechercher un joueur</label>
      <input id="player-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Rechercher parmi ${players.length} joueurs`} className="input mb-3" />
      <div className="divide-y divide-wina-line">
        {list.map((p) => (
          <div key={p.id} className="py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
              <span className="text-xs text-wina-muted">{p.predictions} prono{p.predictions > 1 ? "s" : ""} · {p.lastActivity ? `actif le ${p.lastActivity}` : `inscrit le ${p.createdAt}`} · {p.devices} appareil{p.devices > 1 ? "s" : ""}</span>
              <div className="flex gap-2">
                <button className="bg-wina-line px-3 py-1.5 text-xs font-semibold hover:bg-wina-red" disabled={pending} onClick={() => run(p.id, () => adminCreateAccessLink(p.id))}>Créer un lien d&apos;accès</button>
                {confirmRevoke === p.id ? (
                  <>
                    <button className="bg-wina-red px-3 py-1.5 text-xs font-semibold" disabled={pending} onClick={() => { setConfirmRevoke(null); run(p.id, () => adminRevokeSessions(p.id)); }}>Confirmer</button>
                    <button className="px-2 text-xs text-wina-muted hover:text-white" onClick={() => setConfirmRevoke(null)}>Annuler</button>
                  </>
                ) : (
                  <button className="border border-wina-line px-3 py-1.5 text-xs text-wina-muted hover:text-white" disabled={pending || p.devices === 0} onClick={() => setConfirmRevoke(p.id)}>Déconnecter ses appareils</button>
                )}
              </div>
            </div>
            {result?.id === p.id && (
              <div className="mt-2 space-y-2 text-sm">
                {result.error && <p className="text-wina-red">{result.error}</p>}
                {result.message && <p className="text-green-400">{result.message}</p>}
                {result.link && (
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 select-all break-all border border-wina-line bg-wina-ink px-3 py-2 text-xs">{result.link}</code>
                    <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(result.link!).then(() => setCopied(true), () => setCopied(false))}>{copied ? "Copié ✓" : "Copier"}</button>
                    <p className="w-full text-xs text-wina-muted">Envoie-le au joueur en message privé : il ouvre une session à son nom sur l&apos;appareil où il l&apos;ouvre.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && <p className="py-6 text-center text-sm text-wina-muted">Aucun joueur trouvé.</p>}
      </div>
    </div>
  );
}
