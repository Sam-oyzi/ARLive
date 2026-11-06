import { QRCodeSVG } from "qrcode.react";

type Guide = {
  heading: string;
  steps: [string, string, string];
  read: string;
  qr: string;
};

const GUIDES: Record<string, Guide> = {
  en: {
    heading: "How to use this book",
    steps: ["Scan this QR code with your phone camera and open the link.", "Tap Start scanning and allow camera access.", "Point your phone at a page marked AR. If a floor ring appears, aim it where you want to enter and tap to confirm."],
    read: "Scan this QR code with your phone camera, then open the link to read the book.",
    qr: "Scan to open",
  },
  fr: {
    heading: "Comment utiliser ce livre",
    steps: ["Scannez ce QR code avec l’appareil photo de votre téléphone, puis ouvrez le lien.", "Lancez le scanner et autorisez l’accès à l’appareil photo.", "Visez une page marquée AR. Si un cercle apparaît au sol, visez l’endroit où vous souhaitez entrer, puis touchez l’écran pour confirmer."],
    read: "Scannez ce QR code avec l’appareil photo de votre téléphone, puis ouvrez le lien pour lire le livre.",
    qr: "Scannez pour ouvrir",
  },
  ar: {
    heading: "كيف تستخدم هذا الكتاب؟",
    steps: ["امسح رمز الاستجابة السريعة بكاميرا هاتفك، ثم افتح الرابط.", "ابدأ المسح واسمح بالوصول إلى الكاميرا.", "وجّه هاتفك نحو صفحة تحمل علامة AR. إذا ظهرت حلقة على الأرض، وجّهها إلى المكان الذي تريد الدخول منه واضغط للتأكيد."],
    read: "امسح رمز الاستجابة السريعة بكاميرا هاتفك، ثم افتح الرابط لقراءة الكتاب.",
    qr: "امسح الرمز للفتح",
  },
  es: {
    heading: "Cómo usar este libro",
    steps: ["Escanea este código QR con la cámara del teléfono y abre el enlace.", "Inicia el escáner y permite el acceso a la cámara.", "Apunta a una página marcada con AR. Si aparece un círculo en el suelo, apunta al lugar donde quieras entrar y toca la pantalla para confirmar."],
    read: "Escanea este código QR con la cámara del teléfono y abre el enlace para leer el libro.",
    qr: "Escanea para abrir",
  },
  de: {
    heading: "So benutzt du dieses Buch",
    steps: ["Scanne diesen QR-Code mit der Handykamera und öffne den Link.", "Starte den Scanner und erlaube den Kamerazugriff.", "Richte das Handy auf eine mit AR markierte Seite. Wenn ein Ring auf dem Boden erscheint, wähle den Einstiegspunkt und tippe zum Bestätigen."],
    read: "Scanne diesen QR-Code mit der Handykamera und öffne den Link, um das Buch zu lesen.",
    qr: "Zum Öffnen scannen",
  },
};

export function PrintGuide({ language, title, width, height, qrUrl, ar }: {
  language: string;
  title: string;
  width: string;
  height: string;
  qrUrl: string;
  ar: boolean;
}) {
  const base = language.split("-")[0]?.toLowerCase() ?? "";
  const localized = Object.hasOwn(GUIDES, base);
  const guide = localized ? GUIDES[base]! : GUIDES.en!;
  const rtl = base === "ar";
  return (
    <section
      className="sheet hidden bg-white text-[#2b2118] [container-type:inline-size] print:block"
      style={{ width, height, fontFamily: "var(--font-story), var(--font-arabic), Georgia, serif" }}
      lang={localized ? language : "en"}
      dir={rtl ? "rtl" : "ltr"}
      aria-label={guide.heading}
    >
      <div className="flex h-full flex-col items-center justify-center px-[10cqw] py-[8cqw]">
        <p className="mb-[3cqw] text-center text-[3.5cqw] leading-snug text-[#6e5540]"><bdi lang={language || "en"}>{title}</bdi></p>
        <h1 className="text-center text-[7cqw] leading-tight font-semibold">{guide.heading}</h1>
        <div className="my-[5cqw] flex flex-col items-center gap-[1.5cqw]">
          <QRCodeSVG value={qrUrl} marginSize={4} bgColor="#ffffff" fgColor="#18120d" style={{ width: "31cqw", height: "31cqw" }} />
          <p className="text-[3.4cqw] font-semibold">{guide.qr}</p>
        </div>
        {ar ? (
          <ol className="grid w-full gap-[3cqw] ps-[5cqw] text-[4cqw] leading-snug [list-style:decimal]">
            {guide.steps.map((step) => <li key={step} className="ps-[1.4cqw]">{step}</li>)}
          </ol>
        ) : <p className="text-center text-[4cqw] leading-snug">{guide.read}</p>}
      </div>
    </section>
  );
}
