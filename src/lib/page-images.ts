// Share downloads and decoding between the reader, text compositor and turning leaf.
type PageImage = { image: HTMLImageElement; ready: Promise<HTMLImageElement> };
const images = new Map<string, PageImage>();
const MAX_IMAGES = 12;

export function pageImage(url: string, priority: "high" | "low" | "auto" = "auto"): PageImage {
  const cached = images.get(url);
  if (cached) {
    images.delete(url);
    images.set(url, cached);
    if (priority === "high") cached.image.fetchPriority = "high";
    return cached;
  }
  const image = new Image();
  image.decoding = "async";
  image.fetchPriority = priority;
  const ready = new Promise<HTMLImageElement>((resolve, reject) => {
    let attempts = 0;
    image.onload = () => {
      Promise.resolve(image.decode?.()).catch(() => {}).then(() => {
        if (image.naturalWidth) resolve(image);
        else reject(new Error(`Couldn't decode ${url}`));
      });
    };
    image.onerror = () => {
      if (++attempts <= 2) setTimeout(() => { image.src = url; }, attempts * 300);
      else reject(new Error(`Couldn't load ${url}`));
    };
    image.src = url;
  });
  const entry = { image, ready };
  images.set(url, entry);
  ready.catch(() => { if (images.get(url) === entry) images.delete(url); });
  while (images.size > MAX_IMAGES) images.delete(images.keys().next().value!);
  return entry;
}

export function loadPageImage(url: string): Promise<HTMLImageElement> {
  return pageImage(url, "high").ready;
}
