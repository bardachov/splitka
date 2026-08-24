import CreateGroupForm from "@/components/CreateGroupForm";
import MyGroups from "@/components/MyGroups";

export default function Home() {
  return (
    <main className="container">
      <div style={{ marginTop: 24 }}>
        <span className="brand">
          <span className="logo">₴</span> Splitka
        </span>
      </div>
      <h1>Ділимо витрати без зайвого клопоту</h1>
      <p className="sub">
        Спрощена версія Splitwise. Без реєстрації: створіть групу, скиньте лінк
        друзям — кожен заходить просто за своїм ім&apos;ям.
      </p>
      <MyGroups />
      <CreateGroupForm />
      <p className="footer-note">
        Групу видно всім, хто має лінк. Ім&apos;я — ваш єдиний ключ у групі.
      </p>
    </main>
  );
}
