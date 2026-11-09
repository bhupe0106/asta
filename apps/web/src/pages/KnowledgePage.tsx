import { useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Database,
  FileText,
  Info,
  LibraryBig,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { api, type KnowledgeDocument, type KnowledgeHit } from "@/lib/api";
import { cn, formatBytes, relativeTime } from "@/lib/utils";
import { Badge, EmptyState, Modal, SectionHeader, Skeleton, Spinner, StatusDot } from "@/components/common/ui";
import { useUIStore } from "@/stores/ui";

const ACCEPT = ".txt,.md,.csv,.json,.pdf,.docx,.xlsx,.pptx";

export function KnowledgePage() {
  const queryClient = useQueryClient();
  const toast = useUIStore((s) => s.toast);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<KnowledgeDocument | null>(null);

  const knowledge = useQuery({ queryKey: ["knowledge"], queryFn: api.knowledge });
  const documents = knowledge.data?.documents ?? [];

  const stats = useMemo(() => {
    const totalBytes = documents.reduce((sum, document) => sum + document.size_bytes, 0);
    const indexed = documents.filter((document) => document.status === "indexed").length;
    return { totalBytes, indexed, total: documents.length };
  }, [documents]);

  const deleteDocument = useMutation({
    mutationFn: (id: string) => api.deleteKnowledge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      toast("Document removed", { description: "Its extracted text and chunks were deleted from your knowledge base.", tone: "success" });
      setPendingDelete(null);
    },
    onError: (err: Error) => toast("Could not remove document", { description: err.message, tone: "error" }),
  });

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    for (const file of list) {
      if (file.size > 20 * 1024 * 1024) {
        toast("File is too large", { description: `${file.name} exceeds the 20 MB limit.`, tone: "error" });
        continue;
      }
      try {
        const document = await api.uploadKnowledge(file);
        toast(`${document.title} indexed`, {
          description: "The server extracted text and built keyword-searchable chunks.",
          tone: "success",
        });
      } catch (err) {
        toast(`Could not index ${file.name}`, { description: (err as Error).message, tone: "error" });
      }
    }
    setUploading(false);
    queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function search(event?: FormEvent) {
    event?.preventDefault();
    const value = query.trim();
    if (value.length < 2) return;
    setSearching(true);
    try {
      const hits = await api.searchKnowledge(value, 8);
      setResults(hits);
    } catch (err) {
      toast("Search failed", { description: (err as Error).message, tone: "error" });
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Your private library"
        title="Knowledge"
        description="Upload documents into a knowledge base that is scoped to your account. Text is extracted on the server and retrieved with transparent keyword scoring."
        action={
          <button className="btn-primary !py-1.5 text-xs" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Spinner size={13} /> : <UploadCloud size={14} />} Upload document
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Documents", value: stats.total, icon: LibraryBig, tone: "text-gold" },
          { label: "Indexed", value: stats.indexed, icon: Database, tone: "text-success" },
          { label: "Storage", value: formatBytes(stats.totalBytes), icon: FileText, tone: "text-ash" },
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

      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <section className="panel p-5">
          <h2 className="font-display text-sm text-parchment">Ask your library</h2>
          <p className="mt-1 text-xs leading-relaxed text-ash">
            Retrieval returns the closest chunks and their document. It does not invent an answer — use the results as
            evidence in a conversation.
          </p>
          <form className="mt-3 flex gap-2" onSubmit={search}>
            <label htmlFor="knowledge-query" className="sr-only">
              Search your knowledge base
            </label>
            <div className="relative flex-1">
              <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ash/60" />
              <input
                id="knowledge-query"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (!event.target.value.trim()) setResults(null);
                }}
                placeholder="e.g. battery recycling policy, chapter 3 summary…"
                className="input ps-9"
              />
            </div>
            <button className="btn-ghost !py-2 text-xs" type="submit" disabled={searching || query.trim().length < 2}>
              {searching ? <Spinner size={13} /> : <Search size={13} />} Search
            </button>
          </form>

          <div className="mt-4 space-y-2" aria-live="polite">
            {searching && <Skeleton className="h-20 w-full" />}
            {!searching && results && results.length === 0 && (
              <p className="rounded-lg border border-line/60 px-3 py-4 text-center text-xs text-ash">
                No chunks matched. Try different terms, or upload a document that covers this topic.
              </p>
            )}
            {!searching &&
              (results ?? []).map((hit, index) => (
                <div key={`${hit.document_id}-${index}`} className="rounded-lg border border-line/70 bg-white/[0.015] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-parchment/90">{hit.document_title}</p>
                    <Badge tone="gold" className="!py-0 !text-[0.55rem]">
                      score {hit.score.toFixed(2)}
                    </Badge>
                  </div>
                  <p className="mt-1.5 line-clamp-4 text-[0.72rem] leading-relaxed text-ash">{hit.chunk}</p>
                </div>
              ))}
            {!results && !searching && (
              <div className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[0.7rem] text-ash/60">
                Results appear here with the exact chunk used. Nothing is sent to an external search engine.
              </div>
            )}
          </div>
        </section>

        <section
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void uploadFiles(event.dataTransfer.files);
          }}
          className={cn(
            "panel flex flex-col items-center justify-center border-dashed p-7 text-center transition-colors",
            dragging && "border-gold/50 bg-gold/[0.04]",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void uploadFiles(event.target.files);
            }}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/25 bg-gold/[0.06] text-gold">
            {uploading ? <Spinner size={20} /> : <UploadCloud size={22} />}
          </div>
          <h2 className="mt-4 font-display text-base text-parchment">Drop files into the grimoire</h2>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-ash">
            PDF, DOCX, XLSX, PPTX, CSV, TXT, MD and JSON. Parsing happens locally on the API; files never go to a third
            party.
          </p>
          <button className="btn-ghost mt-4 !py-1.5 text-xs" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <FileText size={13} /> Choose files
          </button>
          <p className="mt-3 text-[0.62rem] text-ash/50">Maximum 20 MB per file · up to 5 attachments per message</p>
        </section>
      </div>

      <section>
        <SectionHeader
          eyebrow="Index"
          title="Documents"
          description="Every document listed here is owned by your account. Deleting one removes its chunks immediately."
        />
        <div className="panel mt-3 overflow-hidden">
          {knowledge.isLoading && (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((key) => (
                <Skeleton key={key} className="h-12 w-full" />
              ))}
            </div>
          )}
          {!knowledge.isLoading && documents.length === 0 && (
            <EmptyState
              icon={<LibraryBig size={20} />}
              title="The library is empty"
              description="Upload notes, reports, worksheets or datasets. Once indexed, ASTA can cite exact chunks from them in conversation."
              action={
                <button className="btn-primary" onClick={() => inputRef.current?.click()}>
                  <UploadCloud size={15} /> Upload your first document
                </button>
              }
            />
          )}
          <div className="divide-y divide-line/60">
            {documents.map((document) => (
              <div key={document.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <FileText size={16} className="shrink-0 text-ash/60" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm text-parchment/90">{document.title}</p>
                    <Badge
                      tone={document.status === "indexed" ? "success" : document.status === "failed" ? "danger" : "neutral"}
                      className="!py-0 !text-[0.55rem]"
                    >
                      <StatusDot status={document.status === "indexed" ? "available" : document.status} /> {document.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[0.62rem] text-ash/60">
                    {document.mime_type} · {formatBytes(document.size_bytes)} · added {relativeTime(document.created_at)}
                  </p>
                  {document.error && <p className="mt-1 text-[0.65rem] text-danger">{document.error}</p>}
                </div>
                <button
                  onClick={() => setPendingDelete(document)}
                  className="btn-quiet p-2 text-ash hover:text-danger"
                  aria-label={`Delete ${document.title}`}
                  title="Delete document"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="panel flex items-start gap-3 p-4">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-gold" />
          <div>
            <p className="text-xs font-medium text-parchment">Scoped by ownership, not prompts</p>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-ash">
              Retrieval filters in the database query, so another account cannot be asked into reading your documents.
              There is no shared organisation workspace in this release.
            </p>
          </div>
        </div>
        <div className="panel flex items-start gap-3 p-4">
          <Info size={16} className="mt-0.5 shrink-0 text-gold" />
          <div>
            <p className="text-xs font-medium text-parchment">{knowledge.data?.vector_search_enabled ? "Vector search" : "Keyword retrieval"}</p>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-ash">
              {knowledge.data?.note ??
                "Retrieval uses transparent keyword scoring scoped to your account. Vector search is enabled only when document volume justifies it."}
            </p>
            <Link
              to="/agents"
              className="mt-2 inline-flex items-center gap-1 text-[0.65rem] text-gold hover:text-parchment"
            >
              See the Researcher contract <ArrowUpRight size={11} />
            </Link>
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this document?"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setPendingDelete(null)}>
              Keep it
            </button>
            <button
              className="btn-danger"
              onClick={() => pendingDelete && deleteDocument.mutate(pendingDelete.id)}
              disabled={deleteDocument.isPending}
            >
              {deleteDocument.isPending ? <Spinner size={14} /> : <Trash2 size={14} />} Delete document
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ash">
          <span className="text-parchment">{pendingDelete?.title}</span> and its extracted chunks will be removed from
          your knowledge base. Conversations that already cite it keep their copied text, but future retrieval will not
          use it.
        </p>
      </Modal>
    </div>
  );
}
