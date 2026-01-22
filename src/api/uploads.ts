export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(
    `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/upload`,
    {
      method: "POST",
      body: form,
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.message || "Upload failed";
    throw new Error(message);
  }

  const data = await response.json();
  return data.url as string;
}
