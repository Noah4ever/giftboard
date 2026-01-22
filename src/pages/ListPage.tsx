import { useMemo, useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  addWish,
  updateList,
  deleteList,
  deleteWish,
  fetchList,
  toggleWish,
  updateWish,
} from "../api/lists";
import {
  PlusCircle,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  Tag,
  Share2,
  Link as LinkIcon,
  Tags,
  Users,
  Calendar,
} from "lucide-react";
import { io } from "socket.io-client";
import { uploadImage } from "../api/uploads";
import { WishForm } from "../components/WishForm";
import { Modal } from "../components/Modal";
import { useUserIdentity } from "../hooks/useUserIdentity";
import type { Wish } from "../types";

export default function ListPage() {
  const { code } = useParams();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { name, hasName, setNameAndReload } = useUserIdentity();
  const appBase = (import.meta.env.BASE_URL || "/") as string;
  const [editing, setEditing] = useState<Wish | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [identityPrompt, setIdentityPrompt] = useState(!hasName);
  const [identityValue, setIdentityValue] = useState(name);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState("");
  const identityRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!hasName) setIdentityPrompt(true);
  }, [hasName]);

  useEffect(() => {
    if (identityPrompt && identityRef.current) {
      const el = identityRef.current;
      const len = el.value.length;
      el.focus();
      el.setSelectionRange(len, len);
    }
  }, [identityPrompt]);

  const listQuery = useQuery({
    queryKey: ["list", code],
    queryFn: () => fetchList(code as string),
    enabled: Boolean(code),
  });

  useEffect(() => {
    if (!code) return;
    const apiBase =
      import.meta.env.VITE_API_URL ||
      (import.meta.env.DEV ? "http://localhost:4000" : "/giftboard/api");
    const socketPathEnv = import.meta.env.VITE_SOCKET_PATH;

    let socketOrigin = apiBase;
    let socketPath = socketPathEnv || "/socket.io";
    try {
      const url = new URL(apiBase, window.location.origin);
      socketOrigin = `${url.protocol}//${url.host}`;
      const prefix = url.pathname.replace(/\/$/, "");
      socketPath = socketPathEnv || `${prefix || ""}/socket.io` || "/socket.io";
    } catch (_err) {
      socketOrigin = window.location.origin;
      socketPath = socketPathEnv || "/socket.io";
    }

    const socket = io(socketOrigin, {
      path: socketPath,
    });
    socket.emit("join:list", code);
    const refresh = (payload: { code: string }) => {
      if (payload.code === code) invalidate();
    };
    socket.on("wish:add", refresh);
    socket.on("wish:update", refresh);
    socket.on("wish:delete", refresh);
    return () => {
      socket.disconnect();
    };
  }, [code]);

  const list = listQuery.data;
  const isOwner =
    list && name && list.owner.toLowerCase() === name.toLowerCase();
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");

  useEffect(() => {
    if (list) {
      setTitleDraft(list.title);
      setDescDraft(list.description || "");
    }
  }, [list]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["list", code] });

  const addMutation = useMutation({
    mutationFn: (payload: Parameters<typeof addWish>[1]) =>
      addWish(code as string, payload),
    onSuccess: () => {
      invalidate();
      setShowAddModal(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      wishId: string;
      data: Parameters<typeof updateWish>[2];
    }) => updateWish(code as string, payload.wishId, payload.data),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (wishId: string) => deleteWish(code as string, wishId),
    onSuccess: invalidate,
    onError: (err: Error) => setError(err.message),
  });

  const updateListMutation = useMutation({
    mutationFn: (payload: { title?: string; description?: string }) =>
      updateList(code as string, {
        ...payload,
        ownerName: name || "",
      }),
    onSuccess: () => {
      setSettingsOpen(false);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteListMutation = useMutation({
    mutationFn: () => deleteList(code as string, name || ""),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["list", code] });
      window.location.href = appBase;
    },
    onError: (err: Error) => setError(err.message),
  });

  const tickMutation = useMutation({
    mutationFn: (payload: { wishId: string; ticked: boolean }) =>
      toggleWish(code as string, payload.wishId, payload.ticked, name),
    onSuccess: invalidate,
    onError: (err: Error) => setError(err.message),
  });

  const sortedWishes = useMemo(() => {
    if (!list) return [];
    const priorityOrder = { high: 0, medium: 1, low: 2 } as const;
    return [...list.wishes].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }, [list]);

  const formatLink = (raw: string) => {
    try {
      const url = new URL(raw);
      const host = url.hostname.replace(/^www\./, "");
      return `${host}${url.pathname !== "/" ? url.pathname : ""}`.slice(0, 40);
    } catch (_) {
      return raw;
    }
  };

  const shareLink = () => {
    if (!list) return;
    const apiBase =
      import.meta.env.VITE_API_URL || `${window.location.origin}/giftboard/api`;
    const url = `${apiBase.replace(/\/$/, "")}/share/${list.code}`;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  const confirmIdentity = () => {
    if (!identityValue.trim()) return;
    setIdentityPrompt(false);
    setNameAndReload(identityValue);
  };

  if (listQuery.isLoading) return <p className="loading">{t("loading")}</p>;
  if (listQuery.isError)
    return <p className="error">{(listQuery.error as Error).message}</p>;
  if (!list) return null;

  const priorityBadge = (priority: Wish["priority"]) => {
    const marks = { low: "!", medium: "!!", high: "!!!" } as const;
    return (
      <span
        className={`priority-chip priority-${priority}`}
        title={priority}
        aria-label={`${priority} priority`}
      >
        <span className="priority-marks" aria-hidden>
          {marks[priority]}
        </span>
      </span>
    );
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return "";
    return `${price.toFixed(2)} €`;
  };

  const handleTick = (wishId: string, current: boolean) => {
    if (!name) {
      setError(t("addNamePrompt"));
      return;
    }
    tickMutation.mutate({ wishId, ticked: !current });
  };

  return (
    <div className="layout">
      <header className="list-header">
        <div className="list-heading">
          <div className="title-row">
            <h1>{list.title}</h1>
            <div className="list-actions">
              <button className="ghost" onClick={shareLink}>
                <Share2 size={16} /> {t("share")}
              </button>
              {isOwner ? (
                <button className="ghost" onClick={() => setSettingsOpen(true)}>
                  <Pencil size={16} /> {t("edit")}
                </button>
              ) : null}
            </div>
          </div>
          <p className="eyebrow code-line">
            {t("listCodeDisplay")}: {list.code}
          </p>
          {!isOwner ? <p className="muted small">{t("viewerNotice")}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </div>
      </header>
      {list.description ? <p className="lead">{list.description}</p> : null}
      <div className="toolbar">
        {isOwner ? (
          <button onClick={() => setShowAddModal(true)}>
            <PlusCircle size={16} /> {t("addWishButton")}
          </button>
        ) : null}
      </div>

      <section className="wishes">
        <div className="section-header">
          <h2>{t("wishes")}</h2>
        </div>
        {sortedWishes.length === 0 ? (
          <p className="muted">{t("noWishes")}</p>
        ) : null}
        <div className="wish-grid">
          {sortedWishes.map((wish) => {
            const wishIsTicked = wish.reservedCount > 0 && !isOwner;
            const showTickDetails = wishIsTicked;
            const reservedByMe = name
              ? wish.reservations?.some((r) => r.userName === name)
              : false;
            const isFull = wish.reservedCount >= wish.quantity;
            const wishClass = [
              "wish",
              !isOwner && isFull ? "wish-done" : "",
              wish.image ? "has-image" : "no-image",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <article
                key={`${wish.id}-${wish.reservedCount}`}
                className={wishClass}
              >
                {wish.image ? (
                  <div className="wish-media">
                    <img src={wish.image} alt={wish.title} />
                  </div>
                ) : null}
                <header className="wish-header">
                  <div>
                    <p className="eyebrow priority-wrapper">
                      {priorityBadge(wish.priority)}
                    </p>
                    <h3>{wish.title}</h3>
                  </div>
                  <div className="wish-actions">
                    {isOwner ? (
                      <>
                        <button
                          className="ghost"
                          onClick={() => setEditing(wish)}
                        >
                          <Pencil size={14} /> {t("editingWish")}
                        </button>
                        <button
                          className="ghost"
                          onClick={() => deleteMutation.mutate(wish.id)}
                        >
                          <Trash2 size={14} /> {t("delete")}
                        </button>
                      </>
                    ) : null}
                  </div>
                </header>
                {wish.description ? (
                  <p className="body">{wish.description}</p>
                ) : null}
                <div className="price-row">
                  {wish.price !== null ? (
                    <span className="chip price-chip">
                      <Tag size={14} /> {formatPrice(wish.price)}
                    </span>
                  ) : null}
                  {wish.priceRange ? (
                    <span className="chip price-chip">
                      <Tags size={14} /> {wish.priceRange} €
                    </span>
                  ) : null}
                </div>
                <div className="meta">
                  {wish.link ? (
                    <a
                      className="meta-item"
                      href={wish.link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <LinkIcon size={14} />
                      <span>{formatLink(wish.link)}</span>
                    </a>
                  ) : null}
                  {!isOwner ? (
                    <span className={`chip qty-chip ${isFull ? "full" : ""}`}>
                      <Users size={14} />
                      {(() => {
                        const dotCount = Math.min(wish.quantity, 6);
                        const dotWidth =
                          dotCount >= 5
                            ? 52
                            : Math.max(16, (dotCount - 1) * 10 + 16);
                        return (
                          <span
                            className="stacked-qty"
                            aria-label={t("quantity")}
                            style={{ width: `${dotWidth}px` }}
                          >
                            {Array.from({ length: dotCount }).map((_v, idx) => {
                              const reserved = idx < wish.reservedCount;
                              return (
                                <span
                                  key={idx}
                                  className={`stacked-pill ${
                                    reserved ? "reserved" : ""
                                  }`}
                                  style={{ zIndex: wish.quantity - idx }}
                                />
                              );
                            })}
                          </span>
                        );
                      })()}
                      <span>
                        {wish.reservedCount}/{wish.quantity} {t("reserved")}
                      </span>
                    </span>
                  ) : null}
                  {showTickDetails && wish.reservations?.length ? (
                    <span className="chip meta-chip">
                      <Calendar size={14} />
                      <span>
                        {t("reservedBy", {
                          name: wish.reservations
                            .map((r) => r.userName)
                            .join(", "),
                          date: new Date(
                            wish.tickedAt || ""
                          ).toLocaleDateString(),
                        })}
                      </span>
                    </span>
                  ) : null}
                </div>
                {!isOwner ? (
                  <div className="wish-footer">
                    <button
                      className="reserve-btn"
                      disabled={!name || (isFull && !reservedByMe)}
                      onClick={() => handleTick(wish.id, reservedByMe)}
                    >
                      {reservedByMe ? (
                        <>
                          <Circle size={16} /> {t("untick")}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} /> {t("tick")}
                        </>
                      )}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <Modal
        open={showAddModal}
        title={t("modalTitleAdd")}
        onClose={() => setShowAddModal(false)}
      >
        <WishForm
          onSubmit={(payload) => addMutation.mutate(payload)}
          submitLabel={
            addMutation.isPending ? t("createSubmitting") : t("addWish")
          }
          onCancel={() => setShowAddModal(false)}
          onUpload={uploadImage}
          isSubmitting={addMutation.isPending}
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        title={t("modalTitleEdit")}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <WishForm
            initial={editing}
            onSubmit={(payload) =>
              updateMutation.mutate({
                wishId: editing.id,
                data: { ...payload },
              })
            }
            onCancel={() => setEditing(null)}
            submitLabel={
              updateMutation.isPending ? t("saveChanges") : t("saveChanges")
            }
            onUpload={uploadImage}
            isSubmitting={updateMutation.isPending}
          />
        ) : null}
      </Modal>

      <Modal
        open={identityPrompt}
        title={t("identityTitle")}
        onClose={() => setIdentityPrompt(false)}
      >
        <div className="stack">
          <p className="hint">{t("identityHint")}</p>
          <input
            ref={identityRef}
            value={identityValue}
            onChange={(e) => setIdentityValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmIdentity();
              }
            }}
            placeholder={t("identityPlaceholder")}
          />
          <div className="actions">
            <button
              className="ghost"
              type="button"
              onClick={() => setIdentityPrompt(false)}
            >
              {t("cancel")}
            </button>
            <button type="button" onClick={confirmIdentity}>
              OK
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={settingsOpen}
        title={t("modalTitleEdit")}
        onClose={() => setSettingsOpen(false)}
      >
        <div className="stack">
          <label className="field">
            <span>{t("listName")}</span>
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t("description")}</span>
            <textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              rows={3}
            />
          </label>
          <div className="actions">
            <button
              type="button"
              className="ghost"
              onClick={() => setSettingsOpen(false)}
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={() =>
                updateListMutation.mutate({
                  title: titleDraft.trim() || list.title,
                  description: descDraft,
                })
              }
              disabled={updateListMutation.isPending}
            >
              {updateListMutation.isPending ? t("loading") : t("saveChanges")}
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (window.confirm(t("confirmDeleteList") || "Delete list?")) {
                  deleteListMutation.mutate();
                }
              }}
              disabled={deleteListMutation.isPending}
            >
              {t("delete")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
