import { Suspense } from "react";

import { LoginForm } from "../../components/login-form";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-shell">
        <div className="login-copy">
          <div className="brand login-brand">
            <span>Frame First</span>
          </div>
          <p>Local workspace access</p>
        </div>
        <Suspense fallback={<div className="card login-card"><div className="card-body">Loading</div></div>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
