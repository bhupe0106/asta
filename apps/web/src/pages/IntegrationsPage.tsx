import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  Code2,
  Github,
  Link2,
  Lock,
  Mail,
  MessageSquare,
  Plug,
  Send,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { api, type Integration } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge, EmptyState, SectionHeader, Skeleton, Spinner } from "@/components/common/ui";
import { useUIStore } from "@/stores/ui";

const CATEGORY_ICONS: Record<string, typeof Mail> = {
  communication: MessageSquare,
  email: Mail,
  calendar: CalendarClock,
  development: Code2,
  repository: Github,
  productivity: Link2,
  automation: Send,
};

export function IntegrationsPage() {
  const toast = useUIStore((s) => s.toast);
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [testing, setTesting] = useState(false);

  const integrations = useQuery({ queryKey: ["integrations"], queryFn: api.integrations });
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: api.capabilities });

  const grouped = useMemo(() => {
    const map = new Map<string, Integration[]>();
    for (const item of integrations.data?.integrations ?? []) {
      map.set(item.category, [...(map.get(item.category) ?? []), item]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [integrations.data?.integrations]);

  async function connect(item: Integration) {
    if (item.key === "webhook") {
      setExpanded("webhook");
      if (!webhookUrl.trim()) {
        toast("Add a webhook URL first", { description: "Paste the HTTPS endpoint that should receive approved payloads.", tone: "info" });
        return;
      }
      setConnecting(item.key);
      try {
        await api.connectIntegration("webhook", { url: webhookUrl.trim(), token: webhookToken.trim() || undefined });
        await queryClient.invalidateQueries({ queryKey: ["integrations"] });
        await queryClient.invalidateQueries({ queryKey: ["capabilities"] });
        toast("Webhook connected", { description: "Each outgoing payload still needs your approval in Tasks.", tone: "success" });
      } catch (err) {
        toast("Webhook could not be connected", { description: (err as Error).message, tone: "error" });
      } finally {
        setConnecting(null);
      }
      return;
    }
    setConnecting(item.key);
    try {
      await api.connectIntegration(item.key);
      await queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast(`${item.display_name} connected`, { tone: "success" });
    } catch (err) {
      toast(`${item.display_name} is not configured`, {
        description: (err as Error).message,
        tone: "info",
      });
      setExpanded(item.key);
    } finally {
      setConnecting(null);
    }
  }

  async function disconnect(item: Integration) {
    if (!item.connection) return;
    try {
      await api.disconnectIntegration(item.connection.id);
      await queryClient.invalidateQueries({ queryKey: ["integrations"] });
      await queryClient.invalidateQueries({ queryKey: ["capabilities"] });
      toast(`${item.display_name} disconnected`, { tone: "success" });
    } catch (err) {
      toast("Disconnect failed", { description: (err as Error).message, tone: "error" });
    }
  }

  async function queueWebhookTest() {
    setTesting(true);
    try {
      const result = await api.testWebhook();
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast("Approval task created", {
        description: `${result.note} Open Tasks to approve and execute it.`,
        tone: "success",
      });
    } catch (err) {
      toast("Could not queue the webhook action", { description: (err as Error).message, tone: "error" });
    } finally {
      setTesting(false);
    }
  }

  const externalEnabled = integrations.data?.external_actions_enabled ?? false;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="The boundary of the grimoire"
        title="Integrations"
        description="OAuth connectors stay unavailable until server-side credentials exist. A custom webhook is live: connect your endpoint, then approve each outbound payload."
        action={
          <Badge tone={externalEnabled ? "success" : "danger"}>
            <ShieldCheck size={11} /> External actions {externalEnabled ? "enabled" : "disabled"}
          </Badge>
        }
      />

      <div
        className={cn(
          "panel flex items-start gap-3 p-4",
          externalEnabled ? "border-success/25 bg-success/[0.04]" : "border-gold/25 bg-gold/[0.04]",
        )}
      >
        <AlertTriangle size={17} className={cn("mt-0.5 shrink-0", externalEnabled ? "text-success" : "text-gold")} />
        <div>
          <p className="text-sm font-medium text-parchment">
            {externalEnabled ? "Approval-gated webhooks are available" : "External actions are disabled"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ash">
            {integrations.data?.note ??
              "OAuth integrations return 501 until apps and secrets are supplied. Custom webhooks can be connected now."}{" "}
            Nothing is sent without a second, explicit approval in Tasks.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[0.65rem] text-gold/80">
            <Lock size={11} /> ASTA will never ask for another service&apos;s password.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Catalogued integrations", value: integrations.data?.integrations.length ?? 0, icon: Plug, tone: "text-gold" },
          { label: "Connected", value: (integrations.data?.integrations ?? []).filter((item) => item.connection).length, icon: Link2, tone: "text-ash" },
          { label: "Approval required", value: (integrations.data?.integrations ?? []).filter((item) => item.requires_approval).length, icon: ShieldCheck, tone: "text-success" },
        ].map((stat) => (
          <div key={stat.label} className="panel flex items-center gap-3 p-4">
            <stat.icon size={18} className={stat.tone} />
            <div>
              <p className="font-display text-xl text-parchment">{stat.value}</p>
              <p className="text-[0.62rem] uppercase tracking-[0.16em] text-ash/60">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {integrations.isLoading && (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((key) => (
            <Skeleton key={key} className="h-36 w-full" />
          ))}
        </div>
      )}

      {integrations.isError && (
        <div className="panel border-danger/30 p-4 text-xs text-danger/90">
          The integration catalog could not be loaded: {(integrations.error as Error).message}
        </div>
      )}

      {!integrations.isLoading && grouped.length === 0 && (
        <div className="panel">
          <EmptyState
            icon={<Unplug size={20} />}
            title="No integrations catalogued"
            description="The server returned an empty catalog. This is honest — nothing was invented to fill the page."
          />
        </div>
      )}

      <div className="space-y-6">
        {grouped.map(([category, items]) => {
          const Icon = CATEGORY_ICONS[category] ?? Plug;
          return (
            <section key={category}>
              <div className="mb-2 flex items-center gap-2">
                <Icon size={14} className="text-gold/70" />
                <h2 className="font-display text-sm capitalize text-parchment">{category}</h2>
                <span className="text-[0.6rem] text-ash/40">{items.length}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((item) => {
                  const isOpen = expanded === item.key;
                  return (
                    <div key={item.key} className="panel overflow-hidden">
                      <div className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-display text-sm text-parchment">{item.display_name}</h3>
                            <p className="mt-1 text-xs leading-relaxed text-ash">{item.description}</p>
                          </div>
                          <Badge
                            tone={item.connection ? "success" : item.status === "available" ? "gold" : "neutral"}
                            className="!py-0.5 !text-[0.55rem]"
                          >
                            {item.connection ? "connected" : item.status === "available" ? "available" : "not configured"}
                          </Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1">
                          {item.scopes.map((scope) => (
                            <span key={scope} className="rounded border border-line bg-white/[0.02] px-1.5 py-0.5 font-mono text-[0.58rem] text-ash/80">
                              {scope}
                            </span>
                          ))}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <button
                            onClick={() => setExpanded(isOpen ? null : item.key)}
                            className="inline-flex items-center gap-1 text-[0.65rem] text-ash hover:text-parchment"
                            aria-expanded={isOpen}
                          >
                            Details <ChevronDown size={12} className={cn("transition-transform", isOpen && "rotate-180")} />
                          </button>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.key === "webhook" && item.connection && (
                              <>
                                <button className="btn-ghost !px-2.5 !py-1 text-[0.68rem]" onClick={() => void queueWebhookTest()} disabled={testing}>
                                  {testing ? <Spinner size={11} /> : <Send size={11} />} Send test
                                </button>
                                <button
                                  className="btn-ghost !px-2.5 !py-1 text-[0.68rem] !text-danger/90"
                                  onClick={() => void disconnect(item)}
                                >
                                  <Unplug size={11} /> Disconnect
                                </button>
                              </>
                            )}
                            {!(item.key === "webhook" && item.connection) && (
                              <button
                                className="btn-ghost !px-2.5 !py-1 text-[0.68rem]"
                                onClick={() => void connect(item)}
                                disabled={connecting === item.key}
                              >
                                {connecting === item.key ? <Spinner size={11} /> : item.connection ? <Check size={11} /> : <Link2 size={11} />}
                                {item.connection ? "Connected" : "Connect"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="border-t border-line/70 bg-coal/40 px-4 py-3 text-[0.68rem] leading-relaxed text-ash">
                          {item.key === "webhook" ? (
                            <div className="space-y-3">
                              <p className="flex items-start gap-2">
                                <ShieldCheck size={12} className="mt-0.5 shrink-0 text-gold" />
                                <span>
                                  Point this at an endpoint you control. ASTA sends a JSON payload only after you approve
                                  the task, and records the outcome in the audit log.
                                </span>
                              </p>
                              <div className="space-y-2">
                                <div>
                                  <label htmlFor="webhook-url" className="text-[0.58rem] uppercase tracking-[0.16em] text-ash/60">
                                    Webhook URL
                                  </label>
                                  <input
                                    id="webhook-url"
                                    className="input mt-1"
                                    placeholder="https://example.com/hooks/asta"
                                    value={webhookUrl}
                                    onChange={(event) => setWebhookUrl(event.target.value)}
                                    autoComplete="off"
                                  />
                                </div>
                                <div>
                                  <label htmlFor="webhook-token" className="text-[0.58rem] uppercase tracking-[0.16em] text-ash/60">
                                    Bearer token (optional)
                                  </label>
                                  <input
                                    id="webhook-token"
                                    className="input mt-1"
                                    type="password"
                                    placeholder="stored server-side, never returned"
                                    value={webhookToken}
                                    onChange={(event) => setWebhookToken(event.target.value)}
                                    autoComplete="new-password"
                                  />
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button className="btn-primary !px-3 !py-1.5 text-[0.68rem]" onClick={() => void connect(item)} disabled={connecting === item.key}>
                                  {connecting === item.key ? <Spinner size={11} /> : <Link2 size={11} />}
                                  {item.connection ? "Update webhook" : "Connect webhook"}
                                </button>
                                {item.connection && (
                                  <span className="text-success">
                                    Connected {new Date(item.connection.connected_at).toLocaleDateString()} · status{" "}
                                    {item.connection.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="flex items-start gap-2">
                                <ShieldCheck size={12} className="mt-0.5 shrink-0 text-gold" />
                                <span>
                                  Connecting requires an OAuth app created by the deployment owner, a server-side client
                                  secret, and a redirect URI. Secrets never reach this browser.
                                </span>
                              </p>
                              <p className="mt-2 flex items-start gap-2">
                                <Lock size={12} className="mt-0.5 shrink-0 text-gold" />
                                <span>
                                  Every write action would require explicit approval and produce an audit record. Reads are
                                  limited to the scopes listed above.
                                </span>
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="panel p-5">
        <h2 className="font-display text-sm text-parchment">If you are deploying ASTA</h2>
        <p className="mt-1 text-xs leading-relaxed text-ash">
          Custom webhook actions are enabled with approval and audit records. Supply OAuth provider credentials through
          server environment variables only if you want the email, calendar and storage contracts to become live; those
          connectors deliberately return 501 until then. Review the{" "}
          <code className="rounded border border-line bg-white/[0.04] px-1 py-0.5 font-mono text-[0.65rem]">external_actions</code>{" "}
          flag and replace the best-effort code runner with a hardened sandbox before exposing the API publicly.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(capabilities.data?.features ?? {})
            .filter(([key]) => key.includes("action") || key.includes("integration") || key.includes("sandbox"))
            .map(([key, value]) => (
              <Badge key={key} tone={value ? "success" : "neutral"} className="!text-[0.58rem]">
                {key.replaceAll("_", " ")}: {String(value)}
              </Badge>
            ))}
        </div>
      </div>
    </div>
  );
}
