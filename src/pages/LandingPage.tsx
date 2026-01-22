import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PlusCircle, LogIn } from "lucide-react";
export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="layout">
      <header className="hero minimal single">
        <div>
          <p className="eyebrow">{t("heroSubtitle")}</p>
          <h1>{t("heroTitle")}</h1>
          <p className="lead">{t("heroLead")}</p>
        </div>
      </header>

      <section className="grid two-col">
        <article className="action-card">
          <h3>{t("createTitle")}</h3>
          <p>{t("createDescription")}</p>
          <button
            className="action-primary"
            onClick={() => navigate("/create")}
          >
            <PlusCircle size={18} /> {t("createSubmit")}
          </button>
        </article>
        <article className="action-card">
          <h3>{t("joinTitle")}</h3>
          <p>{t("joinDescription")}</p>
          <button
            className="action-secondary"
            onClick={() => navigate("/join")}
          >
            <LogIn size={18} /> {t("joinSubmit")}
          </button>
        </article>
      </section>
    </div>
  );
}
