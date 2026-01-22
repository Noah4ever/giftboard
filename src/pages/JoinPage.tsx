import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogIn } from "lucide-react";
import { fetchList } from "../api/lists";
import { useUserIdentity } from "../hooks/useUserIdentity";

export default function JoinPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { name, setName, hasName } = useUserIdentity();
  const [code, setCode] = useState("");
  const [userName, setUserName] = useState(name);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (value: string) => fetchList(value),
    onSuccess: (_, value) => {
      setName(userName);
      navigate(`/lists/${value}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!code.trim() || !(userName || "").trim()) return;
    mutation.mutate(code.trim());
  };

  return (
    <div className="layout narrow">
      <header className="page-header">
        <p className="eyebrow">{t("joinTitle")}</p>
        <h1>{t("heroTitle")}</h1>
        <p className="lead">{t("joinDescription")}</p>
        {error ? <p className="error">{error}</p> : null}
      </header>

      <section className="card">
        <form className="stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>{t("listCodeLabel")}</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="winter-2026"
              required
            />
          </label>
          {!hasName && (
            <label className="field">
              <span>{t("nameLabel")}</span>
              <input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder={t("identityPlaceholder")}
                required
              />
            </label>
          )}
          <button type="submit" disabled={mutation.isPending}>
            <LogIn size={16} />
            {mutation.isPending ? t("joinSubmitting") : t("joinSubmit")}
          </button>
        </form>
      </section>
    </div>
  );
}
