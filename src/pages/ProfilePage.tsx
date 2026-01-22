import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Share2, Pencil, Trash2, Gift } from "lucide-react";
import { fetchOwnedLists, updateList, deleteList } from "../api/lists";
import type { WishList } from "../types";
import { useUserIdentity } from "../hooks/useUserIdentity";
import { Modal } from "../components/Modal";

function Avatar({ name }: { name?: string | null }) {
  const letter = name?.trim()?.charAt(0)?.toUpperCase() || "?";
  return (
    <div className="avatar">
      <span>{letter}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { name, hasName, setNameAndReload } = useUserIdentity();
  const [identityValue, setIdentityValue] = useState(name);
  const [identityPrompt, setIdentityPrompt] = useState(!hasName);
  const [selected, setSelected] = useState<WishList | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");

  useEffect(() => {
    if (!hasName) setIdentityPrompt(true);
  }, [hasName]);

  const listsQuery = useQuery({
    queryKey: ["ownedLists", name],
    queryFn: () => fetchOwnedLists(name as string),
    enabled: Boolean(name),
  });

  const shareLink = (code: string) => {
    const apiBase =
      import.meta.env.VITE_API_URL || `${window.location.origin}/giftboard/api`;
    const url = `${apiBase.replace(/\/$/, "")}/share/${code}`;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  const updateListMutation = useMutation({
    mutationFn: (payload: { title?: string; description?: string }) =>
      updateList(selected!.code, {
        ...payload,
        ownerName: name || "",
      }),
    onSuccess: () => {
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["ownedLists", name] });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: (code: string) => deleteList(code, name || ""),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ownedLists", name] });
      queryClient.removeQueries({ queryKey: ["list", variables] });
    },
  });

  const openList = (code: string) => navigate(`/lists/${code}`);

  const sorted = useMemo(() => {
    return (listsQuery.data || []).slice().sort((a, b) => {
      return (a.createdAt || "").localeCompare(b.createdAt || "");
    });
  }, [listsQuery.data]);

  const confirmIdentity = () => {
    if (!identityValue?.trim()) return;
    setIdentityPrompt(false);
    setNameAndReload(identityValue.trim());
  };

  return (
    <div className="layout">
      <header className="page-header">
        <div className="profile-header">
          <Avatar name={name} />
          <div>
            <p className="eyebrow">Profile</p>
            <h1>{name || "Set your name"}</h1>
            <p className="muted">Manage your giftboards</p>
          </div>
        </div>
        <div className="top-actions">
          <button onClick={() => navigate("/create")}>
            <Gift size={16} /> New Giftboard
          </button>
        </div>
      </header>

      {listsQuery.isLoading ? <p className="loading">{t("loading")}</p> : null}
      {listsQuery.isError ? (
        <p className="error">{(listsQuery.error as Error).message}</p>
      ) : null}

      {sorted.length === 0 && !listsQuery.isLoading ? (
        <p className="muted">No giftboards yet.</p>
      ) : null}

      <div className="grid two-col">
        {sorted.map((list) => (
          <div key={list.id} className="card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Code: {list.code}</p>
                <h3>{list.title}</h3>
                {list.description ? (
                  <p className="muted small">{list.description}</p>
                ) : null}
              </div>
              <div className="card-actions">
                <button className="ghost" onClick={() => shareLink(list.code)}>
                  <Share2 size={14} /> Share
                </button>
                <button
                  className="ghost"
                  onClick={() => {
                    setSelected(list);
                    setTitleDraft(list.title);
                    setDescDraft(list.description || "");
                  }}
                >
                  <Pencil size={14} /> Edit
                </button>
              </div>
            </div>
            <div className="card-footer">
              <button onClick={() => openList(list.code)}>Open</button>
              <button className="ghost" onClick={() => shareLink(list.code)}>
                Copy link
              </button>
              <button
                className="ghost"
                onClick={() => deleteListMutation.mutate(list.code)}
                disabled={deleteListMutation.isPending}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={identityPrompt}
        title={t("identityTitle")}
        onClose={() => setIdentityPrompt(false)}
      >
        <div className="stack">
          <p className="hint">Set your display name to manage your boards.</p>
          <input
            value={identityValue}
            onChange={(e) => setIdentityValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmIdentity();
              }
            }}
            placeholder="Your name"
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
        open={Boolean(selected)}
        title="Edit giftboard"
        onClose={() => setSelected(null)}
      >
        <div className="stack">
          <label className="field">
            <span>Title</span>
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Description</span>
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
              onClick={() => setSelected(null)}
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={() =>
                updateListMutation.mutate({
                  title: titleDraft.trim() || selected?.title,
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
                if (selected) {
                  deleteListMutation.mutate(selected.code);
                  setSelected(null);
                }
              }}
              disabled={deleteListMutation.isPending}
            >
              <Trash2 size={14} /> {t("delete")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
