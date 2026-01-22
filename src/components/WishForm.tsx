import { useEffect, useRef, useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { Tag, Image as ImageIcon, ArrowLeftRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WishPriority, Wish } from "../types";
import { apiFetch } from "../api/client";

interface WishFormProps {
  initial?: Partial<Wish>;
  onSubmit: (payload: {
    title: string;
    priority: WishPriority;
    description: string;
    link?: string;
    image?: string;
    price?: number | null;
    priceRange?: string;
    quantity?: number;
  }) => void;
  onCancel?: () => void;
  submitLabel?: string;
  onUpload?: (file: File) => Promise<string>;
  isSubmitting?: boolean;
}

const PRIORITIES: WishPriority[] = ["low", "medium", "high"];
const PRIORITY_MARKS: Record<WishPriority, string> = {
  low: "!",
  medium: "!!",
  high: "!!!",
};

export function WishForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  onUpload,
  isSubmitting,
}: WishFormProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title || "");
  const [priority, setPriority] = useState<WishPriority>(
    initial?.priority || "medium"
  );
  const [description, setDescription] = useState(initial?.description || "");
  const [link, setLink] = useState(initial?.link || "");
  const [imageUrl, setImageUrl] = useState(initial?.image || "");
  const [priceInput, setPriceInput] = useState(
    initial?.price !== null && initial?.price !== undefined
      ? String(initial.price)
      : ""
  );
  const [priceRange, setPriceRange] = useState(initial?.priceRange || "");
  const [quantityInput, setQuantityInput] = useState(
    initial?.quantity ? String(initial.quantity) : "1"
  );
  const [lastPriceField, setLastPriceField] = useState<"price" | "range">(
    initial?.priceRange ? "range" : "price"
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(initial?.image || "");
  const [uploadError, setUploadError] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const lastFetchedAmazonLink = useRef("");
  const isEditing = Boolean((initial as Wish | undefined)?.id);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setImageUrl("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    let imageValue = imageUrl.trim() || preview || "";

    const parsePrice = (raw: string) => {
      if (!raw.trim()) return null;
      const num = Number(raw.replace(/,/g, "."));
      return Number.isNaN(num) ? null : num;
    };
    const price = parsePrice(priceInput);
    const rangeTrim = priceRange.trim();
    let finalPrice: number | null = null;
    let finalRange: string | undefined = undefined;

    if (lastPriceField === "price") {
      finalPrice = price;
      finalRange = undefined;
    } else {
      finalPrice = null;
      finalRange = rangeTrim || undefined;
    }
    const quantity = Math.max(1, Number(quantityInput) || 1);

    if (file && onUpload) {
      setUploading(true);
      setUploadError("");
      try {
        imageValue = await onUpload(file);
      } catch (_err) {
        setUploadError(t("uploadError"));
        setUploading(false);
        return;
      }
      setUploading(false);
    } else if (!file) {
      imageValue = imageUrl.trim();
    }

    onSubmit({
      title: title.trim(),
      priority,
      description: description.trim(),
      link: link.trim() || undefined,
      image: imageValue || undefined,
      price: finalPrice,
      priceRange: finalRange,
      quantity,
    });

    if (!initial) {
      setTitle("");
      setDescription("");
      setImageUrl("");
      setFile(null);
      setPreview("");
      setPriority("medium");
      setPriceInput("");
      setPriceRange("");
      setQuantityInput("1");
      setLastPriceField("price");
    }
  };

  const clearImage = () => {
    setFile(null);
    setPreview("");
    setImageUrl("");
  };

  const fetchProductMeta = async (options: {
    wantPrice: boolean;
    wantImage: boolean;
  }) => {
    if (!link.trim()) return;
    if (options.wantPrice) setPriceLoading(true);
    if (options.wantImage) setImageLoading(true);
    try {
      const { price: fetchedPrice, image } = await apiFetch<{
        price: number | null;
        image: string | null;
      }>(`/price?url=${encodeURIComponent(link)}`);
      if (
        options.wantPrice &&
        fetchedPrice !== null &&
        !Number.isNaN(fetchedPrice)
      ) {
        setPriceInput(String(fetchedPrice));
        setLastPriceField("price");
      }
      if (options.wantImage && image && !file) {
        setImageUrl(image);
        setPreview((prev) => prev || image);
      }
    } catch (_err) {
      // ignore
    }
    if (options.wantPrice) setPriceLoading(false);
    if (options.wantImage) setImageLoading(false);
  };

  useEffect(() => {
    if (isEditing) return; // don't auto-fetch while editing existing wishes
    const normalized = link.trim();
    if (!normalized) return;
    if (file) return;
    if (lastFetchedAmazonLink.current === normalized) return;
    lastFetchedAmazonLink.current = normalized;
    fetchProductMeta({ wantPrice: true, wantImage: true });
  }, [file, link, isEditing]);

  return (
    <form className="wish-form" onSubmit={handleSubmit}>
      <div className="field-group">
        <label>{t("titleLabel")}</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("wishTitlePlaceholder")}
          required
        />
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>{t("priority")}</label>
          <div className="pill-group">
            {PRIORITIES.map((value) => (
              <button
                key={value}
                type="button"
                className={
                  value === priority
                    ? `pill pill-active priority-${value}`
                    : `pill priority-${value}`
                }
                onClick={() => setPriority(value)}
              >
                <span className="priority-marks" aria-hidden>
                  {PRIORITY_MARKS[value]}
                </span>
                <span className="sr-only">{value}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="field-group">
          <label>{t("optionalLink")}</label>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://"
            disabled={Boolean(file)}
          />
          {link.trim() ? (
            <div className="link-actions">
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  fetchProductMeta({ wantPrice: true, wantImage: false })
                }
                disabled={priceLoading}
              >
                <Tag size={14} />{" "}
                {priceLoading ? t("loading") : t("fetchPrice")}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  fetchProductMeta({ wantPrice: false, wantImage: true })
                }
                disabled={imageLoading}
              >
                <ImageIcon size={14} />{" "}
                {imageLoading ? t("loading") : t("fetchImage")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>{t("description")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Details to help others pick the right gift"
          />
        </div>
        <div className="field-group">
          <label>{t("imageUpload")}</label>
          <input type="file" accept="image/*" onChange={handleFile} />
          <label>{t("imageUrl")}</label>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://"
            disabled={Boolean(file)}
          />
          {uploadError ? <p className="error">{uploadError}</p> : null}
          {preview ? (
            <div className="image-preview">
              <img src={preview} alt="preview" />
              <button type="button" className="ghost" onClick={clearImage}>
                {t("remove")}
              </button>
            </div>
          ) : null}
        </div>
        <div className="field-group">
          <div className="dual-inputs">
            <div className="field-group">
              <label className="label-with-icon price-label">
                <Tag size={14} /> {t("price")}
              </label>
              <input
                inputMode="decimal"
                value={priceInput}
                onChange={(e) => {
                  setPriceInput(e.target.value);
                  setLastPriceField("price");
                }}
                placeholder="19,99"
              />
            </div>
            <div className="field-group">
              <label className="label-with-icon price-label">
                <ArrowLeftRight size={14} /> {t("priceRange")}
              </label>
              <input
                className="price-range-input"
                inputMode="text"
                value={priceRange}
                onChange={(e) => {
                  setPriceRange(e.target.value);
                  setLastPriceField("range");
                }}
                placeholder="15-25"
              />
            </div>
          </div>
          <label>{t("quantity")}</label>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={quantityInput}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
              setQuantityInput(digitsOnly);
            }}
            placeholder="1"
          />
        </div>
      </div>
      <div className="actions">
        {onCancel ? (
          <button type="button" className="ghost" onClick={onCancel}>
            {t("cancel")}
          </button>
        ) : null}
        <button type="submit" disabled={uploading || isSubmitting}>
          {uploading ? t("uploading") : submitLabel || t("addWish")}
        </button>
      </div>
    </form>
  );
}
