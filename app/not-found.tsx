import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container">
      <div className="empty" style={{ marginTop: 60 }}>
        <div className="big">🤷</div>
        <h1 style={{ fontSize: 22 }}>Групу не знайдено</h1>
        <p className="sub">
          Можливо, лінк неповний або групу було видалено.
        </p>
        <Link href="/" className="btn secondary" style={{ display: "inline-flex", width: "auto", textDecoration: "none" }}>
          Створити нову групу
        </Link>
      </div>
    </main>
  );
}
