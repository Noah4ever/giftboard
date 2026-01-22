import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlusCircle } from "lucide-react";
import { createList } from "../api/lists";
import { useUserIdentity } from "../hooks/useUserIdentity";

export default function CreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { name, setName, hasName } = useUserIdentity();
  const [listName, setListName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [owner, setOwner] = useState(name);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: createList,
    onSuccess: (list) => {
      setName(owner);
      navigate(`/lists/${list.code}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!listName.trim() || !(owner || "").trim()) return;
    mutation.mutate({
      title: listName.trim(),
      ownerName: (owner || "").trim(),
      code: code.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="layout narrow">
      <header className="page-header">
        <p className="eyebrow">{t("createTitle")}</p>
        <h1>{t("heroTitle")}</h1>
        <p className="lead">{t("createDescription")}</p>
        {error ? <p className="error">{error}</p> : null}
      </header>

      <section className="card">
        <form className="stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>{t("listName")}</span>
            <input
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="Winter gifts"
              required
            />
          </label>
          <label className="field">
            <span>{t("listCode")}</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="winter-2026"
            />
          </label>
          <label className="field">
            <span>{t("description")}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("createDescriptionPlaceholder", {
                defaultValue: "What this list is about",
              })}
              rows={3}
            />
          </label>
          {!hasName && (
            <label className="field">
              <span>{t("nameLabel")}</span>
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder={t("identityPlaceholder")}
                required
              />
            </label>
          )}
          <button type="submit" disabled={mutation.isPending}>
            <PlusCircle size={16} />
            {mutation.isPending ? t("createSubmitting") : t("createSubmit")}
          </button>
        </form>
      </section>
    </div>
  );
}
